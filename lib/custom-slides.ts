import type { Slide } from '@/components/alkanka/data'

export const CUSTOM_SLIDES_KEY = 'slides:custom'
export const MAX_CUSTOM_SLIDES = 20

export function readCustomSlides(value: unknown): Slide[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (s): s is Slide => !!s && typeof s === 'object' && typeof (s as Slide).id === 'string' && (s as Slide).id.startsWith('c-'),
  )
}

export function isSafeHref(href: string) {
  return href.startsWith('/') ? !href.startsWith('//') : /^https:\/\//i.test(href)
}
