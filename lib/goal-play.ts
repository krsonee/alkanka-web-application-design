import 'server-only'
import { rows, sql } from '@/lib/db'
import type { GoalRule } from '@/lib/goal-rewards-shared'
import { TASK_GAMES } from '@/lib/task-kinds'
import { trDayBounds } from '@/lib/tr-time'

let ready: Promise<unknown> | null = null

/**
 * Minutes a member spent on a game's page, one row per member, Turkey day and game. `play_gate` holds
 * when each member was last credited a minute, in any game.
 */
export function ensurePlay() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS play_minutes (
      user_id text NOT NULL, day date NOT NULL, game text NOT NULL, minutes int NOT NULL DEFAULT 0,
      last_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, day, game))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS play_gate (user_id text PRIMARY KEY, last_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const GAMES = new Set(TASK_GAMES.map((g) => g.value))

const WANTED_FOR_MS = 5 * 60_000
let wanted: { at: number; value: boolean } | null = null

/**
 * Minutes are only written while some running event actually asks for them: without such an event
 * the minute ping costs the database nothing extra.
 */
async function minutesWanted() {
  const now = Date.now()
  if (wanted && now - wanted.at < WANTED_FOR_MS) return wanted.value
  const found = await rows(sql`SELECT 1 FROM goal_events e WHERE e.active AND e.category = 'alkanka' AND e.rules @> '[{"kind":"minutes"}]'::jsonb
      AND EXISTS (SELECT 1 FROM goal_matches m WHERE m.event_id = e.id AND m.status = 'open' AND m.kickoff > now() - interval '2 days') LIMIT 1`).catch(() => [])
  wanted = { at: now, value: found.length > 0 }
  return wanted.value
}

/**
 * Counts one minute for the game whose page the member has open. Rides on the minute ping every member
 * already sends. A member is credited at most one minute per 50 seconds across all games, so several
 * open tabs or a hurried ping add nothing. The member's gate row decides it: pings arriving at the same
 * moment queue on that row, and only the first one finds it old enough.
 */
export async function notePlayMinute(userId: string, game: unknown) {
  if (typeof game !== 'string' || !GAMES.has(game)) return
  if (!(await minutesWanted())) return
  await ensurePlay()
  await rows(sql`WITH gate AS (
      INSERT INTO play_gate (user_id, last_at) VALUES (${userId}::text, now())
      ON CONFLICT (user_id) DO UPDATE SET last_at = now() WHERE play_gate.last_at <= now() - interval '50 seconds'
      RETURNING user_id)
    INSERT INTO play_minutes (user_id, day, game, minutes, last_at)
    SELECT gate.user_id, (now() AT TIME ZONE 'Europe/Istanbul')::date, ${game}::text, 1, now() FROM gate
    ON CONFLICT (user_id, day, game) DO UPDATE SET minutes = play_minutes.minutes + 1, last_at = now()`)
}

/**
 * How much of each condition every listed member did on one Turkey day. One query per condition,
 * however many members are asked about. A member with nothing done is simply missing from the map.
 */
export async function ruleDoneFor(userIds: string[], rules: GoalRule[], day: string): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>()
  const ids = [...new Set(userIds)]
  if (ids.length === 0 || rules.length === 0) return out
  const list = JSON.stringify(ids)
  const { start, end } = trDayBounds(day)
  const put = (found: Record<string, unknown>[], index: number) => {
    for (const x of found) {
      const key = String(x.user_id)
      const done = out.get(key) ?? rules.map(() => 0)
      done[index] = Number(x.n)
      out.set(key, done)
    }
  }
  for (const [index, rule] of rules.entries()) {
    if (rule.kind === 'minutes') {
      await ensurePlay()
      put(
        await rows(sql`SELECT user_id, sum(minutes) AS n FROM play_minutes
          WHERE user_id IN (SELECT jsonb_array_elements_text(${list}::jsonb)) AND day = ${day}::date AND (${rule.game} = '' OR game = ${rule.game})
          GROUP BY user_id`),
        index,
      )
      continue
    }
    if (rule.kind === 'task') {
      // Tasks the member finished and was credited for on that day; a claim still waiting for staff does not count yet.
      const { ensureTasks } = await import('@/lib/tasks')
      await ensureTasks()
      put(
        await rows(sql`SELECT user_id, count(*) AS n FROM task_claims
          WHERE user_id IN (SELECT jsonb_array_elements_text(${list}::jsonb)) AND status = 'onaylandi' AND created_at >= ${start} AND created_at < ${end}
          GROUP BY user_id`),
        index,
      )
      continue
    }
    // Finished table and bot matches only: prizes, fees, staff entries and refunded matches are not games played.
    put(
      await rows(sql`SELECT user_id, count(*) AS n FROM game_history
        WHERE user_id IN (SELECT jsonb_array_elements_text(${list}::jsonb)) AND created_at >= ${start} AND created_at < ${end}
          AND mode NOT IN ('odul', 'harcama', 'admin') AND game <> 'turnuva' AND result <> 'refund'
          AND to_jsonb(game_history) ->> 'quit' IS DISTINCT FROM 'true'
          AND (${rule.kind === 'win'}::boolean IS FALSE OR result = 'win') AND (${rule.game} = '' OR game = ${rule.game})
        GROUP BY user_id`),
      index,
    )
  }
  return out
}
