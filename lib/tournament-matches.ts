import 'server-only'
import { pool } from '@/lib/db'
import { roundName, type MatchEnd, type MatchRecord } from './tournaments-shared'

type Seat = { id: string; name: string; bot?: boolean }
type Leaver = { id: string; name: string; how?: string }

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null)

/**
 * Every table a tournament has opened, first round first. The tables themselves are the record:
 * who was named, who sat down, how it closed and when. The board is not read, so a long tournament stays a light query.
 */
export async function listTournamentMatches(id: number): Promise<MatchRecord[]> {
  const t = await pool.query(
    `SELECT format, jsonb_array_length(COALESCE(bracket->'rounds', '[]'::jsonb)) AS rounds FROM tournaments WHERE id = $1`,
    [id],
  )
  if (!t.rows[0]) return []
  const league = t.rows[0].format === 'lig'
  const rounds = Number(t.rows[0].rounds)
  const r = await pool.query(
    `SELECT id, round_no, match_no, status, seats, players, winner_id, version, created_at, updated_at,
            options->'seen' AS seen, options->'out' AS gone, options->'winners' AS winners, options->>'how' AS how,
            options->'tour'->>'joinBy' AS join_by, options->'ready' AS ready
     FROM game_tables WHERE tournament_id = $1 ORDER BY round_no ASC, match_no ASC, created_at ASC`,
    [id],
  )
  return r.rows.map((x) => {
    const seen = (x.seen as Record<string, string> | null) ?? {}
    const gone = ((x.gone as Leaver[] | null) ?? []).filter((p) => p && p.id)
    const seated = ((x.players as Seat[] | null) ?? []).filter((p) => !p.bot)
    const winners = Array.isArray(x.winners) ? (x.winners as string[]) : x.winner_id ? [String(x.winner_id)] : []
    const status = x.status === 'oynaniyor' ? 'oynaniyor' : x.status === 'bitti' ? 'bitti' : 'iptal'
    return {
      tableId: String(x.id),
      round: Number(x.round_no),
      roundName: roundName(league, Number(x.round_no), rounds),
      match: Number(x.match_no),
      seats: Number(x.seats),
      status,
      players: [
        ...seated.map((p) => ({ id: p.id, name: p.name, arrived: p.id in seen, winner: winners.includes(p.id), out: null })),
        ...gone.map((p) => ({ id: p.id, name: p.name, arrived: p.id in seen, winner: false, out: (p.how as MatchEnd | undefined) ?? 'pes' })),
      ],
      how: (x.how as MatchEnd | null) ?? null,
      started: x.ready === true,
      moves: Number(x.version),
      openedAt: iso(x.created_at)!,
      closedAt: status === 'oynaniyor' ? null : iso(x.updated_at),
      joinBy: iso(x.join_by),
    }
  })
}
