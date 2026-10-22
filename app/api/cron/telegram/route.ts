import { timingSafeEqual } from 'node:crypto'
import { getCronKey, runMirror } from '@/lib/telegram-mirror'
import { pollShareBot } from '@/lib/telegram-bots'
import { pollOddsBot } from '@/lib/special-odds'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function matches(key: string, secret: string | undefined) {
  if (!secret) return false
  const a = Buffer.from(key)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function authorized(req: Request) {
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const key = header ?? new URL(req.url).searchParams.get('key') ?? ''
  if (!key) return false
  return matches(key, process.env.CRON_SECRET) || matches(key, await getCronKey())
}

export async function GET(req: Request) {
  if (!(await authorized(req))) return Response.json({ error: 'Yetkisiz' }, { status: 401 })
  const { repairTelegram } = await import('@/lib/tg-health')
  const repairs = await repairTelegram().catch((error) => [`Onarım hatası: ${String((error as Error).message)}`])
  const share = await pollShareBot().catch((error) => ({ handled: 0, error: String((error as Error).message) }))
  const odds = await pollOddsBot().catch((error) => ({ handled: 0, error: String((error as Error).message) }))
  try {
    return Response.json({ ...(await runMirror()), share, odds, repairs })
  } catch (error) {
    console.error('[telegram] mirror run failed', error)
    return Response.json({ error: String((error as Error).message) }, { status: 500 })
  }
}
