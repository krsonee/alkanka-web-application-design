import type { Slide } from '@/components/alkanka/data'

export const CUSTOM_SLIDES_KEY = 'slides:custom'
export const MAX_CUSTOM_SLIDES = 20

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
