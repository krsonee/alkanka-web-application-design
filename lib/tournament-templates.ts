import 'server-only'
import { rows, sql } from '@/lib/db'
import { isArenaGame } from './arena'
import { MAX_LEAGUE_PLAYERS } from './league'
import { cleanPrizes } from './tournament-prizes'
import {
  DEFAULT_TOURNAMENT_MINUTES,
  MAX_TOURNAMENT_MINUTES,
  MAX_TOURNAMENT_PLAYERS,
  MAX_TOURNAMENT_TEMPLATES,
  MIN_TOURNAMENT_MINUTES,
  cleanJoinMinutes,
  cleanMatchLength,
  formatsFor,
  isTournamentFormat,
  tournamentSeats,
  type Tournament,
  type TournamentTemplate,
} from './tournaments-shared'

let ready: Promise<unknown> | null = null

function ensure() {
  ready ??= rows(sql`CREATE TABLE IF NOT EXISTS tournament_templates (
    id serial PRIMARY KEY,
    name text NOT NULL,
    data jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now())`).catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const whole = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

type Settings = Omit<TournamentTemplate, 'id' | 'name'>

function readSettings(raw: unknown): Settings | null {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const game = String(d.game)
  if (!isArenaGame(game)) return null
  // A template saved before its game moved to shared tables may still say league; such a game has none.
  const seats = tournamentSeats(game) ?? 2
  const format = isTournamentFormat(d.format) && formatsFor(game).includes(d.format) ? d.format : 'eleme'
  const title = text(d.title, 80)
  if (title.length < 3) return null
  const startTime = text(d.startTime, 5)
  const maxPlayers = whole(d.maxPlayers, 2, format === 'lig' ? MAX_LEAGUE_PLAYERS : MAX_TOURNAMENT_PLAYERS, 16)
  return {
    game: game as Settings['game'],
    format,
    title,
    description: text(d.description, 400),
    rules: text(d.rules, 2000),
    entryFee: whole(d.entryFee, 0, 100000, 0),
    prizePool: whole(d.prizePool, 0, 10000000, 0),
    prizes: cleanPrizes(d.prizes, format, maxPlayers, seats),
    prizeNote: text(d.prizeNote, 120),
    maxPlayers,
    startTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ? startTime : '21:00',
    // Templates saved before the end time existed have no length: they open with the form's usual one.
    lengthMinutes: whole(d.lengthMinutes, MIN_TOURNAMENT_MINUTES, MAX_TOURNAMENT_MINUTES, DEFAULT_TOURNAMENT_MINUTES),
    joinMinutes: cleanJoinMinutes(d.joinMinutes),
    matchLength: cleanMatchLength(game, d.matchLength),
  }
}

const istanbulTime = (iso: string) => new Date(Date.parse(iso) + 3 * 3_600_000).toISOString().slice(11, 16)

/** Minutes from the tournament's start to its end time; undefined on a tournament from before end times. */
const lengthOf = (t: Tournament) => (t.endsAt ? Math.round((Date.parse(t.endsAt) - Date.parse(t.startsAt)) / 60_000) : undefined)

export async function listTournamentTemplates(): Promise<TournamentTemplate[]> {
  await ensure()
  const found = await rows<{ id: number; name: string; data: unknown }>(
    sql`SELECT id, name, data FROM tournament_templates ORDER BY lower(name), id LIMIT ${MAX_TOURNAMENT_TEMPLATES}`,
  )
  return found.flatMap((row) => {
    const settings = readSettings(row.data)
    return settings ? [{ id: Number(row.id), name: row.name, ...settings }] : []
  })
}

/** Saving under an existing name replaces that template instead of adding a second one. */
export async function saveTournamentTemplate(name: string, t: Tournament): Promise<'saved' | 'updated' | 'full'> {
  await ensure()
  const settings = readSettings({ ...t, startTime: istanbulTime(t.startsAt), lengthMinutes: lengthOf(t) })
  if (!settings) throw new Error('Bu turnuva şablona çevrilemedi.')
  const data = JSON.stringify(settings)
  const updated = await rows(sql`UPDATE tournament_templates SET data = ${data}::jsonb, updated_at = now() WHERE lower(name) = lower(${name}) RETURNING id`)
  if (updated.length) return 'updated'
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tournament_templates`)
  if (Number(n) >= MAX_TOURNAMENT_TEMPLATES) return 'full'
  await rows(sql`INSERT INTO tournament_templates (name, data) VALUES (${name}, ${data}::jsonb)`)
  return 'saved'
}

export async function deleteTournamentTemplate(id: number): Promise<string | null> {
  await ensure()
  if (!Number.isInteger(id) || id < 1) return null
  const [row] = await rows<{ name: string }>(sql`DELETE FROM tournament_templates WHERE id = ${id} RETURNING name`)
  return row ? row.name : null
}
