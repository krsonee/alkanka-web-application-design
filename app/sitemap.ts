import type { MetadataRoute } from 'next'
import { listPosts } from '@/lib/blog'
import { listDeals } from '@/lib/deals'
import { PAGE_SEO, SITE_URL } from '@/lib/seo'
import { listPublicSponsors } from '@/lib/sites'

export const revalidate = 3600

const DAILY = new Set(['/', '/bonuslar', '/ozel-oranlar', '/kampanyalar'])

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, deals, sponsors] = await Promise.all([
    listPosts().catch(() => []),
    listDeals(1).catch(() => []),
    listPublicSponsors().catch(() => []),
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

  const pages: MetadataRoute.Sitemap = Object.values(PAGE_SEO).map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: lastModifiedFor(p.path),
    changeFrequency: DAILY.has(p.path) ? 'daily' : 'weekly',
    priority: p.path === '/' ? 1 : DAILY.has(p.path) ? 0.9 : 0.6,
  }))

  return [
    ...pages,
    ...['cark', 'sandik', 'zar'].map((g) => ({ url: `${SITE_URL}/oyunlar/${g}`, changeFrequency: 'weekly' as const, priority: 0.5 })),
    ...sponsors.map((s) => ({ url: `${SITE_URL}/siteler/${s.id}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...posts.map((p) => ({ url: `${SITE_URL}/rehber/${p.slug}`, lastModified: new Date(p.updatedAt), changeFrequency: 'monthly' as const, priority: 0.7 })),
  ]
}
