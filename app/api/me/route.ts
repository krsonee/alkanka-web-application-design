import { NextResponse } from 'next/server'
import { getBalance, getMember } from '@/lib/member'
import { myMatches } from '@/lib/tournaments'

export const dynamic = 'force-dynamic'

export async function GET() {
  const member = await getMember()
  if (!member) return NextResponse.json({ member: null, balance: 0, matches: [] })
  const [balance, matches] = await Promise.all([
    getBalance(member.id),
    myMatches(member.id).catch((error) => {
      console.error('[me] turnuva maçları okunamadı', error)
      return []
    }),
  ])
  return NextResponse.json({ member: { id: member.id, name: member.name }, balance, matches })
}
