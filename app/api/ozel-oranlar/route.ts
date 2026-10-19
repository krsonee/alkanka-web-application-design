import { dayStats, listOddsByDay } from '@/lib/special-odds'
import { istanbulDay, isDay } from '@/lib/special-odds-shared'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('day') ?? ''
  const today = istanbulDay()
  const day = isDay(requested) && requested <= today ? requested : today
  const odds = await listOddsByDay(day)
  return Response.json(
    { day, odds, stats: dayStats(odds) },
    { headers: { 'cache-control': day === today ? 'public, s-maxage=10, stale-while-revalidate=20' : 'public, s-maxage=300' } },
  )
}
