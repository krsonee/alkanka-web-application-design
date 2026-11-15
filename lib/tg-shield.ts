import 'server-only'
import { rows, sql } from '@/lib/db'
import { callBot } from '@/lib/telegram-mirror'
import type { TgMessage } from '@/lib/telegram-chat'
import { ensureHubTables, type TgUser } from '@/lib/tg-hub'
import { RAID_BAN_MINUTES, WAVE_MINUTES, type ContentKind, type LockRow, type SuspectRow } from '@/lib/tg-hub-shared'

type Entity = { type: string; url?: string; offset: number; length: number }

export type ShieldMsg = TgMessage & {
  sender_chat?: { id: number; type: string }
  left_chat_member?: TgUser
  is_topic_message?: boolean
  via_bot?: TgUser
  document?: object
  audio?: object
  voice?: object
  video_note?: object
  poll?: object
  contact?: object
  location?: object
  venue?: object
  game?: object
  story?: object
  external_reply?: { chat?: { id: number; type: string }; link_preview_options?: { url?: string } }
  quote?: { text?: string; entities?: Entity[] }
  reply_markup?: { inline_keyboard?: { url?: string }[][] }
}

let ready: Promise<void> | null = null
export function ensureShieldTables() {
  ready ??= (async () => {
    await ensureHubTables()
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_locks (chat_id text PRIMARY KEY, kind text NOT NULL, locked boolean NOT NULL DEFAULT false, perms text,
      until timestamptz, reason text NOT NULL DEFAULT '', title text NOT NULL DEFAULT '', started_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_join_log (id bigserial PRIMARY KEY, chat_id text NOT NULL, tg_id bigint NOT NULL, name text NOT NULL DEFAULT '',
      username text, inviter bigint, via text, raid boolean NOT NULL DEFAULT false, removed boolean NOT NULL DEFAULT false, joined_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tg_join_log_chat_idx ON tg_join_log (chat_id, joined_at DESC)`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tg_join_log_user_idx ON tg_join_log (tg_id)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_thread_locks (chat_id text NOT NULL, thread_id bigint NOT NULL, until timestamptz NOT NULL, PRIMARY KEY (chat_id, thread_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_post_roots (chat_id text NOT NULL, message_id bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (chat_id, message_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_suspect_state (tg_id bigint PRIMARY KEY, state text NOT NULL, reason text, name text, updated_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const idArray = (ids: number[]) => `{${ids.join(',')}}`
const displayName = (u: TgUser) => [u.first_name, u.last_name].filter(Boolean).join(' ').trim()

// --- Content types -----------------------------------------------------------

export function contentKinds(m: ShieldMsg): ContentKind[] {
  const kinds: ContentKind[] = []
  if (m.via_bot || m.game) kinds.push('viaBot')
  if (m.sticker) kinds.push('sticker')
  // A GIF also carries a `document`, so it is checked first and never counted as a file.
  if (m.animation) kinds.push('gif')
  else if (m.photo?.length || m.video || m.document || m.audio) kinds.push('media')
  if (m.voice || m.video_note) kinds.push('voice')
  if (m.poll) kinds.push('poll')
  if (m.contact) kinds.push('contact')
  if (m.location || m.venue) kinds.push('location')
  return kinds
}

/** Links that sit outside the message text: inline buttons, a quoted passage and the preview of a reply to another chat. */
export function hiddenLinks(m: ShieldMsg): string[] {
  const out: string[] = []
  for (const row of m.reply_markup?.inline_keyboard ?? []) for (const b of row) if (b.url) out.push(b.url)
  const quote = m.quote?.text ?? ''
  for (const e of m.quote?.entities ?? []) {
    if (e.type === 'text_link' && e.url) out.push(e.url)
    if (e.type === 'url') out.push(quote.slice(e.offset, e.offset + e.length))
  }
  if (m.external_reply?.link_preview_options?.url) out.push(m.external_reply.link_preview_options.url)
  return out
}

// --- Names -------------------------------------------------------------------

const LOOKALIKES: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ӏ: 'l',
  α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x',
  ı: 'i', ł: 'l', ø: 'o', đ: 'd', ɑ: 'a', ɡ: 'g',
}
const DIGIT_LETTERS: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i', '|': 'i' }

/**
 * Reduces a name to plain Latin letters so look-alike spellings compare equal: styled Unicode letters,
 * accents, Cyrillic and Greek twins, digits used as letters, and l / I / ı which read the same in most fonts.
 */
export function foldName(s: string) {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\x00-\x7f]/g, (c) => LOOKALIKES[c] ?? '')
    .replace(/[013457@$!|]/g, (c) => DIGIT_LETTERS[c] ?? '')
    .replace(/l/g, 'i')
    .replace(/[^a-z0-9]/g, '')
}

const STAFF_WORDS = ['alkanka', 'destek', 'admin', 'yonetici', 'support', 'moderator'].map(foldName)

export function staffWordInName(u: TgUser) {
  const name = foldName(`${u.first_name ?? ''} ${u.last_name ?? ''} ${u.username ?? ''}`)
  return STAFF_WORDS.some((w) => name.includes(w))
}

function withinOneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** The admin this account could be mistaken for, if any. Short names are skipped: two real people called "Ali" are not a fraud. */
export function adminLookalike(u: TgUser, admins: TgUser[]) {
  const name = foldName(displayName(u))
  const handle = foldName(u.username ?? '')
  for (const a of admins) {
    if (a.id === u.id || a.is_bot) continue
    if (name.length >= 8 && name === foldName(displayName(a))) return a
    const adminHandle = foldName(a.username ?? '')
    if (handle.length >= 6 && adminHandle.length >= 6 && withinOneEdit(handle, adminHandle)) return a
  }
  return null
}

const ADMINS_TTL_MS = 10 * 60_000
const adminsCache = new Map<string, { at: number; list: TgUser[] }>()
export async function chatAdmins(token: string, chatId: number | string) {
  const key = String(chatId)
  const hit = adminsCache.get(key)
  if (hit && Date.now() - hit.at < ADMINS_TTL_MS) return hit.list
  const list = await callBot<{ user: TgUser }[]>(token, 'getChatAdministrators', { chat_id: chatId })
    .then((r) => r.map((x) => x.user))
    .catch(() => [] as TgUser[])
  adminsCache.set(key, { at: Date.now(), list })
  return list
}

// --- Chat locks (raid mode and /kilit) -----------------------------------------

const CLOSED = { can_send_messages: false }
const OPEN_FALLBACK = {
  can_send_messages: true,
  can_send_photos: true,
  can_send_videos: true,
  can_send_other_messages: true,
  can_add_web_page_previews: true,
  can_send_polls: true,
}

/**
 * Starts or extends a lock. `fresh` is true only for the call that created it, so alarms fire once.
 * The group's own permissions are saved first and put back exactly as they were on unlock.
 */
export async function lockChat(
  token: string,
  chat: { id: number | string; title: string },
  opts: { kind: 'raid' | 'manual'; minutes: number | null; lock: boolean; reason: string },
): Promise<{ fresh: boolean; locked: boolean; error?: string }> {
  await ensureShieldTables()
  const chatId = String(chat.id)
  const until = opts.minutes == null ? null : new Date(Date.now() + opts.minutes * 60_000).toISOString()
  const [row] = await rows<{ fresh: boolean; locked: boolean }>(sql`INSERT INTO tg_locks (chat_id, kind, until, reason, title)
    VALUES (${chatId}, ${opts.kind}, ${until}::timestamptz, ${opts.reason.slice(0, 200)}, ${chat.title.slice(0, 120)})
    ON CONFLICT (chat_id) DO UPDATE SET
      kind = CASE WHEN EXCLUDED.kind = 'manual' THEN 'manual' ELSE tg_locks.kind END,
      until = CASE WHEN EXCLUDED.kind = 'manual' THEN NULL WHEN tg_locks.kind = 'manual' THEN tg_locks.until ELSE GREATEST(tg_locks.until, EXCLUDED.until) END
    RETURNING (xmax = 0) AS fresh, locked`)
  // A raid that could not close the group the first time is not retried on every later join.
  if (!opts.lock || row.locked || (!row.fresh && opts.kind === 'raid')) return { fresh: row.fresh, locked: row.locked }
  // Parallel webhooks race here; only the one that flips the flag reads and replaces the permissions.
  const claimed = await rows(sql`UPDATE tg_locks SET locked = true WHERE chat_id = ${chatId} AND NOT locked RETURNING chat_id`)
  if (!claimed.length) return { fresh: row.fresh, locked: true }
  const release = () => rows(sql`UPDATE tg_locks SET locked = false WHERE chat_id = ${chatId}`).catch(() => null)
  const info = await callBot<{ permissions?: Record<string, boolean> }>(token, 'getChat', { chat_id: chatId }).catch(() => null)
  if (info?.permissions?.can_send_messages === false) {
    // Already closed by an admin: there is nothing of ours to undo later.
    await release()
    return { fresh: row.fresh, locked: false }
  }
  try {
    await callBot(token, 'setChatPermissions', { chat_id: chatId, permissions: CLOSED })
  } catch (error) {
    await release()
    return { fresh: row.fresh, locked: false, error: String((error as Error).message) }
  }
  await rows(sql`UPDATE tg_locks SET perms = ${info?.permissions ? JSON.stringify(info.permissions) : null} WHERE chat_id = ${chatId}`)
  return { fresh: row.fresh, locked: true }
}

export async function unlockChat(
  token: string,
  chatId: number | string,
): Promise<{ found: boolean; wasLocked: boolean; kind: string; turnedAway: number; error?: string }> {
  await ensureShieldTables()
  const id = String(chatId)
  const [row] = await rows<{ kind: string; locked: boolean; perms: string | null; turned_away: string }>(sql`SELECT l.kind, l.locked, l.perms,
      (SELECT count(*) FROM tg_join_log j WHERE j.chat_id = l.chat_id AND j.raid AND j.joined_at >= l.started_at) AS turned_away
    FROM tg_locks l WHERE l.chat_id = ${id}`)
  if (!row) return { found: false, wasLocked: false, kind: '', turnedAway: 0 }
  let error: string | undefined
  if (row.locked) {
    let perms: Record<string, boolean> | null = null
    try {
      perms = row.perms ? (JSON.parse(row.perms) as Record<string, boolean>) : null
    } catch {
      perms = null
    }
    await callBot(
      token,
      'setChatPermissions',
      perms ? { chat_id: id, permissions: perms, use_independent_chat_permissions: true } : { chat_id: id, permissions: OPEN_FALLBACK },
    ).catch((e) => {
      error = String((e as Error).message)
    })
  }
  // Removed even when Telegram refused: a lock that can never be lifted would keep turning newcomers away for good.
  await rows(sql`DELETE FROM tg_locks WHERE chat_id = ${id}`)
  return { found: true, wasLocked: row.locked, kind: row.kind, turnedAway: Number(row.turned_away), error }
}

export async function raidActive(chatId: string) {
  const r = await rows(sql`SELECT 1 FROM tg_locks WHERE chat_id = ${chatId} AND kind = 'raid' AND until > now()`)
  return r.length > 0
}

export async function dueLocks() {
  await ensureShieldTables()
  const r = await rows<{ chat_id: string; kind: string; title: string }>(sql`SELECT chat_id, kind, title FROM tg_locks WHERE until IS NOT NULL AND until < now()`)
  return r.map((x) => ({ chatId: x.chat_id, kind: x.kind, title: x.title }))
}

export async function extendLock(chatId: string, minutes: number) {
  await rows(sql`UPDATE tg_locks SET until = now() + make_interval(mins => ${minutes}) WHERE chat_id = ${chatId}`)
}

export async function listLocks(): Promise<LockRow[]> {
  await ensureShieldTables()
  const r = await rows(sql`SELECT l.chat_id, l.title, l.kind, l.locked, l.until, l.started_at, l.reason,
      (SELECT count(*) FROM tg_join_log j WHERE j.chat_id = l.chat_id AND j.raid AND j.joined_at >= l.started_at) AS turned_away
    FROM tg_locks l ORDER BY l.started_at DESC`)
  return r.map((x) => ({
    chatId: String(x.chat_id),
    title: String(x.title || x.chat_id),
    kind: x.kind === 'manual' ? 'manual' : 'raid',
    locked: Boolean(x.locked),
    until: x.until ? new Date(String(x.until)).toISOString() : null,
    startedAt: new Date(String(x.started_at)).toISOString(),
    reason: String(x.reason ?? ''),
    turnedAway: Number(x.turned_away),
  }))
}

/** Stops members from adding other people. Returns false when it was already off or Telegram refused. */
export async function closeInvites(token: string, chatId: number | string) {
  const id = String(chatId)
  const info = await callBot<{ permissions?: Record<string, boolean> }>(token, 'getChat', { chat_id: id }).catch(() => null)
  if (!info?.permissions || info.permissions.can_invite_users === false) return false
  const ok = await callBot(token, 'setChatPermissions', {
    chat_id: id,
    permissions: { ...info.permissions, can_invite_users: false },
    use_independent_chat_permissions: true,
  })
    .then(() => true)
    .catch(() => false)
  if (!ok) return false
  // A running lock restores its saved permissions later; without this it would switch invites back on.
  const [lock] = await rows<{ perms: string | null }>(sql`SELECT perms FROM tg_locks WHERE chat_id = ${id}`)
  if (lock?.perms) {
    try {
      const saved = { ...(JSON.parse(lock.perms) as Record<string, boolean>), can_invite_users: false }
      await rows(sql`UPDATE tg_locks SET perms = ${JSON.stringify(saved)} WHERE chat_id = ${id}`)
    } catch {
      // Unreadable saved permissions fall back to the default set on unlock.
    }
  }
  return true
}

// --- Join log ----------------------------------------------------------------

export async function logJoin(input: { chatId: number | string; user: TgUser; inviter?: number | null; via?: string | null; raid?: boolean; removed?: boolean }) {
  await rows(sql`INSERT INTO tg_join_log (chat_id, tg_id, name, username, inviter, via, raid, removed)
    VALUES (${String(input.chatId)}, ${input.user.id}, ${displayName(input.user).slice(0, 80)}, ${input.user.username ?? null}, ${input.inviter ?? null},
      ${input.via ?? null}, ${Boolean(input.raid)}, ${Boolean(input.removed)})`)
}

/** One statement per channel join: stores it and reports whether the account is globally banned and how busy the last 10 minutes were. */
export async function logChannelJoin(chatId: string, user: TgUser, via: string | null) {
  await ensureShieldTables()
  const [r] = await rows<{ banned: boolean; recent: string }>(sql`INSERT INTO tg_join_log (chat_id, tg_id, name, username, via)
    VALUES (${chatId}, ${user.id}, ${displayName(user).slice(0, 80)}, ${user.username ?? null}, ${via})
    RETURNING EXISTS (SELECT 1 FROM tg_global_bans WHERE tg_id = ${user.id}) AS banned,
      (SELECT count(*) FROM tg_join_log WHERE chat_id = ${chatId} AND joined_at > now() - interval '10 minutes') AS recent`)
  // The count is taken from before this insert, so the new row is added by hand.
  return { banned: Boolean(r.banned), recent: Number(r.recent) + 1 }
}

export async function invitedBy(chatId: string, inviter: number) {
  const r = await rows<{ tg_id: string }>(sql`SELECT DISTINCT tg_id FROM tg_join_log
    WHERE chat_id = ${chatId} AND inviter = ${inviter} AND NOT removed AND joined_at > now() - interval '10 minutes'`)
  return r.map((x) => Number(x.tg_id))
}

export async function markRemoved(chatId: string, ids: number[]) {
  if (!ids.length) return
  await rows(sql`UPDATE tg_join_log SET removed = true WHERE chat_id = ${chatId} AND tg_id = ANY(${idArray(ids)}::bigint[])`)
}

export async function waveMembers(chatId: string, limit = 300) {
  await ensureShieldTables()
  const r = await rows<{ tg_id: string }>(sql`SELECT DISTINCT j.tg_id FROM tg_join_log j LEFT JOIN tg_trust t ON t.tg_id = j.tg_id
    WHERE j.chat_id = ${chatId} AND NOT j.removed AND COALESCE(t.trusted, false) = false
      AND j.joined_at > now() - make_interval(mins => ${WAVE_MINUTES}) LIMIT ${limit}`)
  return r.map((x) => Number(x.tg_id))
}

/** Removes everyone who joined in the last wave. The ban lifts by itself, so a real member can come back. */
export async function sweepWave(token: string, chatId: string, budgetMs = 40_000) {
  const ids = await waveMembers(chatId)
  const started = Date.now()
  const until = Math.floor(Date.now() / 1000) + RAID_BAN_MINUTES * 60
  const done: number[] = []
  for (const id of ids) {
    if (Date.now() - started > budgetMs) break
    await callBot(token, 'banChatMember', { chat_id: chatId, user_id: id, until_date: until }).catch(() => null)
    done.push(id)
  }
  await markRemoved(chatId, done)
  return { removed: done.length, left: ids.length - done.length }
}

/** True at most once per `minutes` for a key, across all server instances. */
export async function claimAlert(key: string, minutes: number) {
  const r = await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${new Date().toISOString()})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    WHERE tg_settings.value::timestamptz < now() - make_interval(mins => ${minutes})
    RETURNING key`)
  return r.length > 0
}

/** Guards a destructive button: the first press arms it, a second press within `seconds` confirms. */
export async function confirmTwice(key: string, seconds: number) {
  const [r] = await rows<{ prev: string | null }>(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${new Date().toISOString()})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    RETURNING (SELECT value FROM tg_settings WHERE key = ${key}) AS prev`)
  const armedAt = r?.prev ? Date.parse(r.prev) : NaN
  if (!Number.isFinite(armedAt) || Date.now() - armedAt > seconds * 1000) return false
  await rows(sql`DELETE FROM tg_settings WHERE key = ${key}`)
  return true
}

// --- Comment threads ---------------------------------------------------------

export async function markPostRoot(chatId: string, messageId: number) {
  await rows(sql`INSERT INTO tg_post_roots (chat_id, message_id) VALUES (${chatId}, ${messageId}) ON CONFLICT DO NOTHING`)
}

export async function threadState(chatId: string, threadId: number) {
  const [r] = await rows<{ locked: boolean; is_post: boolean; recent: string }>(sql`SELECT
      EXISTS (SELECT 1 FROM tg_thread_locks WHERE chat_id = ${chatId} AND thread_id = ${threadId} AND until > now()) AS locked,
      EXISTS (SELECT 1 FROM tg_post_roots WHERE chat_id = ${chatId} AND message_id = ${threadId}) AS is_post,
      (SELECT count(*) FROM tg_guard_msgs WHERE chat_id = ${chatId} AND thread_id = ${threadId} AND created_at > now() - interval '60 seconds') AS recent`)
  return { locked: Boolean(r.locked), isPost: Boolean(r.is_post), recent: Number(r.recent) }
}

/** True only for the call that closed the thread, so the notice is posted once. */
export async function lockThread(chatId: string, threadId: number, minutes: number) {
  const r = await rows(sql`INSERT INTO tg_thread_locks (chat_id, thread_id, until) VALUES (${chatId}, ${threadId}, now() + make_interval(mins => ${minutes}))
    ON CONFLICT (chat_id, thread_id) DO UPDATE SET until = EXCLUDED.until WHERE tg_thread_locks.until < now()
    RETURNING chat_id`)
  return r.length > 0
}

export async function unlockThread(chatId: string, threadId: number) {
  await rows(sql`DELETE FROM tg_thread_locks WHERE chat_id = ${chatId} AND thread_id = ${threadId}`)
}

// --- Coordinated spam --------------------------------------------------------

export type SwarmHit = { messageId: number; tgId: number; name: string }

/**
 * Finds the same text sent by several accounts within five minutes. Returned messages are marked in the same
 * statement, so two webhooks that notice the swarm together never both act on one message.
 */
export async function swarmHits(chatId: string, hash: string, accounts: number): Promise<SwarmHit[]> {
  const marked = `swarm:${hash}`
  const r = await rows<{ message_id: string; tg_id: string; text_hash: string }>(sql`SELECT g.message_id, g.tg_id, g.text_hash
    FROM tg_guard_msgs g LEFT JOIN tg_trust t ON t.tg_id = g.tg_id
    WHERE g.chat_id = ${chatId} AND g.text_hash IN (${hash}, ${marked}) AND g.created_at > now() - interval '5 minutes'
      AND COALESCE(t.trusted, false) = false`)
  const fresh = r.filter((x) => x.text_hash === hash)
  if (!fresh.length) return []
  const alreadyKnown = r.length > fresh.length
  if (!alreadyKnown && new Set(fresh.map((x) => x.tg_id)).size < accounts) return []
  const taken = await rows<{ message_id: string; tg_id: string; name: string }>(sql`UPDATE tg_guard_msgs SET text_hash = ${marked}, counted = false
    WHERE chat_id = ${chatId} AND text_hash = ${hash} AND message_id = ANY(${idArray(fresh.map((x) => Number(x.message_id)))}::bigint[])
    RETURNING message_id, tg_id, name`)
  return taken.map((x) => ({ messageId: Number(x.message_id), tgId: Number(x.tg_id), name: String(x.name) }))
}

// --- Suspects ----------------------------------------------------------------

/** Mass-registered accounts seen in the group follow one shape: two capitalised name fragments and a long number. */
const FARM_NAME = '^[A-Z][a-z]+[A-Z][a-z]+[0-9]{5,}$'
const FARM_NAME_RE = new RegExp(FARM_NAME)
const BURST_JOINS = 8

export async function listSuspects(limit = 150): Promise<SuspectRow[]> {
  await ensureShieldTables()
  const r = await rows(sql`WITH w AS (
      SELECT tg_id, (array_agg(name ORDER BY created_at DESC))[1] AS name, count(*) AS msgs FROM tg_guard_msgs GROUP BY tg_id
    ), j AS (
      SELECT tg_id, (array_agg(name ORDER BY joined_at DESC))[1] AS name, (array_agg(username ORDER BY joined_at DESC))[1] AS username,
        max(joined_at) AS joined_at, max(burst) AS burst
      FROM (SELECT tg_id, name, username, joined_at, count(*) OVER (PARTITION BY chat_id, date_trunc('minute', joined_at)) AS burst
        FROM tg_join_log WHERE NOT removed) x
      GROUP BY tg_id
    ), ids AS (
      SELECT tg_id FROM w UNION SELECT tg_id FROM j UNION SELECT tg_id FROM tg_suspect_state WHERE state = 'flagged'
    )
    SELECT i.tg_id, COALESCE(NULLIF(w.name, ''), NULLIF(j.name, ''), s.name, i.tg_id::text) AS name, j.username, COALESCE(w.msgs, 0) AS msgs,
      j.joined_at, COALESCE(j.burst, 0) AS burst, s.state, s.reason
    FROM ids i
      LEFT JOIN w ON w.tg_id = i.tg_id
      LEFT JOIN j ON j.tg_id = i.tg_id
      LEFT JOIN tg_suspect_state s ON s.tg_id = i.tg_id
      LEFT JOIN tg_trust t ON t.tg_id = i.tg_id
      LEFT JOIN tg_global_bans b ON b.tg_id = i.tg_id
    WHERE b.tg_id IS NULL AND COALESCE(t.trusted, false) = false AND COALESCE(s.state, '') NOT IN ('removed', 'cleared')
      AND (s.state = 'flagged' OR COALESCE(j.burst, 0) >= ${BURST_JOINS}
        OR ltrim(COALESCE(w.name, ''), '@') ~ ${FARM_NAME} OR COALESCE(j.username, '') ~ ${FARM_NAME})
    ORDER BY (COALESCE(s.state, '') = 'flagged') DESC, j.joined_at DESC NULLS LAST, i.tg_id
    LIMIT ${limit}`)
  return r.map((x) => {
    const name = String(x.name)
    const username = x.username ? String(x.username) : name.startsWith('@') ? name.slice(1) : null
    const burst = Number(x.burst)
    const msgs = Number(x.msgs)
    const reasons: string[] = []
    if (x.state === 'flagged' && x.reason) reasons.push(String(x.reason))
    if (FARM_NAME_RE.test(username ?? name)) reasons.push('Toplu üretilmiş isim kalıbı')
    if (burst >= BURST_JOINS) reasons.push(`Aynı dakikada ${burst} hesapla birlikte girdi`)
    if (msgs === 0) reasons.push('Hiç yazmadı')
    return { tgId: Number(x.tg_id), name, username, msgs, joinedAt: x.joined_at ? new Date(String(x.joined_at)).toISOString() : null, reasons }
  })
}

export async function setSuspectState(ids: number[], state: 'removed' | 'cleared') {
  if (!ids.length) return
  await ensureShieldTables()
  await rows(sql`INSERT INTO tg_suspect_state (tg_id, state) SELECT unnest(${idArray(ids)}::bigint[]), ${state}
    ON CONFLICT (tg_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`)
}

/** True the first time an account is flagged; someone already reviewed is never flagged again. */
export async function flagSuspect(tgId: number, name: string, reason: string) {
  const r = await rows(sql`INSERT INTO tg_suspect_state (tg_id, state, reason, name) VALUES (${tgId}, 'flagged', ${reason.slice(0, 200)}, ${name.slice(0, 80)})
    ON CONFLICT (tg_id) DO NOTHING RETURNING tg_id`)
  return r.length > 0
}

export async function suspectNames(ids: number[]) {
  const out = new Map<number, string>()
  if (!ids.length) return out
  const r = await rows<{ tg_id: string; name: string }>(sql`SELECT DISTINCT ON (tg_id) tg_id, name FROM (
      SELECT tg_id, name, created_at AS at FROM tg_guard_msgs WHERE tg_id = ANY(${idArray(ids)}::bigint[])
      UNION ALL SELECT tg_id, COALESCE('@' || username, name), joined_at FROM tg_join_log WHERE tg_id = ANY(${idArray(ids)}::bigint[])
      UNION ALL SELECT tg_id, name, updated_at FROM tg_suspect_state WHERE tg_id = ANY(${idArray(ids)}::bigint[]) AND name IS NOT NULL
    ) x WHERE name <> '' ORDER BY tg_id, at DESC`)
  for (const x of r) out.set(Number(x.tg_id), String(x.name))
  return out
}

const PURGE_EVERY_MS = 6 * 60 * 60_000
let lastPurge = 0

/** Old rows only need clearing a few times a day, so the minute tick does not spend queries on it. */
export async function purgeShield() {
  if (Date.now() - lastPurge < PURGE_EVERY_MS) return
  lastPurge = Date.now()
  await ensureShieldTables()
  await rows(sql`DELETE FROM tg_join_log WHERE joined_at < now() - interval '35 days'`)
  await rows(sql`DELETE FROM tg_post_roots WHERE created_at < now() - interval '35 days'`)
  await rows(sql`DELETE FROM tg_thread_locks WHERE until < now() - interval '1 day'`)
}
