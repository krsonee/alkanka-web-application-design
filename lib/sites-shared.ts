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
}

export type SponsorSite = Omit<SiteInput, 'id'> & {
  id: number
  clicks: number
  createdAt: string
}
