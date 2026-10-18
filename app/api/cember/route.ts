import { getCemberStatus } from '@/lib/cember'

export const dynamic = 'force-dynamic'

/** Public schedule poll; shared CDN caching keeps it to a few function calls per minute site-wide. */
export async function GET() {
  const status = await getCemberStatus().catch(() => null)
  if (!status) return Response.json({ enabled: false }, { headers: { 'Cache-Control': 'public, s-maxage=30' } })
  return Response.json(status, { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=5' } })
}
