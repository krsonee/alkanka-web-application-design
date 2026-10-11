import { NextResponse } from 'next/server'
import { getBalance, getMember } from '@/lib/member'

export const dynamic = 'force-dynamic'

export async function GET() {
  const member = await getMember()
  if (!member) return NextResponse.json({ member: null, balance: 0 })
  return NextResponse.json({ member: { id: member.id, name: member.name }, balance: await getBalance(member.id) })
}
