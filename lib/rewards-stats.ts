import 'server-only'
import { rows, sql } from '@/lib/db'
import { EMPTY_MINI_STATS, MINI_GAME_IDS, STATS_DAYS, type MiniGameId, type MiniPlayStats } from '@/lib/rewards-forecast'

/** Plays and coins paid by the mini games in the last 7 days. One query, read when the rewards screen opens. */
export async function miniPlayStats(): Promise<MiniPlayStats> {
  const r = await rows<{ game: string; plays: string; paid: string; players: string }>(sql`
    SELECT game, count(*) AS plays, coalesce(sum(delta), 0) AS paid, count(DISTINCT user_id) AS players
    FROM game_history
    WHERE mode = 'odul' AND game IN ('cark', 'zar', 'sandik') AND created_at >= now() - ${`${STATS_DAYS} days`}::interval
    GROUP BY game`)
  const out: MiniPlayStats = { ...EMPTY_MINI_STATS }
  for (const row of r) {
    if (!MINI_GAME_IDS.includes(row.game as MiniGameId)) continue
    out[row.game as MiniGameId] = { plays: Number(row.plays), paid: Number(row.paid), players: Number(row.players) }
  }
  return out
}
