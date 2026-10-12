import 'server-only'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { generateText } from 'ai'
import sharp from 'sharp'
import { decodeHtml } from '@/lib/html-text'
import { storeFile } from '@/lib/studio'

const NO_AI =
  'Yapay zeka anahtarı ayarlı değil. Ekran görüntüsünden logo ve font okunamıyor; renkler görüntüdeki piksellerden çıkarıldı. Logoyu bilgisayarından yükleyebilirsin.'

const VISION_MODEL = 'google/gemini-3.5-flash'

type VisionResult = { name?: string; font?: string; colors?: string[]; box_2d?: number[] }

function parseJson(text: string): VisionResult {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return {}
  try {
    return JSON.parse(match[0]) as VisionResult
  } catch {
    return {}
  }
}

async function paletteFromImage(buf: Buffer) {
  const { data, info } = await sharp(buf).resize(80, 80, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const counts = new Map<string, number>()
  for (let i = 0; i < data.length; i += info.channels) {
    const q = (v: number) => Math.min(255, Math.round(v / 24) * 24)
    const hex = rgbToHex(q(data[i]), q(data[i + 1]), q(data[i + 2]))
    counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  return pickColors(counts, '')
}

async function knockOutBackground(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const corners = [0, width - 1, (height - 1) * width, height * width - 1].map((p) => [data[p * 4], data[p * 4 + 1], data[p * 4 + 2]])
  const [r, g, b] = corners[0]
  const uniform = corners.every(([cr, cg, cb]) => Math.abs(cr - r) + Math.abs(cg - g) + Math.abs(cb - b) < 40)
  if (!uniform) return { png, transparent: false }
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.abs(data[i] - r) + Math.abs(data[i + 1] - g) + Math.abs(data[i + 2] - b)
    if (d < 45) data[i + 3] = 0
    else if (d < 90) data[i + 3] = Math.round(((d - 45) / 45) * 255)
  }
  const out = await sharp(data, { raw: { width, height, channels: 4 } }).trim().png().toBuffer()
  return { png: out, transparent: true }
}

export async function extractBrandFromScreenshot(input: Buffer, domain: string): Promise<ExtractedBrand> {
  const warnings: string[] = []
  const shot = await sharp(input).rotate().resize({ width: 1600, withoutEnlargement: true }).png().toBuffer()
  const meta = await sharp(shot).metadata()
  const width = meta.width ?? 1600
  const height = meta.height ?? 900

  let vision: VisionResult = {}
  if (!process.env.AI_GATEWAY_API_KEY) {
    warnings.push(NO_AI)
  } else {
  try {
    const { text } = await generateText({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Screenshot of a website homepage. Reply with ONLY JSON:',
                '{"name": exact text of the logo wordmark as written (never guess a famous brand),',
                '"font": closest Google Font to the logo/headings,',
                '"colors": 3-5 hex brand colors most important first incl. main background,',
                '"box_2d": [ymin, xmin, ymax, xmax] of the main brand logo normalized 0-1000}',
              ].join(' '),
            },
            { type: 'file', mediaType: 'image/png', data: shot },
          ],
        },
      ],
    })
    vision = parseJson(text)
  } catch (error) {
    console.error('Vision extract failed:', error)
    const msg = error instanceof Error ? error.message : ''
    warnings.push(
      /api key|unauthorized|authentication/i.test(msg)
        ? 'Yapay zeka anahtarı geçersiz. Logo ve font okunamadı; renkler pikselden çıkarıldı. Logoyu bilgisayarından yükleyebilirsin.'
        : 'Yapay zeka ekran görüntüsünü okuyamadı, renkler pikselden çıkarıldı.',
    )
  }
  }

  const aiColors = (vision.colors ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).map((c) => c.toLowerCase())
  const colors = aiColors.length ? aiColors.slice(0, 5) : await paletteFromImage(shot)

  let logo = ''
  const box = vision.box_2d
  if (Array.isArray(box) && box.length === 4 && box.every((n) => typeof n === 'number' && n >= 0 && n <= 1000) && box[2] > box[0] && box[3] > box[1]) {
    try {
      const [ymin, xmin, ymax, xmax] = box.map((n) => n / 1000)
      const padX = 0.012
      const padY = 0.012
      const left = Math.max(0, Math.floor((xmin - padX) * width))
      const top = Math.max(0, Math.floor((ymin - padY) * height))
      const w = Math.min(width - left, Math.ceil((xmax - xmin + padX * 2) * width))
      const h = Math.min(height - top, Math.ceil((ymax - ymin + padY * 2) * height))
      const crop = await sharp(shot).extract({ left, top, width: w, height: h }).png().toBuffer()
      const { png, transparent } = await knockOutBackground(await logoToPng(crop))
      logo = await storeFile('logos', png, 'image/png', 'png')
      if (!transparent) warnings.push('Logo kesildi ama arka planı temizlenemedi; şeffaf PNG yüklersen daha net olur.')
    } catch (error) {
      console.error('Logo crop failed:', error)
    }
  }
  if (!logo) warnings.push('Logo ekran görüntüsünden kesilemedi, PNG/SVG olarak yükleyebilirsin.')

  const cleanDomain = domain.trim() ? normalizeDomain(domain) : ''
  return {
    name: decodeHtml(vision.name || cleanDomain.split('.')[0] || 'Yeni marka').slice(0, 60),
    domain: cleanDomain,
    logo,
    colors,
    font: (vision.font ?? '').slice(0, 60),
    warnings,
  }
}

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

function pickFont(css: string) {
  const counts = new Map<string, number>()
  for (const match of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const first = match[1].split(',')[0]?.trim().replace(/^["']|["']$/g, '') ?? ''
    if (!first || first.length > 40) continue
    if (/^(inherit|initial|unset|revert|sans-serif|serif|monospace|system-ui|ui-sans-serif|-apple-system|blinkmacsystemfont|var\()/i.test(first)) continue
    counts.set(first, (counts.get(first) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
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

const CHALLENGE = /just a moment|cf-chl|challenge-platform|attention required|checking your browser|ddos-guard|captcha/i

async function fetchPage(domain: string) {
  const bare = domain.replace(/^www\./, '')
  for (const url of [`https://${domain}`, `https://www.${bare}`, `https://${bare}`, `http://${bare}`]) {
    try {
      const page = await fetchLimited(url, 'text/html')
      const html = page.buf.toString('utf8')
      if (html.length < 600 && CHALLENGE.test(html)) continue
      if (CHALLENGE.test(html.slice(0, 4000)) && !/<img\b/i.test(html)) continue
      return { html, finalUrl: page.finalUrl }
    } catch {}
  }
  return null
}

function ownHosts() {
  const hosts = new Set(['alkanka.com', 'www.alkanka.com'])
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (site) {
    try {
      hosts.add(new URL(site).hostname)
    } catch {}
  }
  return hosts
}

function isOwnHost(host: string) {
  return ownHosts().has(host.toLowerCase())
}

async function loadBytes(url: string) {
  const parsed = new URL(url)
  if (isOwnHost(parsed.hostname)) {
    const rel = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')
    if (rel && !rel.includes('..') && !rel.includes('\\')) {
      try {
        return await readFile(join(process.cwd(), 'public', rel))
      } catch {}
    }
  }
  const got = await fetchLimited(url, 'image/*,*/*')
  if (got.type.toLowerCase().startsWith('text/html')) throw new Error('Görsel değil')
  return got.buf
}

function ownLogoUrls(domain: string) {
  if (!isOwnHost(domain)) return []
  const origin = `https://${domain.replace(/^www\./, '')}`
  return ['/apple-icon.png', '/images/logos/fist.png', '/app-icon-512.png', '/images/og.png'].map((path) => origin + path)
}

async function faviconFallback(domain: string) {
  const bare = domain.replace(/^www\./, '')
  for (const url of [
    `https://www.google.com/s2/favicons?domain=${bare}&sz=256`,
    `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${bare}&size=256`,
  ]) {
    try {
      const png = await logoToPng((await fetchLimited(url, 'image/*')).buf)
      return await storeFile('logos', png, 'image/png', 'png')
    } catch {}
  }
  return ''
}

export async function extractBrand(domainInput: string): Promise<ExtractedBrand> {
  const domain = normalizeDomain(domainInput)
  const warnings: string[] = []
  const page = await fetchPage(domain)
  if (!page) {
    let logo = ''
    for (const url of ownLogoUrls(domain)) {
      try {
        logo = await storeFile('logos', await logoToPng(await loadBytes(url)), 'image/png', 'png')
        break
      } catch {}
    }
    if (!logo) logo = await faviconFallback(domain)
    const own = isOwnHost(domain)
    return {
      name: own ? 'AL KANKA' : domain.replace(/^www\./, '').split('.')[0],
      domain,
      logo,
      colors: own ? ['#f5c400', '#0b0e17'] : [],
      font: own ? 'Space Grotesk' : '',
      warnings: [
        'Site bot korumasında, sayfa okunamadı.',
        logo ? 'Logo yerel dosyadan veya site ikonundan alındı.' : 'Logo otomatik alınamadı, PNG olarak yükleyebilirsin.',
        'En sağlam yol: sitenin ana sayfasının ekran görüntüsünü "Ekran görüntüsünden çek" ile yükle.',
      ].filter(Boolean),
    }
  }
  const html = page.html
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
  const title = decodeHtml((html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim())
  const name = decodeHtml(meta('og:site_name') || title.split(/[|\-–—:]/)[0].trim() || domain.split('.')[0])
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
      if (!font) font = pickFont(css)
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
    ...ownLogoUrls(domain),
    logoImg && (attr(logoImg, 'src') || attr(logoImg, 'data-src')),
    touch && attr(touch, 'href'),
    icon && attr(icon, 'href'),
    meta('og:image'),
    '/favicon.ico',
    '/apple-touch-icon.png',
    '/favicon-32x32.png',
  ]
    .filter((c): c is string => Boolean(c) && !String(c).startsWith('data:'))
    .map(abs)
    .filter(Boolean)

  let logo = ''
  for (const url of [...new Set(candidates)]) {
    try {
      const png = await logoToPng(await loadBytes(url))
      logo = await storeFile('logos', png, 'image/png', 'png')
      break
    } catch {}
  }
  if (!logo) logo = await faviconFallback(domain)
  if (!logo) warnings.push('Logo otomatik alınamadı, PNG olarak yükleyebilirsin.')
  if (!font) warnings.push('Font okunamadı, elle yazabilirsin.')

  return { name: name.slice(0, 60), domain, logo, colors, font: decodeHtml(font).slice(0, 60), warnings }
}
