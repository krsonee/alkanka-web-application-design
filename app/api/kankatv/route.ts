import { getScoreBoard, parseDay, parseSport } from '@/lib/kankatv'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const board = await getScoreBoard(parseSport(searchParams.get('sport')), parseDay(searchParams.get('day')))
  return Response.json(board, { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' } })
}
