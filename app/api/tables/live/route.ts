import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { listLiveTables, tableView } from '@/lib/pvp/tables'
import { getArenaSettings } from '@/lib/arena-server'
import { isArenaGame } from '@/lib/arena'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [m, live, settings] = await Promise.all([getMember(), listLiveTables(), getArenaSettings()])
  const open = live.filter((t) => !isArenaGame(t.game) || settings[t.game].enabled)
  return NextResponse.json({
    live: open.map((t) => ({ ...tableView(t, m?.id ?? null), state: null })),
  })
}
