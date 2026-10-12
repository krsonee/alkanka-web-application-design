export const SITE_BADGES = ['', 'Ana Sponsor', 'VIP'] as const

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
}

export type SponsorSite = Omit<SiteInput, 'id'> & {
  id: number
  clicks: number
  createdAt: string
}
