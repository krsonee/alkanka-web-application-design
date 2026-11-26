/**
 * A motion banner is a short film cut from typed copy: a logo opening, then one scene per message,
 * joined by a transition. Nothing in it is drawn by a model, so the letters and the logo stay exact.
 */

export const TRANSITIONS = [
  { id: 'burst', label: 'Patlama', hint: 'Renkli bir dalga ekranı kaplar, yeni mesaj altından çıkar' },
  { id: 'sweep', label: 'Işık süpürmesi', hint: 'Yazı çekilir, üstünden ışık geçer' },
  { id: 'slide', label: 'Kayarak', hint: 'Eski mesaj yukarı çıkar, yenisi alttan gelir' },
  { id: 'fade', label: 'Yumuşak', hint: 'Mesajlar birbirine karışarak değişir' },
] as const
export type TransitionId = (typeof TRANSITIONS)[number]['id']

export const REVEALS = [
  { id: 'letters', label: 'Harf harf' },
  { id: 'words', label: 'Kelime kelime' },
  { id: 'rise', label: 'Alttan yükselen' },
  { id: 'fade', label: 'Belirerek' },
] as const
export type RevealId = (typeof REVEALS)[number]['id']

export const TEXTURES = [
  { id: 'brush', label: 'Fırça dokulu' },
  { id: 'grain', label: 'İnce grenli' },
  { id: 'smooth', label: 'Düz' },
] as const
export type TextureId = (typeof TEXTURES)[number]['id']

export const EFFECTS = [
  { id: 'coins', label: 'Yağan coin' },
  { id: 'sparks', label: 'Parıltı' },
  { id: 'none', label: 'Yok' },
] as const
export type EffectId = (typeof EFFECTS)[number]['id']

/** `beat` is how long one message stays, in seconds. */
export const PACES = [
  { id: 'calm', label: 'Sakin', beat: 2.7 },
  { id: 'steady', label: 'Dengeli', beat: 2.0 },
  { id: 'quick', label: 'Hızlı', beat: 1.45 },
] as const
export type PaceId = (typeof PACES)[number]['id']

export const MOTION_FONTS = [
  { id: 'round', label: 'Yuvarlak', file: 'Baloo2-ExtraBold.ttf' },
  { id: 'block', label: 'Köşeli', file: 'Montserrat-Black.ttf' },
] as const
export type MotionFontId = (typeof MOTION_FONTS)[number]['id']

export type MotionLook = {
  transition: TransitionId
  reveal: RevealId
  texture: TextureId
  effect: EffectId
  pace: PaceId
  font: MotionFontId
  logoIntro: boolean
}

export const DEFAULT_LOOK: MotionLook = { transition: 'burst', reveal: 'letters', texture: 'brush', effect: 'coins', pace: 'steady', font: 'round', logoIntro: true }

/** `deep` and `mid` shade the backdrop, `text` is the copy, `accent` the highlighted words and the burst. */
export type MotionColors = { deep: string; mid: string; text: string; accent: string }
export const DEFAULT_COLORS: MotionColors = { deep: '#0a1836', mid: '#17418f', text: '#ffffff', accent: '#ffd23c' }

export type MotionScene = { text: string; logo: boolean; figure: boolean; effect: boolean }

export type MotionSpec = {
  width: number
  height: number
  fps: number
  seed: number
  brand: string
  look: MotionLook
  colors: MotionColors
  scenes: MotionScene[]
}

/** Frames are always drawn at this rate; a file too heavy for its limit is then given fewer of them. */
export const MOTION_FPS = 25
/** The heaviest file each quality may produce, in megabytes. Most ad slots refuse anything much larger. */
export const MOTION_WEIGHTS = [
  { id: 'sd', label: 'Hafif', hint: 'en fazla 3 MB', mb: 3 },
  { id: 'hd', label: 'Yüksek', hint: 'en fazla 8 MB', mb: 8 },
] as const
export type MotionWeight = (typeof MOTION_WEIGHTS)[number]['id']
export const toWeight = (value: unknown): MotionWeight => MOTION_WEIGHTS.find((w) => w.id === value)?.id ?? 'sd'
export const MAX_SCENES = 8
export const SIZE_RANGE = [40, 2400] as const
/** Past this many pixels a GIF of ten seconds stops being a file anyone can place; it is drawn smaller. */
const MAX_PIXELS = 640_000

export const MOTION_SIZES = [
  { id: '728x90', group: 'Yatay şerit' },
  { id: '468x60', group: 'Yatay şerit' },
  { id: '468x50', group: 'Yatay şerit' },
  { id: '400x60', group: 'Yatay şerit' },
  { id: '1000x100', group: 'Yatay şerit' },
  { id: '1000x50', group: 'Yatay şerit' },
  { id: '1200x90', group: 'Yatay şerit' },
  { id: '1550x100', group: 'Yatay şerit' },
  { id: '2000x160', group: 'Yatay şerit' },
  { id: '150x50', group: 'Yatay şerit' },
  { id: '300x250', group: 'Kutu' },
  { id: '1080x1080', group: 'Kutu' },
  { id: '1280x720', group: 'Kutu' },
  { id: '136x728', group: 'Dikey kule' },
  { id: '160x600', group: 'Dikey kule' },
  { id: '1080x1920', group: 'Dikey kule' },
] as const

export function parseSize(value: unknown): { width: number; height: number } | null {
  const match = /^\s*(\d{2,4})\s*[x×*]\s*(\d{2,4})\s*$/i.exec(String(value ?? ''))
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  const ok = (n: number) => n >= SIZE_RANGE[0] && n <= SIZE_RANGE[1]
  return ok(width) && ok(height) ? { width, height } : null
}

/** The size the frames are drawn at: the asked size, or a smaller one of the same shape. */
export function drawnSize(width: number, height: number) {
  const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (width * height)))
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2)
  return scale === 1 ? { width, height } : { width: even(width), height: even(height) }
}

const pick = <T extends { id: string }>(list: readonly T[], value: unknown, fallback: T['id']): T['id'] => list.find((item) => item.id === value)?.id ?? fallback

export function cleanLook(raw: unknown, base: MotionLook = DEFAULT_LOOK): MotionLook {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    transition: pick(TRANSITIONS, r.transition, base.transition),
    reveal: pick(REVEALS, r.reveal, base.reveal),
    texture: pick(TEXTURES, r.texture, base.texture),
    effect: pick(EFFECTS, r.effect, base.effect),
    pace: pick(PACES, r.pace, base.pace),
    font: pick(MOTION_FONTS, r.font, base.font),
    logoIntro: typeof r.logoIntro === 'boolean' ? r.logoIntro : base.logoIntro,
  }
}

const HEX = /^#[0-9a-f]{6}$/i
export const isHex = (value: unknown): value is string => typeof value === 'string' && HEX.test(value)

export function cleanColors(raw: unknown, base: MotionColors = DEFAULT_COLORS): MotionColors {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const take = (key: keyof MotionColors) => (isHex(r[key]) ? (r[key] as string).toLowerCase() : base[key])
  return { deep: take('deep'), mid: take('mid'), text: take('text'), accent: take('accent') }
}

export function cleanScenes(raw: unknown): MotionScene[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const r = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      const text = typeof r.text === 'string' ? r.text.replace(/\s+/g, ' ').trim().slice(0, 160) : ''
      return { text, logo: r.logo !== false, figure: r.figure === true, effect: r.effect === true }
    })
    .filter((scene) => scene.text.replace(/\*/g, '').trim().length > 0)
    .slice(0, MAX_SCENES)
}

export function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`

export function mix(a: string, b: string, share: number) {
  const [ar, ag, ab] = rgb(a)
  const [br, bg, bb] = rgb(b)
  return hex(ar + (br - ar) * share, ag + (bg - ag) * share, ab + (bb - ab) * share)
}

export function luminance(color: string) {
  const [r, g, b] = rgb(color).map((v) => v / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function saturation(color: string) {
  const [r, g, b] = rgb(color)
  const max = Math.max(r, g, b)
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max
}

function hueGap(a: string, b: string) {
  const hue = (color: string) => {
    const [r, g, b] = rgb(color).map((v) => v / 255)
    const max = Math.max(r, g, b)
    const d = max - Math.min(r, g, b)
    if (d === 0) return 0
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return (h * 60 + 360) % 360
  }
  const gap = Math.abs(hue(a) - hue(b))
  return Math.min(gap, 360 - gap)
}

/**
 * A backdrop and an accent out of a brand kit's colour list: the darkest colour carries the backdrop,
 * the liveliest colour of another hue the accent. A kit without usable colours keeps the defaults.
 */
export function brandColors(list: string[]): MotionColors {
  const colors = list.filter(isHex).map((c) => c.toLowerCase())
  if (!colors.length) return DEFAULT_COLORS
  const byDark = [...colors].sort((a, b) => luminance(a) - luminance(b))
  const base = byDark.find((c) => saturation(c) > 0.25) ?? byDark[0]
  const deep = luminance(base) > 0.08 ? mix(base, '#000000', Math.min(0.8, 0.45 + luminance(base))) : base
  const mid = luminance(base) > 0.3 ? mix(base, '#000000', 0.35) : mix(base, '#ffffff', luminance(base) < 0.06 ? 0.22 : 0.08)
  const lively = colors
    .filter((c) => c !== base && luminance(c) > 0.35 && saturation(c) > 0.45 && hueGap(c, base) > 40)
    .sort((a, b) => saturation(b) * luminance(b) - saturation(a) * luminance(a))[0]
  return { deep, mid, text: '#ffffff', accent: lively ?? DEFAULT_COLORS.accent }
}

/** A seeded generator: the same seed lays the same film out again, frame for frame. */
export function seeded(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1
  return () => {
    s = (s * 48271) % 2147483647
    return (s - 1) / 2147483646
  }
}
