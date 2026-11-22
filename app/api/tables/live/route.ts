import { NextResponse } from 'next/server'
import { getMemberForRead } from '@/lib/member'
import { sharedRead } from '@/lib/shared-read'
import { listLiveTables, tableView } from '@/lib/pvp/tables'
import { getArenaSettings } from '@/lib/arena-server'
import { isArenaGame } from '@/lib/arena'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [m, live, settings] = await Promise.all([getMemberForRead(), sharedRead('live-tables', 1_000, listLiveTables), getArenaSettings()])
  const open = live.filter((t) => !isArenaGame(t.game) || settings[t.game].enabled)
  return NextResponse.json({
    live: open.map((t) => ({ ...tableView(t, m?.id ?? null), state: null })),
  })
}
