import 'server-only'
import { rows, sql } from '@/lib/db'

export type MirrorSource = {
  id: number
  channel: string
  brand: string
  link: string
  keywords: string
  active: boolean
  lastPostId: number | null
  lastCheckedAt: string | null
  lastError: string | null
}

export type MirrorLog = {
  id: number
  channel: string
  postId: number
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  detail: string | null
  createdAt: string
}

export type MirrorResult = { checked: number; sent: number; skipped: number; failed: number; primed: number; errors: string[] }

type ScrapedPost = { id: number; html: string; photos: string[]; video: string | null }

const MAX_PER_RUN = 5
const CAPTION_LIMIT = 1000
const MESSAGE_LIMIT = 3900

let ready: Promise<void> | null = null
function ensureTables() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_sources (
      id serial PRIMARY KEY, channel text NOT NULL UNIQUE, brand text NOT NULL, link text NOT NULL,
      keywords text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true, last_post_id int,
      last_checked_at timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tg_log (
      id serial PRIMARY KEY, source_id int NOT NULL REFERENCES tg_sources(id) ON DELETE CASCADE, post_id int NOT NULL,
      status text NOT NULL, detail text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (source_id, post_id))`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export function botConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}

export function normalizeChannel(input: string) {
  const name = input
    .trim()
    .replace(/^https?:\/\/(www\.)?(t|telegram)\.me\/(s\/)?/i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
  return /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(name) ? name : null
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const stripTags = (s: string) =>
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

export function toTelegramHtml(html: string, link: string) {
  const safeLink = escapeHtml(link)
  const out = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<i class="emoji"[^>]*>\s*<b>([\s\S]*?)<\/b>\s*<\/i>/gi, '$1')
    .replace(/<tg-emoji[^>]*>([\s\S]*?)<\/tg-emoji>/gi, '$1')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const plain = stripTags(label).trim()
      if (href.startsWith('?q=') || /(^|\/\/)(t|telegram)\.me\//i.test(href)) return escapeHtml(plain)
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
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return out
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
    const video = chunk.match(/<video[^>]+src="([^"]+)"/)?.[1] ?? null
    posts.push({ id, html: text?.[1] ?? '', photos, video })
  }
  return posts
}

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, ...body }),
    signal: AbortSignal.timeout(20_000),
  })
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string }
  if (!data.ok) throw new Error(data.description ?? `Telegram HTTP ${res.status}`)
  return data
}

async function deliver(post: ScrapedPost, text: string, parseMode: 'HTML' | undefined) {
  const visible = parseMode ? stripTags(text).length : text.length
  const fmt = parseMode ? { parse_mode: parseMode } : {}
  const fitsCaption = visible <= CAPTION_LIMIT
  const message = { text, ...fmt, link_preview_options: { is_disabled: post.photos.length > 0 } }

  if (post.photos.length > 1) {
    await tg('sendMediaGroup', {
      media: post.photos.slice(0, 10).map((photo, i) => ({ type: 'photo', media: photo, ...(i === 0 && fitsCaption ? { caption: text, ...fmt } : {}) })),
    })
    if (!fitsCaption) await tg('sendMessage', message)
    return
  }
  if (post.photos.length === 1) {
    await tg('sendPhoto', { photo: post.photos[0], ...(fitsCaption ? { caption: text, ...fmt } : {}) })
    if (!fitsCaption) await tg('sendMessage', message)
    return
  }
  if (post.video) {
    try {
      await tg('sendVideo', { video: post.video, ...(fitsCaption ? { caption: text, ...fmt } : {}) })
      if (!fitsCaption) await tg('sendMessage', message)
      return
    } catch {
      // Telegram rejects remote videos above 20 MB; fall back to text only.
    }
  }
  await tg('sendMessage', message)
}

function buildMessage(post: ScrapedPost, source: { brand: string; link: string }) {
  const footerHtml = `\n\n<a href="${escapeHtml(source.link)}"><b>${escapeHtml(source.brand)} giriş ve bonus için tıkla</b></a>`
  let body = toTelegramHtml(post.html, source.link)
  if (stripTags(body).length > MESSAGE_LIMIT) body = escapeHtml(stripTags(body).slice(0, MESSAGE_LIMIT).trimEnd() + '…')
  const plainBody = stripTags(body)
  return {
    html: (body + footerHtml).trim(),
    plain: `${plainBody}\n\n${source.brand} giriş ve bonus: ${source.link}`.trim(),
  }
}

export async function sendPost(post: ScrapedPost, source: { brand: string; link: string }) {
  const { html, plain } = buildMessage(post, source)
  try {
    await deliver(post, html, 'HTML')
  } catch (error) {
    if (!/parse entities|can't parse/i.test(String((error as Error).message))) throw error
    await deliver(post, plain, undefined)
  }
}

function matchesKeywords(post: ScrapedPost, keywords: string) {
  const list = keywords
    .split(',')
    .map((k) => k.trim().toLocaleLowerCase('tr'))
    .filter(Boolean)
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
    keywords: String(r.keywords ?? ''),
    active: Boolean(r.active),
    lastPostId: r.last_post_id == null ? null : Number(r.last_post_id),
    lastCheckedAt: r.last_checked_at ? new Date(String(r.last_checked_at)).toISOString() : null,
    lastError: r.last_error ? String(r.last_error) : null,
  }
}

export async function listSources() {
  await ensureTables()
  return (await rows(sql`SELECT * FROM tg_sources ORDER BY id`)).map(mapSource)
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

export async function addSource(input: { channel: string; brand: string; link: string; keywords: string }) {
  await ensureTables()
  await rows(sql`INSERT INTO tg_sources (channel, brand, link, keywords) VALUES (${input.channel}, ${input.brand}, ${input.link}, ${input.keywords})
    ON CONFLICT (channel) DO UPDATE SET brand = EXCLUDED.brand, link = EXCLUDED.link, keywords = EXCLUDED.keywords, active = true`)
}

export async function setSourceActive(id: number, active: boolean) {
  await ensureTables()
  await rows(sql`UPDATE tg_sources SET active = ${active} WHERE id = ${id}`)
}

export async function deleteSource(id: number) {
  await ensureTables()
  await rows(sql`DELETE FROM tg_sources WHERE id = ${id}`)
}

export async function sendTestMessage() {
  await tg('sendMessage', { text: 'AL KANKA bot bağlantısı çalışıyor.' })
}

export async function runMirror(): Promise<MirrorResult> {
  if (!botConfigured()) throw new Error('TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID tanımlı değil')
  await ensureTables()
  const sources = (await rows(sql`SELECT * FROM tg_sources WHERE active ORDER BY id`)).map(mapSource)
  const result: MirrorResult = { checked: 0, sent: 0, skipped: 0, failed: 0, primed: 0, errors: [] }

  for (const source of sources) {
    result.checked++
    try {
      const posts = await fetchChannel(source.channel)
      const latest = posts.reduce((max, p) => Math.max(max, p.id), 0)

      if (source.lastPostId == null) {
        await rows(sql`UPDATE tg_sources SET last_post_id = ${latest}, last_checked_at = now(), last_error = NULL WHERE id = ${source.id}`)
        result.primed++
        continue
      }

      const fresh = posts
        .filter((p) => p.id > source.lastPostId!)
        .sort((a, b) => a.id - b.id)
        .slice(0, MAX_PER_RUN)

      for (const post of fresh) {
        const claimed = await rows(sql`INSERT INTO tg_log (source_id, post_id, status) VALUES (${source.id}, ${post.id}, 'pending')
          ON CONFLICT (source_id, post_id) DO NOTHING RETURNING id`)
        await rows(sql`UPDATE tg_sources SET last_post_id = GREATEST(COALESCE(last_post_id, 0), ${post.id}) WHERE id = ${source.id}`)
        if (!claimed.length) continue

        const empty = !stripTags(post.html).trim() && !post.photos.length && !post.video
        if (empty || !matchesKeywords(post, source.keywords)) {
          await rows(sql`UPDATE tg_log SET status = 'skipped', detail = ${empty ? 'Boş post' : 'Anahtar kelime yok'} WHERE id = ${claimed[0].id}`)
          result.skipped++
          continue
        }
        try {
          await sendPost(post, source)
          await rows(sql`UPDATE tg_log SET status = 'sent' WHERE id = ${claimed[0].id}`)
          result.sent++
        } catch (error) {
          await rows(sql`UPDATE tg_log SET status = 'failed', detail = ${String((error as Error).message).slice(0, 300)} WHERE id = ${claimed[0].id}`)
          result.failed++
        }
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
