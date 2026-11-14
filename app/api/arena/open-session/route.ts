import { NextResponse, type NextRequest } from 'next/server'
import { getMember } from '@/lib/member'
import { findOpenBotSession } from '@/lib/solo-sessions'

export const dynamic = 'force-dynamic'

// A plain GET rather than a server action: actions run one at a time per page, so this check used to
// wait behind every other action fired on load while "Oyna" stayed locked.
export async function GET(req: NextRequest) {
  const member = await getMember()
  const game = req.nextUrl.searchParams.get('game') ?? ''
  const session = member ? await findOpenBotSession(member.id, game).catch(() => null) : null
  return NextResponse.json({ session }, { headers: { 'Cache-Control': 'no-store' } })
}
