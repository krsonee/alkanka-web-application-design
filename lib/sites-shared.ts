export const SITE_BADGES = ['Ana Sponsor', 'Elit Sponsor', 'VIP', '', 'Sponsor Değil'] as const

const TURKISH: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  I: 'i',
  İ: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
  â: 'a',
  Â: 'a',
  î: 'i',
  Î: 'i',
  û: 'u',
  Û: 'u',
}

/** "Makro Bet" → makro-bet, "Şans Çarkı" → sans-carki. */
export function slugify(value: string) {
  const mapped = [...value.trim()].map((char) => TURKISH[char] ?? char).join('')
  return mapped
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export const SLUG_LETTER_ERROR = 'Adres en az bir harf içermeli'

/** Typed shortcut, otherwise the name. Empty input still falls back to the name. */
export function publicSlug(raw: string, name: string) {
  return slugify(raw) || slugify(name) || 'sponsor'
}

export function slugHasLetter(slug: string) {
  return /[a-z]/.test(slug)
}

export type SiteInput = {
  id: number | null
  name: string
  logoUrl: string
  bonusText: string
  url: string
  entryUrl: string
  domain: string
  badge: string
  featured: boolean
  active: boolean
  sortOrder: number
  tagline: string
  perks: string
  rating: number
  payout: string
  bonusType: string
  wagerText: string
  bonusCode: string
  slug: string
  /** YYYY-MM-DD, or empty when the deal has no end date. */
  dealEnds: string
  /** Monthly fee the sponsor pays, in TL. 0 when not entered. */
  dealFee: number
}

export type SponsorSite = Omit<SiteInput, 'id'> & {
  id: number
  clicks: number
  createdAt: string
}

export const DEAL_WARN_DAYS = 14

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export function istanbulToday(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
}

/** A real calendar day written as YYYY-MM-DD. */
export function isCalendarDay(value: string) {
  if (!DAY_RE.test(value)) return false
  const ms = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value
}

/** Whole days from `today` to the deal's last day; null when no end date is set. Negative once it has passed. */
export function dealDaysLeft(dealEnds: string, today: string) {
  if (!isCalendarDay(dealEnds) || !isCalendarDay(today)) return null
  return Math.round((Date.parse(`${dealEnds}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

export function dealLabel(days: number) {
  if (days < 0) return `Anlaşma ${-days} gün önce bitti`
  if (days === 0) return 'Anlaşma bugün bitiyor'
  return `Anlaşma ${days} gün sonra bitiyor`
}

export type LinkState = 'ok' | 'redirect' | 'blocked' | 'down' | 'timeout' | 'none'

export type LinkCheck = {
  id: number
  name: string
  target: string | null
  state: LinkState
  code: number | null
  ms: number | null
  note: string
}
