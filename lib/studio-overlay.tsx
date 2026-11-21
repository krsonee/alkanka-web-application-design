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

// Average advance of a Montserrat Bold letter in running text, as a fraction of the font size.
const TEXT_GLYPH = 0.6
/** How many lines a paragraph takes at this size. */
const paragraphLines = (text: string, size: number, boxWidth: number) => Math.max(1, Math.ceil((text.length * TEXT_GLYPH * size) / Math.max(1, boxWidth)))

/**
 * Shrinks the headline until it wraps into the line count its length deserves: three at most for a
 * headline of ordinary length, more only when somebody writes a whole paragraph there.
 */
function fitHeadline(text: string, boxWidth: number, base: number) {
  const words = text.split(' ').filter(Boolean)
  const long = text.length > 70
  const target = text.length <= 14 ? 1 : text.length <= 30 ? 2 : long ? Math.ceil(text.length / 24) : 3
  let size = base
  while (size > base * (long ? 0.22 : 0.4) && wrappedLines(words, size, boxWidth) > target) size *= 0.96
  size = Math.round(size)
  return { size, lines: wrappedLines(words, size, boxWidth) }
}

/** `clearTop` is where the logo ends; the wide layout starts its text column below it. */
async function textLayer(width: number, height: number, texts: StudioTexts, colors: string[], clearTop = 0) {
  const wide = width / height > 1.3
  const tall = height / width > 1.3
  const u = Math.min(width, height) / 100
  // The copy sits on a dark scrim, so a brand color only works as an accent when it is light enough.
  const accent = colors.find((c) => luminance(c) > 0.2) ?? FALLBACK_ACCENT
  const onAccent = luminance(accent) > 0.4 ? INK : PAPER

  const box = Math.round(wide ? width * 0.46 : width * 0.88)
  const edge = Math.round(4.5 * u)
  const bottom = Math.round(height * (tall ? 0.09 : 0.065))
  const shadow = `0 ${Math.round(0.5 * u)}px ${Math.round(1.6 * u)}px rgba(0,0,0,0.6)`

  // Copy has no length limit, so the block measures itself and steps every size down until it fits.
  const sized = (scale: number) => {
    const head = fitHeadline(texts.headline, box, (wide ? 9 : tall ? 11.5 : 10) * u * scale)
    const sub = Math.round(Math.min(4.4 * u, Math.max(3.1 * u, head.size * 0.36)) * scale)
    const button = Math.round(3.5 * u * scale)
    const gap = Math.round(2.2 * u * scale)
    const subLines = texts.subline ? Math.max(2, paragraphLines(texts.subline, sub, box)) : 0
    const ctaLines = texts.cta ? paragraphLines(texts.cta, button * 1.05, box - button * 2.6) : 0
    const blockHeight =
      (texts.headline ? head.lines * head.size * 1.04 : 0) +
      (texts.subline ? gap + sub * 1.25 * subLines : 0) +
      (texts.cta ? gap * 1.6 + button * (1.7 + 1.2 * ctaLines) : 0)
    return { head, sub, button, gap, ctaLines, blockHeight }
  }
  const room = wide ? height - Math.max(Math.round(height * 0.1), clearTop) - edge : height * 0.84 - bottom
  let fit = sized(1)
  for (let scale = 0.92; fit.blockHeight > room && scale > 0.2; scale *= 0.92) fit = sized(scale)
  const { head, sub, button, gap, ctaLines, blockHeight } = fit
  // Eased stops: a plain two-stop ramp leaves a visible edge where the darkening begins.
  const fade = 'rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.7) 36%, rgba(0,0,0,0.38) 64%, rgba(0,0,0,0.12) 86%, rgba(0,0,0,0) 100%'
  const scrim = wide
    ? { left: 0, top: 0, width: Math.round(box + edge + 20 * u), height, background: `linear-gradient(to right, ${fade})` }
    : {
        left: 0,
        bottom: 0,
        width,
        // Long copy may need more than the usual share of the picture; the darkening follows it.
        height: Math.round(Math.min(height, Math.max(Math.min(height * 0.72, blockHeight + bottom + 14 * u), blockHeight + bottom + 6 * u))),
        background: `linear-gradient(to top, ${fade})`,
      }
  const block = wide
    ? { left: edge, top: Math.max(Math.round(height * 0.1), clearTop), bottom: 0, width: box, justifyContent: 'center' as const, alignItems: 'flex-start' as const }
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
                maxWidth: box,
                textAlign: 'center',
                borderRadius: ctaLines > 1 ? Math.round(button * 1.1) : 999,
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

/**
 * A logo saved without transparency brings its own backdrop and prints as a box. When the border is
 * one even color, the backdrop is cut away and the logo is cropped to the mark; a dark mark is cut out
 * too, because it is set on a light plate afterwards. In every other case the logo is used as uploaded.
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
  let [left, top, right, bottom] = [width, height, 0, 0]
  for (let p = 0; p < total; p++) {
    if (gone[p]) continue
    const x = p % width
    const y = (p - x) / width
    if (x < left) left = x
    if (x > right) right = x
    if (y < top) top = y
    if (y > bottom) bottom = y
  }

  // A slight blur of the mask softens the stair-stepped edge; backdrop pixels stay fully clear.
  const mask = Buffer.from(gone.map((g) => (g ? 0 : 255)))
  const soft = await sharp(mask, { raw: { width, height, channels: 1 } }).blur(0.6).extractChannel(0).raw().toBuffer()
  for (let p = 0; p < total; p++) data[p * 4 + 3] = gone[p] ? 0 : soft[p]
  return sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png()
    .toBuffer()
}

const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 }
type Box = { left: number; top: number; width: number; height: number }
type Placed = { input: Buffer; left: number; top: number }

/** Crops a logo to its visible mark, so an empty margin saved in the file neither shrinks nor shifts it. */
async function trimClear(logo: Buffer) {
  const { data, info } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let [left, top, right, bottom] = [info.width, info.height, -1, -1]
  for (let p = 0; p < info.width * info.height; p++) {
    if (data[p * 4 + 3] < 12) continue
    const x = p % info.width
    const y = (p - x) / info.width
    if (x < left) left = x
    if (x > right) right = x
    if (y < top) top = y
    if (y > bottom) bottom = y
  }
  if (right < left || bottom < top) return logo
  if (left === 0 && top === 0 && right === info.width - 1 && bottom === info.height - 1) return logo
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png()
    .toBuffer()
}

/** How bright the mark is where it shows, and whether it is a full rectangle with nothing cut away. */
async function readMark(mark: Buffer) {
  const { data, info } = await sharp(mark).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let weight = 0
  let light = 0
  let boxed = true
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 250) boxed = false
    if (alpha === 0) continue
    weight += alpha
    light += alpha * rgbLuminance(data[i], data[i + 1], data[i + 2])
  }
  return { width: info.width, height: info.height, light: weight ? light / weight : 1, boxed }
}

/**
 * A square emblem and a long wordmark get the same visual weight: the size follows the mark's area,
 * not its width, and stays inside what the format can spare.
 */
function logoSize(width: number, height: number, aspect: number) {
  const u = Math.min(width, height)
  const wide = width > height * 1.3
  const side = u * (wide ? 0.19 : 0.15)
  let w = side * Math.sqrt(aspect)
  let h = side / Math.sqrt(aspect)
  const floor = u * 0.062
  if (h < floor) [w, h] = [(w * floor) / h, floor]
  const fit = Math.min(1, (width * (wide ? 0.26 : 0.42)) / w, (u * 0.22) / h)
  return { w: Math.max(1, Math.round(w * fit)), h: Math.max(1, Math.round(h * fit)) }
}

/** Brightness and restlessness of the picture where the logo will stand, the copy's scrim included. */
async function groundUnder(under: Buffer | undefined, ink: Buffer | null, width: number, height: number, box: Box) {
  if (!under) return null
  const area: Box = {
    left: Math.max(0, Math.min(box.left, width - 1)),
    top: Math.max(0, Math.min(box.top, height - 1)),
    width: Math.max(1, Math.min(box.width, width - box.left)),
    height: Math.max(1, Math.min(box.height, height - box.top)),
  }
  let patch = await sharp(await sharp(under).resize(width, height, { fit: 'fill' }).png().toBuffer()).extract(area).png().toBuffer()
  if (ink) patch = await sharp(patch).composite([{ input: await sharp(ink).extract(area).png().toBuffer() }]).png().toBuffer()
  const { data } = await sharp(patch).flatten({ background: '#000000' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const n = data.length / 3
  let sum = 0
  let squares = 0
  for (let i = 0; i < data.length; i += 3) {
    const v = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    sum += v
    squares += v * v
  }
  const mean = sum / n
  return { light: rgbLuminance(mean, mean, mean), busy: Math.sqrt(Math.max(0, squares / n - mean * mean)) }
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/** A feathered rounded shape: the soft shade behind a light logo and the shadow under a plate. */
async function softShape(width: number, height: number, box: Box, radius: number, fill: string, opacity: number, blur: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" rx="${radius}" fill="${fill}" fill-opacity="${opacity}"/></svg>`
  const shape = sharp(Buffer.from(svg))
  return (blur >= 0.3 ? shape.blur(blur) : shape).png().toBuffer()
}

/**
 * The picture darkens gently from its top edge, the way it does under the copy at the bottom. A patch
 * behind the logo alone reads as a stain; an even band across the picture reads as part of the layout.
 */
function topScrim(width: number, reach: number, strength: number) {
  const stops = [
    [0, 1],
    [0.34, 0.8],
    [0.62, 0.44],
    [0.85, 0.14],
    [1, 0],
  ]
    .map(([at, share]) => `<stop offset="${at}" stop-color="#000" stop-opacity="${(strength * share).toFixed(3)}"/>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${reach}"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient></defs><rect width="${width}" height="${reach}" fill="url(#s)"/></svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

/** The mark's own outline as a soft dark shadow, with room around it for the blur. */
async function castShadow(mark: Buffer, strength: number, blur: number) {
  const { data, info } = await sharp(mark).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = 0
    data[i + 3] = Math.round(data[i + 3] * strength)
  }
  const room = Math.ceil(blur * 3)
  const input = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extend({ top: room, bottom: room, left: room, right: room, background: CLEAR })
    .blur(Math.max(0.3, blur))
    .png()
    .toBuffer()
  return { input, room }
}

// A full rectangle carries its own margin, so it is printed a little larger than a bare mark.
const BADGE_SCALE = 1.2

/** A logo that is a full rectangle (a photo, an uneven backdrop) becomes a badge with rounded corners. */
async function asBadge(mark: Buffer, w: number, h: number) {
  const inner = await sharp(mark).resize({ width: Math.round(w * BADGE_SCALE), height: Math.round(h * BADGE_SCALE), fit: 'inside' }).png().toBuffer()
  const size = await sharp(inner).metadata()
  const [bw, bh] = [size.width ?? w, size.height ?? h]
  const corner = `<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="${bh}"><rect width="${bw}" height="${bh}" rx="${Math.round(Math.min(bw, bh) * 0.16)}" fill="#fff"/></svg>`
  return sharp(inner).composite([{ input: Buffer.from(corner), blend: 'dest-in' }]).png().toBuffer()
}

// A mark darker than this cannot stand on a picture by itself; it is set on a light plate instead.
const DARK_MARK = 0.3

/**
 * Sets the brand logo in the top-left corner the way a designer would: cropped to the mark, sized by
 * its shape, and given exactly the backing the picture underneath calls for. A light mark gets a soft
 * shade only where the picture is bright or restless; a dark mark gets a light plate unless the picture
 * is calm and bright; a logo saved as a full rectangle becomes a rounded badge. `bottom` tells the copy
 * where the logo ends.
 */
async function logoLayer(width: number, height: number, logoPath: string, under: Buffer | undefined, ink: Buffer | null) {
  const mark = await trimClear(await cutOutLogo(await readFile(logoPath)))
  const seen = await readMark(mark)
  const u = Math.min(width, height)
  const pad = Math.round(u * 0.045)
  const { w, h } = logoSize(width, height, seen.width / seen.height)
  const ground = await groundUnder(under, ink, width, height, { left: pad, top: pad, width: w, height: h })
  const depth = Math.max(1, Math.round(u * 0.004))
  const layers: Placed[] = []
  let bottom = pad + h

  if (seen.boxed) {
    const badge = await asBadge(mark, w, h)
    const shadow = await castShadow(badge, 0.5, u * 0.007)
    layers.push({ input: shadow.input, left: Math.max(0, pad - shadow.room), top: Math.max(0, pad - shadow.room + depth) }, { input: badge, left: pad, top: pad })
    bottom = pad + ((await sharp(badge).metadata()).height ?? h)
  } else if (seen.light < DARK_MARK && !(ground && ground.light > 0.5 && ground.busy < 34)) {
    const [airX, airY] = [Math.round(h * 0.3), Math.round(h * 0.22)]
    const inner = await sharp(mark).resize({ width: Math.max(1, w - airX * 2), height: Math.max(1, h - airY), fit: 'inside' }).png().toBuffer()
    const size = await sharp(inner).metadata()
    const plate: Box = { left: pad, top: pad, width: (size.width ?? w) + airX * 2, height: (size.height ?? h) + airY * 2 }
    const radius = Math.round(plate.height * 0.24)
    const tile = { width: plate.left + plate.width + pad, height: plate.top + plate.height + pad }
    layers.push(
      { input: await softShape(tile.width, tile.height, { ...plate, top: plate.top + depth }, radius, '#000', 0.42, u * 0.008), left: 0, top: 0 },
      { input: await softShape(tile.width, tile.height, plate, radius, '#fff', 0.96, 0), left: 0, top: 0 },
      { input: inner, left: plate.left + airX, top: plate.top + airY },
    )
    bottom = plate.top + plate.height
  } else {
    const input = await sharp(mark).resize({ width: w, height: h, fit: 'inside' }).png().toBuffer()
    const size = await sharp(input).metadata()
    const [lw, lh] = [size.width ?? w, size.height ?? h]
    if (seen.light >= DARK_MARK) {
      const gap = ground ? contrast(seen.light, ground.light) : 2.4
      const shade = gap < 1.7 ? 0.62 : gap < 3 ? 0.44 : !ground || ground.busy > 44 ? 0.28 : 0
      if (shade > 0) layers.push({ input: await topScrim(width, Math.round(Math.min(height * 0.5, (pad + lh) * 2.6)), shade), left: 0, top: 0 })
      const shadow = await castShadow(input, 0.42, u * 0.006)
      layers.push({ input: shadow.input, left: Math.max(0, pad - shadow.room), top: Math.max(0, pad - shadow.room + depth) })
    }
    layers.push({ input, left: pad, top: pad })
    bottom = pad + lh
  }

  // A layer never reaches past the canvas: sharp refuses an overlay larger than what it is printed on.
  const fitted = await Promise.all(
    layers.map(async (layer) => {
      const size = await sharp(layer.input).metadata()
      const [lw, lh] = [size.width ?? 1, size.height ?? 1]
      const [cw, ch] = [Math.min(lw, width - layer.left), Math.min(lh, height - layer.top)]
      if (cw === lw && ch === lh) return layer
      return { ...layer, input: await sharp(layer.input).extract({ left: 0, top: 0, width: Math.max(1, cw), height: Math.max(1, ch) }).png().toBuffer() }
    }),
  )
  return { layers: fitted, bottom }
}

/**
 * Transparent layer with the original logo and the typed copy; null when there is nothing to print.
 * `under` is the picture it will be printed on: with it the logo's backing follows what is really there.
 */
export async function buildOverlay(width: number, height: number, brush: Brush, under?: Buffer) {
  if (!hasInk(brush)) return null
  // The logo is measured first, so the wide layout can start its text column under it.
  let logo = brush.logo ? await logoLayer(width, height, brush.logo, under, null) : null
  const clearTop = logo && width / height > 1.3 ? logo.bottom + Math.round(Math.min(width, height) * 0.05) : 0
  const ink = brush.texts ? await textLayer(width, height, brush.texts, brush.colors, clearTop) : null
  // With copy on the picture the corner may sit under its scrim; the logo's backing is chosen again on that ground.
  if (brush.logo && ink && under) logo = await logoLayer(width, height, brush.logo, under, ink)
  const layers = [...(ink ? [{ input: ink, top: 0, left: 0 }] : []), ...(logo?.layers ?? [])]
  return sharp({ create: { width, height, channels: 4, background: CLEAR } })
    .composite(layers)
    .png()
    .toBuffer()
}

/** Prints the logo and copy on a text-free picture. Returns a PNG. */
export async function applyOverlay(image: Buffer, brush: Brush) {
  const base = sharp(image)
  const { width = 1024, height = 1024 } = await base.metadata()
  const overlay = await buildOverlay(width, height, brush, image)
  return overlay ? base.composite([{ input: overlay }]).png().toBuffer() : base.png().toBuffer()
}
