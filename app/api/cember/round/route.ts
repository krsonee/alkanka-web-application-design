import { getRound } from '@/lib/cember'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const slot = new URL(req.url).searchParams.get('slot') ?? ''
  const result = await getRound(slot).catch(() => ({ state: 'none' as const }))
  // A settled round never changes, so the CDN can serve every viewer after the first request.
  const cache = result.state === 'ready' ? 'public, s-maxage=86400, immutable' : 'no-store'
  return Response.json(result, { headers: { 'Cache-Control': cache } })
}
