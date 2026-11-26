import type { Font } from 'opentype.js'
import { mix, PACES, seeded, type MotionSpec } from './spec'
import { fitText, glyphOutline, parseWords, plainText, type Box, type Letter, type TextBlock } from './type'

/**
 * The film itself. `prepareReel` lays every scene out once; `drawFrame` then writes any moment of it as
 * an SVG. The same two functions run in the panel (live preview) and on the server (the GIF), so what
 * staff watches before producing is what the file plays.
 */

/** `ratio` is width over height. */
export type Picture = { href: string; ratio: number }
export type MotionKit = { font: Font; logo?: Picture | null; figure?: Picture | null }

export type BannerShape = 'strip' | 'wide' | 'block' | 'tower'

export function shapeOf(width: number, height: number): BannerShape {
  const ratio = width / height
  return ratio >= 3 ? 'strip' : ratio >= 1.45 ? 'wide' : ratio > 0.62 ? 'block' : 'tower'
}

/** A coin falls from `y0` to `y1`; one that starts or ends inside the frame fades there instead of crossing the copy. */
type Coin = { x: number; r: number; y0: number; y1: number; delay: number; fall: number; phase: number; speed: number; tilt: number }
type Star = { x: number; y: number; size: number; phase: number }
type Segment = {
  intro: boolean
  start: number
  dur: number
  logo: Box | null
  mark: TextBlock | null
  figure: Box | null
  text: TextBlock | null
  coins: Coin[]
  stars: Star[]
}
type Blob = { x: number; y: number; r: number; u: number }
type Shard = { x: number; y: number; vx: number; vy: number; size: number; at: number; spin: number; light: boolean }
type Burst = { blobs: Blob[]; holes: Blob[]; shards: Shard[]; blur: number }

export type Reel = {
  spec: MotionSpec
  kit: MotionKit
  shape: BannerShape
  segments: Segment[]
  duration: number
  /** Length of one transition, in seconds. */
  cut: number
  /** Where the file starts playing, so that its first frame is never the middle of a transition. */
  origin: number
  bursts: Burst[]
  coin: { d: string; k: number; dx: number; dy: number } | null
}

const CUT_SECONDS = { burst: 0.95, sweep: 0.6, slide: 0.62, fade: 0.5 } as const
const TAU = Math.PI * 2

const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const outCubic = (x: number) => 1 - (1 - x) ** 3
const inCubic = (x: number) => x ** 3
const inOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)
const outBack = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2
const n = (v: number) => String(Math.round(v * 100) / 100)
const fine = (v: number) => String(Math.round(v * 100000) / 100000)

function contain(ratio: number, maxW: number, maxH: number) {
  const w = Math.min(maxW, maxH * ratio)
  return { w, h: w / ratio }
}

type Layout = { logo: Box | null; mark: TextBlock | null; figure: Box | null; text: TextBlock | null; comfort: number }

function placeLogo(reel: { spec: MotionSpec; kit: MotionKit }, area: Box, align: 'center' | 'left'): { logo: Box; mark: TextBlock | null } | null {
  const { kit, spec } = reel
  if (kit.logo) {
    const size = contain(kit.logo.ratio, area.w, area.h)
    return { logo: { x: align === 'center' ? area.x + (area.w - size.w) / 2 : area.x, y: area.y + (area.h - size.h) / 2, ...size }, mark: null }
  }
  const mark = fitText(kit.font, parseWords(spec.brand), area, { maxSize: area.h * 0.92, minSize: 4, maxLines: 1, align })
  return mark ? { logo: { x: mark.left, y: mark.top, w: mark.width, h: mark.height }, mark } : null
}

function layoutScene(reel: { spec: MotionSpec; kit: MotionKit }, shape: BannerShape, text: string, withLogo: boolean, withFigure: boolean): Layout {
  const { spec, kit } = reel
  const W = spec.width
  const H = spec.height
  const words = parseWords(text)
  const figureRatio = kit.figure?.ratio ?? 1
  let logo: Box | null = null
  let mark: TextBlock | null = null
  let figure: Box | null = null
  const put = (area: Box, align: 'center' | 'left') => {
    const placed = placeLogo(reel, area, align)
    logo = placed?.logo ?? null
    mark = placed?.mark ?? null
    return placed?.logo ?? null
  }

  if (shape === 'strip') {
    const side = Math.max(H * 0.24, W * 0.03)
    let x = side
    if (withLogo) {
      const box = put({ x, y: H * 0.24, w: W * 0.2, h: H * 0.52 }, 'left')
      if (box) x = box.x + box.w + H * 0.42
    }
    if (withFigure) {
      let h = H * 1.04
      let w = h * figureRatio
      if (w > W * 0.17) {
        w = W * 0.17
        h = w / figureRatio
      }
      figure = { x, y: H - h, w, h }
      x += w + H * 0.3
    }
    const fitted = fitText(kit.font, words, { x, y: H * 0.08, w: W - x - side, h: H * 0.84 }, { maxSize: H * 0.44, minSize: H * 0.14, maxLines: H >= 120 ? 2 : 1, align: 'center' })
    return { logo, mark, figure, text: fitted, comfort: H * 0.27 }
  }

  if (shape === 'tower') {
    let top = H * 0.07
    let bottom = H * 0.93
    if (withLogo) {
      const box = put({ x: W * 0.08, y: H * 0.04, w: W * 0.84, h: H * 0.11 }, 'center')
      if (box) top = box.y + box.h + H * 0.04
    }
    if (withFigure) {
      let w = W * 1.08
      let h = w / figureRatio
      if (h > H * 0.36) {
        h = H * 0.36
        w = h * figureRatio
      }
      figure = { x: (W - w) / 2, y: H - h, w, h }
      bottom = H - h - H * 0.02
    }
    const fitted = fitText(kit.font, words, { x: W * 0.07, y: top, w: W * 0.86, h: bottom - top }, { maxSize: W * 0.24, minSize: W * 0.08, maxLines: 9, align: 'center' })
    return { logo, mark, figure, text: fitted, comfort: W * 0.11 }
  }

  const wide = shape === 'wide'
  let top = H * 0.12
  if (withLogo) {
    const box = wide ? put({ x: W * 0.06, y: H * 0.07, w: W * 0.26, h: H * 0.2 }, 'left') : put({ x: W * 0.25, y: H * 0.06, w: W * 0.5, h: H * 0.13 }, 'center')
    if (box) top = box.y + box.h + H * 0.05
  }
  let right = W * 0.92
  if (withFigure) {
    let h = H * (wide ? 0.9 : 0.52)
    let w = h * figureRatio
    const most = W * (wide ? 0.36 : 0.37)
    if (w > most) {
      w = most
      h = w / figureRatio
    }
    figure = { x: W - w - W * 0.02, y: H - h, w, h }
    right = figure.x - W * 0.01
  }
  const left = W * (withFigure ? 0.075 : 0.08)
  const fitted = fitText(
    kit.font,
    words,
    { x: left, y: top, w: right - left, h: H * 0.9 - top },
    { maxSize: H * (wide ? 0.15 : 0.1), minSize: H * 0.04, maxLines: 4, align: withFigure ? 'left' : 'center' },
  )
  return { logo, mark, figure, text: fitted, comfort: H * (wide ? 0.07 : 0.05) }
}

/** The copy has to stay readable: a scene too tight for its message gives up the character, then the logo. */
function roomyLayout(reel: { spec: MotionSpec; kit: MotionKit }, shape: BannerShape, text: string, logo: boolean, figure: boolean): Layout {
  const tries: [boolean, boolean][] = [[logo, figure]]
  if (figure) tries.push([logo, false])
  if (logo) tries.push([false, false])
  let last: Layout | null = null
  for (const [withLogo, withFigure] of tries) {
    last = layoutScene(reel, shape, text, withLogo, withFigure)
    if (last.text && last.text.size >= last.comfort) return last
  }
  return last as Layout
}

function makeBurst(W: number, H: number, shape: BannerShape, seed: number): Burst {
  const rand = seeded(seed)
  const cell = shape === 'strip' ? H * 0.55 : Math.min(W, H) * 0.3
  const cols = Math.ceil(W / cell)
  const rows = Math.ceil(H / cell)
  const flip = rand() > 0.5 ? 1 : -1
  const dir = shape === 'tower' ? { x: 0.12 * flip, y: -1 } : shape === 'strip' ? { x: flip, y: 0.1 } : { x: 0.8 * flip, y: -0.6 }
  const along = (x: number, y: number) => x * dir.x + y * dir.y
  const ends = [along(0, 0), along(W, 0), along(0, H), along(W, H)]
  const low = Math.min(...ends)
  const span = Math.max(...ends) - low
  const grid = (grow: number, satellites: boolean): Blob[] => {
    const out: Blob[] = []
    // One cell past every edge, so the wave never shows a rounded corner inside the frame.
    for (let c = -1; c <= cols; c++) {
      for (let r = -1; r <= rows; r++) {
        const x = (c + 0.5 + (rand() - 0.5) * 0.7) * cell
        const y = (r + 0.5 + (rand() - 0.5) * 0.7) * cell
        const radius = cell * (0.82 + rand() * 0.5) * grow
        const u = clamp((along(x, y) - low) / span)
        out.push({ x, y, r: radius, u })
        if (!satellites) continue
        // Tongues that run ahead of the wave and droplets that break off it.
        for (let s = 0; s < 3; s++) {
          const angle = Math.atan2(dir.y, dir.x) + (rand() - 0.5) * 1.5
          const far = radius * (0.75 + rand() * 0.75)
          out.push({ x: x + Math.cos(angle) * far, y: y + Math.sin(angle) * far, r: radius * (0.2 + rand() * 0.3), u: clamp(u + 0.03 + rand() * 0.1) })
        }
      }
    }
    return out
  }
  const blobs = grid(1, true)
  const holes = grid(1.22, true)
  const shards: Shard[] = Array.from({ length: shape === 'strip' ? 12 : 10 }, () => {
    const u = rand()
    const across = rand()
    // A point on the wave front, pushed along it and a little to the side.
    const px = dir.x >= 0 ? u * W : (1 - u) * W
    const py = shape === 'strip' ? across * H : dir.y < 0 ? (1 - u) * H * 0.6 + across * H * 0.4 : across * H
    const speed = (0.6 + rand() * 0.9) * Math.max(W, H) * (shape === 'strip' ? 0.35 : 0.7)
    const side = (rand() - 0.5) * 1.1
    return { x: px, y: py, vx: (dir.x - dir.y * side) * speed, vy: (dir.y + dir.x * side) * speed - Math.min(W, H) * 0.2, size: cell * (0.1 + rand() * 0.14), at: 0.12 + u * 0.3, spin: (rand() - 0.5) * 500, light: rand() > 0.55 }
  })
  return { blobs, holes, shards, blur: cell * 0.11 }
}

export function prepareReel(spec: MotionSpec, kit: MotionKit): Reel {
  const W = spec.width
  const H = spec.height
  const shape = shapeOf(W, H)
  const { look } = spec
  const cut = CUT_SECONDS[look.transition]
  const beat = PACES.find((p) => p.id === look.pace)?.beat ?? 2
  const tail = look.transition === 'burst' ? cut * 0.5 : cut * 0.35
  const rand = seeded(spec.seed + 17)
  const base = { spec, kit }
  const segments: Segment[] = []
  let start = 0

  if (look.logoIntro) {
    const area = shape === 'strip' ? { x: W * 0.28, y: H * 0.17, w: W * 0.44, h: H * 0.66 } : shape === 'tower' ? { x: W * 0.07, y: H * 0.38, w: W * 0.86, h: H * 0.24 } : { x: W * 0.17, y: H * 0.32, w: W * 0.66, h: H * 0.36 }
    const placed = placeLogo(base, area, 'center')
    if (placed) {
      const dur = Math.max(1.25, beat * 0.6) + tail
      segments.push({ intro: true, start, dur, logo: placed.logo, mark: placed.mark, figure: null, text: null, coins: [], stars: [] })
      start += dur
    }
  }

  for (const scene of spec.scenes) {
    const layout = roomyLayout(base, shape, scene.text, scene.logo, scene.figure && Boolean(kit.figure))
    const letters = plainText(scene.text).length
    const dur = beat + Math.min(0.6, letters * 0.012) + tail
    const block = layout.text
    const coins: Coin[] = []
    const stars: Star[] = []
    if (scene.effect && look.effect === 'coins') {
      const r = shape === 'strip' ? H * 0.19 : Math.min(W, H) * 0.058
      const count = shape === 'strip' ? Math.max(4, Math.min(12, Math.round((W / H) * 0.8))) : 8
      const from = block ? block.left - r * 1.2 : W
      const to = block ? block.left + block.width + r * 1.2 : 0
      const leftRoom = from - r
      const rightRoom = W - r - to
      const above = block ? block.top - r * 1.4 : 0
      const below = block ? block.top + block.height + r * 1.4 : H
      for (let i = 0; i < count; i++) {
        let x = r + rand() * (W - 2 * r)
        let y0 = -r * 1.3
        let y1 = H + r * 1.3
        // The coins are the colour of the highlighted words: none of them may cross the copy.
        if (x > from && x < to) {
          if (leftRoom > r * 2 || rightRoom > r * 2) x = rand() * (Math.max(0, leftRoom) + Math.max(0, rightRoom)) < Math.max(0, leftRoom) ? r + rand() * Math.max(0, leftRoom - r) : to + rand() * Math.max(0, rightRoom)
          else if (above > r * 2.5 && (rand() > 0.5 || H - below < r * 2.5)) y1 = above
          else if (H - below > r * 2.5) y0 = below
          else continue
        }
        const share = (y1 - y0) / (H + r * 2.6)
        coins.push({ x, r: r * (0.8 + rand() * 0.45), y0, y1, delay: cut * 0.3 + rand() * dur * 0.5, fall: ((shape === 'strip' ? 0.75 : 1.25) + rand() * 0.7) * Math.max(0.45, share), phase: rand(), speed: 0.9 + rand() * 0.9, tilt: (rand() - 0.5) * 36 })
      }
    }
    if (scene.effect && look.effect === 'sparks' && block) {
      const reach = block.size * 0.9
      for (let i = 0; i < 9; i++) {
        const onTop = rand() > 0.5
        stars.push({
          x: Math.max(reach * 0.3, Math.min(W - reach * 0.3, block.left - reach * 0.5 + rand() * (block.width + reach))),
          y: Math.max(reach * 0.2, Math.min(H - reach * 0.2, onTop ? block.top - rand() * reach * 0.5 : block.top + block.height + rand() * reach * 0.5)),
          size: block.size * (0.16 + rand() * 0.22),
          phase: rand(),
        })
      }
    }
    segments.push({ intro: false, start, dur, logo: layout.logo, mark: layout.mark, figure: layout.figure, text: block, coins, stars })
    start += dur
  }

  let coin: Reel['coin'] = null
  const initial = plainText(spec.brand).charAt(0).toLocaleUpperCase('tr')
  if (initial) {
    const glyph = glyphOutline(kit.font, initial)
    if (glyph.d) coin = { d: glyph.d, k: 1 / glyph.cap, dx: -glyph.advance / 2, dy: glyph.cap / 2 }
  }

  return {
    spec,
    kit,
    shape,
    segments,
    duration: start,
    cut,
    origin: look.transition === 'burst' ? cut * 0.5 : 0,
    bursts: look.transition === 'burst' ? [0, 1, 2].map((i) => makeBurst(W, H, shape, spec.seed * 7 + i * 131 + 5)) : [],
    coin,
  }
}

function about(cx: number, cy: number, scale: number) {
  return scale === 1 ? '' : `translate(${n(cx)} ${n(cy)}) scale(${fine(scale)}) translate(${n(-cx)} ${n(-cy)})`
}

function attrs(opacity: number, transform: string) {
  return `${opacity < 0.995 ? ` opacity="${n(opacity)}"` : ''}${transform ? ` transform="${transform}"` : ''}`
}

function letterPath(letter: Letter, fill: string, x: number, y: number, scale: number, opacity: number) {
  return `<path d="${letter.d}" transform="translate(${n(x)} ${n(y)}) scale(${fine(letter.k * scale)})" fill="${fill}"${opacity < 0.995 ? ` opacity="${n(opacity)}"` : ''}/>`
}

/** `since` is the time since the copy began to appear; a large value draws it fully set. */
function drawText(reel: Reel, block: TextBlock, since: number, reveal: MotionSpec['look']['reveal'], key: string) {
  const { colors } = reel.spec
  const count = block.letters.length
  const drop = block.size * 0.055
  const rows: { shade: string[]; ink: string[] }[] = Array.from({ length: block.lines }, () => ({ shade: [], ink: [] }))
  const step = Math.min(0.042, 0.9 / Math.max(1, count))
  for (const letter of block.letters) {
    let x = letter.x
    let y = letter.y
    let scale = 1
    let opacity = 1
    if (reveal === 'letters') {
      const g = outCubic(clamp((since - letter.order * step) / 0.36))
      const cx = letter.x + letter.w / 2
      const cy = letter.y - block.cap / 2
      scale = 0.5 + 0.5 * g
      x = cx + scale * (letter.x - cx) + (1 - g) * block.size * 0.5
      y = cy + scale * (letter.y - cy)
      opacity = g
    } else if (reveal === 'words') {
      const p = clamp((since - letter.word * 0.13) / 0.44)
      const centre = block.words[letter.word]
      scale = p <= 0 ? 0.5 : 0.5 + 0.5 * outBack(p)
      x = centre.cx + scale * (letter.x - centre.cx)
      y = centre.cy + scale * (letter.y - centre.cy)
      opacity = clamp(p * 2.4)
    } else if (reveal === 'rise') {
      y += (1 - outCubic(clamp((since - letter.line * 0.14) / 0.52))) * block.lineHeight * 1.05
    } else {
      const g = outCubic(clamp(since / 0.55))
      y += (1 - g) * block.size * 0.3
      opacity = g
    }
    if (opacity <= 0.01) continue
    rows[letter.line].shade.push(letterPath(letter, '#000', x, y + drop, scale, opacity))
    rows[letter.line].ink.push(letterPath(letter, letter.accent ? colors.accent : colors.text, x, y, scale, opacity))
  }
  if (reveal !== 'rise') return `<g opacity="0.3">${rows.map((r) => r.shade.join('')).join('')}</g>${rows.map((r) => r.ink.join('')).join('')}`
  return rows
    .map((row, i) => {
      const id = `${key}l${i}`
      const top = block.top + i * block.lineHeight - block.lineHeight * 0.04
      return `<clipPath id="${id}"><rect x="${n(block.left - block.size)}" y="${n(top)}" width="${n(block.width + block.size * 2)}" height="${n(block.lineHeight * 1.1)}"/></clipPath><g clip-path="url(#${id})"><g opacity="0.3">${row.shade.join('')}</g>${row.ink.join('')}</g>`
    })
    .join('')
}

function drawPicture(picture: Picture, box: Box, opacity: number, transform: string) {
  return `<image xlink:href="${picture.href}" x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" preserveAspectRatio="xMidYMid meet"${attrs(opacity, transform)}/>`
}

function drawCoins(reel: Reel, segment: Segment, tau: number) {
  const { colors, height: H } = reel.spec
  const rim = mix(colors.accent, '#000000', 0.38)
  const shine = mix(colors.accent, '#ffffff', 0.45)
  const out: string[] = []
  for (const coin of segment.coins) {
    const local = tau - coin.delay
    if (local < 0 || local > coin.fall) continue
    const part = local / coin.fall
    const y = coin.y0 + (coin.y1 - coin.y0) * part ** 1.2
    const fade = Math.min(coin.y0 > 0 ? part / 0.25 : 1, coin.y1 < H ? (1 - part) / 0.25 : 1, 1)
    const turn = Math.cos((local * coin.speed + coin.phase) * TAU)
    const squash = Math.max(0.1, Math.abs(turn))
    const mark = reel.coin && turn > 0.25 ? `<path d="${reel.coin.d}" transform="scale(${fine(reel.coin.k * coin.r * 0.95)}) translate(${n(reel.coin.dx)} ${n(reel.coin.dy)})" fill="#fff"/>` : ''
    out.push(
      `<g transform="translate(${n(coin.x)} ${n(y)}) rotate(${n(coin.tilt)}) scale(${fine(squash)} 1)"${fade < 0.995 ? ` opacity="${n(fade)}"` : ''}><circle r="${n(coin.r)}" fill="${rim}"/><circle r="${n(coin.r * 0.86)}" fill="${colors.accent}"/><circle r="${n(coin.r * 0.86)}" fill="none" stroke="${shine}" stroke-width="${n(coin.r * 0.1)}"/>${mark}</g>`,
    )
  }
  return out.join('')
}

function drawStars(reel: Reel, segment: Segment, tau: number) {
  const out: string[] = []
  for (const star of segment.stars) {
    const local = (tau * 0.55 + star.phase) % 1
    const glow = local < 0.5 ? Math.sin((local / 0.5) * Math.PI) : 0
    if (glow < 0.04) continue
    const s = star.size * (0.55 + glow * 0.45)
    const k = s * 0.16
    out.push(
      `<path d="M0 ${n(-s)} L${n(k)} ${n(-k)} L${n(s)} 0 L${n(k)} ${n(k)} L0 ${n(s)} L${n(-k)} ${n(k)} L${n(-s)} 0 L${n(-k)} ${n(-k)} Z" transform="translate(${n(star.x)} ${n(star.y)}) rotate(${n(tau * 40)})" fill="${local < 0.25 ? '#fff' : reel.spec.colors.accent}" opacity="${n(glow)}"/>`,
    )
  }
  return out.join('')
}

type SegmentState = { enterAt: number; exit: number; keepLogoIn: boolean; keepLogoOut: boolean; key: string }

function drawSegment(reel: Reel, segment: Segment, tau: number, state: SegmentState) {
  const { spec, kit, shape } = reel
  const { look } = spec
  const W = spec.width
  const H = spec.height
  const out: string[] = []
  const leave = inCubic(state.exit)

  if (segment.coins.length) out.push(drawCoins(reel, segment, tau))

  if (segment.logo) {
    const box = segment.logo
    const shown = state.keepLogoIn ? 1 : clamp((tau - state.enterAt) / (segment.intro ? 0.6 : 0.42))
    const gone = state.keepLogoOut ? 0 : leave
    const opacity = clamp(outCubic(shown) * 1.15) * (1 - gone)
    let transform = ''
    if (segment.intro) {
      const scale = (0.8 + 0.2 * outBack(shown)) * (1 + 0.04 * (tau / segment.dur)) * (1 + gone * 0.06)
      transform = about(box.x + box.w / 2, box.y + box.h / 2, scale)
    } else {
      const slip = (1 - outCubic(shown)) * (shape === 'strip' ? -box.w * 0.22 : 0)
      const lift = (1 - outCubic(shown)) * (shape === 'strip' ? 0 : -box.h * 0.45)
      if (slip || lift) transform = `translate(${n(slip)} ${n(lift)})`
    }
    if (opacity > 0.01) {
      if (kit.logo) out.push(drawPicture(kit.logo, box, opacity, transform))
      else if (segment.mark) out.push(`<g${attrs(opacity, transform)}>${drawText(reel, segment.mark, 99, 'fade', `${state.key}m`)}</g>`)
    }
  }

  const contentLeave =
    look.transition === 'slide'
      ? `translate(0 ${n(-leave * H * 0.5)})`
      : look.transition === 'sweep'
        ? `translate(${n(-leave * W * 0.05)} 0)`
        : ''
  const slideIn = look.transition === 'slide' ? (1 - outCubic(clamp((tau - state.enterAt) / 0.5))) * H * 0.45 : 0

  if (segment.figure && kit.figure) {
    const box = segment.figure
    const shown = clamp((tau - state.enterAt - 0.08) / 0.55)
    const rise = (1 - outBack(shown)) * box.h * 0.4 + Math.sin((tau / 2.6) * TAU) * box.h * 0.012
    const opacity = clamp(shown * 3) * (1 - leave)
    if (opacity > 0.01) out.push(`<g${attrs(1, contentLeave)}>${drawPicture(kit.figure, box, opacity, `translate(0 ${n(rise)})`)}</g>`)
  }

  if (segment.text) {
    const since = tau - state.enterAt - (segment.logo && !state.keepLogoIn ? 0.16 : 0.06)
    const opacity = 1 - leave
    if (opacity > 0.01) {
      const move = [contentLeave, slideIn ? `translate(0 ${n(slideIn)})` : ''].filter(Boolean).join(' ')
      out.push(`<g${attrs(opacity, move)}>${drawText(reel, segment.text, since, look.reveal, `${state.key}t`)}</g>`)
    }
  }

  if (segment.stars.length) out.push(drawStars(reel, segment, Math.max(0, tau - state.enterAt)))
  return out.join('')
}

/** `p` runs 0 to 1 across the transition: the wave covers the frame by the middle, then tears open. */
function drawBurst(reel: Reel, burst: Burst, p: number, key: string) {
  const { spec } = reel
  const W = spec.width
  const H = spec.height
  const body = mix(spec.colors.accent, '#ffffff', 0.22)
  const halo = mix(spec.colors.accent, '#000000', 0.45)
  const pad = burst.blur * 4
  const ring = (blobs: Blob[], scale: number, lead: number, fill: string, extra = '') =>
    blobs
      .map((b) => {
        const g = clamp((p + lead - b.u * 0.27) / 0.19)
        return g <= 0 ? '' : `<circle cx="${n(b.x)}" cy="${n(b.y)}" r="${n(b.r * scale * outCubic(g))}" fill="${fill}"${extra}/>`
      })
      .join('')
  const coreLeft = 1 - clamp((p - 0.5) / 0.2)
  const full = p > 0.47 && p < 0.53 ? `<rect x="${n(-pad)}" y="${n(-pad)}" width="${n(W + 2 * pad)}" height="${n(H + 2 * pad)}" fill="#fff"/>` : ''
  const goo = (inner: string, opacity = 1) => (inner ? `<g filter="url(#${key}goo)"${opacity < 0.995 ? ` opacity="${n(opacity)}"` : ''}>${inner}</g>` : '')
  const cover = `${goo(ring(burst.blobs, 1.2, 0.045, halo), 0.5)}${goo(ring(burst.blobs, 1, 0, body))}${coreLeft > 0.01 ? goo(ring(burst.blobs, 0.66, -0.075, '#ffffff') + full, coreLeft) : ''}`

  let defs = `<filter id="${key}goo" filterUnits="userSpaceOnUse" x="${n(-pad)}" y="${n(-pad)}" width="${n(W + 2 * pad)}" height="${n(H + 2 * pad)}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${n(burst.blur)}"/><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -6"/></filter>`
  let layer = cover
  if (p > 0.5) {
    const holes = burst.holes
      .map((b) => {
        const g = clamp((p - 0.52 - b.u * 0.25) / 0.2)
        return g <= 0 ? '' : `<circle cx="${n(b.x)}" cy="${n(b.y)}" r="${n(b.r * inOut(g))}" fill="#000"/>`
      })
      .join('')
    defs += `<mask id="${key}open" maskUnits="userSpaceOnUse" x="${n(-pad)}" y="${n(-pad)}" width="${n(W + 2 * pad)}" height="${n(H + 2 * pad)}"><rect x="${n(-pad)}" y="${n(-pad)}" width="${n(W + 2 * pad)}" height="${n(H + 2 * pad)}" fill="#fff"/><g filter="url(#${key}goo)">${holes}</g></mask>`
    layer = `<g mask="url(#${key}open)">${cover}</g>`
  }

  const shards = burst.shards
    .map((s) => {
      const life = clamp((p - s.at) / 0.5)
      if (life <= 0 || life >= 1) return ''
      const x = s.x + s.vx * life * 0.5
      const y = s.y + s.vy * life * 0.5 + life * life * Math.min(W, H) * 0.25
      const size = s.size * (1 - life * 0.55)
      return `<path d="M0 ${n(-size)} C${n(size * 0.75)} ${n(-size * 0.3)} ${n(size * 0.45)} ${n(size * 0.7)} 0 ${n(size)} C${n(-size * 0.2)} ${n(size * 0.3)} ${n(-size * 0.25)} ${n(-size * 0.4)} 0 ${n(-size)} Z" transform="translate(${n(x)} ${n(y)}) rotate(${n(s.spin * life)})" fill="${s.light ? '#ffffff' : body}" opacity="${n(Math.sin(life * Math.PI) ** 0.6)}"/>`
    })
    .join('')
  return `<defs>${defs}</defs>${layer}${shards}`
}

function sameBox(a: Box | null, b: Box | null) {
  return Boolean(a && b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5)
}

/** One moment of the film, without its backdrop: an SVG the size of the banner. */
export function drawFrame(reel: Reel, time: number, key = 'mb'): string {
  const { spec, segments, duration, cut } = reel
  const W = spec.width
  const H = spec.height
  const open = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
  if (!segments.length || duration <= 0) return `${open}</svg>`
  const t = (((time + reel.origin) % duration) + duration) % duration
  let index = segments.findIndex((s) => t < s.start + s.dur)
  if (index < 0) index = segments.length - 1
  const segment = segments[index]
  const count = segments.length
  const next = segments[(index + 1) % count]
  const prev = segments[(index - 1 + count) % count]
  const tau = t - segment.start
  const left = segment.dur - tau
  const parts: string[] = []

  if (spec.look.transition === 'burst') {
    parts.push(drawSegment(reel, segment, tau, { enterAt: cut * 0.3, exit: 0, keepLogoIn: false, keepLogoOut: false, key }))
    const p = left < cut / 2 ? 0.5 - left / cut : tau < cut / 2 ? 0.5 + tau / cut : -1
    if (p >= 0) {
      const boundary = left < cut / 2 ? (index + 1) % count : index
      parts.push(drawBurst(reel, reel.bursts[boundary % reel.bursts.length], p, key))
    }
  } else {
    const half = cut / 2
    const exit = clamp(1 - left / half)
    parts.push(drawSegment(reel, segment, tau, { enterAt: 0, exit, keepLogoIn: count > 1 ? sameBox(segment.logo, prev.logo) : true, keepLogoOut: count > 1 ? sameBox(segment.logo, next.logo) : true, key }))
    if (spec.look.transition === 'sweep') {
      const q = left < half ? 0.5 - left / cut : tau < half ? 0.5 + tau / cut : -1
      if (q >= 0) {
        const band = Math.max(W * 0.16, H * 0.8)
        const x = -band * 1.5 + q * (W + band * 3)
        parts.push(
          `<defs><linearGradient id="${key}band" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect x="${n(x)}" y="${n(-H)}" width="${n(band)}" height="${n(H * 3)}" fill="url(#${key}band)" transform="rotate(18 ${n(x + band / 2)} ${n(H / 2)})"/>`,
        )
      }
    }
  }
  return `${open}${parts.join('')}</svg>`
}

/** The backdrop: the brand's dark colour, lit from one side, with a painted or grained surface. */
export function drawBackdrop(spec: MotionSpec, key = 'mb'): string {
  const W = spec.width
  const H = spec.height
  const { deep, mid } = spec.colors
  const small = Math.min(W, H)
  const seed = (Math.abs(spec.seed) % 900) + 1
  let surface = ''
  let defs = `<linearGradient id="${key}bg" x1="0" y1="0" x2="1" y2="${n(Math.min(1, (H / W) * 0.9))}"><stop offset="0" stop-color="${deep}"/><stop offset="0.58" stop-color="${mid}"/><stop offset="1" stop-color="${mix(mid, deep, 0.55)}"/></linearGradient><radialGradient id="${key}glow"><stop offset="0" stop-color="#fff" stop-opacity="0.1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><radialGradient id="${key}vg" cx="0.5" cy="0.5" r="0.75"><stop offset="0.5" stop-color="${deep}" stop-opacity="0"/><stop offset="1" stop-color="${deep}" stop-opacity="0.7"/></radialGradient>`
  if (spec.look.texture === 'brush') {
    // Long, soft strokes: noise stretched along one axis and tilted, once as shadow and once as light.
    const fy = Math.min(0.07, 3.1 / small)
    const fx = fy / 11
    defs += `<filter id="${key}dark" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${fine(fx)} ${fine(fy)}" numOctaves="4" seed="${seed}"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -1.05"/></filter><filter id="${key}lite" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${fine(fx * 1.6)} ${fine(fy * 1.5)}" numOctaves="3" seed="${seed + 7}"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 0 0 0 -0.78"/></filter>`
    const span = Math.hypot(W, H) * 1.2
    const sheet = (id: string, opacity: number, angle: number) =>
      `<g transform="rotate(${angle} ${n(W / 2)} ${n(H / 2)})" opacity="${opacity}"><rect x="${n((W - span) / 2)}" y="${n((H - span) / 2)}" width="${n(span)}" height="${n(span)}" filter="url(#${key}${id})"/></g>`
    surface = sheet('dark', 0.34, -16) + sheet('lite', 0.2, -11)
  } else if (spec.look.texture === 'grain') {
    defs += `<filter id="${key}grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed}"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.9 0 0 0 -0.36"/></filter>`
    surface = `<rect width="${W}" height="${H}" filter="url(#${key}grain)" opacity="0.22"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs><rect width="${W}" height="${H}" fill="url(#${key}bg)"/>${surface}<ellipse cx="${n(W * 0.56)}" cy="${n(H * 0.42)}" rx="${n(Math.max(W * 0.3, H * 0.8))}" ry="${n(Math.max(H * 0.8, W * 0.16))}" fill="url(#${key}glow)"/><rect width="${W}" height="${H}" fill="url(#${key}vg)"/></svg>`
}

/** Seconds the finished file plays before it loops. */
export const reelSeconds = (reel: Reel) => reel.duration
