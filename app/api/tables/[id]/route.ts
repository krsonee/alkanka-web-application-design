import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { getTableRow, tableView } from '@/lib/pvp/tables'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [t, m] = await Promise.all([getTableRow(id), getMember()])
  if (!t) return NextResponse.json({ error: 'Masa bulunamadı.' }, { status: 404 })
  return NextResponse.json(tableView(t, m?.id ?? null))
}
