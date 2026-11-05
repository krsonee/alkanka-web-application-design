'use server'

import { pool } from '@/lib/db'
import { getMember } from '@/lib/member'

export type HeadRecord = { wins: number; draws: number; losses: number; goals: number; trophies: number }

const HEAD_GAMES = ['kafa-topu', 'kafa-basketbolu']

/** Trophy count is derived from the member's real match history, so it cannot drift from what was actually played. */
export async function getHeadRecord(): Promise<HeadRecord | null> {
  try {
    const m = await getMember()
    if (!m) return null
    const r = await pool.query<{ result: string; n: number; g: number }>(
      `SELECT result, count(*)::int AS n, coalesce(sum(score), 0)::int AS g
         FROM game_history WHERE user_id = $1 AND game = ANY($2::text[]) GROUP BY result`,
      [m.id, HEAD_GAMES],
    )
    const rec: HeadRecord = { wins: 0, draws: 0, losses: 0, goals: 0, trophies: 0 }
    for (const row of r.rows) {
      if (row.result === 'win') rec.wins = row.n
      else if (row.result === 'draw') rec.draws = row.n
      else rec.losses += row.n
      rec.goals += row.g
    }
    rec.trophies = Math.max(0, rec.wins * 30 + rec.draws * 10 - rec.losses * 12)
    return rec
  } catch {
    return null
  }
}
