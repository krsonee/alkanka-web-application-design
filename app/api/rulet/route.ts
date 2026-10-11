import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { liveState } from '@/lib/roulette-live'

export const dynamic = 'force-dynamic'

export async function GET() {
  const m = await getMember()
  return NextResponse.json(await liveState(m))
}
