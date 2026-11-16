import 'server-only'
import { rows, sql } from '@/lib/db'
import { botToken, callBot } from '@/lib/telegram-mirror'
import { ensureHubTables, getHub, modLog } from '@/lib/tg-hub'
import { MEMBER_DROP_FLOOR } from '@/lib/tg-hub-shared'
import { STATS_SPANS, type StatsDay, type TgStats } from '@/lib/tg-resilience-shared'
import { claimAlert as claim, ensureShieldTables } from '@/lib/tg-shield'

const CHECK_EVERY_MIN = 60
const UNREACHABLE_ALERT_MIN = 6 * 60
const DROP_ALERT_MIN = 12 * 60
const KEEP_DAYS = 60
const TR_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

let ready: Promise<void> | null = null
export function ensurePulseTables() {
  ready ??= (async () => {
    await ensureHubTables()
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_chat_pulse (
      chat_id text NOT NULL, at timestamptz NOT NULL DEFAULT now(), members int NOT NULL, PRIMARY KEY (chat_id, at))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_day_counts (
      chat_id text NOT NULL, day date NOT NULL, leaves int NOT NULL DEFAULT 0, PRIMARY KEY (chat_id, day))`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

/** Turkey has no daylight saving, so its calendar day is UTC shifted by three hours. */
const TR_DAY = sql`(((now() AT TIME ZONE 'UTC') + interval '3 hours')::date)`

export async function countLeave(chatId: string) {
  await ensurePulseTables()
  await rows(sql`INSERT INTO tg_day_counts (chat_id, day, leaves) VALUES (${chatId}, ${TR_DAY}, 1)
    ON CONFLICT (chat_id, day) DO UPDATE SET leaves = tg_day_counts.leaves + 1`)
}

/** Telegram answered and said no: the bot is out, or the chat is gone. A timeout or a rate limit is neither. */
function refused(error: unknown) {
  const code = Number((error as { code?: number }).code)
  return code === 400 || code === 403
}

/**
 * Hourly, from the visitor-driven tick: asks Telegram how many members each protected chat has.
 * Raises an alarm when a chat can no longer be reached or lost a large share of its members in a day.
 */
export async function checkChatHealth() {
  const hub = await getHub()
  if (!hub.guard.enabled || !hub.guardBotId || !hub.shield.healthAlert || !hub.groups.length) return
  if (!(await claim('chat_health_checked', CHECK_EVERY_MIN))) return
  await ensurePulseTables()
  const token = await botToken(hub.guardBotId)
  const percent = hub.shield.memberDropPercent
  for (const g of hub.groups) {
    let members: number
    try {
      members = Number(await callBot<number>(token, 'getChatMemberCount', { chat_id: g.chatId }))
    } catch (error) {
      if (refused(error) && (await claim(`chat_unreachable_${g.chatId}`, UNREACHABLE_ALERT_MIN))) {
        await modLog({
          chatId: g.chatId,
          chatTitle: g.title,
          action: 'Sohbete erişilemiyor',
          reason: `Telegram, Bekçi botuna bu sohbet için cevap vermedi (${String((error as Error).message).slice(0, 120)}). Bot çıkarılmış, sohbet silinmiş ya da Telegram tarafından kısıtlanmış olabilir. Sohbet duruyorsa botu yeniden yönetici yap; durmuyorsa Dayanıklılık ekranından yeni kanal adresine geç.`,
        })
      }
      continue
    }
    if (!Number.isFinite(members)) continue
    const [before] = await rows<{ peak: number | null }>(sql`SELECT max(members) AS peak FROM tg_chat_pulse WHERE chat_id = ${g.chatId} AND at > now() - interval '24 hours'`)
    await rows(sql`INSERT INTO tg_chat_pulse (chat_id, members) VALUES (${g.chatId}, ${members}) ON CONFLICT DO NOTHING`)
    const peak = before?.peak == null ? null : Number(before.peak)
    if (peak == null || percent <= 0) continue
    const lost = peak - members
    if (lost < MEMBER_DROP_FLOOR || (lost / peak) * 100 < percent) continue
    if (!(await claim(`chat_drop_${g.chatId}`, DROP_ALERT_MIN))) continue
    await modLog({
      chatId: g.chatId,
      chatTitle: g.title,
      action: 'Üye sayısı düştü',
      reason: `Son 24 saatte ${peak} üyeden ${members} üyeye indi (${lost} kişi, %${Math.round((lost / peak) * 100)}; alarm sınırı %${percent}). Toplu çıkış, Telegram'ın sahte hesap temizliği ya da kanalın bir bölgede kısıtlanması olabilir.`,
    })
  }
}

const PURGE_EVERY_MS = 6 * 60 * 60_000
let lastPurge = 0

export async function purgePulse() {
  if (Date.now() - lastPurge < PURGE_EVERY_MS) return
  lastPurge = Date.now()
  await ensurePulseTables()
  await rows(sql`DELETE FROM tg_chat_pulse WHERE at < now() - make_interval(days => ${KEEP_DAYS})`)
  await rows(sql`DELETE FROM tg_day_counts WHERE day < ${TR_DAY} - ${KEEP_DAYS}::int`)
}

// --- Statistics --------------------------------------------------------------------

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * Read on request only: it scans the message and join history of the chosen period. Messages and joins
 * are kept for 35 days, so 30 days is the longest period that is always complete.
 */
export async function loadTgStats(chatId: string, days: number): Promise<TgStats> {
  const hub = await getHub()
  const span = STATS_SPANS.includes(days as (typeof STATS_SPANS)[number]) ? days : STATS_SPANS[0]
  const chats = hub.groups.map((g) => ({ chatId: g.chatId, title: g.title }))
  const one = chats.find((c) => c.chatId === String(chatId))
  const ids = one ? [one.chatId] : chats.map((c) => c.chatId)

  const trNow = Date.now() + TR_OFFSET_MS
  const firstDayMs = Math.floor(trNow / DAY_MS) * DAY_MS - (span - 1) * DAY_MS
  const dayKeys = Array.from({ length: span }, (_, i) => dayOf(firstDayMs + i * DAY_MS))
  const empty: TgStats = {
    span,
    chatId: one?.chatId ?? '',
    days: dayKeys.map((day) => ({ day, messages: 0, joins: 0, removed: 0, leaves: 0, members: null })),
    hours: Array.from({ length: 24 }, () => 0),
    writers: 0,
    chats,
  }
  if (!ids.length) return empty

  await ensurePulseTables()
  await ensureShieldTables()
  const since = new Date(firstDayMs - TR_OFFSET_MS).toISOString()
  const trDay = (column: 'created_at' | 'joined_at' | 'at') => sql`to_char((${sql.raw(column)} AT TIME ZONE 'UTC') + interval '3 hours', 'YYYY-MM-DD')`

  const [messages, hours, writers, joins, leaves, members] = await Promise.all([
    rows<{ day: string; n: string }>(sql`SELECT ${trDay('created_at')} AS day, count(*) AS n FROM tg_guard_msgs
      WHERE chat_id IN ${ids} AND created_at >= ${since}::timestamptz GROUP BY 1`),
    rows<{ h: number; n: string }>(sql`SELECT extract(hour FROM (created_at AT TIME ZONE 'UTC') + interval '3 hours')::int AS h, count(*) AS n FROM tg_guard_msgs
      WHERE chat_id IN ${ids} AND created_at >= ${since}::timestamptz GROUP BY 1`),
    rows<{ n: string }>(sql`SELECT count(DISTINCT tg_id) AS n FROM tg_guard_msgs WHERE chat_id IN ${ids} AND created_at >= ${since}::timestamptz`),
    rows<{ day: string; n: string; removed: string }>(sql`SELECT ${trDay('joined_at')} AS day, count(*) AS n, count(*) FILTER (WHERE removed) AS removed FROM tg_join_log
      WHERE chat_id IN ${ids} AND joined_at >= ${since}::timestamptz GROUP BY 1`),
    rows<{ day: string; n: string }>(sql`SELECT to_char(day, 'YYYY-MM-DD') AS day, sum(leaves) AS n FROM tg_day_counts
      WHERE chat_id IN ${ids} AND day >= ${dayKeys[0]}::date GROUP BY 1`),
    // A member count only means something for one chat; adding a channel to its own comment group would count people twice.
    one
      ? rows<{ day: string; members: number }>(sql`SELECT DISTINCT ON (day) ${trDay('at')} AS day, members FROM tg_chat_pulse
          WHERE chat_id = ${one.chatId} AND at >= ${since}::timestamptz ORDER BY day, at DESC`)
      : Promise.resolve([]),
  ])

  const byDay = new Map<string, StatsDay>(empty.days.map((d) => [d.day, d]))
  for (const r of messages) if (byDay.has(r.day)) byDay.get(r.day)!.messages = Number(r.n)
  for (const r of joins) {
    const d = byDay.get(r.day)
    if (d) {
      d.joins = Number(r.n)
      d.removed = Number(r.removed)
    }
  }
  for (const r of leaves) if (byDay.has(r.day)) byDay.get(r.day)!.leaves = Number(r.n)
  for (const r of members) if (byDay.has(r.day)) byDay.get(r.day)!.members = Number(r.members)
  for (const r of hours) if (r.h >= 0 && r.h < 24) empty.hours[Number(r.h)] = Number(r.n)
  empty.writers = Number(writers[0]?.n ?? 0)
  return empty
}
