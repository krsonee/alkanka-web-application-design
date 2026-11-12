import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/postlar', '/logolar', '/maskot', '/arena-onizleme', '/survival-onizleme', '/kankatv/onizleme', '/okey-onizleme', '/tavla-onizleme'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
