import { neon } from '@neondatabase/serverless'
import type { ArenaGame } from './arena'
import type { Bracket } from './bracket'

import type { Tournament, TournamentStatus } from './tournaments-shared'

export { TOURNAMENT_STATUSES, STATUS_LABEL } from './tournaments-shared'
export type { Tournament, TournamentStatus } from './tournaments-shared'

const sql = neon(process.env.DATABASE_URL!)

let ready: Promise<unknown> | null = null
function ensureTables() {
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS tournaments (
      id serial PRIMARY KEY,
      game text NOT NULL,
      title text NOT NULL,
      description text NOT NULL DEFAULT '',
      entry_fee integer NOT NULL DEFAULT 0,
      prize_pool integer NOT NULL DEFAULT 0,
      prize_note text NOT NULL DEFAULT '',
      max_players integer NOT NULL DEFAULT 16,
      starts_at timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'kayit',
      winner text,
      bracket jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`
    await sql`CREATE TABLE IF NOT EXISTS tournament_entries (
      id serial PRIMARY KEY,
      tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      nickname text NOT NULL,
      telegram text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    )`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS tournament_entries_unique ON tournament_entries (tournament_id, lower(nickname))`
  })().catch((e) => {
    ready = null
    throw e
  })
  return ready
}

type Row = Record<string, unknown>

function mapRow(r: Row, entries: Row[]): Tournament {
  return {
    id: r.id as number,
    game: r.game as ArenaGame,
    title: r.title as string,
    description: r.description as string,
    entryFee: r.entry_fee as number,
    prizePool: r.prize_pool as number,
    prizeNote: r.prize_note as string,
    maxPlayers: r.max_players as number,
    startsAt: new Date(r.starts_at as string).toISOString(),
    status: r.status as TournamentStatus,
    winner: (r.winner as string | null) ?? null,
    bracket: (r.bracket as Bracket | null) ?? null,
    entries: entries
      .filter((e) => e.tournament_id === r.id)
      .map((e) => ({
        id: e.id as number,
        nickname: e.nickname as string,
        telegram: e.telegram as string,
        createdAt: new Date(e.created_at as string).toISOString(),
      })),
  }
}

export async function listTournaments(): Promise<Tournament[]> {
  try {
    await ensureTables()
    const [rows, entries] = await Promise.all([
      sql`SELECT * FROM tournaments ORDER BY
        CASE status WHEN 'basladi' THEN 0 WHEN 'kayit' THEN 1 WHEN 'bitti' THEN 2 ELSE 3 END, starts_at ASC`,
      sql`SELECT * FROM tournament_entries ORDER BY created_at ASC`,
    ])
    return rows.map((r) => mapRow(r, entries))
  } catch (error) {
    console.error('[tournaments] liste okunamadı', error)
    return []
  }
}

export async function getTournament(id: number): Promise<Tournament | null> {
  await ensureTables()
  const [rows, entries] = await Promise.all([
    sql`SELECT * FROM tournaments WHERE id = ${id}`,
    sql`SELECT * FROM tournament_entries WHERE tournament_id = ${id} ORDER BY created_at ASC`,
  ])
  return rows[0] ? mapRow(rows[0], entries) : null
}

export type TournamentInput = {
  game: ArenaGame
  title: string
  description: string
  entryFee: number
  prizePool: number
  prizeNote: string
  maxPlayers: number
  startsAt: string
}

export async function createTournament(t: TournamentInput) {
  await ensureTables()
  await sql`INSERT INTO tournaments (game, title, description, entry_fee, prize_pool, prize_note, max_players, starts_at)
    VALUES (${t.game}, ${t.title}, ${t.description}, ${t.entryFee}, ${t.prizePool}, ${t.prizeNote}, ${t.maxPlayers}, ${t.startsAt})`
}

export async function updateTournament(id: number, t: TournamentInput) {
  await ensureTables()
  await sql`UPDATE tournaments SET game = ${t.game}, title = ${t.title}, description = ${t.description},
    entry_fee = ${t.entryFee}, prize_pool = ${t.prizePool}, prize_note = ${t.prizeNote},
    max_players = ${t.maxPlayers}, starts_at = ${t.startsAt} WHERE id = ${id}`
}

export async function setTournamentState(id: number, status: TournamentStatus, bracket: Bracket | null, winner: string | null) {
  await ensureTables()
  await sql`UPDATE tournaments SET status = ${status}, bracket = ${bracket ? JSON.stringify(bracket) : null}::jsonb,
    winner = ${winner} WHERE id = ${id}`
}

export async function deleteTournament(id: number) {
  await ensureTables()
  await sql`DELETE FROM tournaments WHERE id = ${id}`
}

export async function addEntry(id: number, nickname: string, telegram: string) {
  await ensureTables()
  const rows = await sql`INSERT INTO tournament_entries (tournament_id, nickname, telegram)
    SELECT ${id}, ${nickname}, ${telegram}
    WHERE (SELECT count(*) FROM tournament_entries WHERE tournament_id = ${id}) <
      (SELECT max_players FROM tournaments WHERE id = ${id} AND status = 'kayit')
    ON CONFLICT DO NOTHING
    RETURNING id`
  return rows.length > 0
}

export async function removeEntry(entryId: number) {
  await ensureTables()
  await sql`DELETE FROM tournament_entries WHERE id = ${entryId}`
}
