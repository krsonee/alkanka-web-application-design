import { after } from 'next/server'
import { getCemberStatus, sendUpcomingNotices } from '@/lib/cember'

export const dynamic = 'force-dynamic'

/** Public schedule poll; shared CDN caching keeps it to a few function calls per minute site-wide. */
export async function GET() {
  const status = await getCemberStatus().catch(() => null)
  // The poll doubles as the scheduler for the 3-minute heads-up; the DB claim keeps it to one send per round.
  after(() => sendUpcomingNotices().catch((e) => console.error('[cember] notice failed', e)))
  if (!status) return Response.json({ enabled: false }, { headers: { 'Cache-Control': 'public, s-maxage=30' } })
  return Response.json(status, { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=5' } })
}
