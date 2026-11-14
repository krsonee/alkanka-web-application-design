import { pool } from '@/lib/db'
import { isArenaGame } from '@/lib/arena'
import { credit } from '@/lib/member'

/** Bot games whose result is reported by the browser and settled through a solo session. */
export const CLIENT_SETTLED = ['tavla', 'bilardo', 'kafa-topu', 'kafa-basketbolu']
/** Okey against bots moved to server-run tables; sessions it left open are refunded instead of resumed. */
const RETIRED = ['okey']
/** Every game whose bot wins count towards the shared daily bot profit ceiling. */
export const BOT_PROFIT_GAMES = [...CLIENT_SETTLED, ...RETIRED]

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

/** Gives back the stake of a session that can no longer be resumed because its game left solo sessions. Returns the refunded total. */
export async function refundRetiredSessions(userId: string, game: string): Promise<number> {
  if (!RETIRED.includes(game)) return 0
  const r = await pool.query<{ stake: number }>(
    `UPDATE solo_sessions SET status = 'iptal'
      WHERE user_id = $1 AND game = $2 AND status = 'acik' AND tournament_id IS NULL AND created_at > now() - interval '3 hours'
      RETURNING stake`,
    [userId, game],
  )
  const total = r.rows.reduce((a, row) => a + Number(row.stake), 0)
  if (total > 0) await credit(userId, total)
  return total
}
