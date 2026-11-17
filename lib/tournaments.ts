import 'server-only'
import { revalidatePath } from 'next/cache'
import { pool } from '@/lib/db'
import { credit, debit, recordHistory, type Member } from '@/lib/member'
import type { ArenaGame } from './arena'
import { bracketChampion, createBracket, setMatchWinner, type Bracket } from './bracket'
import { createLeague, leagueChampion, MAX_LEAGUE_PLAYERS, setLeagueWinner } from './league'
import { initState } from './pvp/rules'
import { cleanPrizes, prizeTotal, tournamentPayouts } from './tournament-prizes'
import {
  MAX_TOURNAMENT_PLAYERS,
  roundName,
  type LiveMatch,
  type MyMatch,
  type TableTour,
  type Tournament,
  type TournamentFormat,
  type TournamentStatus,
} from './tournaments-shared'

export { TOURNAMENT_STATUSES, STATUS_LABEL, MAX_TOURNAMENT_PLAYERS } from './tournaments-shared'
export type { Tournament, TournamentStatus } from './tournaments-shared'

type Row = Record<string, unknown>

const entryKey = (e: Row) => (e.user_id ? String(e.user_id) : `misafir:${e.nickname}`)

const RUNNING_MEMO_MS = 20_000
let runningMemo: { at: number; value: boolean } | null = null

/**
 * "Is my match ready" is asked on every page a member opens. Between tournaments the answer is
 * remembered for a few seconds, so those pages cost one tiny query instead of a scan of the tables.
 */
async function anyRunning() {
  if (runningMemo && Date.now() - runningMemo.at < RUNNING_MEMO_MS) return runningMemo.value
  const r = await pool.query(`SELECT 1 FROM tournaments WHERE status = 'basladi' LIMIT 1`)
  runningMemo = { at: Date.now(), value: Boolean(r.rowCount) }
  return runningMemo.value
}

/** A start, a result or a cancel changes what /turnuvalar shows; outside a request there is nothing to refresh. */
function tournamentChanged() {
  runningMemo = null
  try {
    revalidatePath('/turnuvalar')
  } catch {
    // Called while a page is being rendered: that render already reads the new state.
  }
}

function mapRow(r: Row, entries: Row[], tables: Row[]): Tournament {
  const own = entries.filter((e) => e.tournament_id === r.id)
  const names: Record<string, string> = {}
  for (const e of own) names[entryKey(e)] = String(e.nickname)
  const bracket = (r.bracket as Bracket | null) ?? null
  const liveMatches: LiveMatch[] = tables
    .filter((t) => t.tournament_id === r.id)
    .map((t) => ({
      tableId: String(t.id),
      round: Number(t.round_no),
      match: Number(t.match_no),
      players: ((t.players as { id: string }[]) ?? []).map((p) => p.id),
      status: String(t.status),
    }))
  let currentRound: number | null = null
  if (bracket && r.status === 'basladi') {
    const idx = bracket.rounds.findIndex((round) => round.some((m) => !m.winner && m.players.filter(Boolean).length === 2))
    currentRound = idx >= 0 ? idx : null
  }
  return {
    id: Number(r.id),
    game: r.game as ArenaGame,
    title: String(r.title),
    description: String(r.description ?? ''),
    rules: String(r.rules ?? ''),
    entryFee: Number(r.entry_fee),
    prizePool: Number(r.prize_pool),
    prizes: cleanPrizes(r.prizes, r.format === 'lig' ? 'lig' : 'eleme', Number(r.max_players)),
    prizeNote: String(r.prize_note ?? ''),
    maxPlayers: Number(r.max_players),
    startsAt: new Date(String(r.starts_at)).toISOString(),
    status: r.status as TournamentStatus,
    format: r.format === 'lig' ? 'lig' : 'eleme',
    winner: (r.winner as string | null) ?? null,
    bracket,
    names,
    liveMatches,
    currentRound,
    entries: own.map((e) => ({
      id: Number(e.id),
      userId: (e.user_id as string | null) ?? null,
      nickname: String(e.nickname),
      telegram: String(e.telegram ?? ''),
      createdAt: new Date(String(e.created_at)).toISOString(),
    })),
  }
}

async function load(where: string, params: unknown[]) {
  const t = await pool.query(`SELECT * FROM tournaments ${where}`, params)
  if (!t.rows.length) return []
  const ids = t.rows.map((r) => r.id)
  const [entries, tables] = await Promise.all([
    pool.query('SELECT * FROM tournament_entries WHERE tournament_id = ANY($1) ORDER BY created_at ASC', [ids]),
    pool.query(`SELECT id, tournament_id, round_no, match_no, players, status FROM game_tables
      WHERE tournament_id = ANY($1) AND status = 'oynaniyor'`, [ids]),
  ])
  return t.rows.map((r) => mapRow(r, entries.rows, tables.rows))
}

/** Like `listTournaments`, but a failed read is an error instead of an empty list. */
export async function readTournaments(): Promise<Tournament[]> {
  await autoStartDue()
  return load(
    `ORDER BY CASE status WHEN 'basladi' THEN 0 WHEN 'kayit' THEN 1 WHEN 'bitti' THEN 2 ELSE 3 END, starts_at ASC`,
    [],
  )
}

export async function listTournaments(): Promise<Tournament[]> {
  try {
    return await readTournaments()
  } catch (error) {
    console.error('[tournaments] liste okunamadı', error)
    return []
  }
}

export async function getTournament(id: number): Promise<Tournament | null> {
  return (await load('WHERE id = $1', [id]))[0] ?? null
}

export type TournamentInput = {
  game: ArenaGame
  title: string
  description: string
  rules: string
  entryFee: number
  /** KC per finishing place, best first. The pool shown on the site is worked out from these. */
  prizes: number[]
  prizeNote: string
  maxPlayers: number
  startsAt: string
  format: TournamentFormat
}

const clampPlayers = (n: number, format: TournamentFormat) =>
  Math.min(format === 'lig' ? MAX_LEAGUE_PLAYERS : MAX_TOURNAMENT_PLAYERS, Math.max(2, Math.floor(n)))

let prizesReady: Promise<unknown> | null = null

/** Never call this inside a transaction that already locked a tournament row: adding the column would wait on that lock. */
function ensurePrizes() {
  prizesReady ??= (async () => {
    await pool.query('ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prizes jsonb')
    await pool.query(`CREATE TABLE IF NOT EXISTS tournament_payouts (
      tournament_id int NOT NULL, player_key text NOT NULL, place int NOT NULL, amount int NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tournament_id, player_key))`)
  })().catch((error) => {
    prizesReady = null
    throw error
  })
  return prizesReady
}

function prizeColumns(t: TournamentInput) {
  const maxPlayers = clampPlayers(t.maxPlayers, t.format)
  const prizes = cleanPrizes(t.prizes, t.format, maxPlayers)
  return { maxPlayers, prizes: JSON.stringify(prizes), pool: prizeTotal(t.format, maxPlayers, prizes) }
}

export async function createTournament(t: TournamentInput) {
  await ensurePrizes()
  const p = prizeColumns(t)
  await pool.query(
    `INSERT INTO tournaments (game, title, description, rules, entry_fee, prize_pool, prize_note, max_players, starts_at, format, table_size, prizes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,2,$11::jsonb)`,
    [t.game, t.title, t.description, t.rules, t.entryFee, p.pool, t.prizeNote, p.maxPlayers, t.startsAt, t.format, p.prizes],
  )
}

export async function updateTournament(id: number, t: TournamentInput) {
  await ensurePrizes()
  const p = prizeColumns(t)
  await pool.query(
    `UPDATE tournaments SET game=$2, title=$3, description=$4, rules=$5, entry_fee=$6, prize_pool=$7, prize_note=$8,
       max_players=$9, starts_at=$10, format=$11, prizes=$12::jsonb WHERE id=$1 AND status = 'kayit'`,
    [id, t.game, t.title, t.description, t.rules, t.entryFee, p.pool, t.prizeNote, p.maxPlayers, t.startsAt, t.format, p.prizes],
  )
}

const championOf = (format: unknown, bracket: Bracket, order: string[]) =>
  format === 'lig' ? leagueChampion(bracket, order) : bracketChampion(bracket)

async function refundAll(id: number) {
  const t = await pool.query('SELECT entry_fee, game FROM tournaments WHERE id = $1', [id])
  const fee = Number(t.rows[0]?.entry_fee ?? 0)
  if (!fee) return
  const e = await pool.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1 AND user_id IS NOT NULL', [id])
  for (const row of e.rows) {
    await credit(row.user_id, fee, 'Turnuva iadesi')
    await recordHistory({ userId: row.user_id, userName: row.nickname, game: t.rows[0].game, mode: 'turnuva', opponent: 'Turnuva iadesi', stake: fee, result: 'refund', delta: fee })
  }
}

export async function cancelTournament(id: number) {
  const r = await pool.query(`UPDATE tournaments SET status = 'iptal' WHERE id = $1 AND status IN ('kayit','basladi') RETURNING id`, [id])
  if (!r.rowCount) return
  await pool.query(`UPDATE game_tables SET status = 'iptal', updated_at = now() WHERE tournament_id = $1 AND status = 'oynaniyor'`, [id])
  await refundAll(id)
  tournamentChanged()
}

export async function deleteTournament(id: number) {
  const t = await pool.query('SELECT status FROM tournaments WHERE id = $1', [id])
  if (t.rows[0]?.status === 'kayit' || t.rows[0]?.status === 'basladi') await refundAll(id)
  await pool.query(`UPDATE game_tables SET status = 'iptal' WHERE tournament_id = $1 AND status = 'oynaniyor'`, [id])
  await pool.query('DELETE FROM tournament_entries WHERE tournament_id = $1', [id])
  await pool.query('DELETE FROM tournaments WHERE id = $1', [id])
  tournamentChanged()
}

export async function joinTournament(m: Member, id: number) {
  const { withUserLock } = await import('@/lib/user-lock')
  return withUserLock(`tournament:${id}:${m.id}`, () => joinTournamentLocked(m, id))
}

async function joinTournamentLocked(m: Member, id: number) {
  const t = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id])
  const row = t.rows[0]
  if (!row || row.status !== 'kayit') throw new Error('Bu turnuvanın kayıtları kapalı.')
  const exists = await pool.query('SELECT 1 FROM tournament_entries WHERE tournament_id = $1 AND user_id = $2', [id, m.id])
  if (exists.rowCount) throw new Error('Bu turnuvaya zaten kayıtlısın.')
  const fee = Number(row.entry_fee)
  if (fee > 0 && !(await debit(m.id, fee, 'Turnuva giriş ücreti'))) throw new Error('Yetersiz Kanka Coin.')
  const ins = await pool.query(
    `INSERT INTO tournament_entries (tournament_id, nickname, telegram, user_id)
     SELECT $1, $2, '', $3 WHERE (SELECT count(*) FROM tournament_entries WHERE tournament_id = $1) < $4
     RETURNING id`,
    [id, m.name, m.id, Number(row.max_players)],
  )
  if (!ins.rowCount) {
    if (fee > 0) await credit(m.id, fee, 'Turnuva iadesi')
    throw new Error('Turnuva kontenjanı doldu.')
  }
  if (fee > 0) await recordHistory({ userId: m.id, userName: m.name, game: row.game, mode: 'turnuva', opponent: `Kayıt: ${row.title}`, stake: fee, result: 'loss', delta: -fee })
}

export async function leaveTournament(m: Member, id: number) {
  const t = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id])
  const row = t.rows[0]
  if (!row || row.status !== 'kayit') throw new Error('Turnuva başladıktan sonra ayrılamazsın.')
  const del = await pool.query('DELETE FROM tournament_entries WHERE tournament_id = $1 AND user_id = $2 RETURNING id', [id, m.id])
  const fee = Number(row.entry_fee)
  if (del.rowCount && fee > 0) {
    await credit(m.id, fee, 'Turnuva iadesi')
    await recordHistory({ userId: m.id, userName: m.name, game: row.game, mode: 'turnuva', opponent: `İade: ${row.title}`, stake: fee, result: 'refund', delta: fee })
  }
}

export async function removeEntry(entryId: number) {
  const e = await pool.query(
    `DELETE FROM tournament_entries WHERE id = $1 AND tournament_id IN (SELECT id FROM tournaments WHERE status = 'kayit')
     RETURNING user_id, nickname, tournament_id`,
    [entryId],
  )
  const row = e.rows[0]
  if (!row?.user_id) return
  const t = await pool.query('SELECT entry_fee, game FROM tournaments WHERE id = $1', [row.tournament_id])
  const fee = Number(t.rows[0]?.entry_fee ?? 0)
  if (fee > 0) {
    await credit(row.user_id, fee, 'Turnuva iadesi')
    await recordHistory({ userId: row.user_id, userName: row.nickname, game: t.rows[0].game, mode: 'turnuva', opponent: 'Kayıt iadesi', stake: fee, result: 'refund', delta: fee })
  }
}

export async function autoStartDue() {
  const due = await pool.query(
    `SELECT id FROM tournaments t WHERE status = 'kayit' AND starts_at <= now()
       AND (SELECT count(*) FROM tournament_entries e WHERE e.tournament_id = t.id) >= 2`,
  )
  for (const r of due.rows) await startTournament(Number(r.id)).catch((e) => console.error('[tournaments] otomatik başlatma', e))
}

/** Pairs every entrant at once and opens all first-round tables simultaneously. */
export async function startTournament(id: number) {
  const entries = await pool.query('SELECT * FROM tournament_entries WHERE tournament_id = $1 ORDER BY created_at ASC', [id])
  if (entries.rowCount! < 2) throw new Error('Başlatmak için en az 2 oyuncu gerekli.')
  const t = await pool.query('SELECT format FROM tournaments WHERE id = $1', [id])
  const keys = entries.rows.map(entryKey)
  const bracket = t.rows[0]?.format === 'lig' ? createLeague(keys) : createBracket(keys, 2)
  const r = await pool.query(
    `UPDATE tournaments SET status = 'basladi', bracket = $2::jsonb, winner = NULL WHERE id = $1 AND status = 'kayit' RETURNING id`,
    [id, JSON.stringify(bracket)],
  )
  if (!r.rowCount) return
  await openReadyMatches(id)
  tournamentChanged()
}

/**
 * Opens a table for every match whose two players are known and still unplayed, but only
 * once the whole previous round has finished so winners wait and advance together.
 */
async function openReadyMatches(id: number) {
  await ensurePrizes()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const t = await client.query('SELECT * FROM tournaments WHERE id = $1 FOR UPDATE', [id])
    const row = t.rows[0]
    if (!row || row.status !== 'basladi' || !row.bracket) {
      await client.query('ROLLBACK')
      return
    }
    const bracket = row.bracket as Bracket
    const order = await client.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1 ORDER BY created_at ASC', [id])
    const keys = order.rows.map(entryKey)
    const champion = championOf(row.format, bracket, keys)
    if (champion) {
      await finishTournament(client, row, bracket, champion, keys)
      await client.query('COMMIT')
      return
    }
    const roundIdx = bracket.rounds.findIndex((round) => round.some((m) => !m.winner && m.players.filter(Boolean).length === 2))
    if (roundIdx < 0) {
      await client.query('COMMIT')
      return
    }
    const earlierOpen = bracket.rounds.slice(0, roundIdx).some((round) => round.some((m) => !m.winner && m.players.some(Boolean)))
    if (earlierOpen) {
      await client.query('COMMIT')
      return
    }
    const existing = await client.query(
      `SELECT match_no FROM game_tables WHERE tournament_id = $1 AND round_no = $2 AND status IN ('oynaniyor','bitti')`,
      [id, roundIdx],
    )
    const opened = new Set(existing.rows.map((e) => Number(e.match_no)))
    const names = await client.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1', [id])
    const nicknames = new Map<string, string>(names.rows.map((n) => [n.user_id ?? `misafir:${n.nickname}`, n.nickname]))
    const tables: { match_no: number; players: unknown; state: unknown }[] = []
    for (const [mi, match] of bracket.rounds[roundIdx].entries()) {
      const real = match.players.filter((p): p is string => Boolean(p))
      if (match.winner || real.length !== 2 || opened.has(mi)) continue
      tables.push({
        match_no: mi,
        players: real.map((key, seat) => ({ id: key, name: nicknames.get(key) ?? key, seat })),
        state: initState(row.game),
      })
    }
    // One statement for the whole round: a 1024-player bracket opens 512 tables while the tournament row is locked.
    if (tables.length) {
      const league = row.format === 'lig'
      const tour: TableTour = { title: String(row.title), round: roundName(league, roundIdx, bracket.rounds.length), league }
      await client.query(
        `INSERT INTO game_tables (game, stake, seats, status, players, state, created_by, mode, tournament_id, round_no, match_no, options)
         SELECT $1, 0, 2, 'oynaniyor', t.players, t.state, 'turnuva', 'turnuva', $2, $3, t.match_no, $5::jsonb
         FROM jsonb_to_recordset($4::jsonb) AS t(match_no int, players jsonb, state jsonb)`,
        [row.game, id, roundIdx, JSON.stringify(tables), JSON.stringify({ tour })],
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function finishTournament(client: { query: typeof pool.query }, row: Row, bracket: Bracket, champion: string, order: string[]) {
  const names = await client.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1', [row.id])
  const n = names.rows.find((x) => (x.user_id ?? `misafir:${x.nickname}`) === champion)
  const display = n?.nickname ?? champion
  const upd = await client.query(
    `UPDATE tournaments SET status = 'bitti', winner = $2, bracket = $3::jsonb WHERE id = $1 AND status = 'basladi' RETURNING id`,
    [row.id, display, JSON.stringify(bracket)],
  )
  if (!upd.rowCount) return
  if (n?.user_id) {
    const { rewardTournamentWin } = await import('@/lib/kanka-puan')
    await rewardTournamentWin(n.user_id, Number(row.id), String(row.title))
  }
  const format: TournamentFormat = row.format === 'lig' ? 'lig' : 'eleme'
  const maxPlayers = Number(row.max_players)
  const payouts = tournamentPayouts(
    { format, maxPlayers, prizes: cleanPrizes(row.prizes, format, maxPlayers), prizePool: Number(row.prize_pool) },
    bracket,
    order,
  )
  for (const p of payouts) {
    const player = names.rows.find((x) => (x.user_id ?? `misafir:${x.nickname}`) === p.key)
    if (!player?.user_id) continue
    await payPrize(Number(row.id), { userId: player.user_id, name: player.nickname, key: p.key }, p, { game: String(row.game), title: String(row.title) })
  }
}

/**
 * The claim row is what makes a payout happen once: finishing runs inside a transaction that can be
 * retried, and a retry must not pay the places that were already credited.
 */
async function payPrize(
  tournamentId: number,
  player: { userId: string; name: string; key: string },
  prize: { place: number; amount: number; label: string },
  t: { game: string; title: string },
) {
  const claim = await pool.query(
    `INSERT INTO tournament_payouts (tournament_id, player_key, place, amount) VALUES ($1, $2, $3, $4)
     ON CONFLICT (tournament_id, player_key) DO NOTHING RETURNING tournament_id`,
    [tournamentId, player.key, prize.place, prize.amount],
  )
  if (!claim.rowCount) return
  try {
    await credit(player.userId, prize.amount, 'Turnuva ödülü')
  } catch (error) {
    await pool.query('DELETE FROM tournament_payouts WHERE tournament_id = $1 AND player_key = $2', [tournamentId, player.key])
    throw error
  }
  const what = prize.place === 0 ? 'Şampiyonluk' : `${prize.label} sıra ödülü`
  await recordHistory({ userId: player.userId, userName: player.name, game: t.game, mode: 'turnuva', opponent: `${what}: ${t.title}`, stake: 0, result: 'win', delta: prize.amount }).catch((error) =>
    console.error('[tournaments] ödül geçmişi yazılamadı', (error as Error).message),
  )
}

/** Records a match result, then opens the next round once every match in this round is decided. */
export async function advanceTournament(id: number, round: number, match: number, winnerKey: string) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const t = await client.query('SELECT bracket, status, format FROM tournaments WHERE id = $1 FOR UPDATE', [id])
    const row = t.rows[0]
    if (row?.status === 'basladi' && row.bracket) {
      const set = row.format === 'lig' ? setLeagueWinner : setMatchWinner
      const next = set(row.bracket as Bracket, round, match, winnerKey)
      await client.query('UPDATE tournaments SET bracket = $2::jsonb WHERE id = $1', [id, JSON.stringify(next)])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
  await openReadyMatches(id)
  tournamentChanged()
}

/** Admin override for no-shows: closes the live table and advances the chosen player. */
export async function adminSetMatchWinner(id: number, round: number, match: number, winnerKey: string) {
  await pool.query(
    `UPDATE game_tables SET status = 'bitti', winner_id = $4, updated_at = now()
     WHERE tournament_id = $1 AND round_no = $2 AND match_no = $3 AND status = 'oynaniyor'`,
    [id, round, match, winnerKey],
  )
  await advanceTournament(id, round, match, winnerKey)
}

/** The member's open tournament tables, oldest first. Empty without a query while no tournament is being played. */
export async function myMatches(userId: string): Promise<MyMatch[]> {
  if (!(await anyRunning())) return []
  const r = await pool.query(
    `SELECT g.id, g.game, g.round_no, t.id AS tournament_id, t.title, t.format,
            jsonb_array_length(COALESCE(t.bracket->'rounds', '[]'::jsonb)) AS rounds
     FROM game_tables g JOIN tournaments t ON t.id = g.tournament_id
     WHERE g.status = 'oynaniyor' AND t.status = 'basladi' AND g.players @> $1::jsonb
     ORDER BY g.created_at ASC`,
    [JSON.stringify([{ id: userId }])],
  )
  return r.rows.map((x) => ({
    tableId: String(x.id),
    tournamentId: Number(x.tournament_id),
    game: String(x.game),
    title: String(x.title),
    round: roundName(x.format === 'lig', Number(x.round_no), Number(x.rounds)),
  }))
}
