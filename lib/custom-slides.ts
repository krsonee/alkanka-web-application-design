import { SLIDES, type Slide } from '@/components/alkanka/data'
import { isScheduledLive } from '@/lib/schedule'

export const CUSTOM_SLIDES_KEY = 'slides:custom'
export const MAX_CUSTOM_SLIDES = 20
/** The home slider turns at most this many slides, whichever design is on. */
export const MAX_HOME_SLIDES = 12

export function readCustomSlides(value: unknown): Slide[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (s): s is Slide => !!s && typeof s === 'object' && typeof (s as Slide).id === 'string' && (s as Slide).id.startsWith('c-'),
  )
}

export const SLIDE_ORDER_KEY = 'slides:order'

export function readSlideOrder(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, 100) : []
}

export function sortByOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (!order.length) return items
  const rank = new Map(order.map((id, i) => [id, i]))
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => (rank.get(a.item.id) ?? 1000 + a.i) - (rank.get(b.item.id) ?? 1000 + b.i))
    .map((x) => x.item)
}

export function isSafeHref(href: string) {
  return href.startsWith('/') ? !href.startsWith('//') : /^https:\/\//i.test(href)
}

/** What the panel saved on top of a ready-made slide. */
export type SlideSaved = {
  eyebrow?: string
  title?: string
  description?: string
  cta?: string
  image?: string
  mobileImage?: string
  href?: string
  plain?: boolean
  startAt?: string
  endAt?: string
}

/**
 * How a slide is drawn. `plain`: the picture alone, whole and clean. `text`: the picture with this slide's own
 * words over it. `cover`: a game slide nobody wrote words for, which takes the page's own cover copy.
 */
export type SlideLook = 'cover' | 'text' | 'plain'

export type HomeSlide = Slide & {
  look: SlideLook
  /** "okey" for the ready-made game slide "g-okey", null for every other slide. */
  game: string | null
  custom: boolean
  /** The ready-made promo slides belong to the old design; they join the new one once they have been saved. */
  inNewDesign: boolean
}

const TEXT_KEYS = ['eyebrow', 'title', 'description', 'cta'] as const
const COPIED_KEYS = [...TEXT_KEYS, 'image', 'mobileImage', 'href', 'startAt', 'endAt'] as const
const filled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

export const slideGame = (id: string) => (id.startsWith('g-') ? id.slice(2) : null)

export function resolveSlide(base: Slide, saved?: SlideSaved | null): HomeSlide {
  const custom = base.id.startsWith('c-')
  const s: SlideSaved = saved && typeof saved === 'object' ? saved : {}
  const typed = TEXT_KEYS.some((k) => filled(s[k]))
  const ownImage = filled(s.image) && s.image !== base.image
  // Saved before slides could be marked: a replaced picture with every text left empty is a banner of its own,
  // because the ready-made words were written for the ready-made picture.
  const plain = custom ? base.plain === true : typeof s.plain === 'boolean' ? s.plain : ownImage && !typed
  const merged: Slide = { ...base }
  for (const k of COPIED_KEYS) {
    const value = s[k]
    if (filled(value)) merged[k] = value
  }
  const game = slideGame(base.id)
  const touched = typed || ownImage || filled(s.mobileImage) || filled(s.href) || typeof s.plain === 'boolean'
  return {
    ...merged,
    plain,
    look: plain ? 'plain' : game && !typed ? 'cover' : 'text',
    game,
    custom,
    inNewDesign: custom || !!game || touched,
  }
}

/** Every slide the panel lists, in the panel's order. */
export function listSlides(content: Record<string, unknown>): HomeSlide[] {
  const ready = SLIDES.map((slide) => resolveSlide(slide, content[`slide:${slide.id}`] as SlideSaved | undefined))
  const custom = readCustomSlides(content[CUSTOM_SLIDES_KEY]).map((slide) => resolveSlide(slide))
  return sortByOrder([...ready, ...custom], readSlideOrder(content[SLIDE_ORDER_KEY]))
}

/** The slides a visitor can see right now: not hidden, inside their dates. */
export function liveSlides(content: Record<string, unknown>, hiddenIds: string[] = [], now = Date.now()): HomeSlide[] {
  const hidden = new Set(hiddenIds)
  return listSlides(content).filter((slide) => !hidden.has(slide.id) && isScheduledLive(slide, now))
}
