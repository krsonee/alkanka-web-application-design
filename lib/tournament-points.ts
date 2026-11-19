import 'server-only'
import type { QueryResult } from 'pg'
import { pool } from '@/lib/db'
import type { PointRow } from './bracket'
import { LEAGUE_DRAW_POINTS, LEAGUE_WIN_POINTS, rankPoints } from './league'
import { SOURCE_MODES, type LeagueSettings } from './tournaments-shared'

type Queryable = { query: (text: string, params?: unknown[]) => Promise<QueryResult> }

/** What a points league counts: the tournament's game, between two moments, for its entrants. */
export type PointWindow = { id: number; game: string; from: Date; to: Date; league: Pick<LeagueSettings, 'source' | 'maxGames'> }

/**
 * Members who sat down at a table: the ones still seated, plus the ones a bot took over from when
 * they left. A table whose empty seats were filled by bots is logged as a member table like any other,
 * so this is what tells a game against another member from a game against bots only.
 */
const MEMBERS_AT_TABLE = `(
  (SELECT count(*) FROM jsonb_array_elements(g.players) p WHERE COALESCE(p->>'bot', 'false') <> 'true')
  + COALESCE((g.options->>'forfeits')::int, 0)
)`

/**
 * The league table of a points league, read from the entrants' own game history. Only the league's
 * own game counts, at tables of any size. Fees, prizes and tournament matches are logged under other
 * modes, so only ordinary finished games are counted. With the `pvp` source a game counts only when
 * another member sat at the table. With a game cap, a player's first games in the window count and
 * the later ones do not.
 * `order` is the registration order: it breaks ties and lists the entrants who have not played.
 */
export async function pointStandings(db: Queryable, w: PointWindow, order: string[]): Promise<PointRow[]> {
  const r = await db.query(
    `SELECT user_id,
            count(*)::int AS played,
            (count(*) FILTER (WHERE result = 'win'))::int AS wins,
            (count(*) FILTER (WHERE result = 'draw'))::int AS draws
     FROM (
       SELECT h.user_id, h.result, row_number() OVER (PARTITION BY h.user_id ORDER BY h.created_at, h.id) AS n
       FROM game_history h
       LEFT JOIN game_tables g ON g.id = h.table_id
       WHERE h.game = $2 AND h.mode = ANY($3::text[]) AND h.result IN ('win', 'loss', 'draw')
         AND h.created_at >= $4 AND h.created_at < $5
         AND h.user_id IN (SELECT user_id FROM tournament_entries WHERE tournament_id = $1 AND user_id IS NOT NULL)
         AND ($7::boolean OR ${MEMBERS_AT_TABLE} >= 2)
     ) g
     WHERE $6::int = 0 OR n <= $6::int
     GROUP BY user_id`,
    [w.id, w.game, SOURCE_MODES[w.league.source], w.from, w.to, w.league.maxGames, w.league.source !== 'pvp'],
  )
  const rows: PointRow[] = r.rows.map((x) => {
    const played = Number(x.played)
    const wins = Number(x.wins)
    const draws = Number(x.draws)
    return { key: String(x.user_id), played, wins, draws, losses: played - wins - draws, points: wins * LEAGUE_WIN_POINTS + draws * LEAGUE_DRAW_POINTS }
  })
  return rankPoints(rows, order)
}

const LIVE_MEMO_MS = 30_000
const live = new Map<number, { at: number; rows: PointRow[] }>()

/**
 * The same table for the tournament list. A league runs for days and its page is read by everyone,
 * so the answer is kept for half a minute: the history is read at most twice a minute per league.
 */
export async function livePointStandings(w: PointWindow, order: string[]): Promise<PointRow[]> {
  const kept = live.get(w.id)
  if (kept && Date.now() - kept.at < LIVE_MEMO_MS) return kept.rows
  const rows = await pointStandings(pool, w, order)
  live.set(w.id, { at: Date.now(), rows })
  return rows
}
