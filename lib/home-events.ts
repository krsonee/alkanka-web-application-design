import 'server-only'
import { pool } from '@/lib/db'
import { sharedRead } from '@/lib/shared-read'

export type HomeTournament = {
  id: number
  game: string
  title: string
  prizePool: number
  entryFee: number
  maxPlayers: number
  players: number
  startsAt: string
  running: boolean
}

const FRESH_MS = 60_000
const SHOWN = 3

type Row = {
  id: number
  game: string
  title: string
  prize_pool: string | number
  entry_fee: string | number
  max_players: number
  players: number
  starts_at: Date
  status: string
}

/**
 * The tournaments the home page points at: open for sign-up or being played.
 *
 * The full tournament list reads three tables and moves the tournament clock; the home page only needs a line per
 * tournament, so this is one query, shared by every visitor of a server for a minute.
 */
export function homeTournaments(): Promise<HomeTournament[]> {
  return sharedRead('home-tournaments', FRESH_MS, async () => {
    const found = await pool.query<Row>(
      `SELECT t.id, t.game, t.title, t.prize_pool, t.entry_fee, t.max_players, t.starts_at, t.status,
              (SELECT count(*)::int FROM tournament_entries e WHERE e.tournament_id = t.id) AS players
         FROM tournaments t
        WHERE t.status IN ('kayit', 'basladi')
        ORDER BY CASE t.status WHEN 'basladi' THEN 0 ELSE 1 END, t.starts_at ASC
        LIMIT ${SHOWN}`,
    )
    return found.rows.map((r) => ({
      id: Number(r.id),
      game: r.game,
      title: r.title,
      prizePool: Number(r.prize_pool) || 0,
      entryFee: Number(r.entry_fee) || 0,
      maxPlayers: Number(r.max_players) || 0,
      players: Number(r.players) || 0,
      startsAt: new Date(r.starts_at).toISOString(),
      running: r.status === 'basladi',
    }))
  }).catch(() => [])
}
