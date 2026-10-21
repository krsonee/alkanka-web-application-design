import 'server-only'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { botToken, callBot, ensureTables, normalizeChat } from '@/lib/telegram-mirror'
import { DEFAULT_HUB, type BroadcastRow, type HubConfig, type HubLogRow, type HubStats, type LeaderRow } from '@/lib/tg-hub-shared'
import type { TgMessage } from '@/lib/telegram-chat'

export type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string }
export type TgCallback = { id: string; from: TgUser; data?: string; message?: TgMessage }
export type TgJoinRequest = { chat: { id: number; title?: string }; from: TgUser; user_chat_id?: number; date: number }
export type HubUpdate = {
  update_id: number
  message?: TgMessage
  edited_message?: TgMessage
  channel_post?: TgMessage
  callback_query?: TgCallback
  chat_join_request?: TgJoinRequest
}

const HUB_KEY = 'hub_config'
const HOOK_UPDATES = ['message', 'edited_message', 'channel_post', 'callback_query', 'chat_join_request']

let ready: Promise<void> | null = null
export function ensureHubTables() {
  ready ??= (async () => {
    await ensureTables()
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_mod_log (
      id serial PRIMARY KEY, chat_id text, chat_title text, tg_id bigint, who text, action text NOT NULL, reason text,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tg_mod_log_time_idx ON tg_mod_log (created_at DESC)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_warns (tg_id bigint PRIMARY KEY, count int NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_trust (tg_id bigint PRIMARY KEY, score int NOT NULL DEFAULT 50, last_day date, trusted boolean NOT NULL DEFAULT false)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_global_bans (tg_id bigint PRIMARY KEY, who text, reason text, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_guard_msgs (
      chat_id text NOT NULL, message_id bigint NOT NULL, tg_id bigint NOT NULL, name text NOT NULL, text_hash text,
      counted boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (chat_id, message_id))`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tg_guard_msgs_user_idx ON tg_guard_msgs (tg_id, created_at DESC)`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tg_guard_msgs_time_idx ON tg_guard_msgs (chat_id, created_at DESC)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_captcha (chat_id text NOT NULL, tg_id bigint NOT NULL, expires_at timestamptz NOT NULL, PRIMARY KEY (chat_id, tg_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_joins (id serial PRIMARY KEY, chat_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_broadcasts (
      id serial PRIMARY KEY, text text NOT NULL, button_text text, button_url text, status text NOT NULL DEFAULT 'queued',
      cursor bigint NOT NULL DEFAULT 0, sent int NOT NULL DEFAULT 0, failed int NOT NULL DEFAULT 0, total int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`ALTER TABLE tg_links ADD COLUMN IF NOT EXISTS dm_off boolean NOT NULL DEFAULT false`).catch(() => null)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

async function getSetting(key: string) {
  const r = await rows<{ value: string }>(sql`SELECT value FROM tg_settings WHERE key = ${key}`)
  return r[0]?.value ?? null
}

export async function setSetting(key: string, value: string) {
  await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

// --- Config ------------------------------------------------------------------

function merge<T extends Record<string, unknown>>(base: T, raw: unknown): T {
  if (!raw || typeof raw !== 'object') return structuredClone(base)
  const out = structuredClone(base) as Record<string, unknown>
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(k in out)) continue
    const b = out[k]
    if (b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v)) out[k] = merge(b as Record<string, unknown>, v)
    else if (v !== undefined && (b === null || typeof v === typeof b)) out[k] = v
  }
  return out as T
}

let hubCache: { at: number; value: HubConfig } | null = null
export async function getHub(): Promise<HubConfig> {
  if (hubCache && Date.now() - hubCache.at < 15_000) return hubCache.value
  await ensureHubTables()
  const raw = await getSetting(HUB_KEY)
  let parsed: unknown = null
  try {
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    parsed = null
  }
  const value = merge(DEFAULT_HUB as unknown as Record<string, unknown>, parsed) as unknown as HubConfig
  hubCache = { at: Date.now(), value }
  return value
}

export async function saveHub(cfg: HubConfig) {
  await ensureHubTables()
  await setSetting(HUB_KEY, JSON.stringify(cfg))
  hubCache = null
}

export async function resolveChatFor(botId: number, input: string) {
  const ref = normalizeChat(input)
  const token = await botToken(botId)
  const info = await callBot<{ id: number; title?: string; type: string }>(token, 'getChat', { chat_id: ref })
  const me = await callBot<{ id: number }>(token, 'getMe')
  const member = await callBot<{ status: string }>(token, 'getChatMember', { chat_id: info.id, user_id: me.id })
  return { id: String(info.id), title: info.title ?? String(info.id), type: info.type, isAdmin: ['administrator', 'creator'].includes(member.status) }
}

// --- Webhooks ----------------------------------------------------------------

export async function registerHook(botId: number, origin: string) {
  await ensureHubTables()
  if (!/^https:\/\//.test(origin)) throw new Error('Site adresi https ile başlamalı')
  const token = await botToken(botId)
  const info = await callBot<{ url: string }>(token, 'getWebhookInfo')
  if (info.url && !/\/api\/telegram\/(hook\/\d+|webhook)$/.test(info.url)) {
    throw new Error('Bu bot başka bir iş için (oran ya da TV botu) webhook kullanıyor. Bu rol için ayrı bir bot seç')
  }
  const secret = randomBytes(24).toString('base64url')
  await callBot(token, 'setWebhook', {
    url: `${origin}/api/telegram/hook/${botId}`,
    secret_token: secret,
    allowed_updates: HOOK_UPDATES,
    drop_pending_updates: false,
  })
  await setSetting(`hook_secret_${botId}`, secret)
}

export async function hasHook(botId: number) {
  return Boolean(await getSetting(`hook_secret_${botId}`).catch(() => null))
}

export async function verifyHook(botId: number, header: string | null) {
  await ensureHubTables()
  const secret = await getSetting(`hook_secret_${botId}`)
  if (!secret || !header) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(header)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function hookStatus(botId: number | null) {
  if (!botId) return null
  try {
    const info = await callBot<{ url: string; pending_update_count: number; last_error_message?: string }>(await botToken(botId), 'getWebhookInfo')
    return { ok: info.url.includes(`/api/telegram/hook/${botId}`), pending: info.pending_update_count, lastError: info.last_error_message ?? null }
  } catch (error) {
    return { ok: false, pending: 0, lastError: String((error as Error).message) }
  }
}

/** Routes one Telegram update to every role this bot plays. */
export async function dispatchUpdate(botId: number, update: HubUpdate) {
  const hub = await getHub()
  const { getChatConfig, handleUpdate } = await import('@/lib/telegram-chat')
  const chat = await getChatConfig().catch(() => null)
  const isGuard = hub.guardBotId === botId && hub.guard.enabled
  const isSupport = hub.supportBotId === botId && hub.support.enabled
  const isChat = chat?.botId === botId

  if (update.callback_query) {
    const data = update.callback_query.data ?? ''
    if (data === 'dm:off') return dmOptOut(botId, update.callback_query)
    if (isGuard && /^(cap|gd):/.test(data)) {
      const { handleGuardCallback } = await import('@/lib/tg-guard')
      return handleGuardCallback(botId, update.callback_query)
    }
    if (isSupport && /^(sp|ct|tk|rt|fq):/.test(data)) {
      const { handleSupportCallback } = await import('@/lib/tg-support')
      return handleSupportCallback(botId, update.callback_query)
    }
    await callBot(await botToken(botId), 'answerCallbackQuery', { callback_query_id: update.callback_query.id }).catch(() => null)
    return
  }

  if (update.chat_join_request) {
    if (isGuard) {
      const { handleJoinRequest } = await import('@/lib/tg-guard')
      await handleJoinRequest(botId, update.chat_join_request)
    }
    return
  }

  const m = update.message ?? update.edited_message
  if (m && m.chat.type !== 'private' && m.chat.type !== 'channel' && isGuard) {
    const { guardMessage } = await import('@/lib/tg-guard')
    const removed = await guardMessage(botId, m, Boolean(update.edited_message))
    if (removed) return
  }
  if (update.edited_message) return

  if (m && isSupport) {
    const { handleSupportMessage } = await import('@/lib/tg-support')
    const isLinkStart = m.chat.type === 'private' && isChat && /^\/start\s+[A-Za-z0-9_-]{8,64}$/.test(m.text ?? '')
    if (!isLinkStart && (await handleSupportMessage(botId, m))) return
  }

  if (isChat) {
    await handleUpdate(update)
    return
  }
  const post = m ?? update.channel_post
  if (post && post.chat.type !== 'private') {
    const { handleShareMessage } = await import('@/lib/telegram-bots')
    await handleShareMessage(post, botId)
  }
}

// --- Logging -----------------------------------------------------------------

export function who(u?: TgUser) {
  if (!u) return 'Bilinmeyen'
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Adsız'
  return u.username ? `${name} (@${u.username})` : `${name} (${u.id})`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function modLog(input: { chatId?: string | number; chatTitle?: string; user?: TgUser; action: string; reason: string; notify?: boolean }) {
  await ensureHubTables()
  await rows(sql`INSERT INTO tg_mod_log (chat_id, chat_title, tg_id, who, action, reason)
    VALUES (${input.chatId != null ? String(input.chatId) : null}, ${input.chatTitle ?? null}, ${input.user?.id ?? null},
      ${input.user ? who(input.user) : null}, ${input.action}, ${input.reason.slice(0, 500)})`)
  if (input.notify === false) return
  const hub = await getHub()
  const botId = hub.guardBotId ?? hub.supportBotId
  if (!hub.logChatId || !botId) return
  const lines = [`<b>${esc(input.action)}</b>`]
  if (input.chatTitle) lines.push(`Grup: ${esc(input.chatTitle)}`)
  if (input.user) lines.push(`Kişi: ${esc(who(input.user))}`)
  lines.push(`Neden: ${esc(input.reason.slice(0, 600))}`)
  await callBot(await botToken(botId), 'sendMessage', {
    chat_id: hub.logChatId,
    text: lines.join('\n'),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  }).catch((error) => console.error('[tg-hub] log send failed', error))
}

export async function listModLog(limit = 40): Promise<HubLogRow[]> {
  await ensureHubTables()
  const r = await rows(sql`SELECT id, action, chat_title, who, reason, created_at FROM tg_mod_log ORDER BY id DESC LIMIT ${limit}`)
  return r.map((x) => ({
    id: Number(x.id),
    action: String(x.action),
    chatTitle: String(x.chat_title ?? ''),
    who: String(x.who ?? ''),
    reason: String(x.reason ?? ''),
    createdAt: new Date(String(x.created_at)).toISOString(),
  }))
}

// --- Trust score -------------------------------------------------------------

export async function trustOf(tgId: number) {
  await ensureHubTables()
  const r = await rows<{ score: number; trusted: boolean }>(sql`SELECT score, trusted FROM tg_trust WHERE tg_id = ${tgId}`)
  return { score: r[0] ? Number(r[0].score) : 50, trusted: Boolean(r[0]?.trusted) }
}

export async function adjustTrust(tgId: number, delta: number) {
  await rows(sql`INSERT INTO tg_trust (tg_id, score) VALUES (${tgId}, ${Math.max(0, Math.min(100, 50 + delta))})
    ON CONFLICT (tg_id) DO UPDATE SET score = GREATEST(0, LEAST(100, tg_trust.score + ${delta}))`)
}

/** +1 trust for each day a member writes cleanly. */
export async function dailyTrustBump(tgId: number) {
  await rows(sql`INSERT INTO tg_trust (tg_id, score, last_day) VALUES (${tgId}, 51, CURRENT_DATE)
    ON CONFLICT (tg_id) DO UPDATE SET score = LEAST(100, tg_trust.score + 1), last_day = CURRENT_DATE
    WHERE tg_trust.last_day IS DISTINCT FROM CURRENT_DATE`)
}

export async function setTrusted(tgId: number, trusted: boolean) {
  await ensureHubTables()
  await rows(sql`INSERT INTO tg_trust (tg_id, score, trusted) VALUES (${tgId}, 50, ${trusted})
    ON CONFLICT (tg_id) DO UPDATE SET trusted = EXCLUDED.trusted`)
}

export async function listTrustLow(limit = 20) {
  await ensureHubTables()
  const r = await rows(sql`SELECT t.tg_id, t.score, t.trusted, (SELECT name FROM tg_guard_msgs g WHERE g.tg_id = t.tg_id ORDER BY created_at DESC LIMIT 1) AS name
    FROM tg_trust t ORDER BY t.score ASC LIMIT ${limit}`)
  return r.map((x) => ({ tgId: Number(x.tg_id), score: Number(x.score), trusted: Boolean(x.trusted), name: String(x.name ?? x.tg_id) }))
}

// --- Global bans -------------------------------------------------------------

export async function listGlobalBans(limit = 50) {
  await ensureHubTables()
  const r = await rows(sql`SELECT tg_id, who, reason, created_at FROM tg_global_bans ORDER BY created_at DESC LIMIT ${limit}`)
  return r.map((x) => ({ tgId: Number(x.tg_id), who: String(x.who ?? x.tg_id), reason: String(x.reason ?? ''), createdAt: new Date(String(x.created_at)).toISOString() }))
}

export async function removeGlobalBan(tgId: number) {
  const hub = await getHub()
  await rows(sql`DELETE FROM tg_global_bans WHERE tg_id = ${tgId}`)
  await rows(sql`DELETE FROM tg_warns WHERE tg_id = ${tgId}`)
  if (!hub.guardBotId) return
  const token = await botToken(hub.guardBotId)
  for (const g of hub.groups) {
    await callBot(token, 'unbanChatMember', { chat_id: g.chatId, user_id: tgId, only_if_banned: true }).catch(() => null)
  }
}

// --- Stats & leaderboard -----------------------------------------------------

export async function hubStats(): Promise<HubStats> {
  await ensureHubTables()
  const { ensureSupportTables } = await import('@/lib/tg-support')
  await ensureSupportTables()
  const [log] = await rows(sql`SELECT
      count(*) FILTER (WHERE action = 'Mesaj silindi') AS deleted,
      count(*) FILTER (WHERE action LIKE 'Susturuldu%') AS muted,
      count(*) FILTER (WHERE action LIKE 'Banlandı%') AS banned,
      count(*) FILTER (WHERE action = 'Giriş reddedildi') AS blocked
    FROM tg_mod_log WHERE created_at > now() - interval '7 days'`)
  const [t] = await rows(sql`SELECT
      count(*) FILTER (WHERE status IN ('open','claimed')) AS open,
      count(*) FILTER (WHERE status = 'resolved' AND closed_at > now() - interval '7 days') AS resolved,
      avg(EXTRACT(EPOCH FROM closed_at - created_at) / 60) FILTER (WHERE status IN ('resolved','rejected') AND closed_at > now() - interval '30 days') AS avg_min
    FROM tg_tickets`)
  const [b] = await rows(sql`SELECT count(*) AS n FROM tg_global_bans`)
  return {
    deletedWeek: Number(log.deleted),
    mutedWeek: Number(log.muted),
    bannedWeek: Number(log.banned),
    joinsBlockedWeek: Number(log.blocked),
    openTickets: Number(t.open),
    resolvedWeek: Number(t.resolved),
    avgResolveMin: t.avg_min == null ? null : Math.round(Number(t.avg_min)),
    globalBans: Number(b.n),
  }
}

/** Monday 00:00 Europe/Istanbul of the current week, as an ISO timestamp. */
export function weekStart(offsetWeeks = 0) {
  const now = new Date(Date.now() + 3 * 3600_000)
  const day = (now.getUTCDay() + 6) % 7
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day - offsetWeeks * 7)
  return new Date(monday - 3 * 3600_000).toISOString()
}

export async function chatLeaderboard(fromIso: string, toIso: string, limit = 10): Promise<LeaderRow[]> {
  await ensureHubTables()
  const r = await rows(sql`WITH tg AS (
      SELECT COALESCE(l.user_id, 'tg:' || g.tg_id::text) AS key, max(COALESCE(l.tg_name, g.name)) AS name, count(*) AS n
      FROM tg_guard_msgs g LEFT JOIN tg_links l ON l.tg_id = g.tg_id
      WHERE g.counted AND g.created_at >= ${fromIso} AND g.created_at < ${toIso} GROUP BY 1
    ), site AS (
      SELECT m.user_id AS key, max(m.author) AS name, count(*) AS n FROM tg_chat_messages m
      WHERE m.origin = 'site' AND m.user_id IS NOT NULL AND length(m.text) >= 3 AND m.created_at >= ${fromIso} AND m.created_at < ${toIso} GROUP BY 1
    )
    SELECT key, max(name) AS name, sum(n) AS n FROM (SELECT * FROM tg UNION ALL SELECT * FROM site) x
    GROUP BY key ORDER BY n DESC LIMIT ${limit}`)
  return r.map((x) => ({ key: String(x.key), name: String(x.name), count: Number(x.n) }))
}

// --- DM broadcast ------------------------------------------------------------

const BROADCAST_PER_RUN = 900
const BROADCAST_DELAY_MS = 40

export async function queueBroadcast(text: string, buttonText: string, buttonUrl: string) {
  await ensureHubTables()
  const body = text.trim()
  if (body.length < 3) throw new Error('Mesaj çok kısa')
  if (body.length > 3500) throw new Error('Mesaj en fazla 3500 karakter olabilir')
  if (buttonUrl && !/^https:\/\//.test(buttonUrl)) throw new Error('Buton linki https ile başlamalı')
  const [{ n }] = await rows(sql`SELECT count(*) AS n FROM tg_links WHERE NOT dm_off`)
  await rows(sql`INSERT INTO tg_broadcasts (text, button_text, button_url, total)
    VALUES (${body}, ${buttonText.trim() || null}, ${buttonUrl.trim() || null}, ${Number(n)})`)
  return Number(n)
}

export async function listBroadcasts(limit = 10): Promise<BroadcastRow[]> {
  await ensureHubTables()
  const r = await rows(sql`SELECT id, text, status, sent, failed, total, created_at FROM tg_broadcasts ORDER BY id DESC LIMIT ${limit}`)
  return r.map((x) => ({ id: Number(x.id), text: String(x.text), status: String(x.status), sent: Number(x.sent), failed: Number(x.failed), total: Number(x.total), createdAt: new Date(String(x.created_at)).toISOString() }))
}

export async function cancelBroadcast(id: number) {
  await rows(sql`UPDATE tg_broadcasts SET status = 'cancelled' WHERE id = ${id} AND status IN ('queued','sending')`)
}

/** Sends the next slice of the oldest queued broadcast through the chat bot (members pressed Start there). */
export async function processBroadcasts() {
  await ensureHubTables()
  const [job] = await rows(sql`SELECT * FROM tg_broadcasts WHERE status IN ('queued','sending') ORDER BY id LIMIT 1`)
  if (!job) return
  const { getChatConfig } = await import('@/lib/telegram-chat')
  const chat = await getChatConfig()
  if (!chat) return
  const token = await botToken(chat.botId)
  await rows(sql`UPDATE tg_broadcasts SET status = 'sending' WHERE id = ${job.id}`)
  const people = await rows<{ tg_id: string }>(sql`SELECT tg_id FROM tg_links WHERE NOT dm_off AND tg_id > ${job.cursor} ORDER BY tg_id LIMIT ${BROADCAST_PER_RUN}`)
  const keyboard: { text: string; url?: string; callback_data?: string }[][] = []
  if (job.button_text && job.button_url) keyboard.push([{ text: String(job.button_text), url: String(job.button_url) }])
  keyboard.push([{ text: 'Bildirimleri kapat', callback_data: 'dm:off' }])
  let sent = 0
  let failed = 0
  let cursor = Number(job.cursor)
  const started = Date.now()
  for (const p of people) {
    if (Date.now() - started > 25_000) break
    try {
      await callBot(token, 'sendMessage', { chat_id: Number(p.tg_id), text: String(job.text), reply_markup: { inline_keyboard: keyboard }, link_preview_options: { is_disabled: true } })
      sent++
    } catch (error) {
      failed++
      const retry = String((error as Error).message).match(/retry after (\d+)/i)
      if (retry) await new Promise((r) => setTimeout(r, Number(retry[1]) * 1000))
    }
    cursor = Number(p.tg_id)
    await new Promise((r) => setTimeout(r, BROADCAST_DELAY_MS))
  }
  const done = people.length < BROADCAST_PER_RUN && cursor === Number(people.at(-1)?.tg_id ?? cursor)
  await rows(sql`UPDATE tg_broadcasts SET sent = sent + ${sent}, failed = failed + ${failed}, cursor = ${cursor},
    status = CASE WHEN status = 'cancelled' THEN 'cancelled' WHEN ${done} THEN 'done' ELSE 'sending' END WHERE id = ${job.id}`)
}

export async function dmOptOut(botId: number, q: TgCallback) {
  await ensureHubTables()
  await rows(sql`UPDATE tg_links SET dm_off = true WHERE tg_id = ${q.from.id}`)
  await callBot(await botToken(botId), 'answerCallbackQuery', { callback_query_id: q.id, text: 'Duyurular kapatıldı. Kişisel bildirimler gelmeye devam eder.' }).catch(() => null)
}

/** Personal DM to one linked site member (reminders, birthdays). Returns false if they are not reachable. */
export async function dmMember(userId: string, text: string) {
  const { getChatConfig } = await import('@/lib/telegram-chat')
  const chat = await getChatConfig()
  if (!chat) return false
  const r = await rows<{ tg_id: string }>(sql`SELECT tg_id FROM tg_links WHERE user_id = ${userId}`)
  if (!r[0]) return false
  return callBot(await botToken(chat.botId), 'sendMessage', { chat_id: Number(r[0].tg_id), text })
    .then(() => true)
    .catch(() => false)
}
