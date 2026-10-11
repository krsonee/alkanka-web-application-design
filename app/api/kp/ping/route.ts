import { getMember } from '@/lib/member'
import { pingActive } from '@/lib/kanka-puan'

export const dynamic = 'force-dynamic'

export async function POST() {
  const member = await getMember()
  if (!member) return Response.json({ ok: false }, { status: 401 })
  try {
    return Response.json({ ok: true, ...(await pingActive(member.id)) })
  } catch (error) {
    console.error('[kp-ping]', error)
    return Response.json({ ok: false }, { status: 500 })
  }
}
