import 'server-only'
import { readFile as readLocal } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { readFile } from '@/lib/studio'
import type { StudioBrand, StudioTexts } from '@/lib/studio-types'

/** Everything the server prints on top of the model's picture. */
export type Brush = { logo: string; texts: StudioTexts | null; colors: string[] }

export const brushOf = (brand: StudioBrand | null, texts: StudioTexts | null): Brush => ({
  logo: brand?.logo ?? '',
  texts,
  colors: brand?.colors ?? [],
})

const hasInk = (brush: Brush) => Boolean(brush.logo || brush.texts)

const FONT_DIR = path.join(process.cwd(), 'assets', 'studio-fonts')
const FALLBACK_ACCENT = '#FFD23F'
const INK = '#14110A'
const PAPER = '#FFFFFF'
// Advance of a wide Montserrat Black capital and the gap between words, as fractions of the font
// size. Deliberately on the generous side: a headline may come out a little small, never clipped.
const GLYPH_WIDTH = 0.8
const WORD_GAP = 0.26

type Font = { name: string; data: Buffer; weight: 700 | 900; style: 'normal' }

let fontsReady: Promise<Font[]> | null = null
function loadFonts() {
  fontsReady ??= Promise.all([
    readLocal(path.join(FONT_DIR, 'Montserrat-Black.ttf')),
    readLocal(path.join(FONT_DIR, 'Montserrat-Bold.ttf')),
  ])
    .then(([black, bold]): Font[] => [
      { name: 'Montserrat', data: black, weight: 900, style: 'normal' },
      { name: 'Montserrat', data: bold, weight: 700, style: 'normal' },
    ])
    .catch((error) => {
      fontsReady = null
      throw error
    })
  return fontsReady
}

function rgbLuminance(red: number, green: number, blue: number) {
  const [r, g, b] = [red, green, blue].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function luminance(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  return rgbLuminance((n >> 16) & 255, (n >> 8) & 255, n & 255)
}

function wrappedLines(words: string[], size: number, boxWidth: number) {
  let lines = 1
  let used = 0
  for (const word of words) {
    const width = word.length * GLYPH_WIDTH * size
    const next = used === 0 ? width : used + WORD_GAP * size + width
    if (used > 0 && next > boxWidth) {
      lines++
      used = width
    } else {
      used = next
    }
  }
  return lines
}

/** Shrinks the headline until it wraps into the line count its length deserves (three at most). */
function fitHeadline(text: string, boxWidth: number, base: number) {
  const words = text.split(' ').filter(Boolean)
  const target = text.length <= 14 ? 1 : text.length <= 30 ? 2 : 3
  let size = base
  while (size > base * 0.4 && wrappedLines(words, size, boxWidth) > target) size *= 0.96
  size = Math.round(size)
  return { size, lines: wrappedLines(words, size, boxWidth) }
}

async function textLayer(width: number, height: number, texts: StudioTexts, colors: string[]) {
  const wide = width / height > 1.3
  const tall = height / width > 1.3
  const u = Math.min(width, height) / 100
  // The copy sits on a dark scrim, so a brand color only works as an accent when it is light enough.
  const accent = colors.find((c) => luminance(c) > 0.2) ?? FALLBACK_ACCENT
  const onAccent = luminance(accent) > 0.4 ? INK : PAPER

  const box = Math.round(wide ? width * 0.46 : width * 0.88)
  const edge = Math.round(4.5 * u)
  const head = fitHeadline(texts.headline, box, (wide ? 9 : tall ? 11.5 : 10) * u)
  const sub = Math.round(Math.min(4.4 * u, Math.max(3.1 * u, head.size * 0.36)))
  const button = Math.round(3.5 * u)
  const gap = Math.round(2.2 * u)
  const bottom = Math.round(height * (tall ? 0.09 : 0.065))
  const shadow = `0 ${Math.round(0.5 * u)}px ${Math.round(1.6 * u)}px rgba(0,0,0,0.6)`

  const blockHeight =
    (texts.headline ? head.lines * head.size * 1.04 : 0) +
    (texts.subline ? gap + sub * 1.25 * 2 : 0) +
    (texts.cta ? gap * 1.6 + button * 2.9 : 0)
  // Eased stops: a plain two-stop ramp leaves a visible edge where the darkening begins.
  const fade = 'rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.7) 36%, rgba(0,0,0,0.38) 64%, rgba(0,0,0,0.12) 86%, rgba(0,0,0,0) 100%'
  const scrim = wide
    ? { left: 0, top: 0, width: Math.round(box + edge + 20 * u), height, background: `linear-gradient(to right, ${fade})` }
    : {
        left: 0,
        bottom: 0,
        width,
        height: Math.round(Math.min(height * 0.72, blockHeight + bottom + 14 * u)),
        background: `linear-gradient(to top, ${fade})`,
      }
  const block = wide
    ? { left: edge, top: Math.round(height * 0.1), bottom: 0, width: box, justifyContent: 'center' as const, alignItems: 'flex-start' as const }
    : { left: Math.round((width - box) / 2), bottom, width: box, alignItems: 'center' as const }

  const response = new ImageResponse(
    (
      <div style={{ display: 'flex', position: 'relative', width, height, fontFamily: 'Montserrat' }}>
        <div style={{ display: 'flex', position: 'absolute', ...scrim }} />
        <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', ...block }}>
          {texts.headline ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: wide ? 'flex-start' : 'center',
                columnGap: Math.round(head.size * WORD_GAP),
                fontSize: head.size,
                fontWeight: 900,
                lineHeight: 1.04,
                letterSpacing: -head.size * 0.012,
                textShadow: shadow,
              }}
            >
              {texts.headline.split(' ').map((word, i) => (
                <div key={i} style={{ display: 'flex', color: /[\d%]/.test(word) ? accent : PAPER }}>
                  {word}
                </div>
              ))}
            </div>
          ) : null}
          {texts.subline ? (
            <div
              style={{
                display: 'flex',
                marginTop: texts.headline ? gap : 0,
                fontSize: sub,
                fontWeight: 700,
                lineHeight: 1.25,
                color: PAPER,
                textAlign: wide ? 'left' : 'center',
                textShadow: shadow,
              }}
            >
              {texts.subline}
            </div>
          ) : null}
          {texts.cta ? (
            <div
              style={{
                display: 'flex',
                marginTop: texts.headline || texts.subline ? Math.round(gap * 1.6) : 0,
                padding: `${Math.round(button * 0.48)}px ${Math.round(button * 1.3)}px`,
                borderRadius: 999,
                background: accent,
                color: onAccent,
                fontSize: button,
                fontWeight: 900,
                letterSpacing: button * 0.02,
                boxShadow: `0 ${Math.round(0.6 * u)}px ${Math.round(2.4 * u)}px rgba(0,0,0,0.45)`,
              }}
            >
              {texts.cta}
            </div>
          ) : null}
        </div>
      </div>
    ),
    { width, height, fonts: await loadFonts() },
  )
  return Buffer.from(await response.arrayBuffer())
}

// Largest color jump between neighbours that still counts as the same backdrop, and how far the
// backdrop may drift from its border color. Together they follow a vignette but stop at the mark.
const BACKDROP_STEP = 14
const BACKDROP_REACH = 72
// Below this average brightness the mark would disappear on a picture, so its backdrop stays.
const MIN_MARK_LUMINANCE = 0.18

/**
 * A logo saved without transparency brings its own backdrop and prints as a box. When the border is
 * one even color and the mark inside is bright enough to stand on a picture, the backdrop is cut
 * away and the logo is cropped to the mark. In every other case the logo is used as uploaded.
 */
async function cutOutLogo(logo: Buffer) {
  const { data, info } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const total = width * height
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return logo

  const border: number[] = []
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x)
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1)
  const mean = [0, 1, 2].map((c) => border.reduce((sum, p) => sum + data[p * 4 + c], 0) / border.length)
  const drift = (p: number) => Math.max(...mean.map((m, c) => Math.abs(data[p * 4 + c] - m)))
  const step = (a: number, b: number) =>
    Math.max(Math.abs(data[a * 4] - data[b * 4]), Math.abs(data[a * 4 + 1] - data[b * 4 + 1]), Math.abs(data[a * 4 + 2] - data[b * 4 + 2]))
  if (border.filter((p) => drift(p) > BACKDROP_REACH / 2).length > border.length * 0.05) return logo

  const gone = new Uint8Array(total)
  const queue = new Int32Array(total)
  let tail = 0
  for (const p of border) {
    if (!gone[p] && drift(p) <= BACKDROP_REACH) {
      gone[p] = 1
      queue[tail++] = p
    }
  }
  for (let head = 0; head < tail; head++) {
    const p = queue[head]
    const x = p % width
    for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
      if (q < 0 || q >= total || gone[q] || step(p, q) > BACKDROP_STEP || drift(q) > BACKDROP_REACH) continue
      gone[q] = 1
      queue[tail++] = q
    }
  }

  const kept = total - tail
  if (tail < total * 0.1 || kept < total * 0.02) return logo
  let light = 0
  let [left, top, right, bottom] = [width, height, 0, 0]
  for (let p = 0; p < total; p++) {
    if (gone[p]) continue
    light += rgbLuminance(data[p * 4], data[p * 4 + 1], data[p * 4 + 2])
    const x = p % width
    const y = (p - x) / width
    if (x < left) left = x
    if (x > right) right = x
    if (y < top) top = y
    if (y > bottom) bottom = y
  }
  if (light / kept < MIN_MARK_LUMINANCE) return logo

  // A slight blur of the mask softens the stair-stepped edge; backdrop pixels stay fully clear.
  const mask = Buffer.from(gone.map((g) => (g ? 0 : 255)))
  const soft = await sharp(mask, { raw: { width, height, channels: 1 } }).blur(0.6).extractChannel(0).raw().toBuffer()
  for (let p = 0; p < total; p++) data[p * 4 + 3] = gone[p] ? 0 : soft[p]
  return sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png()
    .toBuffer()
}

async function logoLayer(width: number, height: number, logoPath: string) {
  const logoWidth = Math.round(width * (width > height ? 0.18 : 0.26))
  const input = await sharp(await cutOutLogo(await readFile(logoPath)))
    .resize({ width: logoWidth, height: Math.round(height * 0.12), fit: 'inside' })
    .png()
    .toBuffer()
  const pad = Math.round(Math.min(width, height) * 0.045)
  return { input, top: pad, left: pad }
}

/** Transparent layer with the original logo and the typed copy; null when there is nothing to print. */
export async function buildOverlay(width: number, height: number, brush: Brush) {
  if (!hasInk(brush)) return null
  const layers = [
    ...(brush.texts ? [{ input: await textLayer(width, height, brush.texts, brush.colors), top: 0, left: 0 }] : []),
    ...(brush.logo ? [await logoLayer(width, height, brush.logo)] : []),
  ]
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .png()
    .toBuffer()
}

/** Prints the logo and copy on a text-free picture. Returns a PNG. */
export async function applyOverlay(image: Buffer, brush: Brush) {
  const base = sharp(image)
  const { width = 1024, height = 1024 } = await base.metadata()
  const overlay = await buildOverlay(width, height, brush)
  return overlay ? base.composite([{ input: overlay }]).png().toBuffer() : base.png().toBuffer()
}
