import 'server-only'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { botToken, callBot, ensureTables, normalizeChat } from '@/lib/telegram-mirror'
import { DEFAULT_HUB, type HubConfig, type HubLogRow, type HubStats, type LeaderRow } from '@/lib/tg-hub-shared'
import type { TgMessage } from '@/lib/telegram-chat'

export type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string }
export type TgCallback = { id: string; from: TgUser; data?: string; message?: TgMessage }
export type TgJoinRequest = { chat: { id: number; title?: string }; from: TgUser; user_chat_id?: number; date: number }
export type TgMemberState = { status: string; user: TgUser; is_member?: boolean; can_delete_messages?: boolean; can_restrict_members?: boolean }
export type TgMemberUpdate = {
  chat: { id: number; type: string; title?: string }
  from: TgUser
  date: number
  old_chat_member: TgMemberState
  new_chat_member: TgMemberState
  invite_link?: { name?: string; invite_link?: string }
  via_join_request?: boolean
  via_chat_folder_invite_link?: boolean
}
/** `user` is missing when an anonymous admin or a channel reacted. */
export type TgReaction = { chat: { id: number; type: string; title?: string }; message_id: number; user?: TgUser; date: number; old_reaction: unknown[]; new_reaction: unknown[] }
export type HubUpdate = {
  update_id: number
  message?: TgMessage
  edited_message?: TgMessage
  channel_post?: TgMessage
  callback_query?: TgCallback
  chat_join_request?: TgJoinRequest
  chat_member?: TgMemberUpdate
  my_chat_member?: TgMemberUpdate
  message_reaction?: TgReaction
}
export type LogUndo = { kind: 'warn' | 'mute' | 'ban'; chatId: string; tgIds: number[]; trust: number; warns: number }

const HUB_KEY = 'hub_config'
const HOOK_UPDATES = ['message', 'edited_message', 'channel_post', 'callback_query', 'chat_join_request']
const MEMBER_UPDATES = ['chat_member', 'my_chat_member']

/**
 * Telegram only sends member changes and reactions when asked, and each one is a webhook call that wakes
 * the database. The guard bot asks for them only while something that needs them is switched on.
 */
async function hookUpdatesFor(hub: HubConfig, botId: number) {
  if (hub.guardBotId !== botId || !hub.guard.enabled) return HOOK_UPDATES
  const out = [...HOOK_UPDATES]
  // A campaign link can only count its joins from member updates.
  const openInvites = () => import('@/lib/tg-invites').then((m) => m.hasOpenInvites()).catch(() => false)
  if (hub.shield.channelJoinAlert > 0 || hub.shield.adminAlerts || (await openInvites())) out.push(...MEMBER_UPDATES)
  if (hub.shield.reactionLimit > 0) out.push('message_reaction')
  return out
}

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
    await rows(sql`ALTER TABLE tg_links ADD COLUMN IF NOT EXISTS dm_blocked boolean NOT NULL DEFAULT false`).catch(() => null)
    await rows(sql`ALTER TABLE tg_broadcasts ADD COLUMN IF NOT EXISTS blocked int NOT NULL DEFAULT 0`)
    await rows(sql`ALTER TABLE tg_broadcasts
      ADD COLUMN IF NOT EXISTS photo_path text, ADD COLUMN IF NOT EXISTS photo_file_id text, ADD COLUMN IF NOT EXISTS buttons text,
      ADD COLUMN IF NOT EXISTS send_at timestamptz, ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all',
      ADD COLUMN IF NOT EXISTS author text, ADD COLUMN IF NOT EXISTS note text,
      ADD COLUMN IF NOT EXISTS finished_at timestamptz, ADD COLUMN IF NOT EXISTS lease_until timestamptz`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_seen_updates (
      bot_id int NOT NULL, update_id bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (bot_id, update_id))`)
    // Added without a default first: members who were already here keep NULL and are never treated as newcomers.
    await rows(sql`ALTER TABLE tg_trust ADD COLUMN IF NOT EXISTS first_seen timestamptz`)
    await rows(sql`ALTER TABLE tg_trust ALTER COLUMN first_seen SET DEFAULT now()`)
    await rows(sql`ALTER TABLE tg_trust ADD COLUMN IF NOT EXISTS needs_check boolean NOT NULL DEFAULT false`)
    await rows(sql`ALTER TABLE tg_mod_log ADD COLUMN IF NOT EXISTS undo text`)
    await rows(sql`ALTER TABLE tg_mod_log ADD COLUMN IF NOT EXISTS undone boolean NOT NULL DEFAULT false`)
    await rows(sql`ALTER TABLE tg_guard_msgs ADD COLUMN IF NOT EXISTS thread_id bigint`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tg_mod_log_user_idx ON tg_mod_log (tg_id, id DESC) WHERE tg_id IS NOT NULL`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export async function getSetting(key: string) {
  const r = await rows<{ value: string }>(sql`SELECT value FROM tg_settings WHERE key = ${key}`)
  return r[0]?.value ?? null
}

export async function setSetting(key: string, value: string) {
  await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

/** Older live-chat webhooks were set without button clicks or join requests; re-applies the full list hourly. */
export async function healChatHook() {
  const last = Number((await getSetting('chat_hook_checked_at')) ?? 0)
  if (Date.now() - last < 60 * 60 * 1000) return
  await setSetting('chat_hook_checked_at', String(Date.now()))
  await syncGuardHook().catch((error) => console.error('[tg-hub] guard hook sync failed', error))
  const botId = Number(await getSetting('chat_bot_id'))
  const secret = await getSetting('chat_secret')
  if (!botId || !secret) return
  const token = await botToken(botId)
  const info = await callBot<{ url: string; allowed_updates?: string[] }>(token, 'getWebhookInfo')
  if (!info.url) return
  const have = info.allowed_updates ?? []
  if (HOOK_UPDATES.every((u) => have.includes(u))) return
  await callBot(token, 'setWebhook', { url: info.url, secret_token: secret, allowed_updates: await hookUpdatesFor(await getHub(), botId) })
}

/** Makes the guard bot's webhook ask for exactly the update types the current settings need. */
export async function syncGuardHook() {
  const hub = await getHub()
  const botId = hub.guardBotId
  if (!botId) return
  const secret = await getSetting(`hook_secret_${botId}`)
  if (!secret) return
  const token = await botToken(botId)
  const info = await callBot<{ url: string; allowed_updates?: string[] }>(token, 'getWebhookInfo')
  if (!info.url.endsWith(`/api/telegram/hook/${botId}`)) return
  const want = await hookUpdatesFor(hub, botId)
  const have = info.allowed_updates ?? []
  if (want.length === have.length && want.every((u) => have.includes(u))) return
  await callBot(token, 'setWebhook', { url: info.url, secret_token: secret, allowed_updates: want })
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
  const info = await callBot<{ id: number; title?: string; type: string; linked_chat_id?: number }>(token, 'getChat', { chat_id: ref })
  const me = await callBot<{ id: number }>(token, 'getMe')
  const member = await callBot<{ status: string }>(token, 'getChatMember', { chat_id: info.id, user_id: me.id })
  return {
    id: String(info.id),
    title: info.title ?? String(info.id),
    type: info.type,
    /** For a channel: its comment group. For a group: the channel it serves as comment group for. */
    linkedChatId: info.linked_chat_id ? String(info.linked_chat_id) : undefined,
    isAdmin: ['administrator', 'creator'].includes(member.status),
  }
}

/** Protected chats saved before their kind was recorded get it filled in once, so the panel can tell channels from groups. */
export async function fillGroupDetails(hub: HubConfig): Promise<HubConfig> {
  if (!hub.guardBotId || hub.groups.every((g) => g.type)) return hub
  const token = await botToken(hub.guardBotId)
  const groups = await Promise.all(
    hub.groups.map(async (g) => {
      if (g.type) return g
      const info = await callBot<{ type: string; linked_chat_id?: number }>(token, 'getChat', { chat_id: g.chatId }).catch(() => null)
      return info ? { ...g, type: info.type, linkedChatId: info.linked_chat_id ? String(info.linked_chat_id) : undefined } : g
    }),
  )
  if (groups.every((g, i) => g === hub.groups[i])) return hub
  const next = { ...hub, groups }
  await saveHub(next)
  return next
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
    allowed_updates: await hookUpdatesFor(await getHub(), botId),
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

/**
 * Telegram delivers an update again when the webhook answers too slowly. The first delivery wins,
 * so one message can never earn two warnings. Returns false for a repeat.
 */
export async function claimUpdate(botId: number, updateId: unknown) {
  if (!Number.isSafeInteger(updateId)) return true
  await ensureHubTables()
  const r = await rows(sql`INSERT INTO tg_seen_updates (bot_id, update_id) VALUES (${botId}, ${Number(updateId)})
    ON CONFLICT DO NOTHING RETURNING update_id`)
  return r.length > 0
}

/** Routes one Telegram update to every role this bot plays. */
export async function dispatchUpdate(botId: number, update: HubUpdate) {
  const hub = await getHub()
  const { getChatConfig, handleUpdate } = await import('@/lib/telegram-chat')
  const chat = await getChatConfig().catch(() => null)
  const isGuard = hub.guardBotId === botId && hub.guard.enabled
  const isSupport = hub.supportBotId === botId && hub.support.enabled
  const isChat = chat?.botId === botId

  // Writing to the bot again means the member unblocked it, so DM broadcasts may reach them once more.
  if (isChat && update.message?.chat.type === 'private' && update.message.from) {
    await rows(sql`UPDATE tg_links SET dm_blocked = false WHERE tg_id = ${update.message.from.id} AND dm_blocked`).catch(() => null)
  }

  if (update.callback_query) {
    const data = update.callback_query.data ?? ''
    if (data === 'dm:off') return dmOptOut(botId, update.callback_query)
    // Buttons under panel posts work for whichever bot sent the post, whatever other role it has.
    if (data.startsWith('pb:')) {
      const { handlePostCallback } = await import('@/lib/tg-posts')
      return handlePostCallback(botId, update.callback_query)
    }
    if (isGuard && /^(cap|cq|gd|wp):/.test(data)) {
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

  if (update.message_reaction) {
    if (isGuard) {
      const { handleReaction } = await import('@/lib/tg-guard')
      await handleReaction(botId, update.message_reaction)
    }
    return
  }

  const member = update.chat_member ?? update.my_chat_member
  if (member) {
    if (isGuard) {
      const { handleMemberUpdate } = await import('@/lib/tg-guard')
      await handleMemberUpdate(botId, member, Boolean(update.my_chat_member))
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

  if (update.channel_post && isGuard) {
    const { guardChannelPost } = await import('@/lib/tg-guard')
    if (await guardChannelPost(botId, update.channel_post)) return
  }
  if (update.channel_post) {
    const { noteChannelPost } = await import('@/lib/tg-post-manual')
    await noteChannelPost(botId, update.channel_post).catch((error) => console.error('[tg-hub] channel post not filed', error))
  }

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

export async function modLog(input: {
  chatId?: string | number
  chatTitle?: string
  user?: TgUser
  action: string
  reason: string
  notify?: boolean
  /** Extra buttons under the log-group message; `data` is handled by the guard's callback handler. */
  buttons?: { text: string; data: string }[]
  /** Lets staff reverse this action from the log group or the panel. */
  undo?: LogUndo
}) {
  await ensureHubTables()
  const [row] = await rows<{ id: number }>(sql`INSERT INTO tg_mod_log (chat_id, chat_title, tg_id, who, action, reason, undo)
    VALUES (${input.chatId != null ? String(input.chatId) : null}, ${input.chatTitle ?? null}, ${input.user?.id ?? null},
      ${input.user ? who(input.user) : null}, ${input.action}, ${input.reason.slice(0, 500)}, ${input.undo ? JSON.stringify(input.undo) : null})
    RETURNING id`)
  if (input.notify === false) return
  const buttons = [...(input.buttons ?? []), ...(input.undo ? [{ text: 'Geri al', data: `gd:undo:${row.id}` }] : [])]
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
    reply_markup: buttons.length ? { inline_keyboard: buttons.map((b) => [{ text: b.text, callback_data: b.data }]) } : undefined,
  }).catch((error) => console.error('[tg-hub] log send failed', error))
}

/** Columns every log reader selects, so `mapLogRow` always finds what it needs. */
export const LOG_COLUMNS = sql`id, action, chat_id, chat_title, tg_id, who, reason, created_at, (undo IS NOT NULL AND NOT undone) AS can_undo`

export function mapLogRow(x: Record<string, unknown>): HubLogRow {
  return {
    id: Number(x.id),
    action: String(x.action),
    chatId: x.chat_id == null ? null : String(x.chat_id),
    chatTitle: String(x.chat_title ?? ''),
    tgId: x.tg_id == null ? null : Number(x.tg_id),
    who: String(x.who ?? ''),
    reason: String(x.reason ?? ''),
    createdAt: new Date(String(x.created_at)).toISOString(),
    canUndo: Boolean(x.can_undo),
  }
}

export async function listModLog(limit = 40): Promise<HubLogRow[]> {
  await ensureHubTables()
  const r = await rows(sql`SELECT ${LOG_COLUMNS} FROM tg_mod_log ORDER BY id DESC LIMIT ${limit}`)
  return r.map(mapLogRow)
}

// --- Trust score -------------------------------------------------------------

export async function trustOf(tgId: number) {
  await ensureHubTables()
  const r = await rows<{ score: number; trusted: boolean; first_seen: string | Date | null; needs_check: boolean }>(
    sql`SELECT score, trusted, first_seen, needs_check FROM tg_trust WHERE tg_id = ${tgId}`,
  )
  return {
    score: r[0] ? Number(r[0].score) : 50,
    trusted: Boolean(r[0]?.trusted),
    /** False until the guard has met this account at least once. */
    known: Boolean(r[0]),
    /** When the guard first met the account; null for members who were here before newcomer tracking existed. */
    firstSeen: r[0]?.first_seen ? new Date(r[0].first_seen).getTime() : null,
    needsCheck: Boolean(r[0]?.needs_check),
  }
}

/** Starts the newcomer clock the first time the guard meets an account. */
export async function meetMember(tgId: number, needsCheck = false) {
  await rows(sql`INSERT INTO tg_trust (tg_id, needs_check) VALUES (${tgId}, ${needsCheck}) ON CONFLICT (tg_id) DO NOTHING`)
}

export async function setNeedsCheck(tgId: number, needsCheck: boolean) {
  await rows(sql`INSERT INTO tg_trust (tg_id, needs_check) VALUES (${tgId}, ${needsCheck})
    ON CONFLICT (tg_id) DO UPDATE SET needs_check = EXCLUDED.needs_check`)
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

// --- DM helpers (the announcements themselves live in tg-broadcast.ts) ---------

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
