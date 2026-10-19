import { after } from 'next/server'
import { getScoreBoard, parseDay, parseSport } from '@/lib/kankatv'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const board = await getScoreBoard(parseSport(searchParams.get('sport')), parseDay(searchParams.get('day')))
  // Viewer polling doubles as the goal-alert heartbeat; the scanner throttles itself to once a minute.
  after(() =>
    import('@/lib/kankatv-engage')
      .then(({ scanGoals }) => scanGoals())
      .catch((error) => console.error('[kankatv:scan]', error)),
  )
  return Response.json(board, { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' } })
}
