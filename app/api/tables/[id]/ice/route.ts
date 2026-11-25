import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { opponentOf } from '@/lib/pvp/duel-channel'
import { mintIceServers } from '@/lib/turn'

export const dynamic = 'force-dynamic'

/** ICE servers for a duel's direct link; without the relay every frame falls back to the slow server path. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: room } = await params
  const m = await getMember()
  if (!m) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await opponentOf(`game:${room}`, m.id))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  return NextResponse.json(await mintIceServers(), { headers: { 'Cache-Control': 'no-store' } })
}
