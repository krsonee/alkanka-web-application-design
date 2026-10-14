import 'server-only'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { botToken, callBot, ensureTables } from '@/lib/telegram-mirror'

export type ChatMessage = {
  id: number
  author: string
  userId: string | null
  text: string
  origin: 'telegram' | 'site'
  createdAt: string
}

export type ChatConfig = { botId: number; botUsername: string; chatId: string; title: string; inviteUrl: string | null }

export type ChatFeed = {
  configured: boolean
  title: string | null
  members: number | null
  pinned: string | null
  inviteUrl: string | null
  messages: ChatMessage[]
}

export type ChatLink = { tgName: string; tgUsername: string | null }

type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string }
export type TgMessage = {
  message_id: number
  from?: TgUser
  chat: { id: number; type: string; title?: string }
  message_thread_id?: number
  is_automatic_forward?: boolean
  forward_origin?: { type: string; chat?: { id: number }; message_id?: number }
  forward_from_chat?: { id: number }
  forward_from_message_id?: number
  reply_to_message?: TgMessage
  text?: string
  caption?: string
  photo?: unknown[]
  video?: unknown
  sticker?: { emoji?: string }
  pinned_message?: TgMessage
  new_chat_members?: TgUser[]
}
export type TgUpdate = { update_id: number; message?: TgMessage }

const MAX_TEXT = 500
const SEND_COOLDOWN_MS = 3000
const LINK_CODE_TTL_MIN = 15
const MEMBER_CACHE_MS = 10 * 60 * 1000

let chatReady: Promise<void> | null = null
function ensureChatTables() {
  chatReady ??= (async () => {
    await ensureTables()
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_chat_messages (
      id serial PRIMARY KEY, chat_id text NOT NULL, tg_message_id bigint, from_tg_id bigint, user_id text,
      author text NOT NULL, text text NOT NULL, origin text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tg_chat_messages_chat_idx ON tg_chat_messages (chat_id, id DESC)`)
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS tg_chat_messages_tg_uniq ON tg_chat_messages (chat_id, tg_message_id)
      WHERE tg_message_id IS NOT NULL`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_links (
      user_id text PRIMARY KEY, tg_id bigint NOT NULL UNIQUE, tg_username text, tg_name text NOT NULL,
      linked_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_link_codes (
      code text PRIMARY KEY, user_id text NOT NULL, expires_at timestamptz NOT NULL)`)
  })().catch((error) => {
    chatReady = null
    throw error
  })
  return chatReady
}

async function getSettings(keys: string[]) {
  if (!keys.length) return {} as Record<string, string | undefined>
  const r = await rows<{ key: string; value: string }>(sql`SELECT key, value FROM tg_settings WHERE key IN ${keys}`)
  return Object.fromEntries(r.map((s) => [s.key, s.value])) as Record<string, string | undefined>
}

async function setSetting(key: string, value: string) {
  await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

async function clearSettings(keys: string[]) {
  if (!keys.length) return
  await rows(sql`DELETE FROM tg_settings WHERE key IN ${keys}`)
}

const CHAT_KEYS = ['chat_bot_id', 'chat_bot_username', 'chat_id', 'chat_title', 'chat_invite']

export async function getChatConfig(): Promise<ChatConfig | null> {
  await ensureChatTables()
  const s = await getSettings(CHAT_KEYS)
  if (!s.chat_bot_id || !s.chat_id) return null
  return {
    botId: Number(s.chat_bot_id),
    botUsername: s.chat_bot_username ?? '',
    chatId: s.chat_id,
    title: s.chat_title ?? 'Telegram',
    inviteUrl: s.chat_invite ?? null,
  }
}

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function displayName(u?: TgUser) {
  if (!u) return 'Telegram'
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return (full || u.username || 'Telegram').slice(0, 40)
}

export function messageText(m: TgMessage) {
  const body = (m.text ?? m.caption ?? '').trim()
  if (m.photo) return body ? `[Fotoğraf] ${body}` : '[Fotoğraf]'
  if (m.video) return body ? `[Video] ${body}` : '[Video]'
  if (m.sticker) return m.sticker.emoji ?? '[Çıkartma]'
  return body
}

// --- Admin setup ---------------------------------------------------------

export async function connectChat(botId: number, chatInput: string, siteOrigin: string) {
  await ensureChatTables()
  const chat = chatInput.trim()
  const chatRef = /^-?\d{5,20}$/.test(chat) ? chat : `@${chat.replace(/^https?:\/\/(t|telegram)\.me\//i, '').replace(/^@/, '').split(/[/?#]/)[0]}`
  const token = await botToken(botId)
  const me = await callBot<{ id: number; username: string; can_read_all_group_messages?: boolean }>(token, 'getMe')
  const info = await callBot<{ id: number; type: string; title?: string; username?: string; invite_link?: string }>(token, 'getChat', { chat_id: chatRef })
  if (info.type !== 'group' && info.type !== 'supergroup') throw new Error('Bu bir sohbet grubu değil. Kanal değil, üyelerin yazabildiği grubu seç')
  const member = await callBot<{ status: string }>(token, 'getChatMember', { chat_id: info.id, user_id: me.id })
  const isAdmin = member.status === 'administrator' || member.status === 'creator'
  if (!isAdmin && !me.can_read_all_group_messages) {
    throw new Error('Bot gruptaki mesajları okuyamıyor. Botu grupta yönetici yap ya da BotFather’da /setprivacy → Disable yap')
  }
  if (!['administrator', 'creator', 'member'].includes(member.status)) throw new Error('Bot bu grupta değil. Önce botu gruba ekle')

  const secret = randomBytes(24).toString('base64url')
  await callBot(token, 'setWebhook', {
    url: `${siteOrigin}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  })

  const invite = info.username ? `https://t.me/${info.username}` : (info.invite_link ?? null)
  await setSetting('chat_bot_id', String(botId))
  await setSetting('chat_bot_username', me.username)
  await setSetting('chat_id', String(info.id))
  await setSetting('chat_title', info.title ?? 'Telegram')
  await setSetting('chat_secret', secret)
  if (invite) await setSetting('chat_invite', invite)
  else await clearSettings(['chat_invite'])
  await clearSettings(['chat_members', 'chat_members_at'])
  return info.title ?? 'Telegram'
}

export async function disconnectChat() {
  const config = await getChatConfig()
  if (config) {
    try {
      await callBot(await botToken(config.botId), 'deleteWebhook')
    } catch {
      // The bot may already be removed; clearing local settings is what matters.
    }
  }
  await clearSettings([...CHAT_KEYS, 'chat_secret', 'chat_pinned', 'chat_members', 'chat_members_at'])
}

export async function chatStatus() {
  const config = await getChatConfig()
  if (!config) return null
  let webhook: { url: string; pending: number; lastError: string | null } | null = null
  try {
    const info = await callBot<{ url: string; pending_update_count: number; last_error_message?: string }>(await botToken(config.botId), 'getWebhookInfo')
    webhook = { url: info.url, pending: info.pending_update_count, lastError: info.last_error_message ?? null }
  } catch {
    webhook = null
  }
  const [{ count }] = await rows<{ count: string }>(sql`SELECT count(*) FROM tg_chat_messages WHERE chat_id = ${config.chatId}`)
  const [{ linked }] = await rows<{ linked: string }>(sql`SELECT count(*) AS linked FROM tg_links`)
  return { ...config, webhook, messageCount: Number(count), linkedMembers: Number(linked) }
}

// --- Webhook ---------------------------------------------------------------

export async function verifyWebhookSecret(header: string | null) {
  await ensureChatTables()
  const { chat_secret: secret } = await getSettings(['chat_secret'])
  if (!secret || !header) return false
  const a = Buffer.from(secret)
  const b = Buffer.from(header)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function handleUpdate(update: TgUpdate) {
  const m = update.message
  if (!m) return
  const config = await getChatConfig()
  if (!config) return
  if (m.chat.type !== 'private') {
    // Imported lazily to keep telegram-bots out of the chat module's import graph.
    const { handleShareMessage } = await import('@/lib/telegram-bots')
    if (await handleShareMessage(m, config.botId)) return
  }
  if (!m.from || m.from.is_bot) return

  if (m.chat.type === 'private') {
    const code = m.text?.match(/^\/start\s+([A-Za-z0-9_-]{8,64})$/)?.[1]
    const token = await botToken(config.botId)
    const reply = (text: string) => callBot(token, 'sendMessage', { chat_id: m.chat.id, text })
    if (!code) {
      await reply('Merhaba! Hesabını bağlamak için sitedeki sohbet panelinden "Telegram’ı bağla" butonuna bas.')
      return
    }
    const linked = await linkWithCode(code, m.from)
    await reply(linked ? 'Hesabın bağlandı! Artık siteden sohbete yazabilirsin.' : 'Bu bağlantı kodu geçersiz ya da süresi dolmuş. Siteden yeni kod al.')
    return
  }

  if (String(m.chat.id) !== config.chatId) {
    // Imported lazily: telegram-channels depends on this module.
    const { handleDiscussionMessage } = await import('@/lib/telegram-channels')
    await handleDiscussionMessage(m)
    return
  }

  if (m.pinned_message) {
    const pinned = messageText(m.pinned_message)
    if (pinned) await setSetting('chat_pinned', pinned.slice(0, 300))
    return
  }
  if (m.new_chat_members) return

  const text = messageText(m)
  if (!text) return
  const link = await rows<{ user_id: string }>(sql`SELECT user_id FROM tg_links WHERE tg_id = ${m.from.id}`)
  await rows(sql`INSERT INTO tg_chat_messages (chat_id, tg_message_id, from_tg_id, user_id, author, text, origin)
    VALUES (${config.chatId}, ${m.message_id}, ${m.from.id}, ${link[0]?.user_id ?? null}, ${displayName(m.from)},
      ${text.slice(0, 1000)}, 'telegram')
    ON CONFLICT DO NOTHING`)
}

// --- Account linking -------------------------------------------------------

export async function getLink(userId: string): Promise<ChatLink | null> {
  await ensureChatTables()
  const r = await rows<{ tg_name: string; tg_username: string | null }>(sql`SELECT tg_name, tg_username FROM tg_links WHERE user_id = ${userId}`)
  return r[0] ? { tgName: r[0].tg_name, tgUsername: r[0].tg_username } : null
}

export async function createLinkCode(userId: string) {
  const config = await getChatConfig()
  if (!config) throw new Error('Sohbet grubu henüz bağlanmadı.')
  await rows(sql`DELETE FROM tg_link_codes WHERE user_id = ${userId} OR expires_at < now()`)
  const code = randomBytes(12).toString('base64url')
  await rows(sql`INSERT INTO tg_link_codes (code, user_id, expires_at)
    VALUES (${code}, ${userId}, now() + make_interval(mins => ${LINK_CODE_TTL_MIN}))`)
  return `https://t.me/${config.botUsername}?start=${code}`
}

async function linkWithCode(code: string, from: TgUser) {
  const r = await rows<{ user_id: string }>(sql`DELETE FROM tg_link_codes WHERE code = ${code} AND expires_at > now() RETURNING user_id`)
  const userId = r[0]?.user_id
  if (!userId) return false
  await rows(sql`DELETE FROM tg_links WHERE tg_id = ${from.id} AND user_id <> ${userId}`)
  await rows(sql`INSERT INTO tg_links (user_id, tg_id, tg_username, tg_name) VALUES (${userId}, ${from.id}, ${from.username ?? null}, ${displayName(from)})
    ON CONFLICT (user_id) DO UPDATE SET tg_id = EXCLUDED.tg_id, tg_username = EXCLUDED.tg_username, tg_name = EXCLUDED.tg_name, linked_at = now()`)
  return true
}

const JOINED_CACHE_MS = 5 * 60 * 1000
const NOT_JOINED_CACHE_MS = 8_000
const joinedCache = new Map<string, { at: number; joined: boolean }>()

export async function isGroupMember(userId: string): Promise<boolean> {
  const hit = joinedCache.get(userId)
  if (hit && Date.now() - hit.at < (hit.joined ? JOINED_CACHE_MS : NOT_JOINED_CACHE_MS)) return hit.joined
  const config = await getChatConfig()
  if (!config) return false
  const link = await rows<{ tg_id: string }>(sql`SELECT tg_id FROM tg_links WHERE user_id = ${userId}`)
  if (!link[0]) return false
  const member = await callBot<{ status: string }>(await botToken(config.botId), 'getChatMember', {
    chat_id: config.chatId,
    user_id: Number(link[0].tg_id),
  }).catch(() => null)
  if (!member) return hit?.joined ?? false
  const joined = !['left', 'kicked'].includes(member.status)
  joinedCache.set(userId, { at: Date.now(), joined })
  return joined
}

export async function unlink(userId: string) {
  await ensureChatTables()
  await rows(sql`DELETE FROM tg_links WHERE user_id = ${userId}`)
}

// --- Feed & sending --------------------------------------------------------

async function memberCount(config: ChatConfig) {
  const s = await getSettings(['chat_members', 'chat_members_at'])
  if (s.chat_members && Date.now() - Number(s.chat_members_at) < MEMBER_CACHE_MS) return Number(s.chat_members)
  try {
    const count = await callBot<number>(await botToken(config.botId), 'getChatMemberCount', { chat_id: config.chatId })
    await setSetting('chat_members', String(count))
    await setSetting('chat_members_at', String(Date.now()))
    return count
  } catch {
    return s.chat_members ? Number(s.chat_members) : null
  }
}

export async function getFeed(): Promise<ChatFeed> {
  const config = await getChatConfig()
  if (!config) return { configured: false, title: null, members: null, pinned: null, inviteUrl: null, messages: [] }
  const [members, settings, r] = await Promise.all([
    memberCount(config),
    getSettings(['chat_pinned']),
    rows(sql`SELECT id, author, user_id, text, origin, created_at FROM tg_chat_messages WHERE chat_id = ${config.chatId} ORDER BY id DESC LIMIT 50`),
  ])
  return {
    configured: true,
    title: config.title,
    members,
    pinned: settings.chat_pinned ?? null,
    inviteUrl: config.inviteUrl,
    messages: r.reverse().map((m) => ({
      id: Number(m.id),
      author: String(m.author),
      userId: m.user_id ? String(m.user_id) : null,
      text: String(m.text),
      origin: m.origin === 'site' ? 'site' : 'telegram',
      createdAt: new Date(String(m.created_at)).toISOString(),
    })),
  }
}

export async function sendFromSite(userId: string, rawText: string) {
  const text = rawText.replace(/\s+/g, ' ').trim()
  if (!text) throw new Error('Mesaj boş olamaz.')
  if (text.length > MAX_TEXT) throw new Error(`Mesaj en fazla ${MAX_TEXT} karakter olabilir.`)
  const config = await getChatConfig()
  if (!config) throw new Error('Sohbet grubu henüz bağlanmadı.')

  const link = await rows<{ tg_id: string; tg_name: string }>(sql`SELECT tg_id, tg_name FROM tg_links WHERE user_id = ${userId}`)
  if (!link[0]) throw new Error('Yazmak için önce Telegram hesabını bağla.')

  const last = await rows<{ created_at: string }>(sql`SELECT created_at FROM tg_chat_messages
    WHERE user_id = ${userId} AND origin = 'site' ORDER BY id DESC LIMIT 1`)
  if (last[0] && Date.now() - new Date(last[0].created_at).getTime() < SEND_COOLDOWN_MS) throw new Error('Biraz yavaş kanka, birkaç saniye bekle.')

  const token = await botToken(config.botId)
  const member = await callBot<{ status: string; can_send_messages?: boolean }>(token, 'getChatMember', {
    chat_id: config.chatId,
    user_id: Number(link[0].tg_id),
  }).catch(() => ({ status: 'left' }) as { status: string; can_send_messages?: boolean })
  if (['left', 'kicked'].includes(member.status)) {
    joinedCache.set(userId, { at: Date.now(), joined: false })
    throw new Error('Yazabilmek için önce Telegram sohbet grubuna katılmalısın.')
  }
  if (member.status === 'restricted' && member.can_send_messages === false) throw new Error('Bu grupta yazma iznin kısıtlanmış.')

  const author = link[0].tg_name
  const sent = await callBot<{ message_id: number }>(token, 'sendMessage', {
    chat_id: config.chatId,
    text: `<b>${escapeHtml(author)}</b> <i>(site)</i>: ${escapeHtml(text)}`,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  })
  await rows(sql`INSERT INTO tg_chat_messages (chat_id, tg_message_id, from_tg_id, user_id, author, text, origin)
    VALUES (${config.chatId}, ${sent.message_id}, ${Number(link[0].tg_id)}, ${userId}, ${author}, ${text}, 'site')
    ON CONFLICT DO NOTHING`)
}
