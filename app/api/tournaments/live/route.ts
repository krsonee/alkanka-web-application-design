import { NextResponse } from 'next/server'
import { siteTournaments } from '@/lib/tournaments-site'
import type { Tournament } from '@/lib/tournaments-shared'

export const dynamic = 'force-dynamic'

const MEMO_MS = 5_000
const SOON_MS = 10 * 60_000
let memo: { at: number; list: Tournament[] } | null = null

/**
 * The tournament list for the page that is otherwise served as static HTML. Every visitor gets the
 * same answer, so the CDN holds it for a few seconds and the database sees one read however many
 * people are watching. `?fresh` skips both caches for the member who has just joined or left.
 */
export async function GET(req: Request) {
  const fresh = new URL(req.url).searchParams.has('fresh')
  try {
    if (fresh || !memo || Date.now() - memo.at > MEMO_MS) memo = { at: Date.now(), list: await siteTournaments() }
  } catch (error) {
    console.error('[tournaments] canlı liste okunamadı', error)
    return NextResponse.json({ error: 'Turnuvalar okunamadı.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  const now = Date.now()
  const busy = memo.list.some((t) => t.status === 'basladi' || (t.status === 'kayit' && Date.parse(t.startsAt) - now < SOON_MS))
  const seconds = busy ? 5 : 30
  return NextResponse.json(
    { tournaments: memo.list },
    { headers: { 'Cache-Control': fresh ? 'no-store' : `public, s-maxage=${seconds}, stale-while-revalidate=${seconds}` } },
  )
}
