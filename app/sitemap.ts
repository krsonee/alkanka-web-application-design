import type { MetadataRoute } from 'next'
import { listPosts } from '@/lib/blog'
import { latestDealByBrand, listDeals } from '@/lib/deals'
import { LANDING_PAGES } from '@/lib/landing-pages'
import { listProducts } from '@/lib/market'
import { recordPath } from '@/lib/record-links'
import { siteTournaments } from '@/lib/tournaments-site'
import { MEMBERS_ONLY_PATHS, PAGE_SEO, SITE_URL } from '@/lib/seo'
import { listPublicSponsors } from '@/lib/sites'
import { ARENA_GAMES, MINI_GAME_TITLES } from '@/lib/arena'
import { getArenaSettings } from '@/lib/arena-server'
import { getHidden } from '@/lib/catalog'
import { isHidden } from '@/lib/hidden-shared'
import { LEGAL_DEFAULTS } from '@/lib/legal-shared'

export const revalidate = 3600

const DAILY = new Set(['/'])

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, deals, sponsors, brandDates, tournaments, products, arena, hidden] = await Promise.all([
    listPosts().catch(() => []),
    listDeals(1).catch(() => []),
    listPublicSponsors().catch(() => []),
    latestDealByBrand(),
    siteTournaments().catch(() => []),
    listProducts().catch(() => []),
    getArenaSettings().catch(() => null),
    getHidden().catch(() => ({})),
  ])

  const latestDeal = deals[0] ? new Date(deals[0].createdAt) : undefined
  const latestPost = posts.reduce<Date | undefined>((acc, p) => {
    const d = new Date(p.updatedAt)
    return !acc || d > acc ? d : acc
  }, undefined)

  const lastModifiedFor = (path: string) => {
    if (path === '/rehber') return latestPost
    if (DAILY.has(path)) return latestDeal
    return undefined
  }

  const pages: MetadataRoute.Sitemap = Object.values(PAGE_SEO).filter((p) => !MEMBERS_ONLY_PATHS.has(p.path)).map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: lastModifiedFor(p.path),
    changeFrequency: DAILY.has(p.path) ? 'daily' : 'weekly',
    priority: p.path === '/' ? 1 : DAILY.has(p.path) ? 0.9 : 0.6,
  }))

  return [
    ...pages,
    ...ARENA_GAMES.filter((g) => arena?.[g].enabled ?? true).map((g) => ({ url: `${SITE_URL}/oyunlar/${g}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...Object.keys(MINI_GAME_TITLES)
      .filter((g) => !isHidden(hidden, 'mini', g))
      .map((g) => ({ url: `${SITE_URL}/oyunlar/${g}`, changeFrequency: 'weekly' as const, priority: 0.5 })),
    ...LEGAL_DEFAULTS.map((d) => ({ url: `${SITE_URL}/yasal/${d.slug}`, changeFrequency: 'yearly' as const, priority: 0.2 })),
    ...LANDING_PAGES.map((p) => ({ url: `${SITE_URL}/oyna/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.7 })),
    ...posts.map((p) => ({ url: `${SITE_URL}/rehber/${p.slug}`, lastModified: new Date(p.updatedAt), changeFrequency: 'monthly' as const, priority: 0.7 })),
    ...tournaments
      .filter((t) => t.status !== 'iptal')
      .map((t) => ({ url: `${SITE_URL}${recordPath('turnuva', t.id)}`, changeFrequency: t.status === 'bitti' ? ('monthly' as const) : ('daily' as const), priority: t.status === 'bitti' ? 0.3 : 0.6 })),
    ...products.map((p) => ({ url: `${SITE_URL}${recordPath('market', p.id)}`, changeFrequency: 'weekly' as const, priority: 0.4 })),
  ]
}
