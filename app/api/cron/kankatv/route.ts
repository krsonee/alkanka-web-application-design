import { timingSafeEqual } from 'node:crypto'
import { getCronKey } from '@/lib/telegram-mirror'
import { scanGoals, settlePredictions } from '@/lib/kankatv-engage'
import { syncBets } from '@/lib/tv-bets'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function matches(key: string, secret: string | undefined) {
  if (!secret) return false
  const a = Buffer.from(key)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Ping every minute (e.g. cron-job.org) so goal alerts and prediction payouts run even with no viewers online. */
export async function GET(req: Request) {
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const key = header ?? new URL(req.url).searchParams.get('key') ?? ''
  if (!key || !(matches(key, process.env.CRON_SECRET) || matches(key, await getCronKey()))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const [scan, settled, bets] = await Promise.all([
    scanGoals(),
    settlePredictions({ limit: 100 }),
    syncBets().catch((e: Error) => ({ error: e.message })),
  ])
  return Response.json({ ok: true, scan, settled, bets })
}
