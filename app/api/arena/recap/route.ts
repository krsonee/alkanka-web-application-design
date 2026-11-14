import { NextResponse, type NextRequest } from 'next/server'
import { getMember } from '@/lib/member'
import { isArenaGame } from '@/lib/arena'
import { getMatchRecap } from '@/lib/match-recap'

export const dynamic = 'force-dynamic'

const TABLE_ID = /^[\w-]{1,64}$/

export async function GET(req: NextRequest) {
  const member = await getMember()
  const game = req.nextUrl.searchParams.get('game') ?? ''
  const table = req.nextUrl.searchParams.get('table') ?? ''
  const headers = { 'Cache-Control': 'no-store' }
  if (!member || !isArenaGame(game) || (table && !TABLE_ID.test(table))) return NextResponse.json({ recap: null }, { headers })
  const recap = await getMatchRecap(member.id, game, table || null).catch(() => null)
  return NextResponse.json({ recap }, { headers })
}
