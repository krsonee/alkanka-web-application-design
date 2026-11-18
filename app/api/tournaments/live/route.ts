import { NextResponse } from 'next/server'
import { siteTournaments } from '@/lib/tournaments-site'
import { listPulse, type Tournament } from '@/lib/tournaments-shared'

export const dynamic = 'force-dynamic'

const FAST_MS = 5_000
const CALM_MS = 20_000
const SOON_MS = 10 * 60_000
let memo: { at: number; list: Tournament[]; fast: boolean } | null = null

/**
 * The tournament list for the page that is otherwise served as static HTML. Every visitor gets the
 * same answer, so the CDN holds it for a few seconds and the database sees one read however many
 * people are watching. `?fresh` skips both caches for the member who has just joined or left.
 * While nothing is being played (no tournament, or only a league waiting for its next day or counting
 * points) the answer is kept longer: a league runs for days and must not keep the database busy.
 */
export async function GET(req: Request) {
  const fresh = new URL(req.url).searchParams.has('fresh')
  try {
    if (fresh || !memo || Date.now() - memo.at > (memo.fast ? FAST_MS : CALM_MS)) {
      const list = await siteTournaments()
      memo = { at: Date.now(), list, fast: listPulse(list, Date.now(), SOON_MS) === 'fast' }
    }
  } catch (error) {
    console.error('[tournaments] canlı liste okunamadı', error)
    return NextResponse.json({ error: 'Turnuvalar okunamadı.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  const seconds = memo.fast ? 5 : 30
  return NextResponse.json(
    { tournaments: memo.list },
    { headers: { 'Cache-Control': fresh ? 'no-store' : `public, s-maxage=${seconds}, stale-while-revalidate=${seconds}` } },
  )
}
