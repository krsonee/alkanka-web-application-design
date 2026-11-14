import 'server-only'
import { rows, sql } from '@/lib/db'
import { getKpLevel } from '@/lib/kanka-puan'
import { completedTaskIds, listPublicTasks, taskProgress, visibleTasksFor } from '@/lib/tasks'

export type MatchRecap = {
  /** The settled match itself; null while the history row is not written yet (or for spectators). */
  kc: { delta: number; stake: number; result: string } | null
  kp: { earned: number; total: number; gamesLeftToday: number }
  level: { name: string; nextName: string | null; toNext: number; progress: number }
  task: { title: string; kind: string; progress: number; target: number; points: number; done: boolean } | null
}

const GAME_TASK_KINDS = new Set<string>(['game_play', 'game_win', 'games_distinct'])
const MAX_TASKS_CHECKED = 12

/** The open game task this member is closest to finishing, so the result card can say "2/3". */
async function nearestGameTask(userId: string, game: string): Promise<MatchRecap['task']> {
  const [all, done] = await Promise.all([listPublicTasks(), completedTaskIds(userId)])
  const doneIds = new Set(done)
  const view = visibleTasksFor(userId, all, doneIds)
  const open = view.tasks
    .filter((t) => GAME_TASK_KINDS.has(t.kind) && (!t.param || t.param === game) && !doneIds.has(t.id))
    .filter((t) => !view.chainState[t.id] || view.chainState[t.id] === 'current')
    .slice(0, MAX_TASKS_CHECKED)
  if (!open.length) return null
  const progress = await Promise.all(open.map((t) => taskProgress(userId, t).catch(() => 0)))
  const [top] = open
    .map((t, i) => ({ t, p: Math.min(progress[i], t.target) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p / b.t.target - a.p / a.t.target || a.t.target - b.t.target)
  if (!top) return null
  return { title: top.t.title, kind: top.t.kind, progress: top.p, target: top.t.target, points: top.t.points, done: top.p >= top.t.target }
}

/** What one finished match changed for the member: KC, Kanka Puanı, the nearest task and the next level. */
export async function getMatchRecap(userId: string, game: string, tableId: string | null): Promise<MatchRecap> {
  const [last, today, standing, task] = await Promise.all([
    rows<{ result: string; delta: string | number; stake: string | number }>(sql`SELECT result, delta, stake FROM game_history
      WHERE user_id = ${userId} AND game = ${game} AND mode NOT IN ('odul', 'harcama', 'admin')
        AND (${tableId}::text IS NULL OR table_id::text = ${tableId})
        AND created_at > now() - interval '15 minutes'
      ORDER BY created_at DESC LIMIT 1`).catch(() => []),
    rows<{ n: string | number }>(sql`SELECT count(*) AS n FROM game_history WHERE user_id = ${userId} AND mode <> 'odul'
      AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')`).catch(() => []),
    getKpLevel(userId),
    nearestGameTask(userId, game).catch(() => null),
  ])
  const row = last[0]
  const playedToday = Number(today[0]?.n ?? 0)
  const { kp, level, rules } = standing
  // Mirrors the KP query: each counted game is worth `rules.game` until the daily cap is reached.
  const earned = row && playedToday <= rules.gameDailyCap ? rules.game : 0
  return {
    kc: row ? { delta: Number(row.delta), stake: Number(row.stake), result: String(row.result) } : null,
    kp: { earned, total: kp, gamesLeftToday: Math.max(0, rules.gameDailyCap - playedToday) },
    level: {
      name: level.name,
      nextName: level.next?.name ?? null,
      toNext: level.next ? Math.max(0, level.next.min - kp) : 0,
      progress: level.progress,
    },
    task,
  }
}
