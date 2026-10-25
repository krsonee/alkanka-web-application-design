import { headers } from 'next/headers'
import { after } from 'next/server'

/** Records the missing URL after the response is sent so the panel can offer a redirect. */
export async function NotFoundLogger() {
  const h = await headers()
  const path = h.get('x-alk-path')
  if (!path || !process.env.DATABASE_URL) return null
  const referrer = h.get('referer') ?? ''
  after(async () => {
    try {
      const { log404 } = await import('@/lib/seo-health')
      await log404(path, referrer)
    } catch {}
  })
  return null
}
