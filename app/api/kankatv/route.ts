import { getKankaTvData } from '@/lib/kankatv'

export const revalidate = 30

export async function GET() {
  const data = await getKankaTvData()
  return Response.json(data, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } })
}
