import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { getInviteConfig, inviteWaitSeconds } from '@/lib/table-invite'

export const dynamic = 'force-dynamic'

export async function GET() {
  const m = await getMember()
  if (!m) return NextResponse.json({ enabled: false, wait: 0 })
  const [config, wait] = await Promise.all([getInviteConfig(), inviteWaitSeconds(m.id)])
  return NextResponse.json({ enabled: config != null, wait })
}
