import { getChannels } from '@/lib/kankatv'
import { getMemberChannels } from '@/lib/member-streams'

export async function GET() {
  const [members, channels] = await Promise.all([getMemberChannels(), getChannels()])
  return Response.json([...members, ...channels], { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } })
}
