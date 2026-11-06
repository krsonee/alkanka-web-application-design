import { NextResponse } from 'next/server'
import { rows, sql } from '@/lib/db'
import { getMember } from '@/lib/member'

const clean = (name: unknown) =>
  String(name ?? '')
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .trim()
    .split(/\s+/)[0]
    ?.slice(0, 14) ?? ''

export async function GET() {
  const member = await getMember()
  let names: string[] = []
  try {
    const r = await rows<{ name: string | null }>(sql`
      SELECT u.name FROM public."user" u
      WHERE coalesce(u.name, '') <> ''
        AND NOT EXISTS (SELECT 1 FROM member_bans b WHERE b.user_id = u.id AND (b.until IS NULL OR b.until > now()))
      ORDER BY random() LIMIT 24`)
    names = [...new Set(r.map((x) => clean(x.name)).filter((n) => n.length >= 2))]
  } catch (error) {
    console.error('[chant-names] üye adları okunamadı', error)
  }
  return NextResponse.json(
    { me: member ? clean(member.name) : '', names },
    { headers: { 'Cache-Control': 'private, max-age=120' } },
  )
}
