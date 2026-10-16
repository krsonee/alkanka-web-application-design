import { winnersFeed } from '@/lib/online-rewards'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const items = await winnersFeed()
    return Response.json({ items }, { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' } })
  } catch (error) {
    console.error('[kp-feed]', error)
    return Response.json({ items: [] })
  }
}
