import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { notifyTable } from '@/lib/pvp/table-events'
import { enforceTurnClock, getTableRow, kickIdlePlayers, pausedClock, tableView } from '@/lib/pvp/tables'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [row, m] = await Promise.all([getTableRow(id), getMember()])
  if (!row) return NextResponse.json({ error: 'Masa bulunamadı.' }, { status: 404 })
  const kicked = await kickIdlePlayers(row).catch(() => false)
  const fresh = kicked ? ((await getTableRow(id)) ?? row) : row
  const t = await enforceTurnClock(fresh)
  // A bot move, a forced move or a kick made by this poll reaches the other seats now, not on their next poll.
  if (kicked || t.version !== row.version || t.status !== row.status) await notifyTable(id, t.version)
  const view = tableView(t, m?.id ?? null)
  const clock = t.status === 'oynaniyor' ? await pausedClock(t.updatedAt) : { updatedAt: t.updatedAt, paused: false }
  return NextResponse.json({ ...view, ...clock })
}
