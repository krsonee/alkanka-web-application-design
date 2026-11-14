import { pool } from '@/lib/db'
import { isArenaGame } from '@/lib/arena'

/** Bot games whose result is reported by the browser and settled through a solo session. */
export const CLIENT_SETTLED = ['tavla', 'okey', 'bilardo', 'kafa-topu', 'kafa-basketbolu']

export type OpenBotSession = { sessionId: string; stake: number; started: boolean }

/** The member's still-open bot session for this game, so a page refresh resumes it instead of losing the stake. */
export async function findOpenBotSession(userId: string, game: string): Promise<OpenBotSession | null> {
  if (!isArenaGame(game) || !CLIENT_SETTLED.includes(game)) return null
  const r = await pool.query(
    `SELECT id, stake, state->>'started' AS started FROM solo_sessions
      WHERE user_id = $1 AND game = $2 AND status = 'acik' AND created_at > now() - interval '3 hours'
      ORDER BY created_at DESC LIMIT 1`,
    [userId, game],
  )
  const row = r.rows[0]
  return row ? { sessionId: String(row.id), stake: Number(row.stake), started: row.started === 'true' } : null
}
