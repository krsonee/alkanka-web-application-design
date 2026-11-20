export type StudioBrand = {
  id: number
  name: string
  domain: string
  logo: string
  logoUrl: string
  mascot: string
  mascotUrl: string
  colors: string[]
  font: string
  notes: string
}

export type StudioAsset = { id: number; provider: string; game: string; pathname: string; url: string }

export type StudioKind = 'banner' | 'sticker' | 'gif' | 'video' | 'tgsticker' | 'tgicon'

export const TELEGRAM_LIMITS = {
  sticker: { kb: 512, label: 'WEBP · 512x512 · en fazla 512 KB' },
  tgsticker: { kb: 256, label: 'WEBM VP9 · 512x512 · 3 sn · 30 fps · sessiz · en fazla 256 KB' },
  tgicon: { kb: 32, label: 'WEBP · 100x100 · en fazla 32 KB' },
} as const

/** Copy printed over a banner by the server with a real font, instead of being drawn by the model. */
export type StudioTexts = { headline: string; subline: string; cta: string }

export const EMPTY_TEXTS: StudioTexts = { headline: '', subline: '', cta: '' }
export const TEXT_LIMITS: Record<keyof StudioTexts, number> = { headline: 60, subline: 110, cta: 28 }

const tidy = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Normalizes overlay copy coming from the form or the database; null when every field is empty. */
export function cleanTexts(raw: unknown): StudioTexts | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const texts: StudioTexts = {
    headline: tidy(r.headline, TEXT_LIMITS.headline),
    subline: tidy(r.subline, TEXT_LIMITS.subline),
    cta: tidy(r.cta, TEXT_LIMITS.cta),
  }
  return texts.headline || texts.subline || texts.cta ? texts : null
}

export const sameTexts = (a: StudioTexts | null, b: StudioTexts | null) =>
  JSON.stringify(cleanTexts(a)) === JSON.stringify(cleanTexts(b))

export type StudioJob = {
  id: number
  brandId: number | null
  brandName: string
  kind: StudioKind
  format: string
  prompt: string
  url: string
  parentId: number | null
  cost: number
  createdAt: string
  texts: StudioTexts | null
  /** True when the text-free original is stored, so the copy can be changed without a new model call. */
  retextable: boolean
}

export const STUDIO_FORMATS = [
  { id: '1:1', label: 'Kare 1:1', hint: 'Gönderi' },
  { id: '9:16', label: 'Dikey 9:16', hint: 'Story / Reels' },
  { id: '16:9', label: 'Yatay 16:9', hint: 'Site banner' },
] as const

export const STUDIO_CATEGORIES = [
  'Casino promo',
  'Spor bahisi',
  'Slot / freespin',
  'Canlı casino',
  'Özel oran',
  'Promo kod',
  'Turnuva',
] as const

// Prices are the AI Gateway list prices for the models in studio-generate.ts and studio-animate.ts.
export const IMAGE_SIZES = [
  { id: '1K', label: 'Standart', hint: '1024 px', cost: 0.067 },
  { id: '2K', label: 'Yüksek', hint: '2048 px', cost: 0.101 },
] as const
export type ImageSize = (typeof IMAGE_SIZES)[number]['id']
export const DEFAULT_IMAGE_SIZE: ImageSize = '2K'
export const toImageSize = (value: unknown): ImageSize => IMAGE_SIZES.find((s) => s.id === value)?.id ?? DEFAULT_IMAGE_SIZE
export const imageCost = (size: ImageSize) => IMAGE_SIZES.find((s) => s.id === size)?.cost ?? IMAGE_SIZES[0].cost

export const usd = (n: number) => `$${n.toFixed(2)}`

export const STUDIO_CAP_RANGE = [1, 5000] as const
const CAP_WARN_SHARE = 0.8

export type BudgetLevel = 'none' | 'ok' | 'near' | 'full'

/** `left` is what paid jobs may still spend this month; null when no cap is set. */
export function budgetState(month: number, cap: number | null): { level: BudgetLevel; left: number | null; share: number } {
  if (cap == null) return { level: 'none', left: null, share: 0 }
  const left = Math.max(0, cap - month)
  const share = Math.min(1, month / cap)
  // Under the price of the cheapest picture nothing paid can start any more.
  const level = left < IMAGE_SIZES[0].cost ? 'full' : share >= CAP_WARN_SHARE ? 'near' : 'ok'
  return { level, left, share }
}

export const VIDEO_DURATIONS = [4, 6, 8] as const
export const VIDEO_COST_PER_SECOND = {
  hd: { silent: 0.05, audio: 0.08 },
  sd: { silent: 0.03, audio: 0.05 },
} as const
/** `hd` is a 1080p clip, otherwise 720p. */
export const videoCost = (seconds: number, audio: boolean, hd = true) =>
  seconds * VIDEO_COST_PER_SECOND[hd ? 'hd' : 'sd'][audio ? 'audio' : 'silent']

export const MOTION_QUALITIES = [
  { id: 'sd', label: 'Standart', hint: '720p' },
  { id: 'hd', label: 'Yüksek', hint: '1080p' },
] as const
export type MotionQuality = (typeof MOTION_QUALITIES)[number]['id']
export const toMotionQuality = (value: unknown, fallback: MotionQuality = 'sd'): MotionQuality =>
  MOTION_QUALITIES.find((q) => q.id === value)?.id ?? fallback

/** A GIF is a silent clip turned into frames, so it costs what that clip costs. */
export const GIF_DURATIONS = [4, 6] as const
export const gifCost = (seconds: number, quality: MotionQuality) => videoCost(seconds, false, quality === 'hd')

/** The shortest clip the video model makes; the sticker is cut down to Telegram's 3 seconds. */
export const STICKER_CLIP_SECONDS = 4
export const STICKER_MOTION_COST = videoCost(STICKER_CLIP_SECONDS, false, false)
