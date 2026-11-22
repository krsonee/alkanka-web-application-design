import { NextResponse } from 'next/server'
import { getMemberForRead } from '@/lib/member'
import { liveState } from '@/lib/roulette-live'

export const dynamic = 'force-dynamic'

export async function GET() {
  // The table state is read every few seconds; placing a bet goes through its own action and checks the session.
  const m = await getMemberForRead()
  return NextResponse.json(await liveState(m))
}
