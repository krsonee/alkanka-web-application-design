import type { MetadataRoute } from 'next'
import { listPosts } from '@/lib/blog'
import { listDeals } from '@/lib/deals'
import { PAGE_SEO, SITE_URL } from '@/lib/seo'
import { SPONSORS } from '@/components/alkanka/data'

export const revalidate = 3600

const DAILY = new Set(['/', '/bonuslar', '/ozel-oranlar', '/kampanyalar', '/firsatlar'])

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const [posts, deals] = await Promise.all([listPosts(), listDeals(500)])

  const pages: MetadataRoute.Sitemap = Object.values(PAGE_SEO).map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: DAILY.has(p.path) ? 'daily' : 'weekly',
    priority: p.path === '/' ? 1 : DAILY.has(p.path) ? 0.9 : 0.6,
  }))

  return [
    ...pages,
    ...['cark', 'sandik', 'zar'].map((g) => ({ url: `${SITE_URL}/oyunlar/${g}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.5 })),
    ...SPONSORS.map((s) => ({ url: `${SITE_URL}/siteler/${s.id}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...posts.map((p) => ({ url: `${SITE_URL}/rehber/${p.slug}`, lastModified: new Date(p.updatedAt), changeFrequency: 'monthly' as const, priority: 0.7 })),
    ...deals.map((d) => ({ url: `${SITE_URL}/firsatlar/${d.slug}`, lastModified: new Date(d.createdAt), changeFrequency: 'never' as const, priority: 0.5 })),
  ]
}
