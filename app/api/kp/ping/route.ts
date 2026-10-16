import { getMember } from '@/lib/member'
import { pingActive } from '@/lib/kanka-puan'
import { tickOnline } from '@/lib/online-rewards'

export const dynamic = 'force-dynamic'

export async function POST() {
  const member = await getMember()
  if (!member) return Response.json({ ok: false }, { status: 401 })
  try {
    const online = await tickOnline(member.id).catch((error) => {
      console.error('[kp-ping] online', error)
      return null
    })
    return Response.json({ ok: true, ...(await pingActive(member.id)), online })
  } catch (error) {
    console.error('[kp-ping]', error)
    return Response.json({ ok: false }, { status: 500 })
  }
}
