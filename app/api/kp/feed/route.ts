import { tickerFeed } from '@/lib/online-rewards'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const feed = await tickerFeed()
    return Response.json(feed, { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' } })
  } catch (error) {
    console.error('[kp-feed]', error)
    return Response.json({ enabled: false, toast: false, items: [] })
  }
}
