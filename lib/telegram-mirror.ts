import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { appSecrets, openWithAny } from '@/lib/secrets'
import { filterWords } from '@/lib/telegram-filters'
import { decodeEntities } from '@/lib/html-entities'
import { recordDeal } from '@/lib/deals'
import {
  MAX_SENT_BUTTONS,
  applyReplacements,
  carriedButtons,
  mergeRules,
  parseReplacements,
  pickLink,
  ruleError,
  serializeRules,
  usernameLink,
  type ReplaceRule,
} from '@/lib/text-replace'
import { buttonError, buttonMarkup, cleanButtons, type PostButton } from '@/lib/tg-buttons'

export type MirrorSource = {
  id: number
  channel: string
  brand: string
  link: string
  replacements: string
  footer: string
  /** Buttons placed under every post shared from this source. */
  buttons: PostButton[]
  /** Also carry the source post's own buttons, with their links passed through the rules. */
  carryButtons: boolean
  keywords: string
  active: boolean
  targetId: number | null
  lastPostId: number | null
  lastCheckedAt: string | null
  lastError: string | null
  createdAt: string | null
}

export type MirrorBot = { id: number; name: string; username: string; tokenHint: string }

export type MirrorTarget = { id: number; botId: number; chatId: string; title: string; active: boolean }

export type MirrorLog = {
  id: number
  channel: string
  postId: number
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  detail: string | null
  createdAt: string
}

export type MirrorResult = { checked: number; sent: number; skipped: number; failed: number; primed: number; errors: string[] }

export type MediaItem = { type: 'photo' | 'video' | 'gif'; url: string | null }
export type ScrapedPost = {
  id: number
  html: string
  photos: string[]
  video: string | null
  thumb?: string | null
  date?: string | null
  ref?: string
  items?: MediaItem[]
  /** Link buttons under the source post. */
  buttons?: PostButton[]
  /** The post of the same channel this one answers. */
  replyTo?: number | null
}
export type Destination = { token: string; chatId: string; title: string; botId?: number }

const MAX_PER_RUN = 5
const CAPTION_LIMIT = 1000
const MESSAGE_LIMIT = 3900

let ready: Promise<void> | null = null
export function ensureTables() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_bots (
      id serial PRIMARY KEY, name text NOT NULL, username text NOT NULL UNIQUE, token_enc text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_targets (
      id serial PRIMARY KEY, bot_id int NOT NULL REFERENCES tg_bots(id) ON DELETE CASCADE, chat_id text NOT NULL,
      title text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (bot_id, chat_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_settings (key text PRIMARY KEY, value text NOT NULL)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_sources (
      id serial PRIMARY KEY, channel text NOT NULL UNIQUE, brand text NOT NULL, link text NOT NULL,
      keywords text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true, last_post_id int,
      last_checked_at timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`ALTER TABLE tg_sources ADD COLUMN IF NOT EXISTS target_id int REFERENCES tg_targets(id) ON DELETE SET NULL`)
    await rows(sql`ALTER TABLE tg_sources ADD COLUMN IF NOT EXISTS replacements text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE tg_sources ADD COLUMN IF NOT EXISTS footer text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE tg_sources ADD COLUMN IF NOT EXISTS buttons text NOT NULL DEFAULT '[]'`)
    await rows(sql`ALTER TABLE tg_sources ADD COLUMN IF NOT EXISTS carry_buttons boolean NOT NULL DEFAULT false`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_log (
      id serial PRIMARY KEY, source_id int NOT NULL REFERENCES tg_sources(id) ON DELETE CASCADE, post_id int NOT NULL,
      status text NOT NULL, detail text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (source_id, post_id))`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

function cipherKeys() {
  const secrets = appSecrets()
  if (!secrets.length) throw new Error('BETTER_AUTH_SECRET tanımlı değil')
  return secrets.map((secret) => createHash('sha256').update(`tg-token:${secret}`).digest())
}

function encrypt(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', cipherKeys()[0], iv)
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.')
}

/** Older secrets are tried too, so a bot added before a rotation keeps posting. */
function decrypt(value: string) {
  try {
    const [iv, tag, data] = value.split('.').map((p) => Buffer.from(p, 'base64'))
    return openWithAny(cipherKeys(), (key) => {
      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
    })
  } catch {
    // Node's own text ("Invalid initialization vector") reaches the panel as is and tells the admin nothing.
    throw new Error('Kayıtlı bot anahtarı okunamadı. Telegram bölümünde botu silip anahtarıyla yeniden ekle.')
  }
}

export function normalizeChannel(input: string) {
  const name = input
    .trim()
    .replace(/^https?:\/\/(www\.)?(t|telegram)\.me\/(s\/)?/i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
  return /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(name) ? name : null
}

export function normalizeChat(input: string) {
  const trimmed = input.trim()
  if (/^-?\d{5,20}$/.test(trimmed)) return trimmed
  const name = normalizeChannel(trimmed)
  return name ? `@${name}` : null
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const stripTags = (s: string) => decodeEntities(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))

const ALLOWED_TAGS: Record<string, string> = { b: 'b', strong: 'b', i: 'i', em: 'i', u: 'u', s: 's', del: 's', code: 'code', pre: 'pre', blockquote: 'blockquote' }

const DEAD_LINK = '\u0002'
const hasWords = (line: string) => /[\p{L}\p{N}]/u.test(stripTags(line).replace(/[\u20e3\ufe0f]/g, ''))
const isOrnament = (line: string) => stripTags(line).trim() !== '' && !hasWords(line)

/**
 * Removed Telegram links leave their label text and decorative separator rows behind
 * (e.g. "Güncel Giriş", "🔥🔥🔥"). Drop lines that held only dead links, plus ornament-only
 * rows touching that block, so the mirrored post reads cleanly.
 */
function dropDeadLinks(text: string) {
  const lines = text.split('\n')
  const remove = lines.map((line) => line.includes(DEAD_LINK) && !hasWords(line.split(DEAD_LINK).join('')))
  const blank = (i: number) => stripTags(lines[i]).trim() === ''
  let changed = true
  while (changed) {
    changed = false
    lines.forEach((line, i) => {
      if (remove[i] || !isOrnament(line)) return
      for (const step of [-1, 1]) {
        let j = i + step
        while (j >= 0 && j < lines.length && blank(j) && !remove[j]) j += step
        if (j >= 0 && j < lines.length && remove[j]) {
          remove[i] = true
          changed = true
          return
        }
      }
    })
  }
  return lines
    .filter((_, i) => !remove[i])
    .map((line) => {
      if (!line.includes(DEAD_LINK)) return line
      return line.split(DEAD_LINK).join('').replace(/[ \t]{2,}/g, ' ').replace(/\s*[:：👉⬇️➡️]+\s*$/u, '')
    })
    .join('\n')
}

const ENTITY_TAGS: Record<string, string> = {
  bold: 'b',
  italic: 'i',
  underline: 'u',
  strikethrough: 's',
  code: 'code',
  pre: 'pre',
  blockquote: 'blockquote',
  expandable_blockquote: 'blockquote',
  spoiler: 'tg-spoiler',
}

/**
 * Rebuilds a Telegram message (text + entities) as HTML for re-posting. Hidden links
 * (text_link) are removed together with their label and any ornament rows around them,
 * the same way mirrored channel posts are cleaned.
 */
export function entitiesToCleanHtml(text: string, entities: { type: string; offset: number; length: number }[] = []) {
  const dead = new Array<boolean>(text.length).fill(false)
  const opens = new Map<number, string[]>()
  const closes = new Map<number, string[]>()
  const sorted = [...entities].sort((a, b) => a.offset - b.offset || b.length - a.length)
  for (const e of sorted) {
    if (e.type === 'text_link') {
      for (let i = e.offset; i < Math.min(text.length, e.offset + e.length); i++) dead[i] = true
      continue
    }
    const tag = ENTITY_TAGS[e.type]
    if (!tag || e.length <= 0) continue
    opens.set(e.offset, [...(opens.get(e.offset) ?? []), tag])
    closes.set(e.offset + e.length, [tag, ...(closes.get(e.offset + e.length) ?? [])])
  }
  let out = ''
  for (let i = 0; i <= text.length; i++) {
    for (const tag of closes.get(i) ?? []) out += `</${tag}>`
    if (i === text.length) break
    for (const tag of opens.get(i) ?? []) out += `<${tag}>`
    if (dead[i]) {
      if (text[i] === '\n') out += '\n'
      else if (i === 0 || !dead[i - 1] || text[i - 1] === '\n') out += DEAD_LINK
      continue
    }
    out += escapeHtml(text[i])
  }
  return dropDeadLinks(out)
    .replace(/<(b|i|u|s|code|pre|blockquote|tg-spoiler)>\s*<\/\1>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Plain-text version of entitiesToCleanHtml for bots that post without formatting. */
export function entitiesToCleanText(text: string, entities: { type: string; offset: number; length: number }[] = []) {
  return stripTags(entitiesToCleanHtml(text, entities)).trim()
}

// Two or more premium emoji in a row: a word or banner drawn with them. Without the premium pack only stand-in faces are left.
const EMOJI_RUN = /(?:<tg-emoji[^>]*>(?:(?!<\/?tg-emoji)[\s\S])*<\/tg-emoji>[ \t]*){2,}/gi
/** A digit drawn as a keycap emoji ("1⃣"). Sources write numbers this way, so these are text, not ornament. */
export const KEYCAP_DIGIT = /(\d)\uFE0F?\u20E3/g
const hasKeycap = (s: string) => /\d\uFE0F?\u20E3/.test(s)

/**
 * Plain text of a scraped t.me/s post with hidden-link labels and their ornament rows removed.
 * `dropEmojiRuns` also removes rows of premium emoji, which a bot cannot send and which read as noise,
 * and turns keycap digits into plain ones.
 */
export function scrapedHtmlToCleanText(html: string, options: { dropEmojiRuns?: boolean } = {}) {
  const source = options.dropEmojiRuns ? html.replace(EMOJI_RUN, (run) => (hasKeycap(run) ? run : ' ')) : html
  const marked = source
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<i class="emoji"[^>]*>\s*<b>([\s\S]*?)<\/b>\s*<\/i>/gi, '$1')
    .replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/gi, '$1')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const plain = stripTags(label).trim()
      if (href.startsWith('?q=') || /^(https?:\/\/|www\.)\S+$/i.test(plain) || /^@\w+$/.test(plain)) return label
      return DEAD_LINK
    })
  const text = stripTags(dropDeadLinks(marked))
  return (options.dropEmojiRuns ? text.replace(KEYCAP_DIGIT, '$1') : text)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function toTelegramHtml(html: string, link: string, rules: ReplaceRule[] = []) {
  const converted = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<i class="emoji"[^>]*>\s*<b>([\s\S]*?)<\/b>\s*<\/i>/gi, '$1')
    .replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/gi, '$1')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const plain = stripTags(label).trim()
      if (href.startsWith('?q=')) return escapeHtml(plain)
      // Telegram links are dropped unless a username rule renames the channel they point to.
      const telegram = /(^|\/\/)(t|telegram)\.me\//i.test(href)
      const renamed = telegram ? usernameLink(href, rules) : null
      if (telegram && !renamed) return DEAD_LINK
      const safeLink = escapeHtml(renamed ?? pickLink(href.replace(/&amp;/g, '&'), rules, link))
      if (/^(https?:\/\/|www\.)\S+$/i.test(plain)) return `\u0000a href="${safeLink}"\u0001${safeLink}\u0000/a\u0001`
      return `\u0000a href="${safeLink}"\u0001${escapeHtml(plain)}\u0000/a\u0001`
    })
    .replace(/<(\/?)([a-z0-9-]+)[^>]*>/gi, (_, close: string, tag: string) => {
      const mapped = ALLOWED_TAGS[tag.toLowerCase()]
      return mapped ? `\u0000${close}${mapped}\u0001` : ''
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&(?!(?:amp|lt|gt|quot|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\u0000/g, '<')
    .replace(/\u0001/g, '>')
  return dropDeadLinks(converted)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function fetchChannel(channel: string): Promise<ScrapedPost[]> {
  const res = await fetch(`https://t.me/s/${channel}`, {
    cache: 'no-store',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; AlkankaBot/1.0)', 'accept-language': 'tr,en;q=0.8' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Kanal okunamadı (HTTP ${res.status})`)
  const page = await res.text()
  if (!page.includes('tgme_channel_info')) throw new Error('Kanal herkese açık değil ya da bulunamadı')

  const posts: ScrapedPost[] = []
  for (const chunk of page.split('data-post="').slice(1)) {
    const ref = chunk.slice(0, chunk.indexOf('"'))
    const id = Number(ref.split('/')[1])
    if (!Number.isInteger(id)) continue
    const text = chunk.match(/class="tgme_widget_message_text[^"]*\bjs-message_text\b[^"]*"[^>]*>([\s\S]*?)<\/div>/)
    const photos = [...chunk.matchAll(/tgme_widget_message_photo_wrap[^"]*"[^>]*background-image:url\('([^']+)'\)/g)].map((m) => m[1])
    // Stickers also render as <video>; they are decoration, not post media.
    const sticker = /tgme_widget_message_(?:video)?sticker/.test(chunk)
    const video = sticker ? null : (chunk.match(/<video[^>]+src="([^"]+)"/)?.[1] ?? null)
    const thumb = sticker ? null : (chunk.match(/tgme_widget_message_video_thumb"[^>]*background-image:url\('([^']+)'\)/)?.[1] ?? null)
    const date = chunk.match(/<time[^>]+datetime="([^"]+)"/)?.[1] ?? null
    const answered = chunk.match(/<a[^>]*class="tgme_widget_message_reply[^"]*"[^>]*>/)?.[0].match(/href="https?:\/\/t\.me\/[^"/]+\/(\d+)"/)?.[1]
    const replyTo = answered ? Number(answered) : null
    posts.push({ id, html: text?.[1] ?? '', photos, video, thumb, date, ref, items: sticker ? [] : mediaItems(chunk), buttons: linkButtons(chunk), replyTo })
  }
  return posts
}

/** Link buttons under a post on the channel's web page. Buttons without a web link (callbacks, games) are skipped. */
function linkButtons(chunk: string): PostButton[] {
  const tags = [...chunk.matchAll(/<a\b([^>]*\btgme_widget_message_inline_button\b[^>]*)>([\s\S]*?)<\/a>/g)]
  return cleanButtons(
    tags.map((tag) => ({ text: stripTags(tag[2]).trim(), url: decodeEntities(tag[1].match(/\bhref="([^"]+)"/)?.[1] ?? '') })),
  )
}

/** Every photo, video and GIF of a post (albums included) in their original order. */
function mediaItems(chunk: string): MediaItem[] {
  const tokens = [...chunk.matchAll(/tgme_widget_message_photo_wrap[^"]*"[^>]*background-image:url\('([^']+)'\)|tgme_widget_message_video_player/g)]
  return tokens.map((token, i) => {
    if (token[1]) return { type: 'photo', url: token[1] }
    const segment = chunk.slice(token.index, tokens[i + 1]?.index ?? chunk.length)
    const tag = segment.match(/<video[^>]+src="([^"]+)"[^>]*>/)
    // Telegram renders GIFs as muted looping videos.
    return { type: tag && /\sloop\b/.test(tag[0]) ? 'gif' : 'video', url: tag?.[1] ?? null }
  })
}

/** Large videos have no src on the channel page; the single-post embed page usually still carries it. */
async function resolveMissingVideos(post: ScrapedPost, items: MediaItem[]) {
  if (!post.ref || !items.some((item) => !item.url)) return items
  try {
    const res = await fetch(`https://t.me/${post.ref}?embed=1&mode=tme`, {
      cache: 'no-store',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; AlkankaBot/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return items
    const embedded = mediaItems(await res.text())
    if (embedded.length !== items.length) return items
    return items.map((item, i) => (item.url ? item : { ...item, url: embedded[i].url }))
  } catch {
    return items
  }
}

export class TelegramError extends Error {
  readonly code: number
  /** Telegram's own untranslated error text. */
  readonly description: string
  readonly retryAfter: number | null

  constructor(message: string, code: number, description: string, retryAfter: number | null) {
    super(message)
    this.name = 'TelegramError'
    this.code = code
    this.description = description
    this.retryAfter = retryAfter
  }
}

const RATE_LIMIT_WAIT_MAX_SEC = 5
const RATE_LIMIT_RETRIES = 2

export async function callBot<T = unknown>(token: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      description?: string
      error_code?: number
      parameters?: { retry_after?: number }
      result?: T
    }
    if (data.ok) return data.result as T
    const retryAfter = typeof data.parameters?.retry_after === 'number' ? data.parameters.retry_after : null
    // Short flood waits are sat out here; longer ones go back to the caller so a webhook never hangs on them.
    if (retryAfter != null && retryAfter <= RATE_LIMIT_WAIT_MAX_SEC && attempt < RATE_LIMIT_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 + 250))
      continue
    }
    const description = data.description ?? `Telegram HTTP ${res.status}`
    throw new TelegramError(translateError(description), data.error_code ?? res.status, description, retryAfter)
  }
}

const LINKED_TTL_MS = 10 * 60_000
const linkedCache = new Map<string, { linked: string | null; until: number }>()

async function linkedDiscussion(token: string, chatId: string) {
  const hit = linkedCache.get(chatId)
  if (hit && hit.until > Date.now()) return hit.linked
  const info = await callBot<{ type?: string; linked_chat_id?: number }>(token, 'getChat', { chat_id: chatId }).catch(() => null)
  if (!info) return null
  const linked = info.type === 'channel' && info.linked_chat_id ? String(info.linked_chat_id) : null
  linkedCache.set(chatId, { linked, until: Date.now() + LINKED_TTL_MS })
  return linked
}

/**
 * A channel's linked discussion group receives every channel post automatically, so sending to
 * both shows the post twice in the group. Keeps the channel and drops its discussion group.
 */
export async function dropAutoFed<T extends { token: string; chatId: string }>(targets: T[]): Promise<T[]> {
  if (targets.length < 2) return targets
  const linked = await Promise.all(targets.map((t) => linkedDiscussion(t.token, t.chatId)))
  const autoFed = new Set(linked.filter((id): id is string => Boolean(id)))
  return autoFed.size ? targets.filter((t) => !autoFed.has(t.chatId)) : targets
}

type UploadKind = 'photo' | 'video'
type UploadFile = { url: string; kind: UploadKind; name: string }
// Bot API upload caps: photos 10 MB, other files 50 MB.
const UPLOAD_LIMIT: Record<UploadKind, number> = { photo: 10 * 1024 * 1024, video: 49 * 1024 * 1024 }

async function download(file: UploadFile) {
  const res = await fetch(file.url, {
    cache: 'no-store',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; AlkankaBot/1.0)' },
    signal: AbortSignal.timeout(file.kind === 'video' ? 60_000 : 30_000),
  })
  if (!res.ok) throw new Error(`Medya indirilemedi (HTTP ${res.status})`)
  if (Number(res.headers.get('content-length') ?? 0) > UPLOAD_LIMIT[file.kind]) throw new Error('Medya Telegram yükleme sınırından büyük')
  const blob = await res.blob()
  if (blob.size > UPLOAD_LIMIT[file.kind]) throw new Error('Medya Telegram yükleme sınırından büyük')
  return blob
}

/**
 * Telegram often fails to fetch telesco.pe media by URL ("failed to get HTTP URL content") and
 * refuses remote videos above 20 MB, so media is downloaded here and uploaded as a file.
 */
export async function callBotFiles<T = unknown>(token: string, method: string, body: Record<string, unknown>, files: Record<string, UploadFile>): Promise<T> {
  const parts = await Promise.all(Object.entries(files).map(async ([key, file]) => [key, { blob: await download(file), name: file.name }] as const))
  return callBotUpload<T>(token, method, body, Object.fromEntries(parts))
}

/** Calls a Bot API method with files that are already in memory, sent as a multipart upload. */
export async function callBotUpload<T = unknown>(token: string, method: string, body: Record<string, unknown>, files: Record<string, { blob: Blob; name: string }>): Promise<T> {
  const form = new FormData()
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
  }
  for (const [key, file] of Object.entries(files)) form.append(key, file.blob, file.name)
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body: form, signal: AbortSignal.timeout(90_000) })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; error_code?: number; parameters?: { retry_after?: number }; result?: T }
  if (!data.ok) {
    const description = data.description ?? `Telegram HTTP ${res.status}`
    throw new TelegramError(translateError(description), data.error_code ?? res.status, description, data.parameters?.retry_after ?? null)
  }
  return data.result as T
}

/** Sends a photo by upload, falling back to Telegram fetching the URL itself. */
export async function sendPhotoFile<T = unknown>(token: string, body: Record<string, unknown>, url: string) {
  try {
    return await callBotFiles<T>(token, 'sendPhoto', body, { photo: { url, kind: 'photo', name: 'photo.jpg' } })
  } catch (error) {
    if (/parse entities|can't parse/i.test(String((error as Error).message))) throw error
    return callBot<T>(token, 'sendPhoto', { ...body, photo: url })
  }
}

function translateError(message: string) {
  if (/unauthorized/i.test(message)) return 'Bot token geçersiz ya da iptal edilmiş'
  if (/chat not found/i.test(message)) return 'Kanal bulunamadı. Kullanıcı adını kontrol et ve botu kanala ekle'
  if (/not enough rights|need administrator|have no rights/i.test(message)) return 'Botun bu kanalda mesaj gönderme yetkisi yok'
  if (/bot was kicked|bot is not a member/i.test(message)) return 'Bot bu kanalda değil, yönetici olarak ekle'
  return message
}

type Sent = { message_id: number }
/** Which messages a post became, so the panel can later edit, pin or delete it. `mainId` carries the text. */
type Delivered = { ids: number[]; mainId: number; mainMedia: boolean }

/** The post's own media could not be carried over; the caller decides whether to wait or send text only. */
export class MediaError extends Error {}

export type DeliverOptions = {
  buttons?: PostButton[]
  /** `original` (default) falls back to Telegram's preview of the source post; `throw` raises MediaError instead. */
  mediaFail?: 'original' | 'throw'
}

export async function deliver(
  dest: Destination,
  post: ScrapedPost,
  text: string,
  parseMode: 'HTML' | undefined,
  options: DeliverOptions = {},
): Promise<Delivered> {
  const send = <T = Sent>(method: string, body: Record<string, unknown>) => callBot<T>(dest.token, method, { chat_id: dest.chatId, ...body })
  const visible = parseMode ? stripTags(text).length : text.length
  const fmt = parseMode ? { parse_mode: parseMode } : {}
  const fitsCaption = visible <= CAPTION_LIMIT
  const captioned = fitsCaption ? { caption: text, ...fmt } : {}
  const markup = buttonMarkup(options.buttons)
  const hasButtons = Boolean(options.buttons?.length)
  const isParseError = (error: unknown) => /parse entities|can't parse/i.test(String((error as Error).message))
  const scraped = post.items ?? [
    ...post.photos.map((url) => ({ type: 'photo' as const, url })),
    ...(post.video ? [{ type: 'video' as const, url: post.video }] : []),
  ]
  const textOnly = async (extra: Record<string, unknown> = {}): Promise<Delivered> => {
    const m = await send('sendMessage', { text, ...fmt, ...markup, ...extra })
    return { ids: [m.message_id], mainId: m.message_id, mainMedia: false }
  }
  if (!scraped.length) return textOnly()
  const items = await resolveMissingVideos(post, scraped.slice(0, 10))
  const finish = async (media: Sent[], textInCaption: boolean): Promise<Delivered> => {
    const ids = media.map((m) => m.message_id)
    if (textInCaption) return { ids, mainId: ids[0], mainMedia: true }
    const m = await send('sendMessage', { text, ...fmt, ...markup, link_preview_options: { is_disabled: true } })
    return { ids: [...ids, m.message_id], mainId: m.message_id, mainMedia: false }
  }
  // Never substitute a video/GIF cover frame: if the real file can't be sent, Telegram's own preview of the original post is used.
  const viaOriginal = async (reason: string) => {
    if (options.mediaFail === 'throw') throw new MediaError(reason)
    return textOnly({
      link_preview_options: post.ref ? { url: `https://t.me/${post.ref}`, prefer_large_media: true, show_above_text: true } : { is_disabled: true },
    })
  }
  if (items.some((item) => !item.url)) return viaOriginal('Videonun dosyası kaynak kanalın sayfasında yok (büyük video)')

  try {
    if (items.length > 1) {
      // Telegram albums can't carry buttons, so with buttons the text follows the album as its own message.
      const albumCaption = fitsCaption && !hasButtons
      // Albums can't hold animations; Telegram plays GIF files inside albums as videos.
      const media = items.map((item, i) => ({
        type: item.type === 'photo' ? 'photo' : 'video',
        media: `attach://m${i}`,
        ...(item.type === 'photo' ? {} : { supports_streaming: true }),
        ...(i === 0 && albumCaption ? captioned : {}),
      }))
      let album: Sent[]
      try {
        album = await callBotFiles<Sent[]>(dest.token, 'sendMediaGroup', { chat_id: dest.chatId, media }, Object.fromEntries(items.map((item, i) => [
          `m${i}`,
          { url: item.url!, kind: item.type === 'photo' ? ('photo' as const) : ('video' as const), name: item.type === 'photo' ? `m${i}.jpg` : `m${i}.mp4` },
        ])))
      } catch (error) {
        if (isParseError(error)) throw error
        album = await send<Sent[]>('sendMediaGroup', { media: media.map((m, i) => ({ ...m, media: items[i].url })) })
      }
      return await finish(album, albumCaption)
    }

    const [item] = items
    const onMedia = fitsCaption ? { ...captioned, ...markup } : {}
    if (item.type === 'photo') {
      return await finish([await sendPhotoFile<Sent>(dest.token, { chat_id: dest.chatId, ...onMedia }, item.url!)], fitsCaption)
    }
    const method = item.type === 'gif' ? 'sendAnimation' : 'sendVideo'
    const field = item.type === 'gif' ? 'animation' : 'video'
    const body = { chat_id: dest.chatId, ...(item.type === 'video' ? { supports_streaming: true } : {}), ...onMedia }
    let single: Sent
    try {
      single = await callBotFiles<Sent>(dest.token, method, body, { [field]: { url: item.url!, kind: 'video', name: item.type === 'gif' ? 'animation.mp4' : 'video.mp4' } })
    } catch (error) {
      if (isParseError(error)) throw error
      single = await callBot<Sent>(dest.token, method, { ...body, [field]: item.url })
    }
    return await finish([single], fitsCaption)
  } catch (error) {
    if (isParseError(error)) throw error
    console.error('[mirror] media send failed', error)
    return viaOriginal(String((error as Error).message))
  }
}

type PostSource = { brand: string; link: string; replacements?: string; footer?: string; buttons?: PostButton[]; carryButtons?: boolean }

// --- Rules shared by every source ------------------------------------------

const SHARED_RULES_KEY = 'replace_rules'

/** Rules applied to every source of the post mirror and the special odds bot, after the source's own. */
export async function sharedRules(): Promise<ReplaceRule[]> {
  await ensureTables()
  const r = await rows<{ value: string }>(sql`SELECT value FROM tg_settings WHERE key = ${SHARED_RULES_KEY}`)
  return parseReplacements(r[0]?.value ?? '')
}

async function writeSharedRules(rules: ReplaceRule[]) {
  const value = serializeRules(rules)
  await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${SHARED_RULES_KEY}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

export async function saveSharedRules(text: string) {
  await ensureTables()
  await writeSharedRules(parseReplacements(checkedRules(text)))
}

/** Rules a source's form marked "for every source": added to the shared list, replacing a shared rule for the same thing. */
export async function addSharedRules(text: string) {
  const added = parseReplacements(checkedRules(text))
  if (added.length) await writeSharedRules(mergeRules(added, await sharedRules()))
  return added.length
}

/** A source's rules followed by the shared ones, in the stored form `buildMessage` and `composeOddsPost` read. */
export const withSharedRules = (replacements: string, shared: ReplaceRule[]) => serializeRules(mergeRules(parseReplacements(replacements), shared))

/** Validates a rules field from a form and returns it in the stored form. Older `old => new` text is converted. */
export function checkedRules(text: string) {
  const invalid = ruleError(text)
  if (invalid) throw new Error(invalid)
  return serializeRules(parseReplacements(text))
}

export function checkedButtons(input: unknown) {
  const invalid = buttonError(input)
  if (invalid) throw new Error(invalid)
  return JSON.stringify(cleanButtons(input))
}

/** Buttons under a shared post: the source post's own (when carried over), then ours. */
export function postButtons(source: { link: string; buttons?: PostButton[]; carryButtons?: boolean }, own: PostButton[] | undefined, rules: ReplaceRule[]) {
  const carried = source.carryButtons ? carriedButtons(own ?? [], rules, source.link) : []
  return [...carried, ...(source.buttons ?? [])].slice(0, MAX_SENT_BUTTONS)
}

function buildMessage(post: ScrapedPost, source: PostSource, note: string) {
  const rules = parseReplacements(source.replacements ?? '')
  const footer = source.footer?.trim() || `${source.brand} giriş ve bonus için tıkla`
  const noteHtml = note ? `\n\n<i>${escapeHtml(note)}</i>` : ''
  const footerHtml = `\n\n<a href="${escapeHtml(source.link)}"><b>${escapeHtml(footer)}</b></a>`
  let body = applyReplacements(toTelegramHtml(post.html, source.link, rules), rules, escapeHtml)
  if (stripTags(body).length > MESSAGE_LIMIT) body = escapeHtml(stripTags(body).slice(0, MESSAGE_LIMIT).trimEnd() + '…')
  return {
    html: (body + noteHtml + footerHtml).trim(),
    plain: `${stripTags(body)}${note ? `\n\n${note}` : ''}\n\n${footer}: ${source.link}`.trim(),
  }
}

/** Returns the messages the post became and the text as sent (Telegram HTML), for the panel's post list. */
async function sendPost(dest: Destination, post: ScrapedPost, source: PostSource, note = '') {
  const { html, plain } = buildMessage(post, source, note)
  const buttons = postButtons(source, post.buttons, parseReplacements(source.replacements ?? ''))
  try {
    return { ...(await deliver(dest, post, html, 'HTML', { buttons })), text: html }
  } catch (error) {
    if (!/parse entities|can't parse/i.test(String((error as Error).message))) throw error
    return { ...(await deliver(dest, post, plain, undefined, { buttons })), text: escapeHtml(plain) }
  }
}

function matchesKeywords(post: ScrapedPost, keywords: string) {
  const list = filterWords(keywords)
  if (!list.length) return true
  const text = stripTags(post.html).toLocaleLowerCase('tr')
  return list.some((k) => text.includes(k))
}

function mapSource(r: Record<string, unknown>): MirrorSource {
  return {
    id: Number(r.id),
    channel: String(r.channel),
    brand: String(r.brand),
    link: String(r.link),
    replacements: String(r.replacements ?? ''),
    footer: String(r.footer ?? ''),
    buttons: cleanButtons(r.buttons),
    carryButtons: Boolean(r.carry_buttons),
    keywords: String(r.keywords ?? ''),
    active: Boolean(r.active),
    targetId: r.target_id == null ? null : Number(r.target_id),
    lastPostId: r.last_post_id == null ? null : Number(r.last_post_id),
    lastCheckedAt: r.last_checked_at ? new Date(String(r.last_checked_at)).toISOString() : null,
    lastError: r.last_error ? String(r.last_error) : null,
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : null,
  }
}

export async function listSources() {
  await ensureTables()
  return (await rows(sql`SELECT * FROM tg_sources ORDER BY id`)).map(mapSource)
}

export async function listBots(): Promise<MirrorBot[]> {
  await ensureTables()
  const r = await rows(sql`SELECT id, name, username, token_enc FROM tg_bots ORDER BY id`)
  return r.map((b) => {
    let tokenHint = '••••'
    try {
      const token = decrypt(String(b.token_enc))
      tokenHint = `${token.split(':')[0]}:••••${token.slice(-4)}`
    } catch {
      tokenHint = 'Çözülemedi, botu silip yeniden ekle'
    }
    return { id: Number(b.id), name: String(b.name), username: String(b.username), tokenHint }
  })
}

export async function listTargets(): Promise<MirrorTarget[]> {
  await ensureTables()
  const r = await rows(sql`SELECT * FROM tg_targets ORDER BY id`)
  return r.map((t) => ({ id: Number(t.id), botId: Number(t.bot_id), chatId: String(t.chat_id), title: String(t.title), active: Boolean(t.active) }))
}

export async function listLog(limit = 25): Promise<MirrorLog[]> {
  await ensureTables()
  const r = await rows(sql`SELECT l.*, s.channel FROM tg_log l JOIN tg_sources s ON s.id = l.source_id ORDER BY l.created_at DESC LIMIT ${limit}`)
  return r.map((l) => ({
    id: Number(l.id),
    channel: String(l.channel),
    postId: Number(l.post_id),
    status: String(l.status) as MirrorLog['status'],
    detail: l.detail ? String(l.detail) : null,
    createdAt: new Date(String(l.created_at)).toISOString(),
  }))
}

export async function addBot(token: string) {
  if (!/^\d{5,15}:[A-Za-z0-9_-]{30,}$/.test(token)) throw new Error('Token formatı hatalı. BotFather’ın verdiği "123456:ABC..." şeklindeki kodun tamamını yapıştır')
  const me = await callBot<{ first_name: string; username: string }>(token, 'getMe')
  await ensureTables()
  await rows(sql`INSERT INTO tg_bots (name, username, token_enc) VALUES (${me.first_name}, ${me.username}, ${encrypt(token)})
    ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, token_enc = EXCLUDED.token_enc`)
  const { repairTelegram } = await import('@/lib/tg-health')
  await repairTelegram().catch((error) => console.error('[telegram] repair after add failed', error))
  return me
}

export async function deleteBot(id: number) {
  await ensureTables()
  const { detachBot, repairTelegram } = await import('@/lib/tg-health')
  await detachBot(id)
  await rows(sql`DELETE FROM tg_bots WHERE id = ${id}`)
  await repairTelegram().catch((error) => console.error('[telegram] repair after delete failed', error))
}

export async function botToken(botId: number) {
  const r = await rows(sql`SELECT token_enc FROM tg_bots WHERE id = ${botId}`)
  if (!r.length) throw new Error('Bot bulunamadı')
  return decrypt(String(r[0].token_enc))
}

export async function addTarget(botId: number, chatInput: string) {
  await ensureTables()
  const chat = normalizeChat(chatInput)
  if (!chat) throw new Error('Kanal geçersiz. Örnek: @kanaladi ya da -1001234567890')
  const token = await botToken(botId)
  const info = await callBot<{ id: number; title?: string; username?: string; type: string }>(token, 'getChat', { chat_id: chat })
  const member = await callBot<{ status: string; can_post_messages?: boolean }>(token, 'getChatMember', {
    chat_id: info.id,
    user_id: Number(token.split(':')[0]),
  })
  if (info.type === 'channel') {
    if (member.status !== 'administrator') throw new Error('Bot kanalda yönetici değil. Kanal ayarlarından botu yönetici yap')
    if (member.can_post_messages === false) throw new Error('Botun "Mesaj gönder" yetkisi kapalı. Yönetici ayarından aç')
  } else if (!['administrator', 'creator', 'member'].includes(member.status)) {
    throw new Error('Bot bu grupta değil. Önce botu gruba ekle')
  }
  const title = info.title ?? (info.username ? `@${info.username}` : String(info.id))
  await rows(sql`INSERT INTO tg_targets (bot_id, chat_id, title) VALUES (${botId}, ${String(info.id)}, ${title})
    ON CONFLICT (bot_id, chat_id) DO UPDATE SET title = EXCLUDED.title, active = true`)
  return title
}

export async function setTargetActive(id: number, active: boolean) {
  await ensureTables()
  await rows(sql`UPDATE tg_targets SET active = ${active} WHERE id = ${id}`)
}

export async function deleteTarget(id: number) {
  await ensureTables()
  await rows(sql`DELETE FROM tg_targets WHERE id = ${id}`)
}

export async function testTarget(id: number) {
  await ensureTables()
  const r = await rows(sql`SELECT bot_id, chat_id, title FROM tg_targets WHERE id = ${id}`)
  if (!r.length) throw new Error('Kanal bulunamadı')
  const token = await botToken(Number(r[0].bot_id))
  await callBot(token, 'sendMessage', { chat_id: String(r[0].chat_id), text: 'AL KANKA bot bağlantısı çalışıyor.' })
  return String(r[0].title)
}

export async function addSource(input: {
  channel: string
  brand: string
  link: string
  keywords: string
  targetId: number | null
  replacements: string
  footer: string
  buttons?: unknown
  carryButtons?: boolean
}) {
  await ensureTables()
  const replacements = checkedRules(input.replacements)
  const buttons = checkedButtons(input.buttons ?? [])
  await rows(sql`INSERT INTO tg_sources (channel, brand, link, keywords, target_id, replacements, footer, buttons, carry_buttons)
    VALUES (${input.channel}, ${input.brand}, ${input.link}, ${input.keywords}, ${input.targetId}, ${replacements}, ${input.footer}, ${buttons}, ${Boolean(input.carryButtons)})
    ON CONFLICT (channel) DO UPDATE SET brand = EXCLUDED.brand, link = EXCLUDED.link, keywords = EXCLUDED.keywords,
      target_id = EXCLUDED.target_id, replacements = EXCLUDED.replacements, footer = EXCLUDED.footer,
      buttons = EXCLUDED.buttons, carry_buttons = EXCLUDED.carry_buttons, active = true`)
}

export async function updateSourceText(id: number, input: { link: string; replacements: string; footer: string }) {
  await ensureTables()
  await rows(sql`UPDATE tg_sources SET link = ${input.link}, replacements = ${checkedRules(input.replacements)}, footer = ${input.footer} WHERE id = ${id}`)
}

export async function updateSourceButtons(id: number, input: { buttons: unknown; carryButtons: boolean }) {
  await ensureTables()
  await rows(sql`UPDATE tg_sources SET buttons = ${checkedButtons(input.buttons)}, carry_buttons = ${input.carryButtons} WHERE id = ${id}`)
}

export async function setSourceActive(id: number, active: boolean) {
  await ensureTables()
  await rows(sql`UPDATE tg_sources SET active = ${active} WHERE id = ${id}`)
}

export async function deleteSource(id: number) {
  await ensureTables()
  await rows(sql`DELETE FROM tg_sources WHERE id = ${id}`)
}

export async function getCronKey(rotate = false) {
  await ensureTables()
  if (!rotate) {
    const r = await rows(sql`SELECT value FROM tg_settings WHERE key = 'cron_key'`)
    if (r.length) return String(r[0].value)
  }
  const key = randomBytes(18).toString('base64url')
  await rows(sql`INSERT INTO tg_settings (key, value) VALUES ('cron_key', ${key}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
  return key
}

async function activeDestinations() {
  const r = await rows(sql`SELECT t.id, t.chat_id, t.title, t.bot_id, b.token_enc FROM tg_targets t JOIN tg_bots b ON b.id = t.bot_id WHERE t.active ORDER BY t.id`)
  const map = new Map<number, Destination>()
  for (const t of r) {
    try {
      map.set(Number(t.id), { token: decrypt(String(t.token_enc)), chatId: String(t.chat_id), title: String(t.title), botId: Number(t.bot_id) })
    } catch {
      // A token that none of the known secrets opens can't be used; the panel shows it so the bot can be re-added.
    }
  }
  return map
}

export async function runMirror(): Promise<MirrorResult> {
  await ensureTables()
  const destinations = await activeDestinations()
  if (!destinations.size) throw new Error('Bağlı ve aktif hedef kanal yok. Önce bot ve hedef kanal ekle')
  const shared = await sharedRules()
  const sources = (await rows(sql`SELECT * FROM tg_sources WHERE active ORDER BY id`))
    .map(mapSource)
    .map((source) => ({ ...source, replacements: withSharedRules(source.replacements, shared) }))
  const result: MirrorResult = { checked: 0, sent: 0, skipped: 0, failed: 0, primed: 0, errors: [] }
  // Imported lazily: telegram-bots depends on this module.
  const bots = await import('@/lib/telegram-bots')
  const postLog = await import('@/lib/tg-posts')
  const odds = { isOddsText: bots.isOddsText, extras: await bots.oddsMirrorExtras() }

  for (const source of sources) {
    result.checked++
    const targets = source.targetId == null ? [...destinations.values()] : [destinations.get(source.targetId)].filter((d): d is Destination => Boolean(d))
    try {
      const posts = await fetchChannel(source.channel)
      const latest = posts.reduce((max, p) => Math.max(max, p.id), 0)

      if (source.lastPostId == null) {
        // Baseline at the moment the source was added, so posts published before the first run are still forwarded.
        const addedAt = source.createdAt ? Date.parse(source.createdAt) : NaN
        const before = Number.isNaN(addedAt) ? [] : posts.filter((p) => p.date && Date.parse(p.date) <= addedAt)
        const baseline = before.length ? before.reduce((max, p) => Math.max(max, p.id), 0) : latest
        await rows(sql`UPDATE tg_sources SET last_post_id = ${baseline}, last_checked_at = now(), last_error = NULL WHERE id = ${source.id}`)
        result.primed++
        if (baseline === latest) continue
        source.lastPostId = baseline
      }
      if (!targets.length) throw new Error('Bu kaynağın hedef kanalı durdurulmuş ya da silinmiş')

      const fresh = posts
        .filter((p) => p.id > source.lastPostId!)
        .sort((a, b) => a.id - b.id)
        .slice(0, MAX_PER_RUN)

      for (const post of fresh) {
        const claimed = await rows(sql`INSERT INTO tg_log (source_id, post_id, status) VALUES (${source.id}, ${post.id}, 'pending')
          ON CONFLICT (source_id, post_id) DO NOTHING RETURNING id`)
        await rows(sql`UPDATE tg_sources SET last_post_id = GREATEST(COALESCE(last_post_id, 0), ${post.id}) WHERE id = ${source.id}`)
        if (!claimed.length) continue

        const empty = !stripTags(post.html).trim() && !post.photos.length && !post.video && !post.thumb
        if (empty || !matchesKeywords(post, source.keywords)) {
          await rows(sql`UPDATE tg_log SET status = 'skipped', detail = ${empty ? 'Boş post' : 'Anahtar kelime yok'} WHERE id = ${claimed[0].id}`)
          result.skipped++
          continue
        }

        const isOdds = odds.isOddsText(stripTags(post.html))
        const postTargets = await dropAutoFed(
          isOdds
            ? [...targets, ...odds.extras.targetIds.map((id) => destinations.get(id)).filter((d): d is Destination => Boolean(d) && !targets.includes(d!))]
            : targets,
        )
        const failures: string[] = []
        for (const dest of postTargets) {
          try {
            const sent = await sendPost(dest, post, source, isOdds ? odds.extras.note : '')
            await postLog.recordAutoPost({ origin: 'mirror', note: `@${source.channel} kanalından`, botId: dest.botId ?? null, chatId: dest.chatId, chatTitle: dest.title, ...sent })
          } catch (error) {
            failures.push(`${dest.title}: ${String((error as Error).message)}`)
          }
        }
        const okCount = postTargets.length - failures.length
        const status = okCount > 0 ? 'sent' : 'failed'
        const detail = failures.length ? `${okCount}/${postTargets.length} kanal. ${failures.join(' | ')}`.slice(0, 300) : postTargets.length > 1 ? `${postTargets.length} kanal` : null
        await rows(sql`UPDATE tg_log SET status = ${status}, detail = ${detail} WHERE id = ${claimed[0].id}`)
        if (okCount > 0) {
          result.sent++
          await recordDeal({
            sourceId: source.id,
            postId: post.id,
            brand: source.brand,
            text: stripTags(post.html),
            photo: post.photos[0] ?? post.thumb ?? null,
            link: source.link,
          }).catch((error) => console.error('[deals] kaydedilemedi', error))
        } else result.failed++
      }
      await rows(sql`UPDATE tg_sources SET last_checked_at = now(), last_error = NULL WHERE id = ${source.id}`)
    } catch (error) {
      const message = String((error as Error).message).slice(0, 300)
      result.errors.push(`@${source.channel}: ${message}`)
      await rows(sql`UPDATE tg_sources SET last_checked_at = now(), last_error = ${message} WHERE id = ${source.id}`)
    }
  }
  return result
}
