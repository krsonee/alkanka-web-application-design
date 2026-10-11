import { NextResponse } from 'next/server'
import { getMember } from '@/lib/member'
import { listLiveTables, tableView } from '@/lib/pvp/tables'

export const dynamic = 'force-dynamic'

export async function GET() {
  const m = await getMember()
  const live = await listLiveTables()
  return NextResponse.json({
    live: live.map((t) => ({ ...tableView(t, m?.id ?? null), state: null })),
  })
}
