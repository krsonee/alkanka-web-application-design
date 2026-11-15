import 'server-only'
import { createHash } from 'node:crypto'
import { generateText } from 'ai'
import { rows, sql } from '@/lib/db'
import { botToken, callBot } from '@/lib/telegram-mirror'
import type { TgMessage } from '@/lib/telegram-chat'
import {
  adjustTrust,
  chatLeaderboard,
  dailyTrustBump,
  getHub,
  meetMember,
  modLog,
  setNeedsCheck,
  setTrusted,
  trustOf,
  weekStart,
  who,
  type LogUndo,
  type TgCallback,
  type TgJoinRequest,
  type TgMemberState,
  type TgMemberUpdate,
  type TgUser,
} from '@/lib/tg-hub'
import { CAPTCHA_MINUTES, CONTENT_KINDS, NEW_MEMBER_HOURS, RAID_BAN_MINUTES, WAVE_MINUTES, rulesFor, type GroupRules, type HubConfig, type MemberAction } from '@/lib/tg-hub-shared'
import {
  adminLookalike,
  chatAdmins,
  claimAlert,
  closeInvites,
  confirmTwice,
  contentKinds,
  dueLocks,
  ensureShieldTables,
  extendLock,
  flagSuspect,
  hiddenLinks,
  invitedBy,
  lockChat,
  lockThread,
  logChannelJoin,
  logJoin,
  markPostRoot,
  markRemoved,
  raidActive,
  setSuspectState,
  staffWordInName,
  suspectNames,
  swarmHits,
  sweepWave,
  threadState,
  unlockChat,
  unlockThread,
  waveMembers,
  type ShieldMsg,
  type SwarmHit,
} from '@/lib/tg-shield'
import { autoReply } from '@/lib/tg-autoreply'

type GuardMsg = ShieldMsg & {
  entities?: { type: string; url?: string; offset: number; length: number }[]
  caption_entities?: { type: string; url?: string; offset: number; length: number }[]
}

const AI_MODEL = 'google/gemini-3.5-flash'
const RAID_WINDOW_SEC = 60
const RAID_REASON = `Baskın koruması: ${RAID_BAN_MINUTES} dakikalığına çıkarıldı (kalıcı ban değil)`
const PURGE_MAX = 300
const SWARM_MIN_LENGTH = 20
const ADMIN_CACHE_MS = 10 * 60 * 1000

let guardReady: Promise<void> | null = null
function ensureGuardTables() {
  guardReady ??= (async () => {
    await ensureShieldTables()
    await rows(sql`ALTER TABLE tg_captcha ADD COLUMN IF NOT EXISTS msg_id bigint`)
    await rows(sql`ALTER TABLE tg_captcha ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'join'`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_autodel (id serial PRIMARY KEY, chat_id text NOT NULL, message_id bigint NOT NULL, due_at timestamptz NOT NULL)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_wipe (chat_id text PRIMARY KEY, bot_id int NOT NULL, title text NOT NULL DEFAULT '',
      next_id bigint NOT NULL, total bigint NOT NULL, done bigint NOT NULL DEFAULT 0, started_by text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`ALTER TABLE tg_wipe ADD COLUMN IF NOT EXISTS note text`)
  })().catch((error) => {
    guardReady = null
    throw error
  })
  return guardReady
}

// --- Telegram helpers --------------------------------------------------------

const adminCache = new Map<string, { at: number; admin: boolean }>()
async function isChatAdmin(token: string, chatId: number | string, userId: number) {
  const key = `${chatId}:${userId}`
  const hit = adminCache.get(key)
  if (hit && Date.now() - hit.at < ADMIN_CACHE_MS) return hit.admin
  const m = await callBot<{ status: string }>(token, 'getChatMember', { chat_id: chatId, user_id: userId }).catch(() => ({ status: 'member' }))
  const admin = m.status === 'administrator' || m.status === 'creator'
  adminCache.set(key, { at: Date.now(), admin })
  return admin
}

/** Mirrored Telegram messages live in the site chat too; whatever the guard removes in Telegram must vanish there as well. */
let removedReady: Promise<unknown> | null = null
async function dropFromSite(chatId: number | string, ids: number[]) {
  if (!ids.length) return
  const chat = String(chatId)
  try {
    removedReady ??= rows(sql`CREATE TABLE IF NOT EXISTS tg_site_removed (chat_id text NOT NULL, tg_message_id bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (chat_id, tg_message_id))`).catch((error) => {
      removedReady = null
      throw error
    })
    await removedReady
    await rows(sql`INSERT INTO tg_site_removed (chat_id, tg_message_id) SELECT ${chat}, unnest(${`{${ids.join(',')}}`}::bigint[]) ON CONFLICT DO NOTHING`)
    await rows(sql`DELETE FROM tg_chat_messages WHERE chat_id = ${chat} AND tg_message_id IN ${ids}`)
  } catch {
    // Site cleanup must never block the Telegram moderation action.
  }
}

function dropUserFromSite(chatId: number | string, userId: number) {
  return rows(sql`DELETE FROM tg_chat_messages WHERE chat_id = ${String(chatId)} AND from_tg_id = ${userId}`)
    .then(() => undefined)
    .catch(() => undefined)
}

const del = async (token: string, chatId: number | string, messageId: number) => {
  await dropFromSite(chatId, [messageId])
  return callBot(token, 'deleteMessage', { chat_id: chatId, message_id: messageId }).catch(() => null)
}

async function mute(token: string, chatId: number | string, userId: number, minutes: number) {
  await callBot(token, 'restrictChatMember', {
    chat_id: chatId,
    user_id: userId,
    permissions: { can_send_messages: false },
    until_date: Math.floor(Date.now() / 1000) + Math.max(1, minutes) * 60,
  })
}

async function unmute(token: string, chatId: number | string, userId: number) {
  await callBot(token, 'restrictChatMember', {
    chat_id: chatId,
    user_id: userId,
    permissions: {
      can_send_messages: true,
      can_send_audios: true,
      can_send_documents: true,
      can_send_photos: true,
      can_send_videos: true,
      can_send_video_notes: true,
      can_send_voice_notes: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_invite_users: true,
    },
  })
}

async function ban(token: string, chatId: number | string, userId: number) {
  await dropUserFromSite(chatId, userId)
  await callBot(token, 'banChatMember', { chat_id: chatId, user_id: userId, revoke_messages: true })
}

/**
 * Telegram lifts this ban by itself, so a real member caught in a raid can simply join again later.
 * One call on purpose: a ban followed by a separate unban would turn permanent whenever the unban is rate-limited.
 */
async function tempBan(token: string, chatId: number | string, userId: number, minutes: number) {
  await callBot(token, 'banChatMember', { chat_id: chatId, user_id: userId, until_date: Math.floor(Date.now() / 1000) + minutes * 60 })
}

async function kick(token: string, chatId: number | string, userId: number) {
  await callBot(token, 'banChatMember', { chat_id: chatId, user_id: userId })
  await callBot(token, 'unbanChatMember', { chat_id: chatId, user_id: userId, only_if_banned: true })
}

async function notice(token: string, chatId: number | string, text: string, seconds = 20, replyTo?: number) {
  const sent = await callBot<{ message_id: number }>(token, 'sendMessage', {
    chat_id: chatId,
    text,
    link_preview_options: { is_disabled: true },
    reply_parameters: replyTo ? { message_id: replyTo, allow_sending_without_reply: true } : undefined,
  }).catch(() => null)
  if (!sent) return
  // Serverless functions freeze after responding, so cleanup is queued for the background tick.
  await rows(sql`INSERT INTO tg_autodel (chat_id, message_id, due_at)
    VALUES (${String(chatId)}, ${sent.message_id}, now() + make_interval(secs => ${seconds}))`).catch(() => null)
}

/** A deleted message earns one explanation a minute per person, so a spammer cannot make the bot flood the chat. */
const noticeAt = new Map<string, number>()
function mayNotice(key: string) {
  const now = Date.now()
  if (now - (noticeAt.get(key) ?? 0) < 60_000) return false
  if (noticeAt.size > 2000) noticeAt.clear()
  noticeAt.set(key, now)
  return true
}

export async function flushAutoDelete() {
  await ensureGuardTables()
  const hub = await getHub()
  if (!hub.guardBotId) return 0
  const token = await botToken(hub.guardBotId)
  const due = await rows(sql`DELETE FROM tg_autodel WHERE due_at < now() RETURNING chat_id, message_id`)
  for (const d of due) await del(token, String(d.chat_id), Number(d.message_id))
  return due.length
}

const short = (u?: TgUser) => (u ? (u.username ? `@${u.username}` : [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Üye') : 'Üye')

// --- Text analysis -----------------------------------------------------------

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' }

export function normalizeText(s: string) {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[ıİ]/g, 'i')
    .replace(/[^a-zçğıöşü\s]/g, ' ')
    .replace(/(.)\1{2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function findBadWord(text: string, words: string[]) {
  const norm = normalizeText(text)
  if (!norm) return null
  const tokens = norm.split(' ')
  const squashed = norm.replace(/\s/g, '')
  for (const raw of words) {
    const w = normalizeText(raw)
    if (!w) continue
    if (tokens.some((t) => t === w || (w.length >= 4 && t.startsWith(w)))) return raw
    // Catches spaced-out spellings like "o r o s p u" for longer words.
    if (w.length >= 5 && squashed.includes(w)) return raw
  }
  return null
}

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s]+|(?:t\.me|telegram\.me|telegram\.dog)\/[^\s]+|[a-z0-9-]+\.(?:com|net|org|io|bet|xyz|site|online|club|top|info|me|co|tv|link|live|win|vip|app)(?:\/[^\s]*)?)/gi

function foreignLinks(m: GuardMsg, allow: string[]) {
  const text = m.text ?? m.caption ?? ''
  const found = new Set<string>(text.match(URL_RE) ?? [])
  for (const e of [...(m.entities ?? []), ...(m.caption_entities ?? [])]) {
    if (e.type === 'text_link' && e.url) found.add(e.url)
    if (e.type === 'url') found.add(text.slice(e.offset, e.offset + e.length))
    if (e.type === 'mention') {
      const mention = text.slice(e.offset, e.offset + e.length).toLowerCase()
      // Usernames ending in "bot"/"channel"/"kanal" are almost always ads.
      if (/(bot|channel|kanal|vip|bonus)$/.test(mention)) found.add(`t.me/${mention.slice(1)}`)
    }
  }
  return foreignOnly([...found], allow)
}

function foreignOnly(links: string[], allow: string[]) {
  const allowed = allow.map((a) => a.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, ''))
  return links.filter((link) => {
    const clean = link.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')
    return !allowed.some((a) => a && clean.startsWith(a))
  })
}

/** Ads that hide outside the message text. Chats on the protected list are our own, so quoting them is fine. */
function hiddenAdReason(m: GuardMsg, allow: string[], ownChats: Set<string>) {
  const links = foreignOnly([...hiddenLinks(m), ...((m.quote?.text ?? '').match(URL_RE) ?? [])], allow)
  if (links.length) return `Gizlenmiş link (buton ya da alıntı): ${links[0].slice(0, 60)}`
  const source = m.external_reply?.chat
  if (source?.type === 'channel' && source.id !== m.chat.id && !ownChats.has(String(source.id))) return 'Başka kanaldan alıntı'
  if (m.story) return 'Hikâye iletme'
  return null
}

const isForwardedFromChannel = (m: GuardMsg) => m.forward_origin?.type === 'channel' || Boolean(m.forward_from_chat)

// Spammers dodge URL matching with "t . me/x", "site nokta com", "hxxp" etc.
const SPACED_LINK_RE = /(?:\bt\s*[.,·]\s*me\s*\/|\btelegram\s*[.,·]\s*(?:me|dog)\b|\bh(?:tt|xx)ps?\s*:\s*\/|\bwww\s*[.,·])|\b[a-z0-9-]{3,}\s*(?:[.,·]|\(dot\)|\[dot\]|\snokta\s|\sdot\s)\s*(?:com|net|org|bet|xyz|site|online|club|top|info|io|vip|win|live|link|tv|app|pro|cc)\b/gi
const PHONE_RE = /(?:\+?\d[\s().-]{0,2}){10,}/
const CONTACT_RE = /\b(?:whats?app|watsap|vatsap|wp|dm|özelden|ozelden|özelime|özele|inbox|pm\s*at|bana\s*yaz)\b/i
const MENTION_RE = /@([a-z0-9_]{4,32})/gi
const AD_MENTION_RE = /(bot|channel|kanal|vip|bonus|bet|kupon|tips|signal|sinyal|destek|support|admin|resmi|official)$/i

/** Strict check for anything crossing the site ⇄ Telegram bridge, regardless of the sender's trust score. */
function bridgeReason(m: GuardMsg, allow: string[], words: string[]): { kind: 'ad' | 'word'; reason: string } | null {
  const text = (m.text ?? m.caption ?? '').trim()
  const links = foreignLinks(m, allow)
  if (links.length) return { kind: 'ad', reason: `Link: ${links[0].slice(0, 60)}` }
  const allowed = allow.map((a) => a.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('.')[0]).filter(Boolean)
  const spaced = [...text.matchAll(SPACED_LINK_RE)].map((x) => x[0]).find((hit) => !allowed.some((a) => hit.toLowerCase().replace(/\s/g, '').startsWith(a)))
  if (spaced) return { kind: 'ad', reason: `Gizlenmiş link: ${spaced.slice(0, 60)}` }
  const mentions = [...text.matchAll(MENTION_RE)].map((x) => x[1])
  const adMention = mentions.find((u) => AD_MENTION_RE.test(u) && !allowed.some((a) => u.toLowerCase().startsWith(a)))
  if (adMention) return { kind: 'ad', reason: `Reklam hesabı: @${adMention}` }
  if (PHONE_RE.test(text)) return { kind: 'ad', reason: 'Telefon numarası' }
  if (CONTACT_RE.test(text) && mentions.length) return { kind: 'ad', reason: 'Özelden iletişim çağrısı' }
  const bad = text ? findBadWord(text, words) : null
  if (bad) return { kind: 'word', reason: 'Küfür / hakaret' }
  return null
}

/** Telegram → site: decides whether a group message may be mirrored into the site chat. Admins are exempt. */
export async function screenMirror(token: string, raw: TgMessage): Promise<string | null> {
  const m = raw as GuardMsg
  if (!m.from || m.is_automatic_forward) return null
  if (m.sender_chat && (m.sender_chat.id === m.chat.id || m.from.username === 'GroupAnonymousBot')) return null
  if (await isChatAdmin(token, m.chat.id, m.from.id)) return null
  if (m.sender_chat?.type === 'channel') return 'Başka bir kanal adına mesaj'
  if (isForwardedFromChannel(m)) return 'Başka kanaldan iletilen mesaj'
  const hub = await getHub()
  return bridgeReason(m, hub.guard.allowDomains, hub.guard.words)?.reason ?? null
}

/** Removes a spam message from Telegram and keeps it out of the site chat for good. */
export async function dropBridgeSpam(token: string, raw: TgMessage, reason: string) {
  await ensureGuardTables()
  await del(token, raw.chat.id, raw.message_id)
  await modLog({ chatId: raw.chat.id, chatTitle: raw.chat.title, user: raw.from, action: 'Mesaj silindi', reason: `Köprü filtresi: ${reason}` })
}

/** Site → Telegram: a blocked site message counts as a warning on the linked Telegram account, ending in a group mute. */
export async function siteStrike(tgId: number, chatId: string, token: string, author: string, reason: string) {
  await ensureGuardTables()
  const hub = await getHub()
  const g = hub.guard
  const user = { id: tgId, is_bot: false, first_name: author } as TgUser
  const count = await addWarn(tgId)
  await adjustTrust(tgId, -10)
  if (count < g.warnLimit) {
    await modLog({ chatId, user, action: 'Site mesajı engellendi', reason: `${reason} (uyarı ${count}/${g.warnLimit})` })
    return
  }
  const minutes = g.muteMinutes[Math.min(count - g.warnLimit, g.muteMinutes.length - 1)] ?? 60
  await mute(token, chatId, tgId, minutes).catch(() => null)
  await modLog({ chatId, user, action: `Susturuldu (${minutes} dk)`, reason: `Siteden: ${reason}` })
}

async function aiVerdict(text: string): Promise<{ bad: boolean; reason: string }> {
  try {
    const { text: answer } = await generateText({
      model: AI_MODEL,
      prompt: `Sen bir Türkçe Telegram topluluğunun moderatörüsün. Mesajı değerlendir.
YASAK: ağır hakaret, küfür (sansürlü/kısaltılmış/şifreli yazılmış olsa da), tehdit, ırkçılık, dolandırıcılık
("özelden yaz kazandırayım", "garantili kupon", "yatırımını katlıyorum", sahte destek/yönetici, kart/şifre isteme), reklam.
SERBEST: normal sohbet, maç/bahis yorumu, şaka, hafif argo, şikâyet.
Sadece JSON döndür: {"bad": true|false, "reason": "kısa Türkçe neden"}

MESAJ:
${text.slice(0, 800)}`,
    })
    const json = answer.match(/\{[\s\S]*\}/)?.[0]
    const parsed = json ? (JSON.parse(json) as { bad?: boolean; reason?: string }) : null
    return { bad: Boolean(parsed?.bad), reason: String(parsed?.reason ?? 'Yapay zekâ uygunsuz buldu').slice(0, 120) }
  } catch (error) {
    console.error('[tg-guard] ai moderation failed', error)
    return { bad: false, reason: '' }
  }
}

// --- Punishment ladder -------------------------------------------------------

async function addWarn(tgId: number) {
  const [r] = await rows<{ count: number }>(sql`INSERT INTO tg_warns (tg_id, count) VALUES (${tgId}, 1)
    ON CONFLICT (tg_id) DO UPDATE SET count = CASE WHEN tg_warns.updated_at < now() - interval '30 days' THEN 1 ELSE tg_warns.count + 1 END, updated_at = now()
    RETURNING count`)
  return Number(r.count)
}

/** What "Geri al" must put back: the trust points and warnings this action took away. */
const undoFor = (m: GuardMsg, kind: LogUndo['kind'], trust: number, warns: number): LogUndo => ({
  kind,
  chatId: String(m.chat.id),
  tgIds: [m.from!.id],
  trust,
  warns,
})

async function punish(g: Pick<GroupRules, 'warnLimit' | 'muteMinutes'>, token: string, m: GuardMsg, reason: string, opts: { hard?: boolean } = {}) {
  const user = m.from!
  const chatTitle = m.chat.title ?? String(m.chat.id)
  await del(token, m.chat.id, m.message_id)
  if (opts.hard) {
    await ban(token, m.chat.id, user.id).catch(() => null)
    await adjustTrust(user.id, -50)
    await modLog({ chatId: m.chat.id, chatTitle, user, action: 'Banlandı', reason, undo: undoFor(m, 'ban', 50, 0) })
    return
  }
  const count = await addWarn(user.id)
  await adjustTrust(user.id, -10)
  if (count < g.warnLimit) {
    await notice(token, m.chat.id, `${short(user)} uyarı ${count}/${g.warnLimit}: ${reason}`)
    await modLog({ chatId: m.chat.id, chatTitle, user, action: 'Mesaj silindi', reason: `${reason} (uyarı ${count}/${g.warnLimit})`, undo: undoFor(m, 'warn', 10, 1) })
    return
  }
  const step = count - g.warnLimit
  if (step < g.muteMinutes.length) {
    const minutes = g.muteMinutes[step]
    await mute(token, m.chat.id, user.id, minutes).catch(() => null)
    await adjustTrust(user.id, -15)
    await notice(token, m.chat.id, `${short(user)} ${minutes >= 1440 ? `${Math.round(minutes / 1440)} gün` : `${minutes} dakika`} susturuldu: ${reason}`)
    await modLog({ chatId: m.chat.id, chatTitle, user, action: `Susturuldu (${minutes} dk)`, reason, undo: undoFor(m, 'mute', 25, 1) })
    return
  }
  await ban(token, m.chat.id, user.id).catch(() => null)
  await notice(token, m.chat.id, `${short(user)} kuralları tekrar tekrar çiğnediği için gruptan atıldı.`)
  await modLog({ chatId: m.chat.id, chatTitle, user, action: 'Banlandı (uyarı limiti)', reason, undo: undoFor(m, 'ban', 10, 1) })
}

async function globalBan(hub: HubConfig, token: string, user: TgUser, reason: string) {
  await rows(sql`INSERT INTO tg_global_bans (tg_id, who, reason) VALUES (${user.id}, ${short(user)}, ${reason})
    ON CONFLICT (tg_id) DO UPDATE SET reason = EXCLUDED.reason`)
  for (const g of hub.groups) await ban(token, g.chatId, user.id).catch(() => null)
  await modLog({ user, action: 'Banlandı (tüm gruplar)', reason })
}

// --- Joins -------------------------------------------------------------------

async function casBanned(userId: number) {
  try {
    const res = await fetch(`https://api.cas.chat/check?user_id=${userId}`, { signal: AbortSignal.timeout(4000) })
    const data = (await res.json()) as { ok?: boolean }
    return Boolean(data.ok)
  } catch {
    return false
  }
}

async function recentJoins(chatId: number | string) {
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tg_joins
    WHERE chat_id = ${String(chatId)} AND created_at > now() - make_interval(secs => ${RAID_WINDOW_SEC})`)
  return Number(n)
}

/** Opens raid mode once; later triggers only push its end time back. */
async function beginRaid(r: GroupRules, token: string, chatId: number | string, chatTitle: string, why: string) {
  const res = await lockChat(token, { id: chatId, title: chatTitle }, { kind: 'raid', minutes: r.raidMinutes, lock: r.raidLock, reason: why })
  if (!res.fresh) return
  if (res.locked) {
    await callBot(token, 'sendMessage', {
      chat_id: chatId,
      text: `Olağan dışı hareket algılandı. Grup yaklaşık ${r.raidMinutes} dakikalığına yazmaya kapatıldı, kendiliğinden açılacak.`,
    }).catch(() => null)
  }
  const lockNote = res.locked ? `Grup ${r.raidMinutes} dakika yazmaya kapatıldı. ` : res.error ? `Grup yazmaya kapatılamadı (${res.error}). ` : ''
  await modLog({
    chatId,
    chatTitle,
    action: 'Baskın modu açıldı',
    reason: `${why}. ${lockNote}Bu sürede yeni gelenler ${RAID_BAN_MINUTES} dakikalığına çıkarılır, kalıcı ban yok. Çıkarılanlar tek tek bildirilmez.`,
    buttons: [
      { text: 'Baskın modunu kapat', data: `gd:unlock:${chatId}` },
      { text: `Son ${WAVE_MINUTES} dk girenleri çıkar`, data: `gd:wave:${chatId}` },
    ],
  })
}

async function closeLock(token: string, chatId: string, chatTitle: string, why: string) {
  const res = await unlockChat(token, chatId)
  if (!res.found) return { ok: false, message: 'Bu grupta açık bir kilit ya da baskın modu yok.' }
  if (res.error) {
    await modLog({ chatId, chatTitle, action: 'Kilit açılamadı', reason: `${res.error}. Telegram'da grup izinlerinden mesaj göndermeyi elle aç.` })
    return { ok: false, message: `Kilit açılamadı: ${res.error}. Telegram'da grup izinlerinden mesaj göndermeyi elle aç.` }
  }
  if (res.wasLocked) await callBot(token, 'sendMessage', { chat_id: chatId, text: 'Grup yeniden açıldı. Herkes yazabilir.' }).catch(() => null)
  const turned = res.turnedAway ? ` Bu sürede ${res.turnedAway} giriş geri çevrildi.` : ''
  await modLog({ chatId, chatTitle, action: res.kind === 'raid' ? 'Baskın modu bitti' : 'Grup kilidi açıldı', reason: `${why}.${turned}` })
  return { ok: true, message: res.kind === 'raid' ? 'Baskın modu kapatıldı.' : 'Grup kilidi açıldı.' }
}

/** Ends raid mode when its time is up. A raid that is still going on gets five more minutes instead. */
export async function endDueLocks() {
  const due = await dueLocks()
  if (!due.length) return 0
  const hub = await getHub()
  if (!hub.guardBotId) return 0
  const token = await botToken(hub.guardBotId)
  for (const l of due) {
    const limit = rulesFor(hub, l.chatId).raidJoins
    if (l.kind === 'raid' && limit > 0 && (await recentJoins(l.chatId)) > limit) {
      await extendLock(l.chatId, 5)
      continue
    }
    await closeLock(token, l.chatId, l.title, 'Süre doldu')
  }
  return due.length
}

async function screenNewcomer(hub: HubConfig, r: GroupRules, token: string, chatId: number | string, chatTitle: string, u: TgUser) {
  const banned = await rows(sql`SELECT 1 FROM tg_global_bans WHERE tg_id = ${u.id}`)
  if (banned.length) return 'Global ban listesinde'
  if (hub.guard.casCheck && (await casBanned(u.id))) return 'Bilinen spam hesabı (CAS listesi)'
  if (hub.guard.impersonation && staffWordInName(u)) return 'Yönetici / Alkanka taklidi yapan isim'
  await rows(sql`INSERT INTO tg_joins (chat_id) VALUES (${String(chatId)})`)
  const n = await recentJoins(chatId)
  const over = r.raidJoins > 0 && n > r.raidJoins
  if (r.raidMode) {
    if (over) {
      await beginRaid(r, token, chatId, chatTitle, `1 dakikada ${n} giriş`)
      return RAID_REASON
    }
    return (await raidActive(String(chatId))) ? RAID_REASON : null
  }
  if (over) {
    if (n === r.raidJoins + 1) {
      await modLog({
        chatId,
        chatTitle,
        action: 'Baskın algılandı',
        reason: `1 dakikada ${n} giriş. Girişler yavaşlayana kadar yeni gelenler ${RAID_BAN_MINUTES} dakikalığına çıkarılıyor, kalıcı ban yok. Çıkarılanlar tek tek bildirilmez, panelde "Son işlemler"de görünür.`,
      })
    }
    return RAID_REASON
  }
  return null
}

export async function handleJoinRequest(botId: number, r: TgJoinRequest) {
  await ensureGuardTables()
  const hub = await getHub()
  if (!(await isProtectedChat(hub, r.chat.id))) return
  const token = await botToken(botId)
  const reason = await screenNewcomer(hub, rulesFor(hub, r.chat.id), token, r.chat.id, r.chat.title ?? '', r.from)
  if (reason) {
    await callBot(token, 'declineChatJoinRequest', { chat_id: r.chat.id, user_id: r.from.id }).catch(() => null)
    await modLog({ chatId: r.chat.id, chatTitle: r.chat.title, user: r.from, action: 'Giriş reddedildi', reason, notify: reason !== RAID_REASON })
    return
  }
  await callBot(token, 'approveChatJoinRequest', { chat_id: r.chat.id, user_id: r.from.id }).catch(() => null)
}

/** A member who mass-adds people: everyone they added leaves for a while, they are banned, and adding can be switched off for the group. */
async function stopInviter(r: GroupRules, token: string, m: GuardMsg, adder: TgUser, earlier: number[], invited: TgUser[]) {
  const chatId = String(m.chat.id)
  const chatTitle = m.chat.title ?? chatId
  for (const u of m.new_chat_members ?? []) if (u.is_bot) await ban(token, chatId, u.id).catch(() => null)
  for (const u of invited) {
    await tempBan(token, chatId, u.id, RAID_BAN_MINUTES).catch(() => null)
    await logJoin({ chatId, user: u, inviter: adder.id, removed: true }).catch(() => null)
  }
  for (const id of earlier) await tempBan(token, chatId, id, RAID_BAN_MINUTES).catch(() => null)
  await markRemoved(chatId, earlier)
  if (earlier.length) {
    const prompts = await rows<{ msg_id: string | null }>(sql`DELETE FROM tg_captcha
      WHERE chat_id = ${chatId} AND tg_id = ANY(${`{${earlier.join(',')}}`}::bigint[]) RETURNING msg_id`)
    for (const p of prompts) if (p.msg_id) await del(token, chatId, Number(p.msg_id))
  }
  await ban(token, chatId, adder.id).catch(() => null)
  await adjustTrust(adder.id, -50)
  const closed = r.inviteLock ? await closeInvites(token, chatId) : false
  await modLog({
    chatId,
    chatTitle,
    user: adder,
    action: 'Banlandı',
    reason: `Toplu üye ekleme: 10 dakikada ${earlier.length + invited.length} kişi ekledi (sınır ${r.inviteLimit}). Eklenenler ${RAID_BAN_MINUTES} dakikalığına çıkarıldı.${
      closed ? ' Üyelerin başkasını ekleme izni kapatıldı; grup izinlerinden tekrar açabilirsin.' : ''
    }`,
    undo: { kind: 'ban', chatId, tgIds: [adder.id], trust: 50, warns: 0 },
  })
}

async function handleNewMembers(hub: HubConfig, r: GroupRules, token: string, m: GuardMsg) {
  const chatId = String(m.chat.id)
  const chatTitle = m.chat.title ?? chatId
  const members = m.new_chat_members ?? []
  const adder = m.from
  if (r.raidMode) await endDueLocks().catch((error) => console.error('[tg-guard] lock check failed', error))

  const invited = adder ? members.filter((u) => !u.is_bot && u.id !== adder.id) : []
  if (adder && invited.length && r.inviteLimit > 0 && !(await isChatAdmin(token, m.chat.id, adder.id))) {
    const earlier = await invitedBy(chatId, adder.id)
    if (earlier.length + invited.length > r.inviteLimit) {
      await stopInviter(r, token, m, adder, earlier, invited)
      return
    }
  }

  for (const u of members) {
    if (u.is_bot) {
      // Only admins may add bots; anything else is a spam bot drop.
      if (m.from && !(await isChatAdmin(token, m.chat.id, m.from.id))) {
        await ban(token, m.chat.id, u.id).catch(() => null)
        await modLog({ chatId: m.chat.id, chatTitle, user: u, action: 'Banlandı', reason: 'Yetkisiz bot eklendi' })
      }
      continue
    }
    const inviter = adder && adder.id !== u.id ? adder.id : null
    const reason = await screenNewcomer(hub, r, token, m.chat.id, chatTitle, u)
    if (reason === RAID_REASON) {
      // Real members join in bursts too (right after an announcement), so a raid never bans for good.
      await tempBan(token, m.chat.id, u.id, RAID_BAN_MINUTES).catch(() => null)
      await logJoin({ chatId, user: u, inviter, raid: true, removed: true }).catch(() => null)
      await modLog({ chatId: m.chat.id, chatTitle, user: u, action: 'Giriş reddedildi', reason, notify: false })
      continue
    }
    if (reason) {
      await ban(token, m.chat.id, u.id).catch(() => null)
      await modLog({ chatId: m.chat.id, chatTitle, user: u, action: 'Giriş reddedildi', reason })
      continue
    }
    await logJoin({ chatId, user: u, inviter }).catch(() => null)
    await meetMember(u.id).catch(() => null)
    if (!r.captcha) continue
    await mute(token, m.chat.id, u.id, 60 * 24 * 366).catch(() => null)
    const sent = await callBot<{ message_id: number }>(token, 'sendMessage', {
      chat_id: m.chat.id,
      text: `Hoş geldin ${short(u)}! Yazabilmek için ${CAPTCHA_MINUTES} dakika içinde aşağıdaki butona bas.`,
      reply_markup: { inline_keyboard: [[{ text: 'Ben insanım', callback_data: `cap:${u.id}` }]] },
    }).catch(() => null)
    await rows(sql`INSERT INTO tg_captcha (chat_id, tg_id, expires_at, msg_id)
      VALUES (${String(m.chat.id)}, ${u.id}, now() + make_interval(mins => ${CAPTCHA_MINUTES}), ${sent?.message_id ?? null})
      ON CONFLICT (chat_id, tg_id) DO UPDATE SET expires_at = EXCLUDED.expires_at, msg_id = EXCLUDED.msg_id, kind = 'join'`)
  }
}

/** Kicks newcomers who never pressed the captcha button. Runs from the background tick. */
export async function expireCaptchas() {
  await ensureGuardTables()
  const hub = await getHub()
  if (!hub.guardBotId || !hub.guard.enabled) return 0
  const token = await botToken(hub.guardBotId)
  const due = await rows(sql`DELETE FROM tg_captcha WHERE expires_at < now() RETURNING chat_id, tg_id, msg_id, kind`)
  let kicked = 0
  for (const d of due) {
    // A commenter who is not a member has nothing to be kicked from; their comments just keep being removed.
    if (d.kind !== 'comment') {
      await kick(token, String(d.chat_id), Number(d.tg_id)).catch(() => null)
      kicked++
    }
    if (d.msg_id) await del(token, String(d.chat_id), Number(d.msg_id))
  }
  if (kicked) await modLog({ action: 'Doğrulanmadı, atıldı', reason: `${kicked} hesap butona basmadı (muhtemel bot)`, notify: kicked >= 5 })
  return due.length
}

/** First comment from an account that is not a member of the group: removed, and the account must press a button before writing. */
async function challengeComment(token: string, m: GuardMsg) {
  const u = m.from!
  const chatId = String(m.chat.id)
  await del(token, chatId, m.message_id)
  // One prompt at a time per person; further comments are removed silently until it is answered or expires.
  const claimed = await rows(sql`INSERT INTO tg_captcha (chat_id, tg_id, expires_at, kind)
    VALUES (${chatId}, ${u.id}, now() + make_interval(mins => ${CAPTCHA_MINUTES}), 'comment')
    ON CONFLICT (chat_id, tg_id) DO UPDATE SET expires_at = EXCLUDED.expires_at, kind = 'comment', msg_id = NULL
    WHERE tg_captcha.expires_at < now() RETURNING tg_id`)
  if (!claimed.length) return
  const thread = m.message_thread_id ?? m.reply_to_message?.message_id
  const sent = await callBot<{ message_id: number }>(token, 'sendMessage', {
    chat_id: chatId,
    text: `${short(u)} yorumun silindi. Burada ilk kez yazıyorsun; ${CAPTCHA_MINUTES} dakika içinde butona bas, sonra yorumunu tekrar gönder.`,
    reply_parameters: thread ? { message_id: thread, allow_sending_without_reply: true } : undefined,
    reply_markup: { inline_keyboard: [[{ text: 'Ben insanım', callback_data: `cap:${u.id}` }]] },
  }).catch(() => null)
  if (sent) await rows(sql`UPDATE tg_captcha SET msg_id = ${sent.message_id} WHERE chat_id = ${chatId} AND tg_id = ${u.id}`)
  await modLog({
    chatId,
    chatTitle: m.chat.title,
    user: u,
    action: 'Mesaj silindi',
    reason: 'Yorum kalkanı: gruba üye olmayan hesabın ilk yorumu, doğrulama istendi',
    notify: false,
  })
}

/** Reverses a logged warning, mute or ban. Deleted messages cannot be brought back. */
export async function undoLog(logId: number, by: string): Promise<{ ok: boolean; message: string }> {
  await ensureGuardTables()
  if (!Number.isSafeInteger(logId) || logId <= 0) return { ok: false, message: 'Geçersiz kayıt.' }
  // Claimed first so two people pressing the button together cannot undo twice.
  const [row] = await rows<{ undo: string; chat_title: string | null; who: string | null; action: string }>(sql`UPDATE tg_mod_log SET undone = true
    WHERE id = ${logId} AND undo IS NOT NULL AND NOT undone RETURNING undo, chat_title, who, action`)
  if (!row) return { ok: false, message: 'Bu işlem zaten geri alınmış ya da geri alınamaz.' }
  const release = () => rows(sql`UPDATE tg_mod_log SET undone = false WHERE id = ${logId}`).catch(() => null)
  const hub = await getHub()
  let u: LogUndo
  try {
    u = JSON.parse(row.undo) as LogUndo
  } catch {
    return { ok: false, message: 'Kayıt okunamadı.' }
  }
  if (!hub.guardBotId) {
    await release()
    return { ok: false, message: 'Bekçi botu seçili değil.' }
  }
  const token = await botToken(hub.guardBotId)
  try {
    for (const id of u.tgIds) {
      if (u.kind === 'ban') await callBot(token, 'unbanChatMember', { chat_id: u.chatId, user_id: id, only_if_banned: true })
      if (u.kind === 'mute') await unmute(token, u.chatId, id)
    }
  } catch (error) {
    await release()
    return { ok: false, message: `Geri alınamadı: ${String((error as Error).message)}` }
  }
  for (const id of u.tgIds) {
    if (u.warns) await rows(sql`UPDATE tg_warns SET count = GREATEST(0, count - ${u.warns}) WHERE tg_id = ${id}`)
    if (u.trust) await adjustTrust(id, u.trust)
  }
  await modLog({
    chatId: u.chatId,
    chatTitle: row.chat_title ?? undefined,
    action: 'Geri alındı',
    reason: `"${row.action}"${row.who ? ` · ${row.who}` : ''} · geri alan: ${by}`,
    notify: false,
  })
  const message =
    u.kind === 'ban'
      ? 'Ban kaldırıldı. Kişi gruba kendisi tekrar girmeli; silinen mesajlar geri gelmez.'
      : u.kind === 'mute'
        ? 'Susturma kaldırıldı. Silinen mesaj geri gelmez.'
        : 'Uyarı silindi. Silinen mesaj geri gelmez.'
  return { ok: true, message }
}

export async function handleGuardCallback(botId: number, q: TgCallback) {
  await ensureGuardTables()
  const token = await botToken(botId)
  const answer = (text: string, alert = false) =>
    callBot(token, 'answerCallbackQuery', { callback_query_id: q.id, text: text.slice(0, 190), show_alert: alert }).catch(() => null)
  const [kind, arg, extra] = (q.data ?? '').split(':')
  if (kind === 'cap' && q.message) {
    if (Number(arg) !== q.from.id) return answer('Bu buton sana ait değil.')
    const chatId = q.message.chat.id
    const [row] = await rows<{ kind: string }>(sql`DELETE FROM tg_captcha WHERE chat_id = ${String(chatId)} AND tg_id = ${q.from.id} RETURNING kind`)
    await setNeedsCheck(q.from.id, false)
    await del(token, chatId, q.message.message_id)
    if (row?.kind === 'comment') return answer('Doğrulandı, yorumunu tekrar gönderebilirsin.')
    await unmute(token, chatId, q.from.id).catch(() => null)
    return answer('Doğrulandı, artık yazabilirsin!')
  }
  if (kind === 'gd' && q.message) {
    const hub = await getHub()
    // These buttons act on whole groups, so they only work from the staff log group.
    if (!hub.logChatId || String(q.message.chat.id) !== hub.logChatId) return answer('Bu buton sadece kayıt grubunda çalışır.')
    const logMessage = q.message
    const dropButtons = () =>
      callBot(token, 'editMessageReplyMarkup', { chat_id: logMessage.chat.id, message_id: logMessage.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => null)
    const titleOf = (id: string) => hub.groups.find((g) => g.chatId === id)?.title ?? id
    const target = extra ?? ''
    if (arg === 'unlock') return answer((await closeLock(token, target, titleOf(target), `Kapatan: ${short(q.from)}`)).message, true)
    if (arg === 'wave') {
      const waiting = (await waveMembers(target)).length
      if (!waiting) return answer(`Son ${WAVE_MINUTES} dakikada girip hâlâ içeride olan kimse yok.`, true)
      if (!(await confirmTwice(`wave_confirm_${target}`, 30))) {
        return answer(`Son ${WAVE_MINUTES} dakikada giren ${waiting} kişi ${RAID_BAN_MINUTES} dakikalığına çıkarılacak. Onaylamak için 30 saniye içinde butona tekrar bas.`, true)
      }
      await answer('Çıkarılıyor…')
      const res = await sweepWave(token, target)
      await modLog({
        chatId: target,
        chatTitle: titleOf(target),
        action: 'Giriş dalgası çıkarıldı',
        reason: `${res.removed} kişi ${RAID_BAN_MINUTES} dakikalığına çıkarıldı${res.left ? `, ${res.left} kişi kaldı (butona tekrar bas)` : ''}. Yapan: ${short(q.from)}`,
      })
      return
    }
    if (arg === 'undo') {
      const res = await undoLog(Number(target), short(q.from))
      if (res.ok) await dropButtons()
      return answer(res.message, true)
    }
    if (arg === 'tun') {
      const [, , chat, thread] = (q.data ?? '').split(':')
      await unlockThread(chat, Number(thread))
      await dropButtons()
      return answer('Bu gönderinin yorumları yeniden açıldı.')
    }
    if (arg === 'ban') {
      const id = Number(target)
      if (!Number.isSafeInteger(id) || id <= 0) return answer('Geçersiz hesap.')
      const name = (await suspectNames([id])).get(id) ?? String(id)
      await globalBan(hub, token, { id, first_name: name }, `Kayıt grubundan banlandı: ${short(q.from)}`)
      await setSuspectState([id], 'removed')
      await dropButtons()
      return answer('Tüm gruplardan banlandı. Yanlışsa panelde "Tüm gruplardan yasaklılar" listesinden kaldırabilirsin.', true)
    }
    return answer('')
  }
  if (kind === 'wp' && q.message) {
    const chatId = q.message.chat.id
    // Channel buttons are visible to every subscriber, so the presser must be an admin.
    if (!(await isChatAdmin(token, chatId, q.from.id))) return answer('Bu butonu sadece yöneticiler kullanabilir.')
    await del(token, chatId, q.message.message_id)
    if (arg === 'no') return answer('Vazgeçildi.')
    await startWipe(botId, chatId, q.message.chat.title ?? String(chatId), q.message.message_id, who(q.from))
    await notice(token, chatId, 'Tüm sohbet geçmişi siliniyor. Mesaj sayısına göre birkaç dakika sürebilir.', 30)
    return answer('Temizlik başladı.')
  }
  return answer('')
}

// --- Full chat wipe -----------------------------------------------------------

const WIPE_BATCH = 100

/**
 * deleteMessages rejects the whole batch when a single id can't be deleted (service message, etc.),
 * so a failed batch is split in half until only the undeletable ids are left out.
 */
async function deleteChunk(token: string, chatId: string, ids: number[]): Promise<number> {
  try {
    await callBot(token, 'deleteMessages', { chat_id: chatId, message_ids: ids })
    await dropFromSite(chatId, ids)
    return ids.length
  } catch (error) {
    const msg = String((error as Error).message)
    if (/too many requests|retry after|not enough rights|chat not found|bot was kicked|not a member/i.test(msg)) throw error
    // Splitting all the way to single ids costs ~200 calls per bad batch and stalls the job; small leftovers are skipped.
    if (ids.length <= 12) return 0
    const half = Math.ceil(ids.length / 2)
    return (await deleteChunk(token, chatId, ids.slice(0, half))) + (await deleteChunk(token, chatId, ids.slice(half)))
  }
}

const FATAL_WIPE_ERROR = /too many requests|retry after|not enough rights|chat not found|bot was kicked|not a member/i

/**
 * deleteMessages answers "true" even when it silently skips messages it isn't allowed to delete,
 * so a single deleteMessage on one id is the only honest way to learn whether old posts are reachable.
 */
async function probeDelete(token: string, chatId: string, id: number): Promise<'deleted' | 'gone' | 'too-old'> {
  try {
    await callBot(token, 'deleteMessage', { chat_id: chatId, message_id: id })
    await dropFromSite(chatId, [id])
    return 'deleted'
  } catch (error) {
    const msg = String((error as Error).message)
    if (FATAL_WIPE_ERROR.test(msg)) throw error
    return /can't be deleted|cannot be deleted/i.test(msg) ? 'too-old' : 'gone'
  }
}

export const WIPE_TOO_OLD_NOTE =
  'Telegram, botların 48 saatten eski mesajları silmesine izin vermiyor. Bu noktadan eski postlar bot ile silinemez; Telegram uygulamasından elle seçip silmen gerekiyor.'

export async function startWipe(botId: number, chatId: number | string, title: string, fromId: number, by: string) {
  await ensureGuardTables()
  await rows(sql`INSERT INTO tg_wipe (chat_id, bot_id, title, next_id, total, done, started_by)
    VALUES (${String(chatId)}, ${botId}, ${title.slice(0, 80)}, ${fromId}, ${fromId}, 0, ${by.slice(0, 80)})
    ON CONFLICT (chat_id) DO UPDATE SET bot_id = EXCLUDED.bot_id, next_id = EXCLUDED.next_id, total = EXCLUDED.total, done = 0,
      started_by = EXCLUDED.started_by, note = NULL, created_at = now()`)
  await modLog({ chatId, chatTitle: title, action: 'Tüm sohbet silme başladı', reason: `${by} · ${fromId} mesaja kadar` })
}

export async function listWipes() {
  await ensureGuardTables()
  const r = await rows<{ chat_id: string; title: string; next_id: string; total: string; done: string; note: string | null; started_by: string; created_at: string }>(
    sql`SELECT chat_id, title, next_id, total, done, note, started_by, created_at FROM tg_wipe ORDER BY created_at`,
  )
  return r.map((w) => ({
    chatId: w.chat_id,
    title: w.title,
    left: Math.max(0, Number(w.next_id)),
    total: Number(w.total),
    deleted: Number(w.done),
    note: w.note,
    startedBy: w.started_by,
    startedAt: new Date(w.created_at).toISOString(),
  }))
}

export async function cancelWipe(chatId: string) {
  await ensureGuardTables()
  const r = await rows<{ title: string }>(sql`DELETE FROM tg_wipe WHERE chat_id = ${chatId} RETURNING title`)
  if (r[0]) await modLog({ chatId, chatTitle: r[0].title, action: 'Tüm sohbet silme durduruldu', reason: 'Panelden iptal edildi' })
  return r.length > 0
}

/** Deletes message ids from newest to oldest in batches; resumes on the next tick when time runs out or Telegram rate-limits. */
export async function processWipes(budgetMs = 25_000) {
  await ensureGuardTables()
  const started = Date.now()
  const jobs = await rows<{ chat_id: string; bot_id: number; title: string; next_id: string; total: string; done: string }>(
    sql`SELECT * FROM tg_wipe WHERE note IS NULL ORDER BY created_at`,
  )
  for (const job of jobs) {
    let token: string
    try {
      token = await botToken(Number(job.bot_id))
    } catch {
      await rows(sql`DELETE FROM tg_wipe WHERE chat_id = ${job.chat_id}`)
      continue
    }
    let next = Number(job.next_id)
    let done = Number(job.done)
    while (next >= 1 && Date.now() - started < budgetMs) {
      const ids: number[] = []
      for (let id = next; id > Math.max(0, next - WIPE_BATCH); id--) ids.push(id)
      try {
        const first = await probeDelete(token, job.chat_id, ids[0])
        const middleId = ids[Math.floor(ids.length / 2)]
        const middle = middleId > 1 ? await probeDelete(token, job.chat_id, middleId) : 'gone'
        if (first === 'too-old' && middle === 'too-old') {
          // Ids grow with time, so everything below this point is older still and equally out of reach.
          await rows(sql`UPDATE tg_wipe SET next_id = ${next}, done = ${done}, note = ${WIPE_TOO_OLD_NOTE} WHERE chat_id = ${job.chat_id}`)
          await modLog({ chatId: job.chat_id, chatTitle: job.title, action: 'Tüm sohbet silme durdu', reason: `${next} numaradan eski mesajlar 48 saati geçmiş, bot silemez` })
          next = -1
          break
        }
        done += (first === 'deleted' ? 1 : 0) + (middle === 'deleted' ? 1 : 0)
        const rest = ids.filter((id) => id !== ids[0] && id !== middleId)
        if (rest.length) {
          await deleteChunk(token, job.chat_id, rest)
          // deleteMessages can't report how many it really removed; count only when this batch is clearly recent.
          if (first === 'deleted' || middle === 'deleted') done += rest.length
        }
      } catch (error) {
        const msg = String((error as Error).message)
        if (/not enough rights|chat not found|bot was kicked|not a member/i.test(msg)) {
          await rows(sql`DELETE FROM tg_wipe WHERE chat_id = ${job.chat_id}`)
          await modLog({ chatId: job.chat_id, chatTitle: job.title, action: 'Tüm sohbet silme durdu', reason: `Botun silme yetkisi yok: ${msg}`.slice(0, 300) })
          next = -1
        }
        // Rate limited: keep the cursor so this batch is retried on the next tick.
        break
      }
      next -= WIPE_BATCH
      await new Promise((r) => setTimeout(r, 40))
    }
    if (next === -1) continue
    if (next < 1) {
      await rows(sql`DELETE FROM tg_wipe WHERE chat_id = ${job.chat_id}`)
      // The "temizlik başlıyor" marker is the job's starting id; make sure it never stays behind.
      await del(token, job.chat_id, Number(job.total))
      await notice(token, job.chat_id, 'Sohbet temizliği tamamlandı.', 15)
      await modLog({ chatId: job.chat_id, chatTitle: job.title, action: 'Tüm sohbet silindi', reason: `${done} mesaj numarası tarandı` })
    } else {
      // The panel pump and the traffic tick can overlap; never move the cursor backwards.
      await rows(sql`UPDATE tg_wipe SET next_id = ${next}, done = ${done} WHERE chat_id = ${job.chat_id} AND next_id > ${next}`)
    }
    if (Date.now() - started >= budgetMs) break
  }
}

async function askWipe(token: string, chatId: number | string) {
  await callBot(token, 'sendMessage', {
    chat_id: chatId,
    text: 'DİKKAT: Bu sohbetteki TÜM mesajlar silinecek. Geri alınamaz. Emin misin?',
    reply_markup: { inline_keyboard: [[{ text: 'Evet, hepsini sil', callback_data: 'wp:yes' }, { text: 'Vazgeç', callback_data: 'wp:no' }]] },
  }).catch(() => null)
}

/** /sil typed as a channel post. Only admins can post in a channel, so no extra check is needed. */
export async function guardChannelPost(botId: number, m: TgMessage) {
  const text = (m.text ?? '').trim()
  if (!/^\/sil(?:@\w+)?$/i.test(text)) return false
  const token = await botToken(botId)
  await del(token, m.chat.id, m.message_id)
  await askWipe(token, m.chat.id)
  return true
}

// --- Commands ----------------------------------------------------------------

async function weeklyRank(tgId: number) {
  const from = weekStart()
  const to = new Date(Date.now() + 60_000).toISOString()
  const board = await chatLeaderboard(from, to, 500)
  const link = await rows<{ user_id: string }>(sql`SELECT user_id FROM tg_links WHERE tg_id = ${tgId}`)
  const key = link[0]?.user_id ?? `tg:${tgId}`
  const idx = board.findIndex((b) => b.key === key)
  return { rank: idx >= 0 ? idx + 1 : null, count: idx >= 0 ? board[idx].count : 0, board }
}

export function leaderboardText(board: { name: string; count: number }[], rewards: number[], title = 'Bu haftanın en çok yazanları') {
  if (!board.length) return `${title}\n\nHenüz sayılan mesaj yok.`
  return [
    title,
    '',
    ...board.slice(0, 10).map((b, i) => `${i + 1}. ${b.name} · ${b.count} mesaj${rewards[i] ? ` · ${rewards[i]} KC` : ''}`),
    '',
    'Liste her pazartesi 00:00 sıfırlanır. İlk sıralara KC ödülü verilir.',
  ].join('\n')
}

async function deletedAccountSweep(token: string, chatId: number | string) {
  const seen = await rows<{ tg_id: string }>(sql`SELECT DISTINCT tg_id FROM tg_guard_msgs WHERE chat_id = ${String(chatId)} LIMIT 2000`)
  let removed = 0
  const started = Date.now()
  for (const s of seen) {
    if (Date.now() - started > 40_000) break
    const m = await callBot<{ status: string; user: TgUser }>(token, 'getChatMember', { chat_id: chatId, user_id: Number(s.tg_id) }).catch(() => null)
    if (!m || !['member', 'restricted'].includes(m.status)) continue
    if (m.user.first_name === 'Deleted Account' || (!m.user.first_name && !m.user.username)) {
      await kick(token, chatId, Number(s.tg_id)).catch(() => null)
      removed++
    }
  }
  return { checked: seen.length, removed }
}

async function purgeRange(token: string, chatId: number | string, fromId: number, toId: number) {
  const ids: number[] = []
  for (let id = Math.max(fromId, toId - PURGE_MAX); id <= toId; id++) ids.push(id)
  let deleted = 0
  await dropFromSite(chatId, ids)
  for (let i = 0; i < ids.length; i += 100) {
    const ok = await callBot<boolean>(token, 'deleteMessages', { chat_id: chatId, message_ids: ids.slice(i, i + 100) }).catch(() => false)
    if (ok) deleted += ids.slice(i, i + 100).length
  }
  return deleted
}

async function handleCommand(hub: HubConfig, token: string, m: GuardMsg, isAdmin: boolean): Promise<boolean> {
  const text = (m.text ?? '').trim()
  const match = text.match(/^\/([a-zçğıöşü]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  if (!match) return false
  const cmd = match[1].toLocaleLowerCase('tr')
  const arg = (match[2] ?? '').trim()
  const chatTitle = m.chat.title ?? String(m.chat.id)
  const target = m.reply_to_message?.from

  if (cmd === 'kurallar') {
    await notice(token, m.chat.id, hub.guard.rules, 120)
    return true
  }
  if (cmd === 'liste') {
    const { board } = await weeklyRank(m.from!.id)
    await notice(token, m.chat.id, leaderboardText(board, hub.counter.rewards), 120)
    await del(token, m.chat.id, m.message_id)
    return true
  }
  if (cmd === 'ben') {
    const { rank, count } = await weeklyRank(m.from!.id)
    await notice(token, m.chat.id, rank ? `${short(m.from)} bu hafta ${count} mesajla ${rank}. sıradasın.` : `${short(m.from)} bu hafta henüz sayılan mesajın yok.`, 60)
    await del(token, m.chat.id, m.message_id)
    return true
  }

  const adminCmds = ['ban', 'gban', 'sustur', 'mute', 'ac', 'aç', 'unmute', 'uyar', 'warn', 'affet', 'sil', 'temizle', 'purge', 'hayalet', 'guvenilir', 'güvenilir', 'kilit', 'kilitac']
  if (!adminCmds.includes(cmd)) return false
  await del(token, m.chat.id, m.message_id)
  if (!isAdmin) return true

  const needTarget = ['ban', 'gban', 'sustur', 'mute', 'ac', 'aç', 'unmute', 'uyar', 'warn', 'affet', 'guvenilir', 'güvenilir']
  if (needTarget.includes(cmd) && !target) {
    await notice(token, m.chat.id, 'Bu komutu bir mesaja yanıt vererek kullan.')
    return true
  }

  switch (cmd) {
    case 'ban':
      await ban(token, m.chat.id, target!.id).catch(() => null)
      if (m.reply_to_message) await del(token, m.chat.id, m.reply_to_message.message_id)
      await modLog({ chatId: m.chat.id, chatTitle, user: target, action: 'Banlandı', reason: arg || `Yönetici: ${short(m.from)}` })
      break
    case 'gban':
      await globalBan(hub, token, target!, arg || `Yönetici: ${short(m.from)}`)
      break
    case 'sustur':
    case 'mute': {
      const minutes = Math.max(1, Math.min(60 * 24 * 30, Number(arg.match(/\d+/)?.[0] ?? 60)))
      await mute(token, m.chat.id, target!.id, minutes).catch(() => null)
      await notice(token, m.chat.id, `${short(target)} ${minutes} dakika susturuldu.`)
      await modLog({ chatId: m.chat.id, chatTitle, user: target, action: `Susturuldu (${minutes} dk)`, reason: `Yönetici: ${short(m.from)}` })
      break
    }
    case 'ac':
    case 'aç':
    case 'unmute':
      await unmute(token, m.chat.id, target!.id).catch(() => null)
      await notice(token, m.chat.id, `${short(target)} artık yazabilir.`)
      break
    case 'uyar':
    case 'warn': {
      const fake = { ...m.reply_to_message!, chat: m.chat } as GuardMsg
      await punish(rulesFor(hub, m.chat.id), token, fake, arg || 'Yönetici uyarısı')
      break
    }
    case 'affet':
      await rows(sql`DELETE FROM tg_warns WHERE tg_id = ${target!.id}`)
      await notice(token, m.chat.id, `${short(target)} uyarıları sıfırlandı.`)
      break
    case 'guvenilir':
    case 'güvenilir':
      await setTrusted(target!.id, true)
      await notice(token, m.chat.id, `${short(target)} güvenilir listeye eklendi. Bekçi artık bu kişiye dokunmaz.`)
      break
    case 'sil':
      if (m.reply_to_message) await del(token, m.chat.id, m.reply_to_message.message_id)
      else await askWipe(token, m.chat.id)
      break
    case 'temizle':
    case 'purge': {
      const n = Number(arg.match(/\d+/)?.[0] ?? 0)
      const from = m.reply_to_message ? m.reply_to_message.message_id : n > 0 ? m.message_id - Math.min(n, PURGE_MAX) : null
      if (!from) {
        await notice(token, m.chat.id, 'Kullanım: silmeye başlanacak mesaja yanıt verip /temizle yaz, ya da /temizle 50')
        break
      }
      const deleted = await purgeRange(token, m.chat.id, from, m.message_id)
      await notice(token, m.chat.id, `Temizlik bitti. Son 48 saatteki mesajlar silindi (${deleted} deneme).`, 10)
      await modLog({ chatId: m.chat.id, chatTitle, user: m.from, action: 'Toplu silme', reason: `${deleted} mesaj aralığı silindi` })
      break
    }
    case 'hayalet': {
      await notice(token, m.chat.id, 'Silinmiş hesaplar taranıyor, biraz sürebilir...', 15)
      const r = await deletedAccountSweep(token, m.chat.id)
      await notice(token, m.chat.id, `${r.checked} hesap kontrol edildi, ${r.removed} silinmiş hesap çıkarıldı.`, 60)
      await modLog({ chatId: m.chat.id, chatTitle, user: m.from, action: 'Silinmiş hesap temizliği', reason: `${r.removed}/${r.checked} hesap çıkarıldı` })
      break
    }
    case 'kilit': {
      const res = await lockChat(token, { id: m.chat.id, title: chatTitle }, { kind: 'manual', minutes: null, lock: true, reason: `Yönetici: ${short(m.from)}` })
      if (res.error) {
        await notice(token, m.chat.id, `Grup kilitlenemedi: ${res.error}`)
        break
      }
      await callBot(token, 'sendMessage', { chat_id: m.chat.id, text: 'Grup geçici olarak kilitlendi. Sadece yöneticiler yazabilir.' }).catch(() => null)
      await modLog({ chatId: m.chat.id, chatTitle, user: m.from, action: 'Grup kilitlendi', reason: 'Yönetici komutu' })
      break
    }
    case 'kilitac': {
      const res = await unlockChat(token, m.chat.id)
      // No lock of ours to restore (closed by hand, or before locks were remembered): open with the usual set.
      if (!res.found || !res.wasLocked || res.error) {
        await callBot(token, 'setChatPermissions', {
          chat_id: m.chat.id,
          permissions: { can_send_messages: true, can_send_photos: true, can_send_videos: true, can_send_other_messages: true, can_add_web_page_previews: true, can_send_polls: true },
        }).catch(() => null)
      }
      await callBot(token, 'sendMessage', { chat_id: m.chat.id, text: 'Grup kilidi açıldı. Herkes yazabilir.' }).catch(() => null)
      break
    }
  }
  return true
}

/** Panel helpers that run the same sweeps without a group command. */
export async function sweepDeletedAccounts(chatId: string, title?: string) {
  const hub = await getHub()
  if (!hub.guardBotId) throw new Error('Önce Bekçi botunu seç')
  const r = await deletedAccountSweep(await botToken(hub.guardBotId), chatId)
  await modLog({ chatId, chatTitle: title ?? hub.groups.find((g) => g.chatId === chatId)?.title, action: 'Silinmiş hesap temizliği', reason: `${r.removed}/${r.checked} hesap çıkarıldı (panelden)` })
  return r
}

/** Telegram ids of people who wrote in a protected group under this @username or display name. */
export async function findWriterIds(name: string) {
  await ensureGuardTables()
  const plain = name.trim().replace(/^@/, '')
  if (!plain) return []
  const r = await rows<{ tg_id: string }>(sql`SELECT DISTINCT tg_id FROM tg_guard_msgs
    WHERE lower(name) = lower(${plain}) OR lower(name) = lower(${`@${plain}`}) LIMIT 5`)
  return r.map((x) => Number(x.tg_id))
}

export async function deleteUserMessages(tgId: number) {
  const hub = await getHub()
  if (!hub.guardBotId) throw new Error('Önce Bekçi botunu seç')
  const token = await botToken(hub.guardBotId)
  const list = await rows<{ chat_id: string; message_id: string }>(sql`SELECT chat_id, message_id FROM tg_guard_msgs
    WHERE tg_id = ${tgId} AND created_at > now() - interval '47 hours'`)
  const byChat = new Map<string, number[]>()
  for (const r of list) byChat.set(r.chat_id, [...(byChat.get(r.chat_id) ?? []), Number(r.message_id)])
  let n = 0
  for (const [chatId, ids] of byChat) {
    await dropFromSite(chatId, ids)
    for (let i = 0; i < ids.length; i += 100) {
      if (await callBot<boolean>(token, 'deleteMessages', { chat_id: chatId, message_ids: ids.slice(i, i + 100) }).catch(() => false)) n += ids.slice(i, i + 100).length
    }
  }
  return n
}

// --- Main entry --------------------------------------------------------------

/** The reply thread a message belongs to. Forum topics are left out: a topic is a room, not a comment thread. */
const threadOf = (m: GuardMsg) => (!m.is_topic_message && m.message_thread_id ? m.message_thread_id : null)

async function recordMessage(hub: HubConfig, m: GuardMsg, textHash: string | null) {
  const text = (m.text ?? m.caption ?? '').trim()
  const counted = hub.counter.enabled && !text.startsWith('/') && normalizeText(text).replace(/\s/g, '').length >= hub.counter.minLength
  await rows(sql`INSERT INTO tg_guard_msgs (chat_id, message_id, tg_id, name, text_hash, counted, thread_id)
    VALUES (${String(m.chat.id)}, ${m.message_id}, ${m.from!.id}, ${short(m.from).slice(0, 60)}, ${textHash}, ${counted}, ${threadOf(m)})
    ON CONFLICT (chat_id, message_id) DO NOTHING`)
}

type Trust = Awaited<ReturnType<typeof trustOf>>

const isNewcomer = (trust: Trust, hours: number) => !trust.known || (trust.firstSeen != null && Date.now() - trust.firstSeen < hours * 3_600_000)

/** Why this message type may not be sent here, or null when it is fine. */
function contentBlock(r: GroupRules, m: GuardMsg, trust: Trust): { reason: string; notice: string } | null {
  const kinds = contentKinds(m)
  const fresh = isNewcomer(trust, r.quarantineHours || NEW_MEMBER_HOURS)
  for (const kind of kinds) {
    const rule = r.content?.[kind] ?? 'allow'
    if (rule === 'allow' || (rule === 'new' && !fresh)) continue
    const label = CONTENT_KINDS.find((c) => c.key === kind)?.label ?? kind
    return rule === 'new'
      ? { reason: `Yeni üyeye kapalı içerik: ${label}`, notice: `yeni üyeler bu türde mesaj gönderemez (${label}).` }
      : { reason: `Kapalı içerik türü: ${label}`, notice: `bu grupta bu tür mesaj kapalı (${label}).` }
  }
  if (r.quarantineHours > 0 && isNewcomer(trust, r.quarantineHours)) {
    const mentions = [...(m.entities ?? []), ...(m.caption_entities ?? [])].some((e) => e.type === 'mention' || e.type === 'text_mention')
    const what = kinds.length ? 'medya' : m.forward_origin || m.forward_from_chat ? 'iletilmiş mesaj' : mentions ? 'etiket' : null
    if (what) {
      return {
        reason: `Karantina: yeni üye ${what} gönderdi`,
        notice: `yeni üyeler ilk ${r.quarantineHours} saat sadece düz yazı yazabilir (medya, iletme, etiket yok).`,
      }
    }
  }
  return null
}

/** Removes a message without a warning or a strike: the sender broke a house rule, not the law. */
async function softDelete(token: string, m: GuardMsg, block: { reason: string; notice: string }) {
  await del(token, m.chat.id, m.message_id)
  if (mayNotice(`${m.chat.id}:${m.from!.id}`)) await notice(token, m.chat.id, `${short(m.from)} ${block.notice}`, 15)
  await modLog({ chatId: m.chat.id, chatTitle: m.chat.title, user: m.from, action: 'Mesaj silindi', reason: block.reason, notify: false })
}

/** Remembers the last name seen per account on this instance, so the admin list is consulted only when a name is new or changed. */
const nameSeen = new Map<number, string>()

/** Catches accounts that take a staff-like name after joining. Returns true when the account was removed. */
async function nameAlarm(hub: HubConfig, token: string, m: GuardMsg) {
  const u = m.from!
  const tag = `${u.first_name ?? ''}|${u.last_name ?? ''}|${u.username ?? ''}`
  if (nameSeen.get(u.id) === tag) return false
  if (nameSeen.size > 5000) nameSeen.clear()
  nameSeen.set(u.id, tag)
  const chatTitle = m.chat.title ?? String(m.chat.id)
  if (hub.guard.impersonation && staffWordInName(u)) {
    await del(token, m.chat.id, m.message_id)
    await ban(token, m.chat.id, u.id).catch(() => null)
    await modLog({ chatId: m.chat.id, chatTitle, user: u, action: 'Banlandı', reason: 'Yönetici / Alkanka taklidi yapan isim', undo: undoFor(m, 'ban', 0, 0) })
    return true
  }
  const twin = adminLookalike(u, await chatAdmins(token, m.chat.id))
  // A matching name is a hint, not proof, so staff decide; each account is reported once.
  if (twin && (await flagSuspect(u.id, short(u), `Yönetici ${short(twin)} ile aynı görünen isim`))) {
    await modLog({
      chatId: m.chat.id,
      chatTitle,
      user: u,
      action: 'Şüpheli isim',
      reason: `Yönetici ${who(twin)} ile aynı görünen isim. Otomatik işlem yapılmadı; sahteyse butonla banla.`,
      buttons: [{ text: 'Tüm gruplardan banla', data: `gd:ban:${u.id}` }],
    })
  }
  return false
}

async function punishSwarm(r: GroupRules, token: string, m: GuardMsg, hits: SwarmHit[], text: string) {
  const chatId = String(m.chat.id)
  const chatTitle = m.chat.title ?? chatId
  const ids = hits.map((h) => h.messageId)
  await dropFromSite(chatId, ids)
  for (let i = 0; i < ids.length; i += 100) await callBot(token, 'deleteMessages', { chat_id: chatId, message_ids: ids.slice(i, i + 100) }).catch(() => null)
  const accounts = [...new Map(hits.map((h) => [h.tgId, h.name])).entries()]
  for (const [id] of accounts) {
    await mute(token, chatId, id, r.floodMuteMinutes).catch(() => null)
    await adjustTrust(id, -10)
  }
  await modLog({
    chatId,
    chatTitle,
    action: 'Koordineli spam',
    reason: `${accounts.length} hesap aynı yazıyı attı (${accounts.map(([, name]) => name).join(', ').slice(0, 160)}). ${ids.length} mesaj silindi, hesaplar ${r.floodMuteMinutes} dakika susturuldu. Yazı: "${text.slice(0, 80)}"`,
    // Stragglers of an already reported swarm are logged quietly.
    notify: accounts.length >= r.swarmAccounts,
    undo: { kind: 'mute', chatId, tgIds: accounts.map(([id]) => id), trust: 10, warns: 0 },
  })
  if (r.raidMode) await beginRaid(r, token, chatId, chatTitle, `Koordineli spam: ${accounts.length} hesap aynı yazıyı attı`)
}

/** The site's chat group is always protected, even if it was never added to the guard list. */
async function isProtectedChat(hub: HubConfig, chatId: number | string) {
  const id = String(chatId)
  if (hub.groups.some((g) => g.chatId === id)) return true
  const { getChatConfig } = await import('@/lib/telegram-chat')
  const chat = await getChatConfig().catch(() => null)
  return chat?.chatId === id
}

/** Returns true when the message was removed and should not reach other handlers. */
/** Same Bekçi rules applied to messages typed in the on-site chat, before they reach Telegram. */
export async function checkSiteText(text: string): Promise<string | null> {
  const hub = await getHub()
  const g = hub.guard
  const spam = bridgeReason({ text } as GuardMsg, g.allowDomains, g.words)
  if (spam?.kind === 'ad') return 'Sohbette link, numara ya da reklam paylaşamazsın.'
  if (spam?.kind === 'word') return 'Mesajında küfür / hakaret var, gönderilmedi.'
  if (g.aiModeration && text.length >= 12) {
    const verdict = await aiVerdict(text)
    if (verdict.bad) return 'Mesajın topluluk kurallarına uymuyor, gönderilmedi.'
  }
  return null
}

export async function guardMessage(botId: number, raw: TgMessage, edited: boolean): Promise<boolean> {
  await ensureGuardTables()
  const hub = await getHub()
  const m = raw as GuardMsg
  if (!(await isProtectedChat(hub, m.chat.id))) return false
  const token = await botToken(botId)
  const g = hub.guard
  const r = rulesFor(hub, m.chat.id)
  const chatId = String(m.chat.id)

  if (m.new_chat_members?.length) {
    await handleNewMembers(hub, r, token, m)
    if (r.cleanService) await del(token, m.chat.id, m.message_id)
    return true
  }
  if (m.left_chat_member) {
    if (r.cleanService) await del(token, m.chat.id, m.message_id)
    return true
  }
  if (m.is_automatic_forward) {
    // The channel post that opens a comment thread. Remembered so the comment speed limit only counts real posts.
    if (r.commentRate > 0) await markPostRoot(chatId, m.message_id).catch(() => null)
    return false
  }
  if (!m.from) return false
  // Anonymous admins and the linked channel post as the chat itself.
  if (m.sender_chat && (m.sender_chat.id === m.chat.id || m.from.username === 'GroupAnonymousBot')) return false
  if (m.from.is_bot) return false

  const admin = await isChatAdmin(token, m.chat.id, m.from.id)
  if (!edited && (await handleCommand(hub, token, m, admin))) return true
  if (admin) {
    if (!edited) await recordMessage(hub, m, null)
    return false
  }

  const trust = await trustOf(m.from.id)
  const text = (m.text ?? m.caption ?? '').trim()

  if (!trust.trusted) {
    const gb = await rows(sql`SELECT reason FROM tg_global_bans WHERE tg_id = ${m.from.id}`)
    if (gb.length) {
      await del(token, m.chat.id, m.message_id)
      await ban(token, m.chat.id, m.from.id).catch(() => null)
      return true
    }

    let needsCheck = trust.needsCheck
    if (!trust.known) {
      if (r.commentShield) {
        // Only an account that is not a member can be writing here without having joined: it is commenting on a channel post.
        const status = await callBot<{ status: string }>(token, 'getChatMember', { chat_id: m.chat.id, user_id: m.from.id })
          .then((x) => x.status)
          .catch(() => 'member')
        needsCheck = status === 'left' || status === 'kicked'
      }
      await meetMember(m.from.id, needsCheck)
    }
    if (r.commentShield && needsCheck) {
      await challengeComment(token, m)
      return true
    }

    if (r.nameWatch && (await nameAlarm(hub, token, m))) return true

    // A channel sender_chat that is not ours means someone is posting as a foreign channel.
    if (m.sender_chat && m.sender_chat.type === 'channel') {
      await punish(r, token, m, 'Başka bir kanal adına mesaj', { hard: r.linkAction === 'ban' })
      return true
    }

    const links = foreignLinks(m, g.allowDomains)
    if (links.length) {
      await punish(r, token, m, `Yabancı link / reklam: ${links[0].slice(0, 60)}`, { hard: r.linkAction === 'ban' || trust.score < 30 })
      return true
    }
    const hidden = r.hiddenAds ? hiddenAdReason(m, g.allowDomains, new Set(hub.groups.map((x) => x.chatId))) : null
    if (hidden) {
      await punish(r, token, m, hidden, { hard: r.linkAction === 'ban' || trust.score < 30 })
      return true
    }
    if (r.blockForwards && isForwardedFromChannel(m)) {
      await punish(r, token, m, 'Başka kanaldan iletilen mesaj')
      return true
    }
    const bad = text ? findBadWord(text, g.words) : null
    if (bad) {
      await punish(r, token, m, 'Küfür / hakaret')
      return true
    }
    const blocked = contentBlock(r, m, trust)
    if (blocked) {
      await softDelete(token, m, blocked)
      return true
    }
  }

  if (edited) return false
  const textHash = text ? createHash('sha1').update(normalizeText(text)).digest('hex').slice(0, 16) : null

  if (!trust.trusted) {
    // Record first: a burst arrives as parallel webhooks, so counting before inserting lets every message see zero.
    await recordMessage(hub, m, textHash)
    const thread = threadOf(m)
    if (thread && r.commentRate > 0) {
      const state = await threadState(chatId, thread)
      const tooFast = state.isPost && state.recent > r.commentRate
      if (state.locked || tooFast) {
        await del(token, m.chat.id, m.message_id)
        await rows(sql`UPDATE tg_guard_msgs SET counted = false WHERE chat_id = ${chatId} AND message_id = ${m.message_id}`)
        if (!state.locked && (await lockThread(chatId, thread, r.commentLockMinutes))) {
          await notice(token, m.chat.id, `Bu gönderiye çok hızlı yorum geldi. Yorumlar ${r.commentLockMinutes} dakikalığına kapatıldı.`, r.commentLockMinutes * 60, thread)
          await modLog({
            chatId,
            chatTitle: m.chat.title,
            action: 'Yorumlar kapatıldı',
            reason: `Bir gönderiye 1 dakikada ${state.recent} yorum geldi (sınır ${r.commentRate}). O gönderinin yorumları ${r.commentLockMinutes} dakika kapalı; yeni yorumlar silinir.`,
            buttons: [{ text: 'Yorumları şimdi aç', data: `gd:tun:${chatId}:${thread}` }],
          })
        }
        return true
      }
    }
    const [flood] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tg_guard_msgs
      WHERE chat_id = ${chatId} AND tg_id = ${m.from.id} AND created_at > now() - make_interval(secs => ${r.floodSeconds})`)
    if (Number(flood.n) >= r.floodCount) {
      await del(token, m.chat.id, m.message_id)
      await mute(token, m.chat.id, m.from.id, r.floodMuteMinutes).catch(() => null)
      await adjustTrust(m.from.id, -10)
      await notice(token, m.chat.id, `${short(m.from)} çok hızlı yazdığı için ${r.floodMuteMinutes} dakika susturuldu.`)
      await modLog({
        chatId: m.chat.id,
        chatTitle: m.chat.title,
        user: m.from,
        action: `Susturuldu (${r.floodMuteMinutes} dk)`,
        reason: `Flood: ${r.floodSeconds} sn içinde ${flood.n} mesaj`,
        undo: undoFor(m, 'mute', 10, 0),
      })
      return true
    }
    if (textHash && r.repeatLimit > 1) {
      const [rep] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tg_guard_msgs
        WHERE tg_id = ${m.from.id} AND text_hash = ${textHash} AND created_at > now() - interval '10 minutes'`)
      if (Number(rep.n) >= r.repeatLimit) {
        await del(token, m.chat.id, m.message_id)
        await mute(token, m.chat.id, m.from.id, r.floodMuteMinutes).catch(() => null)
        await modLog({
          chatId: m.chat.id,
          chatTitle: m.chat.title,
          user: m.from,
          action: `Susturuldu (${r.floodMuteMinutes} dk)`,
          reason: `Aynı mesajı ${rep.n} kez tekrarladı`,
          undo: undoFor(m, 'mute', 0, 0),
        })
        return true
      }
    }
    // Short lines ("gol", "tebrikler") are typed by many real people at once, so only longer texts count as a swarm.
    if (textHash && r.swarmAccounts > 1 && normalizeText(text).length >= SWARM_MIN_LENGTH) {
      const hits = await swarmHits(chatId, textHash, r.swarmAccounts)
      if (hits.length) {
        await punishSwarm(r, token, m, hits, text)
        return true
      }
    }
    if (g.aiModeration && text.length >= 12 && trust.score < 85) {
      const verdict = await aiVerdict(text)
      if (verdict.bad) {
        await punish(r, token, m, `Yapay zekâ: ${verdict.reason}`)
        return true
      }
    }
  }

  await recordMessage(hub, m, textHash)
  await dailyTrustBump(m.from.id)
  await autoReply(hub, token, m, text).catch((error) => console.error('[tg-autoreply]', error))
  return false
}

// --- Member changes (chat_member / my_chat_member) -----------------------------

const isAdminStatus = (s: string) => s === 'administrator' || s === 'creator'
const isInChat = (s: TgMemberState) => s.status === 'member' || isAdminStatus(s.status) || (s.status === 'restricted' && s.is_member !== false)

/**
 * Telegram reports these only to an admin bot that asked for them. Groups already report joins as messages,
 * so here they are used for what messages cannot show: channel subscribers and changes to who is an admin.
 */
export async function handleMemberUpdate(botId: number, up: TgMemberUpdate, own: boolean) {
  await ensureGuardTables()
  const hub = await getHub()
  const chatId = String(up.chat.id)
  const isLogChat = chatId === hub.logChatId
  if (!isLogChat && !(await isProtectedChat(hub, chatId))) return
  const chatTitle = up.chat.title ?? chatId
  const was = up.old_chat_member
  const now = up.new_chat_member
  const place = up.chat.type === 'channel' ? 'kanaldan' : 'gruptan'

  if (own) {
    if (!hub.shield.adminAlerts) return
    if (isInChat(was) && !isInChat(now)) {
      await modLog({ chatId, chatTitle, action: 'Bekçi çıkarıldı', reason: `Bekçi botu bu ${place} çıkarıldı (yapan: ${who(up.from)}). Burada koruma artık çalışmıyor.` })
    } else if (isAdminStatus(was.status) && !isAdminStatus(now.status)) {
      await modLog({ chatId, chatTitle, action: 'Bekçi yetkisi alındı', reason: `Bekçi botunun yöneticiliği kaldırıldı (yapan: ${who(up.from)}). Mesaj silemez, kimseyi engelleyemez.` })
    } else if (isAdminStatus(now.status)) {
      const lost = [
        was.can_delete_messages && !now.can_delete_messages ? 'mesaj silme' : null,
        was.can_restrict_members && !now.can_restrict_members ? 'üye engelleme' : null,
      ].filter(Boolean)
      if (lost.length) {
        await modLog({ chatId, chatTitle, action: 'Bekçi yetkisi kısıldı', reason: `Kapatılan yetki: ${lost.join(', ')} (yapan: ${who(up.from)}). Koruma eksik çalışır.` })
      }
    }
    return
  }
  if (isLogChat) return

  if (hub.shield.adminAlerts && isAdminStatus(was.status) !== isAdminStatus(now.status)) {
    adminCache.delete(`${chatId}:${now.user.id}`)
    await modLog({
      chatId,
      chatTitle,
      user: now.user,
      action: isAdminStatus(now.status) ? 'Yeni yönetici eklendi' : 'Yönetici çıkarıldı',
      reason: `Yapan: ${who(up.from)}. Bu değişikliği sen ya da ekibin yapmadıysa hesabın ele geçirilmiş olabilir.`,
    })
  }

  if (up.chat.type !== 'channel' || now.user.is_bot || isInChat(was) || !isInChat(now)) return
  const via = up.via_join_request
    ? 'katılma isteği'
    : up.via_chat_folder_invite_link
      ? 'klasör linki'
      : up.invite_link
        ? `davet linki${up.invite_link.name ? `: ${up.invite_link.name.slice(0, 40)}` : ''}`
        : up.from.id !== now.user.id
          ? 'biri ekledi'
          : null
  const join = await logChannelJoin(chatId, now.user, via)
  const token = await botToken(botId)
  if (join.banned) {
    await callBot(token, 'banChatMember', { chat_id: chatId, user_id: now.user.id }).catch(() => null)
    await markRemoved(chatId, [now.user.id])
    await modLog({ chatId, chatTitle, user: now.user, action: 'Giriş reddedildi', reason: 'Global ban listesinde (kanal)', notify: false })
    return
  }
  const limit = hub.shield.channelJoinAlert
  if (limit > 0 && join.recent >= limit && (await claimAlert(`chan_alert_${chatId}`, WAVE_MINUTES))) {
    await modLog({
      chatId,
      chatTitle,
      action: 'Kanala toplu giriş',
      reason: `Son 10 dakikada ${join.recent} yeni abone (alarm sınırı ${limit}). Reklam ya da duyuru yaptıysan normaldir; yapmadıysan kanala sahte abone basılıyor olabilir.`,
      buttons: [{ text: `Son ${WAVE_MINUTES} dk girenleri çıkar`, data: `gd:wave:${chatId}` }],
    })
  }
}

// --- Panel: locks, join waves, suspects -----------------------------------------

async function guardToken() {
  const hub = await getHub()
  if (!hub.guardBotId) throw new Error('Önce Bekçi botunu seç')
  return { hub, token: await botToken(hub.guardBotId) }
}

export async function panelUnlock(chatId: string) {
  await ensureGuardTables()
  const { hub, token } = await guardToken()
  const res = await closeLock(token, chatId, hub.groups.find((g) => g.chatId === chatId)?.title ?? chatId, 'Panelden kapatıldı')
  return { ok: res.ok, message: res.message }
}

export async function panelSweepWave(chatId: string) {
  await ensureGuardTables()
  const { hub, token } = await guardToken()
  if (!(await isProtectedChat(hub, chatId))) throw new Error('Bu sohbet korunan listede değil')
  const res = await sweepWave(token, chatId)
  await modLog({
    chatId,
    chatTitle: hub.groups.find((g) => g.chatId === chatId)?.title,
    action: 'Giriş dalgası çıkarıldı',
    reason: `${res.removed} kişi ${RAID_BAN_MINUTES} dakikalığına çıkarıldı${res.left ? `, ${res.left} kişi kaldı` : ''} (panelden)`,
    notify: false,
  })
  return res
}

export async function suspectAct(ids: number[], action: 'ban' | 'mute' | 'wipe' | 'clear') {
  await ensureGuardTables()
  const list = [...new Set(ids.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))].slice(0, 100)
  if (!list.length) throw new Error('Kimse seçilmedi')
  if (action === 'clear') {
    await setSuspectState(list, 'cleared')
    return `${list.length} hesap listeden çıkarıldı, bir daha şüpheli gösterilmez.`
  }
  const { hub, token } = await guardToken()
  if (action === 'wipe') {
    let deleted = 0
    for (const id of list) deleted += await deleteUserMessages(id)
    return `${deleted} mesaj silindi (Telegram sadece son 48 saati sildirir).`
  }
  const names = await suspectNames(list)
  const started = Date.now()
  const done: number[] = []
  for (const id of list) {
    // Each account costs one Telegram call per group; the rest wait for the next press instead of timing out.
    if (Date.now() - started > 40_000) break
    if (action === 'ban') {
      await rows(sql`INSERT INTO tg_global_bans (tg_id, who, reason) VALUES (${id}, ${names.get(id) ?? String(id)}, 'Şüpheli listesinden banlandı (panel)')
        ON CONFLICT (tg_id) DO UPDATE SET reason = EXCLUDED.reason`)
      for (const g of hub.groups) await ban(token, g.chatId, id).catch(() => null)
    } else {
      for (const g of hub.groups) if (g.type !== 'channel') await mute(token, g.chatId, id, 1440).catch(() => null)
    }
    done.push(id)
  }
  if (action === 'ban') await setSuspectState(done, 'removed')
  await modLog({
    action: action === 'ban' ? 'Banlandı (tüm gruplar)' : 'Susturuldu (1440 dk)',
    reason: `Şüpheli listesinden ${done.length} hesap (panelden): ${done.map((id) => names.get(id) ?? String(id)).join(', ').slice(0, 300)}`,
    notify: false,
  })
  const rest = list.length - done.length ? ` ${list.length - done.length} hesap kaldı, tekrar dene.` : ''
  return action === 'ban'
    ? `${done.length} hesap tüm gruplardan banlandı.${rest} Yanlış olanı "Tüm gruplardan yasaklılar" listesinden geri alabilirsin.`
    : `${done.length} hesap 24 saat susturuldu.${rest}`
}

/** What the panel's member card can do to one account. Every action covers all protected groups at once. */
export async function memberAct(tgId: number, action: MemberAction, by: string) {
  await ensureGuardTables()
  if (!Number.isSafeInteger(tgId) || tgId <= 0) throw new Error('Geçersiz Telegram ID')
  const name = (await suspectNames([tgId])).get(tgId) ?? ''
  const user: TgUser = name.startsWith('@') ? { id: tgId, username: name.slice(1) } : { id: tgId, first_name: name || undefined }
  const note = `panelden, ${by}`

  if (action === 'clearWarns') {
    await rows(sql`DELETE FROM tg_warns WHERE tg_id = ${tgId}`)
    await modLog({ user, action: 'Uyarılar sıfırlandı', reason: note, notify: false })
    return 'Uyarılar sıfırlandı.'
  }
  const { hub, token } = await guardToken()
  if (action === 'wipe') {
    const n = await deleteUserMessages(tgId)
    await modLog({ user, action: 'Mesaj silindi', reason: `Son 48 saatteki ${n} mesajı silindi (${note})`, notify: false })
    return `${n} mesaj silindi (Telegram sadece son 48 saati sildirir).`
  }
  if (action === 'ban') {
    // Listed first: even if Telegram refuses every group right now, the account is turned away the next time it tries to join.
    await rows(sql`INSERT INTO tg_global_bans (tg_id, who, reason) VALUES (${tgId}, ${who(user)}, ${`Panelden banlandı (${by})`})
      ON CONFLICT (tg_id) DO UPDATE SET reason = EXCLUDED.reason`)
  }
  const groups = hub.groups.filter((g) => action === 'ban' || g.type !== 'channel')
  let reached = 0
  let lastError = ''
  for (const g of groups) {
    try {
      if (action === 'ban') await ban(token, g.chatId, tgId)
      else if (action === 'mute') await mute(token, g.chatId, tgId, 1440)
      else await unmute(token, g.chatId, tgId)
      reached++
    } catch (error) {
      lastError = String((error as Error).message)
    }
  }
  if (action !== 'ban' && !reached) {
    throw new Error(groups.length ? `Telegram hiçbir grupta izin vermedi: ${lastError}` : 'Korunan grup yok.')
  }
  const where = `${reached}/${groups.length} sohbet`
  await modLog({
    user,
    action: action === 'ban' ? 'Banlandı (tüm gruplar)' : action === 'mute' ? 'Susturuldu (1440 dk)' : 'Susturma kaldırıldı',
    reason: `${where} (${note})`,
    notify: false,
  })
  if (action === 'ban') return `Tüm gruplardan banlandı (${where}). Genel yasak listesine eklendi.`
  return action === 'mute' ? `24 saat susturuldu (${where}).` : `Susturma kaldırıldı (${where}).`
}
