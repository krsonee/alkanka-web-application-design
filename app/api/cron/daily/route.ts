import { timingSafeEqual } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { sendToUsers } from '@/lib/push'
import { getCronKey } from '@/lib/telegram-mirror'
import { trDay } from '@/lib/task-period'
import { autoStartDue } from '@/lib/tournaments'

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

/** Members who checked in yesterday but not yet today lose their streak at midnight, so nudge them once. */
async function remindStreaks() {
  const yesterday = trDay(new Date(Date.now() - 86400000))
  const due = await rows<{ user_id: string; streak: number }>(
    sql`SELECT user_id, streak FROM daily_checkins WHERE last_day = ${yesterday}::date AND streak >= 2`,
  ).catch(() => [])
  if (!due.length) return 0
  await sendToUsers(
    due.map((r) => r.user_id),
    { title: 'Serin bozulmak üzere kanka', body: 'Bugün giriş yap, günlük ödülünü al ve serini koru.', url: '/gorevler' },
  )
  return due.length
}

export async function GET(req: Request) {
  if (!(await authorized(req))) return Response.json({ error: 'Yetkisiz' }, { status: 401 })
  const [tournaments, reminders] = await Promise.allSettled([autoStartDue(), remindStreaks()])
  return Response.json({
    tournaments: tournaments.status === 'fulfilled' ? 'ok' : String(tournaments.reason),
    streakReminders: reminders.status === 'fulfilled' ? reminders.value : String(reminders.reason),
  })
}
