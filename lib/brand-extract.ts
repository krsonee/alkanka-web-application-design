import 'server-only'
import sharp from 'sharp'
import { storeFile } from '@/lib/studio'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const MAX_BYTES = 1_500_000

export type ExtractedBrand = { name: string; domain: string; logo: string; colors: string[]; font: string; warnings: string[] }

export function normalizeDomain(input: string) {
  const raw = input.trim().toLowerCase()
  const url = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`)
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(url.hostname)) throw new Error('Geçersiz domain.')
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname)) throw new Error('Geçersiz domain.')
  return url.hostname
}

async function fetchLimited(url: string, accept = '*/*') {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: accept, 'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_BYTES) throw new Error('Dosya çok büyük')
  return { buf, type: res.headers.get('content-type') ?? '', finalUrl: res.url }
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] ?? ''

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('')}`
}

function isNeutral(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max - min < 28
}

function collectColors(text: string, into: Map<string, number>, weight = 1) {
  for (const m of text.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let h = m[1].toLowerCase()
    if (h.length === 3) h = h.replace(/./g, (c) => c + c)
    into.set(`#${h}`, (into.get(`#${h}`) ?? 0) + weight)
  }
  for (const m of text.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/gi)) {
    const hex = rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]))
    into.set(hex, (into.get(hex) ?? 0) + weight)
  }
}

function pickColors(counts: Map<string, number>, theme: string) {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  const vivid = sorted.filter((c) => !isNeutral(c))
  const dark = sorted.find((c) => isNeutral(c) && Number.parseInt(c.slice(1, 3), 16) < 60)
  const list = [theme, ...vivid].filter(Boolean)
  const unique = [...new Set(list)].slice(0, 4)
  if (dark) unique.push(dark)
  return unique.slice(0, 5)
}

async function logoToPng(buf: Buffer) {
  const png = await sharp(buf, { density: 300 })
    .resize({ width: 800, height: 400, fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()
  const meta = await sharp(png).metadata()
  if (!meta.width || meta.width < 48) throw new Error('Logo çok küçük')
  return png
}

export async function extractBrand(domainInput: string): Promise<ExtractedBrand> {
  const domain = normalizeDomain(domainInput)
  const warnings: string[] = []
  const page = await fetchLimited(`https://${domain}`, 'text/html')
  const html = page.buf.toString('utf8')
  const base = page.finalUrl || `https://${domain}`
  const abs = (u: string) => {
    try {
      return new URL(u.replace(/&amp;/g, '&'), base).toString()
    } catch {
      return ''
    }
  }

  const metas = html.match(/<meta\b[^>]*>/gi) ?? []
  const meta = (key: string) => {
    const tag = metas.find((t) => new RegExp(`(name|property)\\s*=\\s*["']${key}["']`, 'i').test(t))
    return tag ? attr(tag, 'content') : ''
  }
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim()
  const name = meta('og:site_name') || title.split(/[|\-–—:]/)[0].trim() || domain.split('.')[0]
  const themeRaw = meta('theme-color')
  const theme = /^#[0-9a-f]{6}$/i.test(themeRaw) ? themeRaw.toLowerCase() : ''

  const counts = new Map<string, number>()
  collectColors(html.match(/<style[^>]*>[\s\S]*?<\/style>/gi)?.join('\n') ?? '', counts, 2)
  collectColors((html.match(/style\s*=\s*"[^"]*"/gi) ?? []).join('\n'), counts, 3)

  let font = ''
  const cssLinks = (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((t) => /stylesheet/i.test(attr(t, 'rel')))
    .map((t) => abs(attr(t, 'href')))
    .filter(Boolean)
    .slice(0, 3)
  for (const href of cssLinks) {
    try {
      const css = (await fetchLimited(href, 'text/css')).buf.toString('utf8')
      collectColors(css, counts)
      if (!font) {
        const family = css.match(/font-family\s*:\s*["']?([^"',;}]+)/i)?.[1]?.trim() ?? ''
        if (family && !/^(inherit|initial|sans-serif|serif|monospace|system-ui|-apple-system|var\()/i.test(family)) font = family
      }
    } catch {}
  }
  const gfont = html.match(/fonts\.googleapis\.com\/css2?\?family=([^"'&:]+)/i)?.[1]
  if (gfont) font = decodeURIComponent(gfont).replace(/\+/g, ' ')

  const colors = pickColors(counts, theme)
  if (!colors.length) warnings.push('Renkler okunamadı, elle ekleyebilirsin.')

  const imgs = html.match(/<img\b[^>]*>/gi) ?? []
  const logoImg = imgs.find((t) => /logo/i.test(`${attr(t, 'src')} ${attr(t, 'class')} ${attr(t, 'alt')} ${attr(t, 'id')}`))
  const links = html.match(/<link\b[^>]*>/gi) ?? []
  const touch = links.find((t) => /apple-touch-icon/i.test(attr(t, 'rel')))
  const icon = links.find((t) => /\bicon\b/i.test(attr(t, 'rel')) && /png|svg/i.test(attr(t, 'href')))
  const candidates = [
    logoImg && (attr(logoImg, 'src') || attr(logoImg, 'data-src')),
    touch && attr(touch, 'href'),
    icon && attr(icon, 'href'),
    meta('og:image'),
  ]
    .filter((c): c is string => Boolean(c) && !String(c).startsWith('data:'))
    .map(abs)
    .filter(Boolean)

  let logo = ''
  for (const url of candidates) {
    try {
      const png = await logoToPng((await fetchLimited(url, 'image/*')).buf)
      logo = await storeFile('logos', png, 'image/png', 'png')
      break
    } catch {}
  }
  if (!logo) warnings.push('Logo otomatik alınamadı, PNG/SVG olarak yükleyebilirsin.')

  return { name: name.slice(0, 60), domain, logo, colors, font: font.slice(0, 60), warnings }
}
