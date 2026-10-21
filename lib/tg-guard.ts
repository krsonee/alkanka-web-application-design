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
  ensureHubTables,
  getHub,
  modLog,
  setTrusted,
  trustOf,
  weekStart,
  who,
  type TgCallback,
  type TgJoinRequest,
  type TgUser,
} from '@/lib/tg-hub'
import type { HubConfig } from '@/lib/tg-hub-shared'
import { autoReply } from '@/lib/tg-autoreply'

type GuardMsg = TgMessage & {
  sender_chat?: { id: number; type: string }
  left_chat_member?: TgUser
  entities?: { type: string; url?: string; offset: number; length: number }[]
  caption_entities?: { type: string; url?: string; offset: number; length: number }[]
}

const AI_MODEL = 'google/gemini-3.5-flash'
const CAPTCHA_MINUTES = 3
const RAID_WINDOW_SEC = 60
const PURGE_MAX = 300
const ADMIN_CACHE_MS = 10 * 60 * 1000

let guardReady: Promise<void> | null = null
function ensureGuardTables() {
  guardReady ??= (async () => {
    await ensureHubTables()
    await rows(sql`ALTER TABLE tg_captcha ADD COLUMN IF NOT EXISTS msg_id bigint`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_autodel (id serial PRIMARY KEY, chat_id text NOT NULL, message_id bigint NOT NULL, due_at timestamptz NOT NULL)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_wipe (chat_id text PRIMARY KEY, bot_id int NOT NULL, title text NOT NULL DEFAULT '',
      next_id bigint NOT NULL, total bigint NOT NULL, done bigint NOT NULL DEFAULT 0, started_by text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now())`)
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

const del = (token: string, chatId: number | string, messageId: number) =>
  callBot(token, 'deleteMessage', { chat_id: chatId, message_id: messageId }).catch(() => null)

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
  await callBot(token, 'banChatMember', { chat_id: chatId, user_id: userId, revoke_messages: true })
}

async function kick(token: string, chatId: number | string, userId: number) {
  await callBot(token, 'banChatMember', { chat_id: chatId, user_id: userId })
  await callBot(token, 'unbanChatMember', { chat_id: chatId, user_id: userId, only_if_banned: true })
}

async function notice(token: string, chatId: number | string, text: string, seconds = 20) {
  const sent = await callBot<{ message_id: number }>(token, 'sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } }).catch(() => null)
  if (!sent) return
  // Serverless functions freeze after responding, so cleanup is queued for the background tick.
  await rows(sql`INSERT INTO tg_autodel (chat_id, message_id, due_at)
    VALUES (${String(chatId)}, ${sent.message_id}, now() + make_interval(secs => ${seconds}))`).catch(() => null)
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
  const allowed = allow.map((a) => a.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, ''))
  return [...found].filter((link) => {
    const clean = link.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')
    return !allowed.some((a) => a && clean.startsWith(a))
  })
}

const isForwardedFromChannel = (m: GuardMsg) => m.forward_origin?.type === 'channel' || Boolean(m.forward_from_chat)

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

async function punish(hub: HubConfig, token: string, m: GuardMsg, reason: string, opts: { hard?: boolean } = {}) {
  const user = m.from!
  const chatTitle = m.chat.title ?? String(m.chat.id)
  await del(token, m.chat.id, m.message_id)
  if (opts.hard) {
    await ban(token, m.chat.id, user.id).catch(() => null)
    await adjustTrust(user.id, -50)
    await modLog({ chatId: m.chat.id, chatTitle, user, action: 'Banlandı', reason })
    return
  }
  const count = await addWarn(user.id)
  await adjustTrust(user.id, -10)
  const g = hub.guard
  if (count < g.warnLimit) {
    await notice(token, m.chat.id, `${short(user)} uyarı ${count}/${g.warnLimit}: ${reason}`)
    await modLog({ chatId: m.chat.id, chatTitle, user, action: 'Mesaj silindi', reason: `${reason} (uyarı ${count}/${g.warnLimit})` })
    return
  }
  const step = count - g.warnLimit
  if (step < g.muteMinutes.length) {
    const minutes = g.muteMinutes[step]
    await mute(token, m.chat.id, user.id, minutes).catch(() => null)
    await adjustTrust(user.id, -15)
    await notice(token, m.chat.id, `${short(user)} ${minutes >= 1440 ? `${Math.round(minutes / 1440)} gün` : `${minutes} dakika`} susturuldu: ${reason}`)
    await modLog({ chatId: m.chat.id, chatTitle, user, action: `Susturuldu (${minutes} dk)`, reason })
    return
  }
  await ban(token, m.chat.id, user.id).catch(() => null)
  await notice(token, m.chat.id, `${short(user)} kuralları tekrar tekrar çiğnediği için gruptan atıldı.`)
  await modLog({ chatId: m.chat.id, chatTitle, user, action: 'Banlandı (uyarı limiti)', reason })
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

function impersonates(u: TgUser) {
  const name = normalizeText(`${u.first_name ?? ''} ${u.last_name ?? ''} ${u.username ?? ''}`).replace(/\s/g, '')
  return /(alkanka|alkankadestek|alkankaadmin)/.test(name) || /(destek|admin|yonetici|yönetici|support|moderator)/.test(name)
}

async function screenNewcomer(hub: HubConfig, token: string, chatId: number | string, chatTitle: string, u: TgUser) {
  const banned = await rows(sql`SELECT 1 FROM tg_global_bans WHERE tg_id = ${u.id}`)
  if (banned.length) return 'Global ban listesinde'
  if (hub.guard.casCheck && (await casBanned(u.id))) return 'Bilinen spam hesabı (CAS listesi)'
  if (hub.guard.impersonation && impersonates(u)) return 'Yönetici / Alkanka taklidi yapan isim'
  await rows(sql`INSERT INTO tg_joins (chat_id) VALUES (${String(chatId)})`)
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tg_joins
    WHERE chat_id = ${String(chatId)} AND created_at > now() - make_interval(secs => ${RAID_WINDOW_SEC})`)
  if (hub.guard.raidJoins > 0 && Number(n) > hub.guard.raidJoins) {
    if (Number(n) === hub.guard.raidJoins + 1) {
      await modLog({ chatId, chatTitle, action: 'Baskın algılandı', reason: `1 dakikada ${n} giriş. Yeni gelenler geçici olarak engelleniyor.` })
    }
    return 'Baskın koruması (çok hızlı toplu giriş)'
  }
  return null
}

export async function handleJoinRequest(botId: number, r: TgJoinRequest) {
  await ensureGuardTables()
  const hub = await getHub()
  if (!hub.groups.some((g) => g.chatId === String(r.chat.id))) return
  const token = await botToken(botId)
  const reason = await screenNewcomer(hub, token, r.chat.id, r.chat.title ?? '', r.from)
  if (reason) {
    await callBot(token, 'declineChatJoinRequest', { chat_id: r.chat.id, user_id: r.from.id }).catch(() => null)
    await modLog({ chatId: r.chat.id, chatTitle: r.chat.title, user: r.from, action: 'Giriş reddedildi', reason })
    return
  }
  await callBot(token, 'approveChatJoinRequest', { chat_id: r.chat.id, user_id: r.from.id }).catch(() => null)
}

async function handleNewMembers(hub: HubConfig, token: string, m: GuardMsg) {
  const chatTitle = m.chat.title ?? String(m.chat.id)
  for (const u of m.new_chat_members ?? []) {
    if (u.is_bot) {
      // Only admins may add bots; anything else is a spam bot drop.
      if (m.from && !(await isChatAdmin(token, m.chat.id, m.from.id))) {
        await ban(token, m.chat.id, u.id).catch(() => null)
        await modLog({ chatId: m.chat.id, chatTitle, user: u, action: 'Banlandı', reason: 'Yetkisiz bot eklendi' })
      }
      continue
    }
    const reason = await screenNewcomer(hub, token, m.chat.id, chatTitle, u)
    if (reason) {
      await ban(token, m.chat.id, u.id).catch(() => null)
      await modLog({ chatId: m.chat.id, chatTitle, user: u, action: 'Giriş reddedildi', reason })
      continue
    }
    if (!hub.guard.captcha) continue
    await mute(token, m.chat.id, u.id, 60 * 24 * 366).catch(() => null)
    const sent = await callBot<{ message_id: number }>(token, 'sendMessage', {
      chat_id: m.chat.id,
      text: `Hoş geldin ${short(u)}! Yazabilmek için ${CAPTCHA_MINUTES} dakika içinde aşağıdaki butona bas.`,
      reply_markup: { inline_keyboard: [[{ text: 'Ben insanım', callback_data: `cap:${u.id}` }]] },
    }).catch(() => null)
    await rows(sql`INSERT INTO tg_captcha (chat_id, tg_id, expires_at, msg_id)
      VALUES (${String(m.chat.id)}, ${u.id}, now() + make_interval(mins => ${CAPTCHA_MINUTES}), ${sent?.message_id ?? null})
      ON CONFLICT (chat_id, tg_id) DO UPDATE SET expires_at = EXCLUDED.expires_at, msg_id = EXCLUDED.msg_id`)
  }
}

/** Kicks newcomers who never pressed the captcha button. Runs from the background tick. */
export async function expireCaptchas() {
  await ensureGuardTables()
  const hub = await getHub()
  if (!hub.guardBotId || !hub.guard.enabled) return 0
  const token = await botToken(hub.guardBotId)
  const due = await rows(sql`DELETE FROM tg_captcha WHERE expires_at < now() RETURNING chat_id, tg_id, msg_id`)
  for (const d of due) {
    await kick(token, String(d.chat_id), Number(d.tg_id)).catch(() => null)
    if (d.msg_id) await del(token, String(d.chat_id), Number(d.msg_id))
  }
  if (due.length) await modLog({ action: 'Doğrulanmadı, atıldı', reason: `${due.length} hesap butona basmadı (muhtemel bot)`, notify: due.length >= 5 })
  return due.length
}

export async function handleGuardCallback(botId: number, q: TgCallback) {
  await ensureGuardTables()
  const token = await botToken(botId)
  const answer = (text: string) => callBot(token, 'answerCallbackQuery', { callback_query_id: q.id, text }).catch(() => null)
  const [kind, arg] = (q.data ?? '').split(':')
  if (kind === 'cap' && q.message) {
    if (Number(arg) !== q.from.id) return answer('Bu buton sana ait değil.')
    const chatId = q.message.chat.id
    await rows(sql`DELETE FROM tg_captcha WHERE chat_id = ${String(chatId)} AND tg_id = ${q.from.id}`)
    await unmute(token, chatId, q.from.id).catch(() => null)
    await del(token, chatId, q.message.message_id)
    return answer('Doğrulandı, artık yazabilirsin!')
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

export async function startWipe(botId: number, chatId: number | string, title: string, fromId: number, by: string) {
  await ensureGuardTables()
  await rows(sql`INSERT INTO tg_wipe (chat_id, bot_id, title, next_id, total, done, started_by)
    VALUES (${String(chatId)}, ${botId}, ${title.slice(0, 80)}, ${fromId}, ${fromId}, 0, ${by.slice(0, 80)})
    ON CONFLICT (chat_id) DO UPDATE SET bot_id = EXCLUDED.bot_id, next_id = EXCLUDED.next_id, total = EXCLUDED.total, done = 0,
      started_by = EXCLUDED.started_by, created_at = now()`)
  await modLog({ chatId, chatTitle: title, action: 'Tüm sohbet silme başladı', reason: `${by} · ${fromId} mesaja kadar` })
}

export async function listWipes() {
  await ensureGuardTables()
  const r = await rows<{ chat_id: string; title: string; next_id: string; total: string }>(sql`SELECT chat_id, title, next_id, total FROM tg_wipe ORDER BY created_at`)
  return r.map((w) => ({ chatId: w.chat_id, title: w.title, left: Number(w.next_id), total: Number(w.total) }))
}

/** Deletes message ids from newest to oldest in batches; resumes on the next tick when time runs out or Telegram rate-limits. */
export async function processWipes(budgetMs = 25_000) {
  await ensureGuardTables()
  const started = Date.now()
  const jobs = await rows<{ chat_id: string; bot_id: number; title: string; next_id: string; done: string }>(sql`SELECT * FROM tg_wipe ORDER BY created_at`)
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
        await callBot(token, 'deleteMessages', { chat_id: job.chat_id, message_ids: ids })
        done += ids.length
      } catch (error) {
        const msg = String((error as Error).message)
        if (/too many requests|retry after/i.test(msg)) break
        if (/not enough rights|chat not found|bot was kicked|not a member/i.test(msg)) {
          await rows(sql`DELETE FROM tg_wipe WHERE chat_id = ${job.chat_id}`)
          await modLog({ chatId: job.chat_id, chatTitle: job.title, action: 'Tüm sohbet silme durdu', reason: `Botun silme yetkisi yok: ${msg}`.slice(0, 300) })
          next = -1
          break
        }
        // "message can't be deleted" for a batch of service or missing ids; skip and continue.
      }
      next -= WIPE_BATCH
      await new Promise((r) => setTimeout(r, 40))
    }
    if (next === -1) continue
    if (next < 1) {
      await rows(sql`DELETE FROM tg_wipe WHERE chat_id = ${job.chat_id}`)
      await notice(token, job.chat_id, 'Sohbet temizliği tamamlandı.', 30)
      await modLog({ chatId: job.chat_id, chatTitle: job.title, action: 'Tüm sohbet silindi', reason: `${done} mesaj numarası tarandı` })
    } else {
      await rows(sql`UPDATE tg_wipe SET next_id = ${next}, done = ${done} WHERE chat_id = ${job.chat_id}`)
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
      await punish(hub, token, fake, arg || 'Yönetici uyarısı')
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
    case 'kilit':
      await callBot(token, 'setChatPermissions', { chat_id: m.chat.id, permissions: { can_send_messages: false } }).catch(() => null)
      await callBot(token, 'sendMessage', { chat_id: m.chat.id, text: 'Grup geçici olarak kilitlendi. Sadece yöneticiler yazabilir.' }).catch(() => null)
      await modLog({ chatId: m.chat.id, chatTitle, user: m.from, action: 'Grup kilitlendi', reason: 'Yönetici komutu' })
      break
    case 'kilitac':
      await callBot(token, 'setChatPermissions', {
        chat_id: m.chat.id,
        permissions: { can_send_messages: true, can_send_photos: true, can_send_videos: true, can_send_other_messages: true, can_add_web_page_previews: true, can_send_polls: true },
      }).catch(() => null)
      await callBot(token, 'sendMessage', { chat_id: m.chat.id, text: 'Grup kilidi açıldı. Herkes yazabilir.' }).catch(() => null)
      break
  }
  return true
}

/** Panel helpers that run the same sweeps without a group command. */
export async function sweepDeletedAccounts(chatId: string) {
  const hub = await getHub()
  if (!hub.guardBotId) throw new Error('Önce Bekçi botunu seç')
  const r = await deletedAccountSweep(await botToken(hub.guardBotId), chatId)
  await modLog({ chatId, chatTitle: hub.groups.find((g) => g.chatId === chatId)?.title, action: 'Silinmiş hesap temizliği', reason: `${r.removed}/${r.checked} hesap çıkarıldı (panelden)` })
  return r
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
    for (let i = 0; i < ids.length; i += 100) {
      if (await callBot<boolean>(token, 'deleteMessages', { chat_id: chatId, message_ids: ids.slice(i, i + 100) }).catch(() => false)) n += ids.slice(i, i + 100).length
    }
  }
  return n
}

// --- Main entry --------------------------------------------------------------

async function recordMessage(hub: HubConfig, m: GuardMsg, textHash: string | null) {
  const text = (m.text ?? m.caption ?? '').trim()
  const counted = hub.counter.enabled && !text.startsWith('/') && normalizeText(text).replace(/\s/g, '').length >= hub.counter.minLength
  await rows(sql`INSERT INTO tg_guard_msgs (chat_id, message_id, tg_id, name, text_hash, counted)
    VALUES (${String(m.chat.id)}, ${m.message_id}, ${m.from!.id}, ${short(m.from).slice(0, 60)}, ${textHash}, ${counted})
    ON CONFLICT (chat_id, message_id) DO NOTHING`)
}

/** Returns true when the message was removed and should not reach other handlers. */
export async function guardMessage(botId: number, raw: TgMessage, edited: boolean): Promise<boolean> {
  await ensureGuardTables()
  const hub = await getHub()
  const m = raw as GuardMsg
  if (!hub.groups.some((g) => g.chatId === String(m.chat.id))) return false
  const token = await botToken(botId)
  const g = hub.guard

  if (m.new_chat_members?.length) {
    await handleNewMembers(hub, token, m)
    if (g.cleanService) await del(token, m.chat.id, m.message_id)
    return true
  }
  if (m.left_chat_member) {
    if (g.cleanService) await del(token, m.chat.id, m.message_id)
    return true
  }
  if (!m.from || m.is_automatic_forward) return false
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

    // A channel sender_chat that is not ours means someone is posting as a foreign channel.
    if (m.sender_chat && m.sender_chat.type === 'channel') {
      await punish(hub, token, m, 'Ba��ka bir kanal adına mesaj', { hard: g.linkAction === 'ban' })
      return true
    }

    const links = foreignLinks(m, g.allowDomains)
    if (links.length) {
      await punish(hub, token, m, `Yabancı link / reklam: ${links[0].slice(0, 60)}`, { hard: g.linkAction === 'ban' || trust.score < 30 })
      return true
    }
    if (g.blockForwards && isForwardedFromChannel(m)) {
      await punish(hub, token, m, 'Başka kanaldan iletilen mesaj')
      return true
    }
    const bad = text ? findBadWord(text, g.words) : null
    if (bad) {
      await punish(hub, token, m, 'Küfür / hakaret')
      return true
    }
  }

  if (edited) return false
  const textHash = text ? createHash('sha1').update(normalizeText(text)).digest('hex').slice(0, 16) : null

  if (!trust.trusted) {
    const [flood] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tg_guard_msgs
      WHERE chat_id = ${String(m.chat.id)} AND tg_id = ${m.from.id} AND created_at > now() - make_interval(secs => ${g.floodSeconds})`)
    if (Number(flood.n) + 1 >= g.floodCount) {
      await del(token, m.chat.id, m.message_id)
      await mute(token, m.chat.id, m.from.id, g.floodMuteMinutes).catch(() => null)
      await adjustTrust(m.from.id, -10)
      await notice(token, m.chat.id, `${short(m.from)} çok hızlı yazdığı için ${g.floodMuteMinutes} dakika susturuldu.`)
      await modLog({ chatId: m.chat.id, chatTitle: m.chat.title, user: m.from, action: `Susturuldu (${g.floodMuteMinutes} dk)`, reason: `Flood: ${g.floodSeconds} sn içinde ${Number(flood.n) + 1} mesaj` })
      return true
    }
    if (textHash && g.repeatLimit > 1) {
      const [rep] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tg_guard_msgs
        WHERE tg_id = ${m.from.id} AND text_hash = ${textHash} AND created_at > now() - interval '10 minutes'`)
      if (Number(rep.n) + 1 >= g.repeatLimit) {
        await del(token, m.chat.id, m.message_id)
        await mute(token, m.chat.id, m.from.id, g.floodMuteMinutes).catch(() => null)
        await modLog({ chatId: m.chat.id, chatTitle: m.chat.title, user: m.from, action: `Susturuldu (${g.floodMuteMinutes} dk)`, reason: `Aynı mesajı ${Number(rep.n) + 1} kez tekrarladı` })
        return true
      }
    }
    if (g.aiModeration && text.length >= 12 && trust.score < 85) {
      const verdict = await aiVerdict(text)
      if (verdict.bad) {
        await punish(hub, token, m, `Yapay zekâ: ${verdict.reason}`)
        return true
      }
    }
  }

  await recordMessage(hub, m, textHash)
  await dailyTrustBump(m.from.id)
  await autoReply(hub, token, m, text).catch((error) => console.error('[tg-autoreply]', error))
  return false
}
