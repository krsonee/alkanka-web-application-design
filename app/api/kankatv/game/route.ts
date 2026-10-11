import { getMatchDetail } from '@/lib/kankatv'

export async function GET(request: Request) {
  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: 'Geçersiz maç' }, { status: 400 })
  const detail = await getMatchDetail(id)
  return Response.json(detail, { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' } })
}
