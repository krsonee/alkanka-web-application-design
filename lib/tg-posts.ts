import 'server-only'
import { get } from '@vercel/blob'
import { rows, sql } from '@/lib/db'
import { SITE_URL } from '@/lib/seo'
import { TelegramError, botToken, callBot, callBotUpload, ensureTables, normalizeChat } from '@/lib/telegram-mirror'
import type { TgCallback } from '@/lib/tg-hub'
import {
  CAPTION_LIMIT,
  DEFAULT_OPTIONS,
  FILE_MAX_BYTES,
  MEDIA_PATH,
  PHOTO_MAX_BYTES,
  POPUP_LIMIT,
  cleanTgHtml,
  finalText,
  mediaKindOf,
  needsSplit,
  normalizeContent,
  postProblems,
  visibleLength,
  type PostButton,
  type PostCenterData,
  type PostContent,
  type PostMedia,
  type PostMediaKind,
  type PostOrigin,
  type PostRow,
  type PostSendRow,
  type PostSponsor,
  type PostTarget,
  type TargetCheck,
} from '@/lib/tg-posts-shared'

type TgSent = {
  message_id: number
  photo?: { file_id: string }[]
  video?: { file_id: string }
  animation?: { file_id: string }
  document?: { file_id: string }
}
type Markup = { inline_keyboard: Record<string, unknown>[][] }
type Delivered = { ids: number[]; mainId: number; mainMedia: boolean }
type ChatInfo = { id: number; type: string; title?: string; username?: string; linked_chat_id?: number }
type Member = { status: string; can_post_messages?: boolean; can_edit_messages?: boolean; can_pin_messages?: boolean; can_send_messages?: boolean }
type Checked = TargetCheck & { username: string | null }

type SendRecord = {
  id: number
  postId: number
  botId: number | null
  chatId: string
  chatTitle: string
  chatUsername: string | null
  ids: number[]
  mainId: number | null
  mainMedia: boolean
  status: PostSendRow['status']
  error: string | null
  pinned: boolean
  unpinAt: Date | null
  deleteAt: Date | null
  sentAt: Date
  editedAt: Date | null
}
type PostRecord = { id: number; origin: PostOrigin; note: string; author: string; botId: number | null; content: PostContent; createdAt: Date }

const TEST_KEY = 'post_test_content'
const TEST_CHAT_KEY = 'post_test_chat'
const DELETE_WINDOW_MS = 48 * 60 * 60 * 1000
const AUTO_KEEP_DAYS = 60

let ready: Promise<void> | null = null
export function ensurePostTables() {
  ready ??= (async () => {
    await ensureTables()
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_posts (
      id serial PRIMARY KEY, origin text NOT NULL DEFAULT 'panel', note text NOT NULL DEFAULT '', author text NOT NULL DEFAULT '',
      bot_id int, text text NOT NULL DEFAULT '', media text NOT NULL DEFAULT '[]', buttons text NOT NULL DEFAULT '[]',
      options text NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_post_sends (
      id serial PRIMARY KEY, post_id int NOT NULL REFERENCES tg_posts(id) ON DELETE CASCADE, bot_id int, chat_id text NOT NULL,
      chat_title text NOT NULL DEFAULT '', chat_username text, message_ids text NOT NULL DEFAULT '[]', main_id bigint,
      main_media boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'sent', error text, pinned boolean NOT NULL DEFAULT false,
      unpin_at timestamptz, delete_at timestamptz, sent_at timestamptz NOT NULL DEFAULT now(), edited_at timestamptz)`)
    await rows(sql`CREATE INDEX IF NOT EXISTS tg_post_sends_post_idx ON tg_post_sends (post_id)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_post_clicks (
      post_id int NOT NULL, button_id text NOT NULL, clicks int NOT NULL DEFAULT 0, PRIMARY KEY (post_id, button_id))`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const parse = <T>(value: unknown, fallback: T): T => {
  try {
    return JSON.parse(String(value)) as T
  } catch {
    return fallback
  }
}
const date = (v: unknown) => (v ? new Date(v as string | Date) : null)

const mapSend = (r: Record<string, unknown>): SendRecord => ({
  id: Number(r.id),
  postId: Number(r.post_id),
  botId: r.bot_id == null ? null : Number(r.bot_id),
  chatId: String(r.chat_id),
  chatTitle: String(r.chat_title ?? ''),
  chatUsername: r.chat_username ? String(r.chat_username) : null,
  ids: parse<number[]>(r.message_ids, []).map(Number),
  mainId: r.main_id == null ? null : Number(r.main_id),
  mainMedia: Boolean(r.main_media),
  status: String(r.status) as PostSendRow['status'],
  error: r.error ? String(r.error) : null,
  pinned: Boolean(r.pinned),
  unpinAt: date(r.unpin_at),
  deleteAt: date(r.delete_at),
  sentAt: date(r.sent_at) ?? new Date(),
  editedAt: date(r.edited_at),
})

const mapPost = (r: Record<string, unknown>): PostRecord => ({
  id: Number(r.id),
  origin: (['mirror', 'share'].includes(String(r.origin)) ? String(r.origin) : 'panel') as PostOrigin,
  note: String(r.note ?? ''),
  author: String(r.author ?? ''),
  botId: r.bot_id == null ? null : Number(r.bot_id),
  content: {
    text: String(r.text ?? ''),
    media: parse<PostMedia[]>(r.media, []),
    buttons: parse<PostButton[][]>(r.buttons, []),
    options: { ...DEFAULT_OPTIONS, ...parse<Partial<PostContent['options']>>(r.options, {}) },
  },
  createdAt: date(r.created_at) ?? new Date(),
})

const mediaCountOf = (s: Pick<SendRecord, 'ids' | 'mainMedia'>) => (s.mainMedia ? s.ids.length : Math.max(0, s.ids.length - 1))

function postLink(chatId: string, username: string | null, messageId: number | null) {
  if (!messageId) return null
  if (username) return `https://t.me/${username}/${messageId}`
  return chatId.startsWith('-100') ? `https://t.me/c/${chatId.slice(4)}/${messageId}` : null
}

/** Turns Telegram's wording into what the admin has to do about it. */
function explain(error: unknown) {
  const raw = error instanceof TelegramError ? error.description : String((error as Error)?.message ?? error)
  if (/message can't be deleted/i.test(raw)) return 'Telegram bu mesajı silmeme izin vermiyor (48 saatten eski olabilir). Telegram’dan elle sil.'
  if (/message to \w+ not found|message not found|MESSAGE_ID_INVALID/i.test(raw)) return 'Mesaj Telegram’da bulunamadı (elle silinmiş olabilir).'
  if (/can't parse entities/i.test(raw)) return 'Telegram yazının biçimini okuyamadı. Biçimi temizleyip tekrar dene.'
  if (/(message|caption) is too long/i.test(raw)) return 'Yazı Telegram sınırından uzun.'
  if (/BUTTON_URL_INVALID|Wrong HTTP URL|url host is empty/i.test(raw)) return 'Butonlardan birinin adresi Telegram’a göre geçersiz.'
  if (/not enough rights to (pin|manage pinned)/i.test(raw)) return 'Botun bu sohbette mesaj sabitleme yetkisi yok.'
  if (/message can't be edited/i.test(raw)) return 'Telegram bu mesajı düzenlememe izin vermiyor.'
  return String((error as Error)?.message ?? error)
}

const unchanged = (error: unknown) => /message is not modified/i.test(error instanceof TelegramError ? error.description : String((error as Error)?.message))

// --- Building what goes to Telegram ---------------------------------------------

async function sponsors(): Promise<PostSponsor[]> {
  const { listPublicSponsors } = await import('@/lib/sites')
  const list = await listPublicSponsors().catch(() => [])
  return list.map((s) => ({ id: String(s.id), name: s.name, url: `${SITE_URL}/git/${encodeURIComponent(String(s.id))}` }))
}

async function textOf(content: PostContent) {
  return content.options.sponsorId ? finalText(content, await sponsors()) : content.text
}

/** `key` is the post id, or "t" for a trial send that has no post behind it. */
export function keyboardFor(key: number | 't', buttons: PostButton[][]): Markup | null {
  const keyboard = buttons
    .map((row) =>
      row.map((b): Record<string, unknown> => {
        if (b.kind === 'popup') return { text: b.label, callback_data: `pb:${key}:${b.id}` }
        if (b.kind === 'copy') return { text: b.label, copy_text: { text: b.value } }
        return { text: b.label, url: b.track && key !== 't' ? `${SITE_URL}/api/tg/go/${key}-${b.id}` : b.value }
      }),
    )
    .filter((row) => row.length > 0)
  return keyboard.length ? { inline_keyboard: keyboard } : null
}

const SEND_METHOD: Record<PostMediaKind, [method: string, field: string]> = {
  photo: ['sendPhoto', 'photo'],
  video: ['sendVideo', 'video'],
  gif: ['sendAnimation', 'animation'],
  file: ['sendDocument', 'document'],
}
const INPUT_TYPE: Record<PostMediaKind, string> = { photo: 'photo', video: 'video', gif: 'animation', file: 'document' }

function fileIdOf(m: TgSent | undefined, kind: PostMediaKind) {
  if (!m) return undefined
  if (kind === 'photo') return m.photo?.[m.photo.length - 1]?.file_id
  if (kind === 'video') return m.video?.file_id
  if (kind === 'gif') return m.animation?.file_id ?? m.document?.file_id
  return m.document?.file_id
}

async function readMedia(item: PostMedia) {
  if (!MEDIA_PATH.test(item.path) || item.path.includes('..')) throw new Error('Geçersiz medya dosyası')
  const result = await get(item.path, { access: 'private' })
  if (!result || result.statusCode !== 200) throw new Error(`Medya bulunamadı: ${item.name}`)
  const blob = await new Response(result.stream).blob()
  if (blob.size > (item.kind === 'photo' ? PHOTO_MAX_BYTES : FILE_MAX_BYTES)) throw new Error(`${item.name} Telegram yükleme sınırından büyük`)
  return { blob: new Blob([blob], { type: result.blob.contentType }), name: item.name }
}

/** Sends the media and remembers Telegram's file ids on the items, so the next target reuses them instead of uploading again. */
async function sendMedia(token: string, base: Record<string, unknown>, media: PostMedia[], caption: Record<string, unknown>, markup: Markup | null) {
  if (media.length === 1) {
    const [item] = media
    const [method, field] = SEND_METHOD[item.kind]
    const body = { ...base, ...caption, ...(markup ? { reply_markup: markup } : {}), ...(item.kind === 'video' ? { supports_streaming: true } : {}) }
    const sent = item.fileId
      ? await callBot<TgSent>(token, method, { ...body, [field]: item.fileId })
      : await callBotUpload<TgSent>(token, method, body, { [field]: await readMedia(item) })
    item.fileId = fileIdOf(sent, item.kind) ?? item.fileId
    return { sent: [sent], captionAt: 0 }
  }
  // Telegram shows a document album's caption under its last file, a photo album's under the first.
  const captionAt = media[0].kind === 'file' ? media.length - 1 : 0
  const files: Record<string, { blob: Blob; name: string }> = {}
  const input = []
  for (const [i, item] of media.entries()) {
    if (!item.fileId) files[`m${i}`] = await readMedia(item)
    input.push({ type: INPUT_TYPE[item.kind], media: item.fileId ?? `attach://m${i}`, ...(i === captionAt ? caption : {}) })
  }
  const body = { ...base, media: input }
  const sent = Object.keys(files).length
    ? await callBotUpload<TgSent[]>(token, 'sendMediaGroup', body, files)
    : await callBot<TgSent[]>(token, 'sendMediaGroup', body)
  sent.forEach((m, i) => {
    if (media[i]) media[i].fileId = fileIdOf(m, media[i].kind) ?? media[i].fileId
  })
  return { sent, captionAt }
}

async function deliverContent(token: string, chatId: string, content: PostContent, text: string, markup: Markup | null): Promise<Delivered> {
  const { options, media } = content
  const base = {
    chat_id: chatId,
    ...(options.silent ? { disable_notification: true } : {}),
    ...(options.protect ? { protect_content: true } : {}),
  }
  const sendText = () =>
    callBot<TgSent>(token, 'sendMessage', {
      ...base,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: !options.preview },
      ...(markup ? { reply_markup: markup } : {}),
    })

  if (!media.length) {
    const m = await sendText()
    return { ids: [m.message_id], mainId: m.message_id, mainMedia: false }
  }
  if (needsSplit(media.length, visibleLength(text), Boolean(markup))) {
    const { sent } = await sendMedia(token, base, media, {}, null)
    const mediaIds = sent.map((m) => m.message_id)
    try {
      const m = await sendText()
      return { ids: [...mediaIds, m.message_id], mainId: m.message_id, mainMedia: false }
    } catch (error) {
      // Half a post is worse than none: the media is taken back when its text could not follow.
      await callBot(token, 'deleteMessages', { chat_id: chatId, message_ids: mediaIds }).catch(() => null)
      throw error
    }
  }
  const caption = text ? { caption: text, parse_mode: 'HTML' } : {}
  const { sent, captionAt } = await sendMedia(token, base, media, caption, media.length === 1 ? markup : null)
  return { ids: sent.map((m) => m.message_id), mainId: sent[captionAt].message_id, mainMedia: true }
}

// --- Targets ---------------------------------------------------------------------

/** Asks Telegram whether the bot may post (and pin, when asked) in each chat, before anything is sent. */
async function inspectTargets(token: string, chats: string[], needPin: boolean): Promise<Checked[]> {
  const me = Number(token.split(':')[0])
  const found = await Promise.all(
    chats.map(async (chat) => {
      try {
        const info = await callBot<ChatInfo>(token, 'getChat', { chat_id: chat })
        const member = await callBot<Member>(token, 'getChatMember', { chat_id: info.id, user_id: me })
        return { chat, info, member, error: null }
      } catch (error) {
        return { chat, info: null, member: null, error: explain(error) }
      }
    }),
  )
  const feeds = new Map<string, string>()
  for (const f of found) {
    if (f.info?.type === 'channel' && f.info.linked_chat_id) feeds.set(String(f.info.linked_chat_id), f.info.title ?? 'kanal')
  }
  return found.map(({ chat, info, member, error }): Checked => {
    if (!info || !member) return { chatId: chat, title: chat, ok: false, problem: error ?? 'Sohbet bulunamadı', username: null }
    const chatId = String(info.id)
    const title = info.title ?? (info.username ? `@${info.username}` : chatId)
    const fail = (problem: string): Checked => ({ chatId, title, ok: false, problem, username: info.username ?? null })
    const admin = member.status === 'administrator' || member.status === 'creator'
    if (info.type === 'channel') {
      if (!admin) return fail('Bot bu kanalda yönetici değil. Kanal ayarlarından botu yönetici yap.')
      if (member.status !== 'creator' && member.can_post_messages === false) return fail('Botun bu kanalda "Mesaj gönder" yetkisi kapalı.')
      if (needPin && member.status !== 'creator' && !member.can_edit_messages) return fail('Sabitlemek için botun "Mesajları düzenle" yetkisi gerekli.')
    } else if (info.type !== 'private') {
      if (['left', 'kicked'].includes(member.status)) return fail('Bot bu grupta değil. Önce botu gruba ekle.')
      if (member.status === 'restricted' && member.can_send_messages === false) return fail('Bot bu grupta kısıtlı, yazamıyor.')
      if (needPin && !(member.status === 'creator' || (admin && member.can_pin_messages))) return fail('Sabitlemek için botun yönetici olması ve "Mesaj sabitle" yetkisi gerekli.')
      const feeder = feeds.get(chatId)
      if (feeder) return fail(`Bu grup "${feeder}" kanalının yorum grubu. Kanala atılan post buraya kendiliğinden düşer; ikisini birden seçersen post grupta iki kez görünür.`)
    }
    return { chatId, title, ok: true, problem: null, username: info.username ?? null }
  })
}

const publicCheck = ({ chatId, title, ok, problem }: Checked): TargetCheck => ({ chatId, title, ok, problem })

function cleanChats(input: string[]) {
  return [...new Set(input.map((c) => normalizeChat(String(c))).filter((c): c is string => Boolean(c)))].slice(0, 30)
}

export async function checkTargets(botId: number, chatIds: string[], needPin: boolean): Promise<TargetCheck[]> {
  const chats = cleanChats(chatIds)
  if (!chats.length) return []
  return (await inspectTargets(await botToken(botId), chats, needPin)).map(publicCheck)
}

// --- Sending ---------------------------------------------------------------------

async function getPost(id: number) {
  await ensurePostTables()
  const r = await rows(sql`SELECT * FROM tg_posts WHERE id = ${id}`)
  return r.length ? mapPost(r[0]) : null
}

async function getSend(id: number) {
  await ensurePostTables()
  const r = await rows(sql`SELECT * FROM tg_post_sends WHERE id = ${id}`)
  return r.length ? mapSend(r[0]) : null
}

async function savePostContent(id: number, content: PostContent) {
  await rows(sql`UPDATE tg_posts SET text = ${content.text}, media = ${JSON.stringify(content.media)}, buttons = ${JSON.stringify(content.buttons)},
    options = ${JSON.stringify(content.options)}, updated_at = now() WHERE id = ${id}`)
}

async function insertSend(input: {
  postId: number
  botId: number
  chat: { chatId: string; title: string; username: string | null }
  delivered: Delivered | null
  error: string | null
  pinned: boolean
  unpinHours: number
  deleteHours: number
}) {
  const d = input.delivered
  await rows(sql`INSERT INTO tg_post_sends (post_id, bot_id, chat_id, chat_title, chat_username, message_ids, main_id, main_media, status, error, pinned, unpin_at, delete_at)
    VALUES (${input.postId}, ${input.botId}, ${input.chat.chatId}, ${input.chat.title}, ${input.chat.username}, ${JSON.stringify(d?.ids ?? [])},
      ${d?.mainId ?? null}, ${d?.mainMedia ?? false}, ${d ? 'sent' : 'failed'}, ${input.error ? input.error.slice(0, 400) : null}, ${input.pinned},
      ${input.pinned && input.unpinHours > 0 ? sql`now() + make_interval(hours => ${input.unpinHours})` : sql`NULL`},
      ${d && input.deleteHours > 0 ? sql`now() + make_interval(hours => ${input.deleteHours})` : sql`NULL`})`)
}

/** Sends one post to one chat and records the outcome. Returns the problem, or null when it went through. */
async function deliverTo(post: { id: number; botId: number; content: PostContent }, token: string, text: string, chat: Checked) {
  const { options } = post.content
  const target = { chatId: chat.chatId, title: chat.title, username: chat.username }
  try {
    const delivered = await deliverContent(token, chat.chatId, post.content, text, keyboardFor(post.id, post.content.buttons))
    let pinned = false
    let note: string | null = null
    if (options.pin) {
      try {
        await callBot(token, 'pinChatMessage', { chat_id: chat.chatId, message_id: delivered.mainId, disable_notification: true })
        pinned = true
      } catch (error) {
        note = `Gönderildi ama sabitlenemedi: ${explain(error)}`
      }
    }
    await insertSend({ postId: post.id, botId: post.botId, chat: target, delivered, error: note, pinned, unpinHours: options.unpinHours, deleteHours: options.deleteHours })
    return note
  } catch (error) {
    const problem = explain(error)
    await insertSend({ postId: post.id, botId: post.botId, chat: target, delivered: null, error: problem, pinned: false, unpinHours: 0, deleteHours: 0 })
    return problem
  }
}

export type SendOutcome = { ok: boolean; message: string; checks?: TargetCheck[] }

type Outcome = { title: string; problem: string | null; failed: boolean }
const SENT = { done: 'hedefe gönderildi', none: 'Gönderilemedi' }
const EDITED = { done: 'kopya düzenlendi', none: 'Düzenlenemedi' }

function summarize(results: Outcome[], words: { done: string; none: string }): SendOutcome {
  const worked = results.filter((r) => !r.failed).length
  const notes = results.filter((r) => r.problem).map((r) => `${r.title}: ${r.problem}`)
  if (!worked) return { ok: false, message: `${words.none}. ${notes.join(' · ')}` }
  return { ok: true, message: `${worked} ${words.done}.${notes.length ? ` ${notes.join(' · ')}` : ''}` }
}

async function prepare(raw: unknown) {
  const content = normalizeContent(raw)
  const text = await textOf(content)
  return { content, text, problems: postProblems(content, text) }
}

export async function sendPost(input: { content: unknown; botId: number; chatIds: string[]; author: string }): Promise<SendOutcome> {
  await ensurePostTables()
  const { content, text, problems } = await prepare(input.content)
  if (problems.length) return { ok: false, message: problems.join(' ') }
  const chats = cleanChats(input.chatIds)
  if (!chats.length) return { ok: false, message: 'En az bir hedef seç.' }
  if (content.buttons.flat().some((b) => b.kind === 'popup') && !(await botListens(input.botId))) {
    return { ok: false, message: 'Bu bot buton basışlarını dinlemiyor, "Açılır yazı" butonu çalışmaz. Önce "Dinlemeyi aç"a bas ya da dinleyen bir bot seç.' }
  }
  const token = await botToken(input.botId)
  const checks = await inspectTargets(token, chats, content.options.pin)
  if (checks.some((c) => !c.ok)) {
    return { ok: false, message: 'Bazı hedeflere gönderilemiyor, hiçbirine gönderilmedi. Sorunlu hedefi düzelt ya da seçimden çıkar.', checks: checks.map(publicCheck) }
  }

  const [row] = await rows<{ id: number }>(sql`INSERT INTO tg_posts (origin, author, bot_id, text, media, buttons, options)
    VALUES ('panel', ${input.author.slice(0, 80)}, ${input.botId}, ${content.text}, ${JSON.stringify(content.media)}, ${JSON.stringify(content.buttons)},
      ${JSON.stringify(content.options)}) RETURNING id`)
  const post = { id: Number(row.id), botId: input.botId, content }
  const results: Outcome[] = []
  for (const chat of checks) {
    const problem = await deliverTo(post, token, text, chat)
    results.push({ title: chat.title, problem, failed: Boolean(problem) && !problem!.startsWith('Gönderildi') })
  }
  // File ids collected during the first upload are kept for resends and copies.
  await savePostContent(post.id, content)
  return summarize(results, SENT)
}

/** Sends the post to one chat without recording it, so the admin can see it in Telegram before it goes live. */
export async function sendTest(input: { content: unknown; botId: number; chat: string }): Promise<SendOutcome> {
  await ensurePostTables()
  const { content, text, problems } = await prepare(input.content)
  if (problems.length) return { ok: false, message: problems.join(' ') }
  const chat = normalizeChat(input.chat)
  if (!chat) return { ok: false, message: 'Deneme sohbeti geçersiz. Sohbet ID’si (-100… ya da kendi sayı ID’n) ya da @kanaladi yaz.' }
  const token = await botToken(input.botId)
  // The trial post's popup buttons read their text from here; only the latest trial is kept.
  await setSetting(TEST_KEY, JSON.stringify(content.buttons))
  await setSetting(TEST_CHAT_KEY, chat)
  try {
    const delivered = await deliverContent(token, chat, { ...content, options: { ...content.options, pin: false } }, text, keyboardFor('t', content.buttons))
    const splitNote = delivered.ids.length > 1 && !delivered.mainMedia ? ' Medya ve yazı iki ayrı mesaj olarak gitti.' : ''
    return { ok: true, message: `Deneme gönderildi.${splitNote} Link butonları denemede doğrudan adrese gider, tıklama sayılmaz.` }
  } catch (error) {
    const problem = explain(error)
    const hint = /bulunamadı|chat not found/i.test(problem) ? ' Kendi hesabına denemek için önce bu bota Telegram’dan /start yaz; grup için botu gruba ekle.' : ''
    return { ok: false, message: `Deneme gönderilemedi: ${problem}${hint}` }
  }
}

// --- Editing ---------------------------------------------------------------------

async function editSend(token: string, send: SendRecord, old: PostContent, next: PostContent, text: string, markup: Markup, auto: boolean) {
  if (send.mainId == null) throw new Error('Mesaj kaydı eksik')
  const mediaCount = mediaCountOf(send)
  const length = visibleLength(text)
  const target = { chat_id: send.chatId, message_id: send.mainId }
  const album = send.mainMedia && mediaCount > 1

  if (auto) {
    if (album && markup.inline_keyboard.length) throw new Error('Telegram albümün altına buton koymuyor.')
    if (!text) {
      await callBot(token, 'editMessageReplyMarkup', { ...target, reply_markup: markup })
      return
    }
    if (send.mainMedia && length > CAPTION_LIMIT) throw new Error(`Medya altındaki yazı en fazla ${CAPTION_LIMIT} karakter olabilir.`)
  } else {
    if (next.media.length !== mediaCount) {
      throw new Error('Gönderilmiş postta medya sayısı değiştirilemez. Medyayı aynı sayıda dosyayla değiştir ya da postu silip yeniden gönder.')
    }
    const wasSplit = !send.mainMedia && mediaCount > 0
    if (needsSplit(mediaCount, length, markup.inline_keyboard.length > 0) !== wasSplit) {
      throw new Error(
        wasSplit
          ? 'Bu postta yazı medyadan ayrı bir mesaj. Yazıyı medyanın altına taşımak düzenlemeyle olmuyor; postu silip yeniden gönder.'
          : 'Bu değişiklik yazıyı medyadan ayrı bir mesaja taşımayı gerektiriyor (yazı 1024 karakteri geçti ya da albüme buton eklendi). Düzenlemeyle olmuyor; postu silip yeniden gönder.',
      )
    }
  }

  const withMarkup = album ? {} : { reply_markup: markup }
  let mainDone = false
  if (!auto) {
    for (let i = 0; i < mediaCount; i++) {
      const item = next.media[i]
      if (item.path === old.media[i]?.path) continue
      const isMain = send.mainMedia && send.ids[i] === send.mainId
      const media = { type: INPUT_TYPE[item.kind], media: item.fileId ?? 'attach://f', ...(isMain && text ? { caption: text, parse_mode: 'HTML' } : {}) }
      const body = { chat_id: send.chatId, message_id: send.ids[i], media, ...(isMain ? withMarkup : {}) }
      const sent = item.fileId
        ? await callBot<TgSent>(token, 'editMessageMedia', body)
        : await callBotUpload<TgSent>(token, 'editMessageMedia', body, { f: await readMedia(item) })
      item.fileId = fileIdOf(sent, item.kind) ?? item.fileId
      if (isMain) mainDone = true
    }
  }
  if (mainDone) return
  try {
    if (send.mainMedia) await callBot(token, 'editMessageCaption', { ...target, caption: text, parse_mode: 'HTML', ...withMarkup })
    else await callBot(token, 'editMessageText', { ...target, text, parse_mode: 'HTML', link_preview_options: { is_disabled: !next.options.preview }, ...withMarkup })
  } catch (error) {
    if (!unchanged(error)) throw error
  }
}

export async function editPost(postId: number, raw: unknown): Promise<SendOutcome> {
  const post = await getPost(postId)
  if (!post) return { ok: false, message: 'Post bulunamadı.' }
  const auto = post.origin !== 'panel'
  const input = normalizeContent(raw)
  const known = new Map(post.content.media.map((m) => [m.path, m.fileId]))
  // What cannot change after sending (silent, protected, timers) keeps its stored value.
  const next: PostContent = auto
    ? { ...post.content, text: input.text, buttons: input.buttons }
    : {
        text: input.text,
        buttons: input.buttons,
        media: input.media.map((m) => ({ ...m, fileId: known.get(m.path) })),
        options: { ...post.content.options, preview: input.options.preview, sponsorId: input.options.sponsorId },
      }
  const text = auto ? next.text : await textOf(next)
  const problems = postProblems(next, text).filter((p) => !(auto && p.startsWith('Yazı ya da medya')))
  if (problems.length) return { ok: false, message: problems.join(' ') }

  const live = (await rows(sql`SELECT * FROM tg_post_sends WHERE post_id = ${postId} AND status = 'sent' ORDER BY id`)).map(mapSend)
  if (!live.length) return { ok: false, message: 'Bu postun Telegram’da duran bir kopyası yok.' }
  if (next.buttons.flat().some((b) => b.kind === 'popup') && post.botId && !(await botListens(post.botId))) {
    return { ok: false, message: 'Bu bot buton basışlarını dinlemiyor, "Açılır yazı" butonu çalışmaz. Önce yeni post bölümünden "Dinlemeyi aç"a bas.' }
  }
  const markup = keyboardFor(postId, next.buttons) ?? { inline_keyboard: [] }
  const results: Outcome[] = []
  for (const send of live) {
    try {
      if (!send.botId) throw new Error('Bu mesajı gönderen bot kayıtlı değil')
      await editSend(await botToken(send.botId), send, post.content, next, text, markup, auto)
      await rows(sql`UPDATE tg_post_sends SET edited_at = now(), error = NULL WHERE id = ${send.id}`)
      results.push({ title: send.chatTitle, problem: null, failed: false })
    } catch (error) {
      results.push({ title: send.chatTitle, problem: explain(error), failed: true })
    }
  }
  if (results.some((r) => !r.failed)) await savePostContent(postId, next)
  return summarize(results, EDITED)
}

// --- Actions on a sent copy ------------------------------------------------------

async function liveSend(sendId: number) {
  const send = await getSend(sendId)
  if (!send) throw new Error('Kayıt bulunamadı')
  if (send.status !== 'sent' || !send.ids.length) throw new Error('Bu kopya Telegram’da durmuyor')
  if (!send.botId) throw new Error('Bu mesajı gönderen bot kayıtlı değil')
  return { send, token: await botToken(send.botId) }
}

export async function deleteSend(sendId: number): Promise<SendOutcome> {
  try {
    const { send, token } = await liveSend(sendId)
    await callBot(token, 'deleteMessages', { chat_id: send.chatId, message_ids: [...send.ids].sort((a, b) => a - b) })
    await rows(sql`UPDATE tg_post_sends SET status = 'deleted', pinned = false, unpin_at = NULL, delete_at = NULL, error = NULL WHERE id = ${sendId}`)
    return { ok: true, message: `${send.chatTitle}: post Telegram’dan silindi.` }
  } catch (error) {
    return { ok: false, message: explain(error) }
  }
}

/** Drops the record only; nothing is sent to Telegram. For copies the bot can no longer reach. */
export async function forgetSend(sendId: number): Promise<SendOutcome> {
  const send = await getSend(sendId)
  if (!send) return { ok: false, message: 'Kayıt bulunamadı.' }
  await rows(sql`DELETE FROM tg_post_sends WHERE id = ${sendId}`)
  await rows(sql`DELETE FROM tg_posts p WHERE p.id = ${send.postId} AND NOT EXISTS (SELECT 1 FROM tg_post_sends s WHERE s.post_id = p.id)`)
  return { ok: true, message: 'Kayıt listeden çıkarıldı. Telegram’daki mesaja dokunulmadı.' }
}

export async function pinSend(sendId: number, pin: boolean): Promise<SendOutcome> {
  try {
    const { send, token } = await liveSend(sendId)
    const target = { chat_id: send.chatId, message_id: send.mainId ?? send.ids[0] }
    if (pin) await callBot(token, 'pinChatMessage', { ...target, disable_notification: true })
    else await callBot(token, 'unpinChatMessage', target)
    await rows(sql`UPDATE tg_post_sends SET pinned = ${pin}, unpin_at = NULL WHERE id = ${sendId}`)
    return { ok: true, message: `${send.chatTitle}: ${pin ? 'post sabitlendi.' : 'post sabitten kaldırıldı.'}` }
  } catch (error) {
    return { ok: false, message: explain(error) }
  }
}

/** Copies a post the panel did not write (its media is only on Telegram) by asking Telegram to duplicate the messages. */
async function copyByTelegram(post: PostRecord, source: SendRecord, token: string, chat: Checked) {
  const ordered = [...source.ids].sort((a, b) => a - b)
  const copies = await callBot<{ message_id: number }[]>(token, 'copyMessages', { chat_id: chat.chatId, from_chat_id: source.chatId, message_ids: ordered })
  const ids = copies.map((c) => c.message_id)
  const mainId = ids[Math.max(0, ordered.indexOf(source.mainId ?? ordered[0]))]
  const markup = keyboardFor(post.id, post.content.buttons)
  if (markup && !(source.mainMedia && ids.length > 1)) {
    await callBot(token, 'editMessageReplyMarkup', { chat_id: chat.chatId, message_id: mainId, reply_markup: markup }).catch(() => null)
  }
  return { ids, mainId, mainMedia: source.mainMedia }
}

/** Sends an existing post to more chats, or again to the same one. */
export async function copyPost(postId: number, chatIds: string[]): Promise<SendOutcome> {
  const post = await getPost(postId)
  if (!post || !post.botId) return { ok: false, message: 'Post bulunamadı.' }
  const chats = cleanChats(chatIds)
  if (!chats.length) return { ok: false, message: 'En az bir hedef seç.' }
  const token = await botToken(post.botId)
  const checks = await inspectTargets(token, chats, false)
  if (checks.some((c) => !c.ok)) {
    return { ok: false, message: 'Bazı hedeflere gönderilemiyor, hiçbirine gönderilmedi.', checks: checks.map(publicCheck) }
  }
  const results: Outcome[] = []
  if (post.origin === 'panel') {
    // Pinning and timers belonged to the first send; a copy goes out plain.
    const content = { ...post.content, options: { ...post.content.options, pin: false, unpinHours: 0, deleteHours: 0 } }
    const text = await textOf(content)
    for (const chat of checks) {
      const problem = await deliverTo({ id: post.id, botId: post.botId, content }, token, text, chat)
      results.push({ title: chat.title, problem, failed: Boolean(problem) })
    }
    await rows(sql`UPDATE tg_posts SET media = ${JSON.stringify(content.media)} WHERE id = ${post.id}`)
  } else {
    const [source] = (await rows(sql`SELECT * FROM tg_post_sends WHERE post_id = ${postId} AND status = 'sent' ORDER BY id LIMIT 1`)).map(mapSend)
    if (!source) return { ok: false, message: 'Bu postun Telegram’da duran bir kopyası yok, kopyalanacak mesaj bulunamadı.' }
    for (const chat of checks) {
      const target = { chatId: chat.chatId, title: chat.title, username: chat.username }
      try {
        const delivered = await copyByTelegram(post, source, token, chat)
        await insertSend({ postId, botId: post.botId, chat: target, delivered, error: null, pinned: false, unpinHours: 0, deleteHours: 0 })
        results.push({ title: chat.title, problem: null, failed: false })
      } catch (error) {
        results.push({ title: chat.title, problem: explain(error), failed: true })
      }
    }
  }
  return summarize(results, SENT)
}

// --- Posts sent by the automations -----------------------------------------------

/** Lets a post sent by an automation show up in the panel list. Never throws: a failed note must not undo a sent post. */
export async function recordAutoPost(input: {
  origin: Exclude<PostOrigin, 'panel'>
  note: string
  botId: number | null
  chatId: string
  chatTitle: string
  ids: number[]
  mainId: number
  mainMedia: boolean
  /** Telegram HTML of the text as sent; empty when it is not known, which switches text editing off for this post. */
  text: string
}) {
  try {
    if (!input.ids.length) return
    await ensurePostTables()
    const [row] = await rows<{ id: number }>(sql`INSERT INTO tg_posts (origin, note, author, bot_id, text)
      VALUES (${input.origin}, ${input.note.slice(0, 120)}, 'Otomasyon', ${input.botId}, ${cleanTgHtml(input.text)}) RETURNING id`)
    await rows(sql`INSERT INTO tg_post_sends (post_id, bot_id, chat_id, chat_title, message_ids, main_id, main_media)
      VALUES (${Number(row.id)}, ${input.botId}, ${input.chatId}, ${input.chatTitle}, ${JSON.stringify(input.ids)}, ${input.mainId}, ${input.mainMedia})`)
  } catch (error) {
    console.error('[tg-posts] automation post not recorded', error)
  }
}

// --- Buttons pressed -------------------------------------------------------------

async function getSetting(key: string) {
  const r = await rows<{ value: string }>(sql`SELECT value FROM tg_settings WHERE key = ${key}`)
  return r[0]?.value ?? null
}

async function setSetting(key: string, value: string) {
  await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

async function countPress(postId: number, buttonId: string) {
  await rows(sql`INSERT INTO tg_post_clicks (post_id, button_id, clicks) VALUES (${postId}, ${buttonId}, 1)
    ON CONFLICT (post_id, button_id) DO UPDATE SET clicks = tg_post_clicks.clicks + 1`)
}

async function buttonsOf(key: string): Promise<PostButton[]> {
  if (key === 't') return parse<PostButton[][]>(await getSetting(TEST_KEY), []).flat()
  const id = Number(key)
  if (!Number.isSafeInteger(id) || id <= 0) return []
  const r = await rows<{ buttons: string }>(sql`SELECT buttons FROM tg_posts WHERE id = ${id}`)
  return parse<PostButton[][]>(r[0]?.buttons, []).flat()
}

/** A bot hears button presses only through a webhook that reaches the shared dispatcher. */
export async function botListens(botId: number) {
  const r = await rows<{ key: string; value: string }>(sql`SELECT key, value FROM tg_settings WHERE key IN (${`hook_secret_${botId}`}, 'chat_bot_id')`)
  return r.some((s) => (s.key === 'chat_bot_id' ? Number(s.value) === botId : Boolean(s.value)))
}

/** Answers a press on an "Açılır yazı" button with its text. */
export async function handlePostCallback(botId: number, q: TgCallback) {
  const token = await botToken(botId)
  const [, key = '', buttonId = ''] = (q.data ?? '').split(':')
  const answer = (text: string) =>
    callBot(token, 'answerCallbackQuery', { callback_query_id: q.id, text: text.slice(0, POPUP_LIMIT), show_alert: true }).catch((error) =>
      console.error('[tg-posts] popup answer failed', error),
    )
  await ensurePostTables()
  const button = (await buttonsOf(key)).find((b) => b.id === buttonId && b.kind === 'popup')
  if (!button) return answer('Bu buton artık geçerli değil.')
  // Telegram shows a loading spinner until the answer arrives, so the answer goes out before the count is written.
  await answer(button.value)
  if (key !== 't') await countPress(Number(key), buttonId).catch(() => null)
}

/** Counts a press on a tracked link button and returns where to send the visitor. */
export async function trackClick(ref: string) {
  const m = /^(\d{1,9})-([a-z0-9]{1,8})$/.exec(ref)
  if (!m) return null
  await ensurePostTables()
  const button = (await buttonsOf(m[1])).find((b) => b.id === m[2] && b.kind === 'link')
  if (!button) return null
  await countPress(Number(m[1]), m[2]).catch(() => null)
  return button.value
}

// --- Timed work ------------------------------------------------------------------

/** Unpins and deletes posts whose time has come. Called from the traffic-driven tick; adds no schedule of its own. */
export async function runPostJobs() {
  await ensurePostTables()
  const due = (
    await rows(sql`SELECT * FROM tg_post_sends WHERE status = 'sent' AND ((pinned AND unpin_at <= now()) OR delete_at <= now()) ORDER BY id LIMIT 20`)
  ).map(mapSend)
  for (const send of due) {
    const deleting = Boolean(send.deleteAt && send.deleteAt.getTime() <= Date.now())
    try {
      if (!send.botId) throw new Error('Gönderen bot kayıtlı değil')
      const token = await botToken(send.botId)
      if (deleting) {
        await callBot(token, 'deleteMessages', { chat_id: send.chatId, message_ids: [...send.ids].sort((a, b) => a - b) })
        await rows(sql`UPDATE tg_post_sends SET status = 'deleted', pinned = false, unpin_at = NULL, delete_at = NULL WHERE id = ${send.id}`)
      } else {
        await callBot(token, 'unpinChatMessage', { chat_id: send.chatId, message_id: send.mainId ?? send.ids[0] })
        await rows(sql`UPDATE tg_post_sends SET pinned = false, unpin_at = NULL WHERE id = ${send.id}`)
      }
    } catch (error) {
      // The timer is cleared either way, so one unreachable message is not retried every minute.
      const note = `${deleting ? 'Zamanlı silme' : 'Sabitten kaldırma'} yapılamadı: ${explain(error)}`.slice(0, 400)
      if (deleting) await rows(sql`UPDATE tg_post_sends SET delete_at = NULL, error = ${note} WHERE id = ${send.id}`)
      else await rows(sql`UPDATE tg_post_sends SET unpin_at = NULL, error = ${note} WHERE id = ${send.id}`)
    }
  }
  await rows(sql`DELETE FROM tg_posts WHERE origin <> 'panel' AND created_at < now() - make_interval(days => ${AUTO_KEEP_DAYS})`)
}

// --- Panel -----------------------------------------------------------------------

function toSendRow(s: SendRecord): PostSendRow {
  return {
    id: s.id,
    chatId: s.chatId,
    chatTitle: s.chatTitle || s.chatId,
    link: s.status === 'sent' ? postLink(s.chatId, s.chatUsername, s.mainId) : null,
    status: s.status,
    error: s.error,
    pinned: s.pinned,
    unpinAt: s.unpinAt?.toISOString() ?? null,
    deleteAt: s.deleteAt?.toISOString() ?? null,
    sentAt: s.sentAt.toISOString(),
    editedAt: s.editedAt?.toISOString() ?? null,
    canDelete: Date.now() - s.sentAt.getTime() < DELETE_WINDOW_MS,
    mediaCount: mediaCountOf(s),
    textOnMedia: s.mainMedia,
  }
}

export async function listPosts(limit = 20, beforeId?: number): Promise<PostRow[]> {
  await ensurePostTables()
  const found = await rows(sql`SELECT p.*, b.name AS bot_name, b.username AS bot_username FROM tg_posts p LEFT JOIN tg_bots b ON b.id = p.bot_id
    WHERE ${beforeId ? sql`p.id < ${beforeId}` : sql`true`} ORDER BY p.id DESC LIMIT ${limit}`)
  if (!found.length) return []
  const ids = found.map((p) => Number(p.id))
  const [sends, clicks] = await Promise.all([
    rows(sql`SELECT * FROM tg_post_sends WHERE post_id IN ${ids} ORDER BY id`),
    rows(sql`SELECT post_id, button_id, clicks FROM tg_post_clicks WHERE post_id IN ${ids}`),
  ])
  return found.map((r): PostRow => {
    const post = mapPost(r)
    return {
      id: post.id,
      origin: post.origin,
      note: post.note,
      author: post.author,
      botId: post.botId,
      botName: r.bot_username ? `@${String(r.bot_username)}` : r.bot_name ? String(r.bot_name) : 'Silinmiş bot',
      content: { ...post.content, media: post.content.media.map(({ kind, path, name, size }) => ({ kind: kind ?? mediaKindOf(path), path, name, size })) },
      createdAt: post.createdAt.toISOString(),
      sends: sends.filter((s) => Number(s.post_id) === post.id).map((s) => toSendRow(mapSend(s))),
      clicks: Object.fromEntries(clicks.filter((c) => Number(c.post_id) === post.id).map((c) => [String(c.button_id), Number(c.clicks)])),
    }
  })
}

const PAGE = 20

export async function loadPostCenter(bots: { id: number; name: string; username: string }[]): Promise<PostCenterData> {
  await ensurePostTables()
  const [{ getHub }, { listJobs }] = await Promise.all([import('@/lib/tg-hub'), import('@/lib/studio')])
  const [targetRows, hub, settings, sponsorList, jobs, posts] = await Promise.all([
    rows(sql`SELECT bot_id, chat_id, title FROM tg_targets WHERE active ORDER BY id`),
    getHub().catch(() => null),
    rows<{ key: string; value: string }>(sql`SELECT key, value FROM tg_settings WHERE key LIKE 'hook_secret_%' OR key IN ('chat_bot_id', ${TEST_CHAT_KEY})`),
    sponsors().catch(() => []),
    listJobs(40).catch(() => []),
    listPosts(PAGE + 1),
  ])

  const targets: PostTarget[] = targetRows.map((t) => ({ botId: Number(t.bot_id), chatId: String(t.chat_id), title: String(t.title) }))
  // Chats the guard bot protects are places it can post to as well.
  if (hub?.guardBotId) {
    for (const g of hub.groups) {
      if (!targets.some((t) => t.botId === hub.guardBotId && t.chatId === g.chatId)) targets.push({ botId: hub.guardBotId, chatId: g.chatId, title: g.title })
    }
  }
  const listening = bots
    .filter((b) => settings.some((s) => (s.key === 'chat_bot_id' ? Number(s.value) === b.id : s.key === `hook_secret_${b.id}` && Boolean(s.value))))
    .map((b) => b.id)

  return {
    bots: bots.map((b) => ({ id: b.id, name: b.name, username: b.username })),
    targets,
    listening,
    sponsors: sponsorList,
    library: jobs
      .map((j) => ({ path: `studio/${j.url.replace('/api/studio/file/', '')}`, label: j.brandName || j.format }))
      .filter((item) => MEDIA_PATH.test(item.path) && mediaKindOf(item.path) === 'photo'),
    posts: posts.slice(0, PAGE),
    hasMore: posts.length > PAGE,
    testChat: settings.find((s) => s.key === TEST_CHAT_KEY)?.value || hub?.logChatId || '',
  }
}

export async function morePosts(beforeId: number) {
  const posts = await listPosts(PAGE + 1, beforeId)
  return { posts: posts.slice(0, PAGE), hasMore: posts.length > PAGE }
}
