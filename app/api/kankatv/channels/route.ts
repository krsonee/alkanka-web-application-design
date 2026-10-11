import { getChannels } from '@/lib/kankatv'

export async function GET() {
  const channels = await getChannels()
  return Response.json(channels, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } })
}
