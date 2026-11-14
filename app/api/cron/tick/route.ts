import { runAutoTick } from '@/lib/auto-tick'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Called every minute by the Vercel scheduler (vercel.json). It needs no key on purpose: it only
 * starts the same slot-limited jobs any page view already starts, and it returns no data.
 */
export async function GET() {
  await runAutoTick({ force: true })
  return Response.json({ ok: true })
}
