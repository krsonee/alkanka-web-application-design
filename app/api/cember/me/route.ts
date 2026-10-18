import { getMember } from '@/lib/member'
import { myCemberStatus } from '@/lib/cember'

export const dynamic = 'force-dynamic'

export async function GET() {
  const member = await getMember().catch(() => null)
  const status = await myCemberStatus(member?.id ?? null).catch(() => ({ signedIn: !!member, userId: member?.id ?? null, eligible: false, progress: [] }))
  return Response.json(status, { headers: { 'Cache-Control': 'private, no-store' } })
}
