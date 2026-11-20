import { hashNetwork } from '@/lib/growth'
import { hitRateLimit } from '@/lib/rate-limit'
import { trackTourRun } from '@/lib/tour'

const MAX_BODY = 2000

/**
 * Receives one line per tour run (steps shown, where it was left), sent as a beacon so a closed tab
 * still counts. It only moves counters for steps that exist in the saved tour, a few times an hour
 * per network; nothing about the visitor is stored.
 */
export async function POST(request: Request) {
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') return new Response(null, { status: 204 })
  const text = await request.text().catch(() => '')
  if (!text || text.length > MAX_BODY) return new Response(null, { status: 204 })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return new Response(null, { status: 204 })
  }
  const ip = (request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))?.split(',')[0]?.trim() || null
  if (await hitRateLimit(`tourrun:${hashNetwork(ip) ?? 'yok'}`, 6, 3600)) return new Response(null, { status: 204 })
  await trackTourRun(body).catch((error) => console.error('[tour] sayım yazılamadı', error))
  return new Response(null, { status: 204 })
}
