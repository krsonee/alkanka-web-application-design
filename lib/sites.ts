import 'server-only'
import type { Sponsor, SponsorTier } from '@/components/alkanka/data'
import { rows, sql } from '@/lib/db'
import { SITE_BADGES, slugify, type SiteInput, type SponsorSite } from '@/lib/sites-shared'

export type { SiteInput, SponsorSite } from '@/lib/sites-shared'
export { SITE_BADGES, slugify } from '@/lib/sites-shared'

let ready: Promise<unknown> | null = null

export function ensureSites() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS sites (
      id serial PRIMARY KEY,
      name text NOT NULL,
      logo_url text NOT NULL DEFAULT '',
      bonus_text text NOT NULL DEFAULT '',
      url text NOT NULL DEFAULT '',
      entry_url text NOT NULL DEFAULT '',
      domain text NOT NULL DEFAULT '',
      badge text NOT NULL DEFAULT '',
      featured boolean NOT NULL DEFAULT false,
      active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      clicks integer NOT NULL DEFAULT 0,
      tagline text NOT NULL DEFAULT '',
      perks text NOT NULL DEFAULT '',
      rating real NOT NULL DEFAULT 0,
      payout text NOT NULL DEFAULT '',
      bonus_type text NOT NULL DEFAULT '',
      wager_text text NOT NULL DEFAULT '',
      bonus_code text NOT NULL DEFAULT '',
      slug text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS slug text`)
    await rows(sql`CREATE INDEX IF NOT EXISTS sites_sort_idx ON sites (sort_order, id)`)
    const missing = await rows<{ id: number; name: string }>(sql`SELECT id, name FROM sites WHERE slug IS NULL OR btrim(slug) = '' ORDER BY id`)
    for (const row of missing) {
      const slug = await uniqueSlug(slugify(row.name) || 'sponsor', Number(row.id))
      await rows(sql`UPDATE sites SET slug = ${slug} WHERE id = ${row.id}`)
    }
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS sites_slug_idx ON sites (slug)`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

async function uniqueSlug(base: string, exceptId: number | null) {
  const root = base || 'sponsor'
  let slug = root
  for (let n = 2; n < 1000; n += 1) {
    const taken = await rows<{ id: number }>(sql`SELECT id FROM sites WHERE slug = ${slug}`)
    if (!taken.some((row) => Number(row.id) !== exceptId)) return slug
    slug = `${root}-${n}`
  }
  throw new Error('Bu adres kısaltması kullanılıyor.')
}

type SiteRow = {
  id: number
  name: string
  logo_url: string
  bonus_text: string
  url: string
  entry_url: string
  domain: string
  badge: string
  featured: boolean
  active: boolean
  sort_order: number
  clicks: number
  tagline: string
  perks: string
  rating: number | string
  payout: string
  bonus_type: string
  wager_text: string
  bonus_code: string
  slug: string | null
  created_at: string | Date
}

function mapSite(row: SiteRow): SponsorSite {
  const rating = Number(row.rating)
  return {
    id: Number(row.id),
    name: row.name,
    logoUrl: row.logo_url,
    bonusText: row.bonus_text,
    url: row.url,
    entryUrl: row.entry_url,
    domain: row.domain,
    badge: row.badge,
    featured: row.featured,
    active: row.active,
    sortOrder: Number(row.sort_order) || 0,
    clicks: Number(row.clicks) || 0,
    tagline: row.tagline,
    perks: row.perks,
    rating: Number.isFinite(rating) ? rating : 0,
    payout: row.payout,
    bonusType: row.bonus_type,
    wagerText: row.wager_text,
    bonusCode: row.bonus_code,
    slug: String(row.slug ?? '').trim(),
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export type PublicSponsor = Sponsor & { featured: boolean }

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  const letters = parts.map((part) => part[0] ?? '').join('')
  return (letters || name.slice(0, 2)).toLocaleUpperCase('tr-TR')
}

export function tierOf(badge: string): SponsorTier {
  const value = badge.trim()
  if (value === SITE_BADGES[1]) return 'ana'
  if (value === SITE_BADGES[2]) return 'vip'
  return 'guvenilir'
}

export function toPublicSponsor(site: SponsorSite): PublicSponsor {
  const perks = site.perks.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  return {
    id: site.slug,
    name: site.name,
    initials: initialsOf(site.name),
    tier: tierOf(site.badge),
    tagline: site.tagline.trim() || site.badge || 'Sponsor',
    welcome: site.bonusText.trim(),
    perks: perks.length ? perks : site.badge ? [site.badge] : [],
    rating: site.rating,
    payout: site.payout.trim(),
    logoUrl: site.logoUrl.trim() || undefined,
    featured: site.featured,
  }
}

export async function listPublicSponsors(): Promise<PublicSponsor[]> {
  const all = await listSites()
  return all.filter((site) => site.active && site.slug).map(toPublicSponsor)
}

export function pickFeatured(all: PublicSponsor[]) {
  const main = all.find((site) => site.tier === 'ana') ?? all.find((site) => site.featured) ?? all[0] ?? null
  const highlighted = all.filter((site) => site.id !== main?.id && (site.featured || site.tier === 'vip'))
  const cards = (highlighted.length ? highlighted : all.filter((site) => site.id !== main?.id)).slice(0, 4)
  return { main, cards, total: all.length }
}

export type ResolvedSponsor = PublicSponsor & { recordId: string }

function hrefOf(entryUrl: string, url: string) {
  const entry = entryUrl.trim()
  const siteUrl = url.trim()
  const pick = entry && entry !== '#' ? entry : siteUrl && siteUrl !== '#' ? siteUrl : ''
  if (!pick) return null
  try {
    const target = new URL(pick)
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return null
    return target.toString()
  } catch {
    return null
  }
}

export async function resolvePublicSite(key: string): Promise<ResolvedSponsor | null> {
  const all = await listSites()
  const row = /^\d+$/.test(key)
    ? all.find((site) => String(site.id) === key) ?? all.find((site) => site.slug === key)
    : all.find((site) => site.slug === key)
  if (!row?.active || !row.slug) return null
  return { ...toPublicSponsor(row), recordId: String(row.id) }
}

export async function publicSiteById(key: string): Promise<ResolvedSponsor | null> {
  return resolvePublicSite(key)
}

/** Entry address wins, then the site address. Does not read site_links. */
export async function sponsorTarget(key: string): Promise<string | null> {
  const site = await resolvePublicSite(key)
  if (!site) return null
  const row = (await listSites()).find((item) => String(item.id) === site.recordId)
  return row ? hrefOf(row.entryUrl, row.url) : null
}

export async function listSites(): Promise<SponsorSite[]> {
  await ensureSites()
  const found = await rows<SiteRow>(sql`SELECT id, name, logo_url, bonus_text, url, entry_url, domain, badge, featured, active,
    sort_order, clicks, tagline, perks, rating, payout, bonus_type, wager_text, bonus_code, slug, created_at
    FROM sites ORDER BY sort_order, id`)
  return found.map(mapSite)
}

function clip(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

function httpsOrEmpty(value: string, label: string) {
  if (!value) return ''
  if (!/^https:\/\/[^\s"'<>]+$/.test(value)) throw new Error(`${label} https:// ile başlamalı.`)
  return value
}

function logoOf(value: string) {
  if (!value) return ''
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('..')) return value
  return httpsOrEmpty(value, 'Logo')
}

function domainOf(value: string) {
  const host = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!host) return ''
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) throw new Error('Alan adı örneği: ornek.com')
  return host
}

function clean(input: SiteInput): Omit<SiteInput, 'id' | 'slug'> {
  const name = clip(input.name, 80)
  if (!name) throw new Error('Sponsor adı gerekli.')
  const badge = clip(input.badge, 40)
  if (!SITE_BADGES.includes(badge as (typeof SITE_BADGES)[number])) throw new Error('Rozet Ana Sponsor, VIP veya güvenilir olmalı.')
  const sortOrder = Number(input.sortOrder)
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) throw new Error('Sıra 0 ile 10000 arasında tam sayı olmalı.')
  const rating = Number(input.rating)
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) throw new Error('Puan 0 ile 5 arasında olmalı.')
  return {
    name,
    logoUrl: logoOf(clip(input.logoUrl, 500)),
    bonusText: clip(input.bonusText, 200),
    url: httpsOrEmpty(clip(input.url, 500), 'Site adresi'),
    entryUrl: httpsOrEmpty(clip(input.entryUrl, 500), 'Giriş adresi'),
    domain: domainOf(clip(input.domain, 120)),
    badge,
    featured: Boolean(input.featured),
    active: Boolean(input.active),
    sortOrder,
    tagline: clip(input.tagline, 160),
    perks: clip(input.perks, 2000),
    rating: Math.round(rating * 10) / 10,
    payout: clip(input.payout, 40),
    bonusType: clip(input.bonusType, 40),
    wagerText: clip(input.wagerText, 80),
    bonusCode: clip(input.bonusCode, 40),
  }
}

export async function saveSite(input: SiteInput): Promise<number> {
  const site = clean(input)
  await ensureSites()
  const id = Number(input.id)
  const slug = await uniqueSlug(slugify(input.slug) || slugify(site.name) || 'sponsor', input.id ? id : null)
  if (input.id != null && input.id !== 0) {
    if (!Number.isInteger(id) || id < 1) throw new Error('Sponsor bulunamadı.')
    const updated = await rows<{ id: number }>(sql`UPDATE sites SET
      name = ${site.name},
      logo_url = ${site.logoUrl},
      bonus_text = ${site.bonusText},
      url = ${site.url},
      entry_url = ${site.entryUrl},
      domain = ${site.domain},
      badge = ${site.badge},
      featured = ${site.featured},
      active = ${site.active},
      sort_order = ${site.sortOrder},
      tagline = ${site.tagline},
      perks = ${site.perks},
      rating = ${site.rating},
      payout = ${site.payout},
      bonus_type = ${site.bonusType},
      wager_text = ${site.wagerText},
      bonus_code = ${site.bonusCode},
      slug = ${slug}
      WHERE id = ${id}
      RETURNING id`)
    if (!updated.length) throw new Error('Sponsor bulunamadı.')
    return id
  }
  const inserted = await rows<{ id: number }>(sql`INSERT INTO sites (
    name, logo_url, bonus_text, url, entry_url, domain, badge, featured, active, sort_order,
    tagline, perks, rating, payout, bonus_type, wager_text, bonus_code, slug)
    VALUES (
      ${site.name}, ${site.logoUrl}, ${site.bonusText}, ${site.url}, ${site.entryUrl}, ${site.domain}, ${site.badge},
      ${site.featured}, ${site.active}, ${site.sortOrder}, ${site.tagline}, ${site.perks}, ${site.rating}, ${site.payout},
      ${site.bonusType}, ${site.wagerText}, ${site.bonusCode}, ${slug})
    RETURNING id`)
  return Number(inserted[0]?.id)
}
