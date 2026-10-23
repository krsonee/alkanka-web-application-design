import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { filterWords } from '@/lib/telegram-filters'
import { recordDeal } from '@/lib/deals'
import { applyReplacements, parseReplacements, pickLink, type ReplaceRule } from '@/lib/text-replace'

export type MirrorSource = {
  id: number
  channel: string
  brand: string
  link: string
  replacements: string
  footer: string
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

type MediaItem = { type: 'photo' | 'video' | 'gif'; url: string | null }
type ScrapedPost = {
  id: number
  html: string
  photos: string[]
  video: string | null
  thumb?: string | null
  date?: string | null
  ref?: string
  items?: MediaItem[]
}
type Destination = { token: string; chatId: string; title: string }

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
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_log (
      id serial PRIMARY KEY, source_id int NOT NULL REFERENCES tg_sources(id) ON DELETE CASCADE, post_id int NOT NULL,
      status text NOT NULL, detail text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (source_id, post_id))`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

function cipherKey() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('BETTER_AUTH_SECRET tanımlı değil')
  return createHash('sha256').update(`tg-token:${secret}`).digest()
}

function encrypt(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', cipherKey(), iv)
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.')
}

function decrypt(value: string) {
  const [iv, tag, data] = value.split('.').map((p) => Buffer.from(p, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', cipherKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
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
export const stripTags = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/g, '&')

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

/** Plain text of a scraped t.me/s post with hidden-link labels and their ornament rows removed. */
export function scrapedHtmlToCleanText(html: string) {
  const marked = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<i class="emoji"[^>]*>\s*<b>([\s\S]*?)<\/b>\s*<\/i>/gi, '$1')
    .replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/gi, '$1')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const plain = stripTags(label).trim()
      if (href.startsWith('?q=') || /^(https?:\/\/|www\.)\S+$/i.test(plain) || /^@\w+$/.test(plain)) return label
      return DEAD_LINK
    })
  return stripTags(dropDeadLinks(marked))
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
      if (/(^|\/\/)(t|telegram)\.me\//i.test(href)) return DEAD_LINK
      const safeLink = escapeHtml(pickLink(href.replace(/&amp;/g, '&'), rules, link))
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
    posts.push({ id, html: text?.[1] ?? '', photos, video, thumb, date, ref, items: sticker ? [] : mediaItems(chunk) })
  }
  return posts
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

export async function callBot<T = unknown>(token: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: T }
  if (!data.ok) throw new Error(translateError(data.description ?? `Telegram HTTP ${res.status}`))
  return data.result as T
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
  const form = new FormData()
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
  }
  const blobs = await Promise.all(Object.entries(files).map(async ([key, file]) => [key, await download(file), file.name] as const))
  for (const [key, blob, name] of blobs) form.append(key, blob, name)
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', body: form, signal: AbortSignal.timeout(90_000) })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: T }
  if (!data.ok) throw new Error(translateError(data.description ?? `Telegram HTTP ${res.status}`))
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

async function deliver(dest: Destination, post: ScrapedPost, text: string, parseMode: 'HTML' | undefined) {
  const send = (method: string, body: Record<string, unknown>) => callBot(dest.token, method, { chat_id: dest.chatId, ...body })
  const visible = parseMode ? stripTags(text).length : text.length
  const fmt = parseMode ? { parse_mode: parseMode } : {}
  const fitsCaption = visible <= CAPTION_LIMIT
  const captioned = fitsCaption ? { caption: text, ...fmt } : {}
  const isParseError = (error: unknown) => /parse entities|can't parse/i.test(String((error as Error).message))
  const scraped = post.items ?? [
    ...post.photos.map((url) => ({ type: 'photo' as const, url })),
    ...(post.video ? [{ type: 'video' as const, url: post.video }] : []),
  ]
  if (!scraped.length) {
    await send('sendMessage', { text, ...fmt })
    return
  }
  const items = await resolveMissingVideos(post, scraped.slice(0, 10))
  const finish = async () => {
    if (!fitsCaption) await send('sendMessage', { text, ...fmt, link_preview_options: { is_disabled: true } })
  }
  // Never substitute a video/GIF cover frame: if the real file can't be sent, Telegram's own preview of the original post is used.
  const viaOriginal = () =>
    send('sendMessage', {
      text,
      ...fmt,
      link_preview_options: post.ref ? { url: `https://t.me/${post.ref}`, prefer_large_media: true, show_above_text: true } : { is_disabled: true },
    })
  if (items.some((item) => !item.url)) return viaOriginal()

  try {
    if (items.length > 1) {
      // Albums can't hold animations; Telegram plays GIF files inside albums as videos.
      const media = items.map((item, i) => ({
        type: item.type === 'photo' ? 'photo' : 'video',
        media: `attach://m${i}`,
        ...(item.type === 'photo' ? {} : { supports_streaming: true }),
        ...(i === 0 ? captioned : {}),
      }))
      try {
        await callBotFiles(dest.token, 'sendMediaGroup', { chat_id: dest.chatId, media }, Object.fromEntries(items.map((item, i) => [
          `m${i}`,
          { url: item.url!, kind: item.type === 'photo' ? ('photo' as const) : ('video' as const), name: item.type === 'photo' ? `m${i}.jpg` : `m${i}.mp4` },
        ])))
      } catch (error) {
        if (isParseError(error)) throw error
        await send('sendMediaGroup', { media: media.map((m, i) => ({ ...m, media: items[i].url })) })
      }
      return await finish()
    }

    const [item] = items
    if (item.type === 'photo') {
      await sendPhotoFile(dest.token, { chat_id: dest.chatId, ...captioned }, item.url!)
      return await finish()
    }
    const method = item.type === 'gif' ? 'sendAnimation' : 'sendVideo'
    const field = item.type === 'gif' ? 'animation' : 'video'
    const body = { chat_id: dest.chatId, ...(item.type === 'video' ? { supports_streaming: true } : {}), ...captioned }
    try {
      await callBotFiles(dest.token, method, body, { [field]: { url: item.url!, kind: 'video', name: item.type === 'gif' ? 'animation.mp4' : 'video.mp4' } })
    } catch (error) {
      if (isParseError(error)) throw error
      await callBot(dest.token, method, { ...body, [field]: item.url })
    }
    return await finish()
  } catch (error) {
    if (isParseError(error)) throw error
    console.error('[mirror] media send failed, sharing original post instead', error)
    return viaOriginal()
  }
}

type PostSource = { brand: string; link: string; replacements?: string; footer?: string }

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

async function sendPost(dest: Destination, post: ScrapedPost, source: PostSource, note = '') {
  const { html, plain } = buildMessage(post, source, note)
  try {
    await deliver(dest, post, html, 'HTML')
  } catch (error) {
    if (!/parse entities|can't parse/i.test(String((error as Error).message))) throw error
    await deliver(dest, post, plain, undefined)
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
}) {
  await ensureTables()
  await rows(sql`INSERT INTO tg_sources (channel, brand, link, keywords, target_id, replacements, footer)
    VALUES (${input.channel}, ${input.brand}, ${input.link}, ${input.keywords}, ${input.targetId}, ${input.replacements}, ${input.footer})
    ON CONFLICT (channel) DO UPDATE SET brand = EXCLUDED.brand, link = EXCLUDED.link, keywords = EXCLUDED.keywords,
      target_id = EXCLUDED.target_id, replacements = EXCLUDED.replacements, footer = EXCLUDED.footer, active = true`)
}

export async function updateSourceText(id: number, input: { link: string; replacements: string; footer: string }) {
  await ensureTables()
  await rows(sql`UPDATE tg_sources SET link = ${input.link}, replacements = ${input.replacements}, footer = ${input.footer} WHERE id = ${id}`)
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
  const r = await rows(sql`SELECT t.id, t.chat_id, t.title, b.token_enc FROM tg_targets t JOIN tg_bots b ON b.id = t.bot_id WHERE t.active ORDER BY t.id`)
  const map = new Map<number, Destination>()
  for (const t of r) {
    try {
      map.set(Number(t.id), { token: decrypt(String(t.token_enc)), chatId: String(t.chat_id), title: String(t.title) })
    } catch {
      // A token encrypted with a previous secret can't be used; the panel shows it so the bot can be re-added.
    }
  }
  return map
}

export async function runMirror(): Promise<MirrorResult> {
  await ensureTables()
  const destinations = await activeDestinations()
  if (!destinations.size) throw new Error('Bağlı ve aktif hedef kanal yok. Önce bot ve hedef kanal ekle')
  const sources = (await rows(sql`SELECT * FROM tg_sources WHERE active ORDER BY id`)).map(mapSource)
  const result: MirrorResult = { checked: 0, sent: 0, skipped: 0, failed: 0, primed: 0, errors: [] }
  // Imported lazily: telegram-bots depends on this module.
  const bots = await import('@/lib/telegram-bots')
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
        const postTargets = isOdds
          ? [...targets, ...odds.extras.targetIds.map((id) => destinations.get(id)).filter((d): d is Destination => Boolean(d) && !targets.includes(d!))]
          : targets
        const failures: string[] = []
        for (const dest of postTargets) {
          try {
            await sendPost(dest, post, source, isOdds ? odds.extras.note : '')
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
