import { pool } from '@/lib/db'
import { FULL_POT_GAMES, isArenaGame } from '@/lib/arena'

/** Bot games whose result is reported by the browser and settled through a solo session. */
export const CLIENT_SETTLED = ['tavla', 'okey', 'bilardo', 'kafa-topu', 'kafa-basketbolu']
/** Every game whose bot wins count towards the shared daily bot profit ceiling. */
export const BOT_PROFIT_GAMES = CLIENT_SETTLED

/**
 * Today's net KC won from bots, measured against BOT_DAILY_PROFIT_CAP: the bot games above plus
 * full-pot tables where at least one bot seat was not paid for by a player who quit.
 */
export async function botProfitToday(userId: string) {
  const r = await pool.query<{ net: string | null }>(
    `SELECT sum(h.delta) AS net FROM game_history h
       LEFT JOIN game_tables g ON g.id = h.table_id
      WHERE h.user_id = $1
        AND h.created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')
        AND ((h.mode = 'bot' AND h.game = ANY($2::text[]))
          OR (h.game = ANY($3::text[])
              AND jsonb_array_length(jsonb_path_query_array(g.players, '$[*] ? (@.bot == true)')) > COALESCE((g.options->>'forfeits')::int, 0)))`,
    [userId, BOT_PROFIT_GAMES, FULL_POT_GAMES],
  )
  return Math.max(0, Number(r.rows[0]?.net ?? 0))
}

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
