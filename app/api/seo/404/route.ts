import { after } from 'next/server'
import { log404 } from '@/lib/seo-health'

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return new Response(null, { status: 204 })
  const data = (await request.json().catch(() => null)) as { path?: unknown; referrer?: unknown } | null
  const path = typeof data?.path === 'string' ? data.path : ''
  const referrer = typeof data?.referrer === 'string' ? data.referrer : ''
  if (path) {
    after(async () => {
      try {
        await log404(path, referrer)
      } catch {}
    })
  }
  return new Response(null, { status: 204 })
}
