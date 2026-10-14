import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { blackjackLiveState } from '@/lib/blackjack-live'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const m = await getMember()
    return NextResponse.json(await blackjackLiveState(m))
  } catch (error) {
    console.error('[blackjack] state failed:', error)
    return NextResponse.json({ error: 'Masa yüklenemedi' }, { status: 500 })
  }
}
