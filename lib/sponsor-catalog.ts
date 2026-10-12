import 'server-only'
import { cache } from 'react'
import { rows, sql } from '@/lib/db'
import type { Sponsor, SponsorTier } from '@/components/alkanka/data'

let ready: Promise<void> | null = null

/** Adds sponsor card columns without touching existing rows. */
export function ensureSiteColumns() {
  ready ??= (async () => {
    await rows(sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS perks text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS rating real NOT NULL DEFAULT 0`)
    await rows(sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS payout text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS bonus_type text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS wager_text text NOT NULL DEFAULT ''`)
    await rows(sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS bonus_code text NOT NULL DEFAULT ''`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

type SiteRow = {
  id: number
  name: string
  logo_url: string
  bonus_text: string
  badge: string
  featured: boolean
  sort_order: number
  tagline: string
  perks: string
  rating: number | string
  payout: string
  bonus_type: string
  wager_text: string
  bonus_code: string
}

export type CatalogSponsor = Sponsor & {
  logoUrl: string
  featured: boolean
  badge: string
  sortOrder: number
  bonusType: string
  wager: string
  bonusCode: string
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  const letters = parts.map((part) => part[0] ?? '').join('')
  return (letters || name.slice(0, 2)).toLocaleUpperCase('tr-TR')
}

export function tierOf(badge: string): SponsorTier {
  const value = badge.toLocaleLowerCase('tr-TR')
  if (value.includes('ana')) return 'ana'
  if (value.includes('vip')) return 'vip'
  return 'guvenilir'
}

function mapSite(row: SiteRow): CatalogSponsor {
  const perks = String(row.perks ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const badge = String(row.badge ?? '')
  const rating = Number(row.rating)
  return {
    id: String(row.id),
    name: String(row.name),
    initials: initialsOf(String(row.name)),
    tier: tierOf(badge),
    tagline: String(row.tagline ?? '').trim() || badge,
    welcome: String(row.bonus_text ?? '').trim(),
    perks: perks.length ? perks : badge ? [badge] : [],
    rating: Number.isFinite(rating) ? rating : 0,
    payout: String(row.payout ?? '').trim(),
    logoUrl: String(row.logo_url ?? '').trim(),
    featured: Boolean(row.featured),
    badge,
    sortOrder: Number(row.sort_order) || 0,
    bonusType: String(row.bonus_type ?? '').trim(),
    wager: String(row.wager_text ?? '').trim(),
    bonusCode: String(row.bonus_code ?? '').trim(),
  }
}

export const listCatalog = cache(async (): Promise<CatalogSponsor[]> => {
  await ensureSiteColumns()
  const list = await rows<SiteRow>(sql`SELECT id, name, logo_url, bonus_text, badge, featured, sort_order,
      tagline, perks, rating, payout, bonus_type, wager_text, bonus_code
    FROM sites WHERE active
    ORDER BY sort_order, id`)
  return list.map(mapSite)
})

export async function sponsorExists(id: string) {
  if (!/^\d+$/.test(id)) return false
  await ensureSiteColumns()
  const found = await rows(sql`SELECT 1 FROM sites WHERE id = ${Number(id)} AND active`)
  return found.length > 0
}

export async function siteName(id: string) {
  const all = await listCatalog()
  return all.find((site) => site.id === id)?.name ?? id
}

export async function siteNames() {
  const all = await listCatalog()
  return Object.fromEntries(all.map((site) => [site.id, site.name]))
}

/** Affiliate target stays on the server. Entry address wins, then the affiliate link. */
export async function sponsorTarget(id: string) {
  if (!/^\d+$/.test(id)) return null
  await ensureSiteColumns()
  const found = await rows<{ entry_url: string; url: string }>(sql`SELECT entry_url, url FROM sites WHERE id = ${Number(id)} AND active`)
  const entry = String(found[0]?.entry_url ?? '').trim()
  const url = String(found[0]?.url ?? '').trim()
  const pick = entry && entry !== '#' ? entry : url && url !== '#' ? url : ''
  if (!pick) return null
  try {
    const target = new URL(pick)
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return null
    return target.toString()
  } catch {
    return null
  }
}

export function pickFeatured(all: CatalogSponsor[]) {
  const main = all.find((site) => site.tier === 'ana') ?? all.find((site) => site.featured) ?? all[0] ?? null
  const highlighted = all.filter((site) => site.id !== main?.id && (site.featured || site.tier === 'vip'))
  const cards = (highlighted.length ? highlighted : all.filter((site) => site.id !== main?.id)).slice(0, 4)
  return { main, cards, total: all.length }
}

export type PublicBonus = {
  id: string
  sponsorId: string
  type: string
  title: string
  amount: string
  wager: string
  code?: string
}

export function bonusesFrom(all: CatalogSponsor[]): PublicBonus[] {
  return all
    .filter((site) => site.welcome)
    .map((site) => ({
      id: site.id,
      sponsorId: site.id,
      type: site.bonusType || 'Bonus',
      title: site.welcome,
      amount: site.welcome,
      wager: site.wager || '—',
      code: site.bonusCode || undefined,
    }))
}
