import type { Font } from 'opentype.js'

export type Word = { text: string; accent: boolean }

/** One drawn glyph: `d` is its outline in font units, `k` scales it to the fitted size. */
export type Letter = { d: string; x: number; y: number; k: number; w: number; accent: boolean; order: number; word: number; line: number }

export type TextBlock = {
  letters: Letter[]
  size: number
  cap: number
  lineHeight: number
  left: number
  top: number
  width: number
  height: number
  lines: number
  words: { cx: number; cy: number }[]
}

export type Box = { x: number; y: number; w: number; h: number }

const HOT = /[\d%₺$€]/

/**
 * `*word*` marks the words drawn in the accent colour. Copy without marks is not left flat: its numbers
 * and percentages are accented, and when it has none its last word is.
 */
export function parseWords(text: string): Word[] {
  const marked = text.includes('*')
  const words: Word[] = []
  text.split('*').forEach((part, i) => {
    for (const word of part.split(/\s+/).filter(Boolean)) words.push({ text: word, accent: marked && i % 2 === 1 })
  })
  if (marked || words.length < 2) return words
  const hot = words.filter((word) => HOT.test(word.text))
  if (hot.length && hot.length < words.length) for (const word of hot) word.accent = true
  else words[words.length - 1].accent = true
  return words
}

export const plainText = (text: string) => text.replace(/\*/g, '').replace(/\s+/g, ' ').trim()

const outlines = new WeakMap<Font, Map<number, string>>()

function outline(font: Font, index: number) {
  let known = outlines.get(font)
  if (!known) outlines.set(font, (known = new Map()))
  let d = known.get(index)
  if (d === undefined) known.set(index, (d = font.glyphs.get(index).getPath(0, 0, font.unitsPerEm).toPathData(1)))
  return d
}

type Shaped = { glyphs: { index: number; advance: number }[]; width: number }

function shape(font: Font, text: string): Shaped {
  const glyphs = font.stringToGlyphs(text)
  let width = 0
  const out = glyphs.map((glyph, i) => {
    const kern = i + 1 < glyphs.length ? font.getKerningValue(glyph, glyphs[i + 1]) : 0
    const advance = (glyph.advanceWidth ?? 0) + kern
    width += advance
    return { index: glyph.index, advance }
  })
  return { glyphs: out, width }
}

function wrap(widths: number[], space: number, limit: number) {
  const lines: number[][] = []
  let line: number[] = []
  let used = 0
  widths.forEach((width, i) => {
    const next = line.length ? used + space + width : width
    if (line.length && next > limit) {
      lines.push(line)
      line = [i]
      used = width
    } else {
      line.push(i)
      used = next
    }
  })
  if (line.length) lines.push(line)
  return lines
}

export type FitOptions = { maxSize: number; minSize: number; maxLines: number; align: 'center' | 'left'; gap?: number }

/** The largest size at which the words fit the box, broken into lines of even length. */
export function fitText(font: Font, words: Word[], box: Box, options: FitOptions): TextBlock | null {
  if (!words.length || box.w <= 0 || box.h <= 0) return null
  const upm = font.unitsPerEm
  const gap = options.gap ?? 1.14
  const shaped = words.map((word) => shape(font, word.text))
  const widths = shaped.map((s) => s.width)
  const widest = Math.max(...widths)
  const space = font.charToGlyph(' ').advanceWidth ?? upm * 0.25

  let size = options.maxSize
  let lines = wrap(widths, space, (box.w / size) * upm)
  const fits = () => widest <= (box.w / size) * upm && lines.length <= options.maxLines && lines.length * size * gap <= box.h
  while (!fits() && size > options.minSize) {
    size = Math.max(options.minSize, size * 0.96)
    lines = wrap(widths, space, (box.w / size) * upm)
  }
  // A single word wider than the box is shrunk rather than cut.
  if (widest > (box.w / size) * upm) {
    size = (box.w / widest) * upm
    lines = wrap(widths, space, (box.w / size) * upm)
  }

  // Same number of lines, as even as they can be.
  let low = widest
  let high = (box.w / size) * upm
  const count = lines.length
  for (let i = 0; i < 14; i++) {
    const mid = (low + high) / 2
    if (wrap(widths, space, mid).length <= count) high = mid
    else low = mid
  }
  lines = wrap(widths, space, high)

  const k = size / upm
  const cap = ((font.tables.os2?.sCapHeight as number | undefined) || upm * 0.7) * k
  const lineHeight = size * gap
  const height = lines.length * lineHeight
  const top = box.y + (box.h - height) / 2
  const letters: Letter[] = []
  const centres: { cx: number; cy: number }[] = []
  let order = 0
  let width = 0
  let left = Number.POSITIVE_INFINITY
  lines.forEach((line, row) => {
    const lineWidth = (line.reduce((sum, i) => sum + widths[i], 0) + space * (line.length - 1)) * k
    width = Math.max(width, lineWidth)
    let x = options.align === 'center' ? box.x + (box.w - lineWidth) / 2 : box.x
    left = Math.min(left, x)
    const y = top + row * lineHeight + (lineHeight + cap) / 2
    for (const i of line) {
      centres[i] = { cx: x + (widths[i] * k) / 2, cy: y - cap / 2 }
      for (const glyph of shaped[i].glyphs) {
        const d = outline(font, glyph.index)
        if (d) letters.push({ d, x, y, k, w: glyph.advance * k, accent: words[i].accent, order: order++, word: i, line: row })
        x += glyph.advance * k
      }
      x += space * k
    }
  })
  return { letters, size, cap, lineHeight, left, top, width, height, lines: lines.length, words: centres }
}

/** A single glyph's outline in font units, for marks drawn outside running text (the letter on a coin). */
export function glyphOutline(font: Font, char: string) {
  const glyph = font.charToGlyph(char)
  return { d: outline(font, glyph.index), advance: glyph.advanceWidth ?? font.unitsPerEm * 0.6, upm: font.unitsPerEm, cap: (font.tables.os2?.sCapHeight as number | undefined) || font.unitsPerEm * 0.7 }
}
