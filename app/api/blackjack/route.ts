import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { blackjackLiveState } from '@/lib/blackjack-live'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const m = await getMember()
    const masa = Number(new URL(req.url).searchParams.get('masa'))
    return NextResponse.json(await blackjackLiveState(m, Number.isInteger(masa) && masa > 0 ? masa : null))
  } catch (error) {
    console.error('[blackjack] state failed:', error)
    return NextResponse.json({ error: 'Masa yüklenemedi' }, { status: 500 })
  }
}
