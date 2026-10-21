import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureKp } from '@/lib/kanka-puan'
import { credit, getBalance } from '@/lib/member'
import { STREAK_DAYS, trDay } from '@/lib/task-period'

let ready: Promise<unknown> | null = null

function ensureCheckins() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS daily_checkins (
    user_id text PRIMARY KEY,
    last_day date NOT NULL,
    streak int NOT NULL DEFAULT 0,
    total int NOT NULL DEFAULT 0)`).catch((error) => {
    ready = null
    throw error
  })
  return ready
}

function yesterday(day: string) {
  return trDay(new Date(Date.parse(`${day}T12:00:00+03:00`) - 86400000))
}

export type StreakState = { streak: number; checkedToday: boolean }

export async function getStreak(userId: string): Promise<StreakState> {
  await ensureCheckins()
  const found = await rows<{ last_day: string; streak: number }>(sql`SELECT to_char(last_day, 'YYYY-MM-DD') AS last_day, streak FROM daily_checkins WHERE user_id = ${userId}`)
  const row = found[0]
  if (!row) return { streak: 0, checkedToday: false }
  const today = trDay()
  if (row.last_day === today) return { streak: Number(row.streak), checkedToday: true }
  if (row.last_day === yesterday(today)) return { streak: Number(row.streak) >= STREAK_DAYS.length ? 0 : Number(row.streak), checkedToday: false }
  return { streak: 0, checkedToday: false }
}

/** One claim per Turkey calendar day; the conditional upsert makes double clicks and parallel requests safe. */
export async function checkIn(userId: string): Promise<{ claimed: boolean; streak: number; reward: number; balance: number }> {
  await ensureCheckins()
  await ensureKp()
  const today = trDay()
  const prev = yesterday(today)
  const updated = await rows<{ streak: number }>(sql`INSERT INTO daily_checkins (user_id, last_day, streak, total)
    VALUES (${userId}, ${today}::date, 1, 1)
    ON CONFLICT (user_id) DO UPDATE SET
      streak = CASE WHEN daily_checkins.last_day = ${prev}::date AND daily_checkins.streak < ${STREAK_DAYS.length} THEN daily_checkins.streak + 1 ELSE 1 END,
      last_day = EXCLUDED.last_day,
      total = daily_checkins.total + 1
    WHERE daily_checkins.last_day < ${today}::date
    RETURNING streak`)
  if (!updated.length) {
    const state = await getStreak(userId)
    return { claimed: false, streak: state.streak, reward: 0, balance: await getBalance(userId) }
  }
  const streak = Number(updated[0].streak)
  const { boosted } = await import('@/lib/boosts')
  const reward = await boosted('giris', STREAK_DAYS[streak - 1]?.reward ?? STREAK_DAYS[0].reward)
  const inserted = await rows(sql`INSERT INTO kp_events (user_id, source, points, ref) VALUES (${userId}, 'giris', ${reward}, ${today}) ON CONFLICT DO NOTHING RETURNING id`)
  if (inserted.length) await credit(userId, reward)
  return { claimed: true, streak, reward, balance: await getBalance(userId) }
}
