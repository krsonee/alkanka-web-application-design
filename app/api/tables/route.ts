import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { listMyActiveTables, listOpenTables, sweepIdleTables, tableView } from '@/lib/pvp/tables'
import { myTournamentTables } from '@/lib/tournaments'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const game = new URL(req.url).searchParams.get('game') ?? undefined
  const m = await getMember()
  await sweepIdleTables().catch((e) => console.error('[tables] sweep failed', e))
  const [open, mine, tour] = await Promise.all([
    listOpenTables(game),
    m ? listMyActiveTables(m.id) : Promise.resolve([]),
    m ? myTournamentTables(m.id) : Promise.resolve([]),
  ])
  const strip = (t: ReturnType<typeof tableView>) => ({ ...t, state: null })
  return NextResponse.json({
    open: open.map((t) => strip(tableView(t, m?.id ?? null))),
    mine: mine.filter((t) => !t.tournamentId).map((t) => strip(tableView(t, m?.id ?? null))),
    tournament: tour,
  })
}
