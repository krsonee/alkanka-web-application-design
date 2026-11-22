import { NextResponse } from 'next/server'
import { getMember, getMemberForRead } from '@/lib/member'
import { okeyBotDueMs } from '@/lib/pvp/rules'
import { notifyTable } from '@/lib/pvp/table-events'
import { enforceTurnClock, enterTournamentTable, getTableRow, kickIdlePlayers, pausedClock, tableView } from '@/lib/pvp/tables'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [row, reader] = await Promise.all([getTableRow(id), getMemberForRead()])
  if (!row) return NextResponse.json({ error: 'Masa bulunamadı.' }, { status: 404 })
  // An ordinary table poll only shows the asker their own seat, so the remembered sign-in is enough. A tournament
  // table seats whoever asks, which is a write: that one checks the session and the ban list every time.
  const m = row.tournamentId ? await getMember() : reader
  const kicked = await kickIdlePlayers(row).catch(() => false)
  const fresh = kicked ? ((await getTableRow(id)) ?? row) : row
  // A tournament table first seats whoever is asking and applies the deadline for sitting down.
  const seated = await enterTournamentTable(fresh, m?.id ?? null).catch((error) => {
    console.error('[tables] turnuva masası', error)
    return fresh
  })
  const t = await enforceTurnClock(seated)
  // A bot move, a forced move or a kick made by this poll reaches the other seats now, not on their next poll.
  if (kicked || t.version !== row.version || t.status !== row.status) await notifyTable(id, t.version)
  const view = tableView(t, m?.id ?? null)
  const clock = t.status === 'oynaniyor' ? await pausedClock(t.updatedAt) : { updatedAt: t.updatedAt, paused: false }
  const botDueMs = t.status === 'oynaniyor' && t.state ? okeyBotDueMs(t.state, t.updatedAt) : null
  return NextResponse.json({ ...view, ...clock, botDueMs })
}
