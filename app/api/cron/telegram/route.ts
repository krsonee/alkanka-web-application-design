import { timingSafeEqual } from 'node:crypto'
import { runMirror } from '@/lib/telegram-mirror'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const key = header ?? new URL(req.url).searchParams.get('key') ?? ''
  const a = Buffer.from(key)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Yetkisiz' }, { status: 401 })
  try {
    return Response.json(await runMirror())
  } catch (error) {
    console.error('[telegram] mirror run failed', error)
    return Response.json({ error: String((error as Error).message) }, { status: 500 })
  }
}
