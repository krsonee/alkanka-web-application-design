import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    // Members-only pages (sponsors, campaigns, odds, trust) are left crawlable on purpose: they carry
    // a noindex tag, and a crawler that is blocked here can never read it.
    // Click counters (/git, /r, /k, /l) only redirect; a crawler following them would be counted as a visitor.
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/git/', '/r/', '/k/', '/l/', '/postlar', '/logolar', '/maskot', '/arena-onizleme', '/survival-onizleme', '/kankatv/onizleme', '/okey-onizleme', '/tavla-onizleme'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
