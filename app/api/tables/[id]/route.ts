import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { enforceTurnClock, getTableRow, tableView } from '@/lib/pvp/tables'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [row, m] = await Promise.all([getTableRow(id), getMember()])
  if (!row) return NextResponse.json({ error: 'Masa bulunamadı.' }, { status: 404 })
  const t = await enforceTurnClock(row)
  return NextResponse.json(tableView(t, m?.id ?? null))
}
