import { getMemberForRead } from '@/lib/member'
import { guestOnlineStatus, readOnlineStatus } from '@/lib/online-rewards'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const member = await getMemberForRead()
    return Response.json(member ? await readOnlineStatus(member.id) : await guestOnlineStatus(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[kp-online]', error)
    return Response.json({ error: 'unavailable' }, { status: 500 })
  }
}
