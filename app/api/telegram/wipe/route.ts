import { timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { getCronKey } from '@/lib/telegram-mirror'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function matches(key: string, secret: string) {
  const a = Buffer.from(key)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Self-chaining wipe runner: deletes for ~45s, then calls itself again while jobs remain,
 * so a full chat wipe finishes without anyone keeping the panel or site open.
 */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') ?? ''
  const cronKey = await getCronKey()
  if (!key || !matches(key, cronKey)) return Response.json({ error: 'Yetkisiz' }, { status: 401 })

  const { processWipes, listWipes } = await import('@/lib/tg-guard')
  await processWipes(45_000).catch((e) => console.error('[tg-wipe] run failed', e))
  const left = await listWipes()

  if (left.length) {
    const nextUrl = new URL('/api/telegram/wipe', req.url)
    nextUrl.searchParams.set('key', cronKey)
    after(() => fetch(nextUrl, { cache: 'no-store', signal: AbortSignal.timeout(4000) }).catch(() => null))
  }
  return Response.json({ running: left.map((w) => ({ title: w.title, left: w.left, total: w.total })) })
}
