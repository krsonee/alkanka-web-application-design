import 'server-only'
import { revalidatePath } from 'next/cache'
import type { PoolClient } from 'pg'
import { pool } from '@/lib/db'
import { getBalance, recordHistory, type Member } from '@/lib/member'
import { assertCanPlay } from '@/lib/member-limits'
import { applyCoins, ensureLedger } from '@/lib/wallet-ledger'
import type { ArenaGame } from './arena'
import { anyWin, bracketChampion, bracketOver, createBracket, createTableBracket, isDecided, isRealMatch, openRound, setMatchWinner, setTableResult, voidMatch, type Bracket } from './bracket'
import { createLeague, leagueStandings, MAX_LEAGUE_PLAYERS, setLeagueWinner, voidLeagueMatch } from './league'
import { initState } from './pvp/rules'
import { pickBotNames } from './pvp/tables'
import { tournamentTable } from './tournament-games'
import { cleanPrizes, prizeTotal, tournamentPayouts, type Payout } from './tournament-prizes'
import {
  MATCH_END_LABEL,
  MAX_TOURNAMENT_PLAYERS,
  TABLE_PASS,
  TOURNAMENT_MONEY_GAME,
  cleanJoinMinutes,
  isFinishReason,
  minEntrants,
  roundName,
  tournamentSeats,
  type FinishReason,
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

// A Date turned into text loses its milliseconds, so a moment read from the database is used as it is.
const toDate = (v: unknown) => (v instanceof Date ? v : new Date(String(v)))
const isoOrNull = (v: unknown) => (v ? toDate(v).toISOString() : null)
const passed = (v: unknown) => Boolean(v) && toDate(v).getTime() <= Date.now()
const joinMinutesOf = (row: Row) => cleanJoinMinutes((row.settings as { joinMinutes?: unknown } | null)?.joinMinutes)

/**
 * Players per table. Once paired, a tournament keeps the size it was paired with, so one that started
 * as a duel before its game moved to shared tables is played out as a duel.
 */
const tableSizeOf = (row: Row) => {
  const bracket = row.bracket as Bracket | null
  return bracket ? (bracket.seats ?? 2) : (tournamentSeats(String(row.game)) ?? 2)
}

function mapRow(r: Row, entries: Row[], tables: Row[]): Tournament {
  const own = entries.filter((e) => e.tournament_id === r.id)
  const names: Record<string, string> = {}
  for (const e of own) names[entryKey(e)] = String(e.nickname)
  const bracket = (r.bracket as Bracket | null) ?? null
  const tableSize = tableSizeOf(r)
  const liveMatches: LiveMatch[] = tables
    .filter((t) => t.tournament_id === r.id)
    .map((t) => ({
      tableId: String(t.id),
      round: Number(t.round_no),
      match: Number(t.match_no),
      players: ((t.players as { id: string; bot?: boolean }[]) ?? []).filter((p) => !p.bot).map((p) => p.id),
      status: String(t.status),
    }))
  let currentRound: number | null = null
  if (bracket && r.status === 'basladi') {
    const idx = bracket.rounds.findIndex((round) => round.some((m) => isRealMatch(m) && !isDecided(m)))
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
    prizes: cleanPrizes(r.prizes, r.format === 'lig' ? 'lig' : 'eleme', Number(r.max_players), tableSize),
    prizeNote: String(r.prize_note ?? ''),
    maxPlayers: Number(r.max_players),
    tableSize,
    startsAt: new Date(String(r.starts_at)).toISOString(),
    endsAt: isoOrNull(r.ends_at),
    joinMinutes: joinMinutesOf(r),
    finishedAt: isoOrNull(r.finished_at),
    finishReason: isFinishReason(r.finish_reason) ? r.finish_reason : null,
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
  // Whoever looks at the list also moves the clock: a start that is due, a forfeit, an end time.
  const { tournamentTick } = await import('./tournament-run')
  await tournamentTick().catch((error) => console.error('[tournaments] saat kontrolü', error))
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
  /** When the tournament is closed whatever is still being played. */
  endsAt?: string | null
  /** Minutes a player has to sit down once a match opens. */
  joinMinutes?: number
  format: TournamentFormat
}

/** What may still change once the first matches are open. */
export type RunningInput = { endsAt: string; description: string; prizeNote: string }

const clampPlayers = (n: number, format: TournamentFormat) =>
  Math.min(format === 'lig' ? MAX_LEAGUE_PLAYERS : MAX_TOURNAMENT_PLAYERS, Math.max(2, Math.floor(n)))

const TOURNAMENT_COLUMNS: [string, string][] = [
  ['prizes', 'jsonb'],
  ['ends_at', 'timestamptz'],
  ['settings', 'jsonb'],
  ['finished_at', 'timestamptz'],
  ['finish_reason', 'text'],
]

/**
 * A table still open for a tournament that is deleted, cancelled or finished can never close by itself:
 * it would sit in the list of live tables for ever. Returns how many were closed.
 */
export async function closeOrphanTables() {
  const r = await pool.query(
    `UPDATE game_tables g SET status = 'iptal', updated_at = now(), options = COALESCE(g.options, '{}'::jsonb) || '{"how":"iptal"}'::jsonb
     WHERE g.tournament_id IS NOT NULL AND g.status = 'oynaniyor'
       AND NOT EXISTS (SELECT 1 FROM tournaments t WHERE t.id = g.tournament_id AND t.status = 'basladi')`,
  )
  return r.rowCount ?? 0
}

let columnsReady: Promise<unknown> | null = null

/** Never call this inside a transaction that already locked a tournament row: adding a column would wait on that lock. */
function ensureColumns() {
  columnsReady ??= (async () => {
    const seen = await pool.query(
      `SELECT ARRAY(SELECT column_name::text FROM information_schema.columns WHERE table_name = 'tournaments') AS cols,
              ARRAY(SELECT indexname::text FROM pg_indexes WHERE tablename = 'game_tables') AS idx`,
    )
    const cols: string[] = seen.rows[0]?.cols ?? []
    const indexes: string[] = seen.rows[0]?.idx ?? []
    for (const [name, type] of TOURNAMENT_COLUMNS) {
      if (!cols.includes(name)) await pool.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS ${name} ${type}`)
    }
    await pool.query(`CREATE TABLE IF NOT EXISTS tournament_payouts (
      tournament_id int NOT NULL, player_key text NOT NULL, place int NOT NULL, amount int NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tournament_id, player_key))`)
    // The clock looks up a tournament's open tables every time it runs; without this it reads every table on the site.
    if (!indexes.includes('game_tables_tournament_idx')) {
      await pool
        .query(`CREATE INDEX IF NOT EXISTS game_tables_tournament_idx ON game_tables (tournament_id, status) WHERE tournament_id IS NOT NULL`)
        .catch((error) => console.error('[tournaments] masa dizini kurulamadı', (error as Error).message))
    }
    await closeOrphanTables().catch((error) => console.error('[tournaments] sahipsiz masalar kapatılamadı', (error as Error).message))
  })().catch((error) => {
    columnsReady = null
    throw error
  })
  return columnsReady
}

function prizeColumns(t: TournamentInput) {
  const seats = tournamentSeats(t.game) ?? 2
  const maxPlayers = clampPlayers(t.maxPlayers, t.format)
  const prizes = cleanPrizes(t.prizes, t.format, maxPlayers, seats)
  return { maxPlayers, seats, prizes: JSON.stringify(prizes), pool: prizeTotal(t.format, maxPlayers, prizes, seats) }
}

const settingsOf = (t: TournamentInput) => JSON.stringify({ joinMinutes: cleanJoinMinutes(t.joinMinutes) })

export async function createTournament(t: TournamentInput) {
  await ensureColumns()
  const p = prizeColumns(t)
  await pool.query(
    `INSERT INTO tournaments (game, title, description, rules, entry_fee, prize_pool, prize_note, max_players, starts_at, format, table_size, prizes, ends_at, settings)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$14,$11::jsonb,$12,$13::jsonb)`,
    [t.game, t.title, t.description, t.rules, t.entryFee, p.pool, t.prizeNote, p.maxPlayers, t.startsAt, t.format, p.prizes, t.endsAt ?? null, settingsOf(t), p.seats],
  )
}

/** Everything can change while entries are open. False when the tournament has already started or closed. */
export async function updateTournament(id: number, t: TournamentInput) {
  await ensureColumns()
  const p = prizeColumns(t)
  const r = await pool.query(
    `UPDATE tournaments SET game=$2, title=$3, description=$4, rules=$5, entry_fee=$6, prize_pool=$7, prize_note=$8,
       max_players=$9, starts_at=$10, format=$11, prizes=$12::jsonb, ends_at=$13, settings=$14::jsonb, table_size=$15 WHERE id=$1 AND status = 'kayit' RETURNING id`,
    [id, t.game, t.title, t.description, t.rules, t.entryFee, p.pool, t.prizeNote, p.maxPlayers, t.startsAt, t.format, p.prizes, t.endsAt ?? null, settingsOf(t), p.seats],
  )
  if (r.rowCount) tournamentChanged()
  return Boolean(r.rowCount)
}

/** A tournament being played keeps its game, players, fee and prizes; only its end time and its texts can change. */
export async function updateRunningTournament(id: number, t: RunningInput) {
  await ensureColumns()
  const r = await pool.query(
    `UPDATE tournaments SET ends_at = $2, description = $3, prize_note = $4 WHERE id = $1 AND status = 'basladi' RETURNING id`,
    [id, t.endsAt, t.description, t.prizeNote],
  )
  if (r.rowCount) tournamentChanged()
  return Boolean(r.rowCount)
}

let entriesReady: Promise<unknown> | null = null

/** Never call this inside a transaction that already locked a tournament row: changing the entries table would wait on that lock. */
function ensureEntries() {
  entriesReady ??= (async () => {
    const seen = await pool.query(
      `SELECT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'tournament_entries' AND column_name = 'fee_paid')::int AS col,
              ARRAY(SELECT indexname::text FROM pg_indexes WHERE tablename = 'tournament_entries') AS idx`,
    )
    const indexes: string[] = seen.rows[0]?.idx ?? []
    if (!seen.rows[0]?.col) {
      await pool.query('ALTER TABLE tournament_entries ADD COLUMN IF NOT EXISTS fee_paid int')
      // Entries made before the fee was stored paid what the tournament asked at the time this ran.
      await pool.query(
        `UPDATE tournament_entries e SET fee_paid = t.entry_fee FROM tournaments t WHERE t.id = e.tournament_id AND e.fee_paid IS NULL`,
      )
    }
    // Two members can share a display name; the member is what may enter only once.
    // The new index goes in first and the old one leaves only once it is there: if existing rows keep
    // the new one from being built, the table must not be left with no unique index at all.
    let byMember = indexes.includes('tournament_entries_member')
    if (!byMember) {
      byMember = await pool
        .query(`CREATE UNIQUE INDEX IF NOT EXISTS tournament_entries_member ON tournament_entries (tournament_id, user_id) WHERE user_id IS NOT NULL`)
        .then(() => true)
        .catch((error) => {
          console.error('[tournaments] üye dizini kurulamadı, ad dizini yerinde bırakıldı', (error as Error).message)
          return false
        })
    }
    if (byMember && indexes.includes('tournament_entries_unique')) await pool.query('DROP INDEX IF EXISTS tournament_entries_unique')
  })().catch((error) => {
    entriesReady = null
    throw error
  })
  return entriesReady
}

const ensureAll = () => Promise.all([ensureColumns(), ensureEntries(), ensureLedger()])

/**
 * Runs `fn` in one transaction that holds the tournament's row. Joining, leaving, removing an entrant,
 * starting, recording a result and closing all go through here, so none of them can see a half-finished other.
 */
async function withTournament<T>(id: number, fn: (client: PoolClient, row: Row | undefined) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const t = await client.query('SELECT * FROM tournaments WHERE id = $1 FOR UPDATE', [id])
    const out = await fn(client, t.rows[0])
    await client.query('COMMIT')
    return out
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/** What the entrant was actually charged, which is not the tournament's fee if the fee was edited afterwards. */
const paidFee = (entry: Row, tournament: Row) => Number(entry.fee_paid ?? tournament.entry_fee ?? 0)

type Refund = { userId: string; name: string; fee: number }

type PaidPrize = { userId: string; name: string; amount: number; what: string }

/** What closing a tournament leaves to do once its transaction has committed. */
type Closed = {
  id: number
  status: 'bitti' | 'iptal'
  reason: FinishReason
  title: string
  refunds: Refund[]
  entrants: Refund[]
  prizes?: PaidPrize[]
  champion?: string | null
}

/**
 * Fees, refunds and prizes are written as coin movements under their own game name, never as a played game:
 * play counters, win counters and the daily game limit must not move when coins change hands.
 */
async function noteFee(userId: string, name: string, label: string, fee: number, refund: boolean) {
  await recordHistory({
    userId,
    userName: name,
    game: TOURNAMENT_MONEY_GAME,
    mode: 'harcama',
    opponent: label,
    stake: fee,
    result: refund ? 'refund' : 'loss',
    delta: refund ? fee : -fee,
  }).catch((error) => console.error('[tournaments] ücret geçmişi yazılamadı', (error as Error).message))
}

/** Gives the fee back inside the caller's transaction. False means there was no wallet to pay into. */
async function refundIn(client: PoolClient, userId: string, fee: number) {
  if (fee <= 0) return true
  return (await applyCoins(userId, fee, 'Turnuva iadesi', { client })) !== null
}

/**
 * Cancels inside the caller's transaction: the status change, every refund and the closing of the open
 * tables commit together, so a failure half way leaves the tournament untouched and the cancel can be repeated.
 */
async function cancelIn(client: PoolClient, row: Row, reason: FinishReason): Promise<Closed> {
  await client.query(`UPDATE tournaments SET status = 'iptal', finished_at = now(), finish_reason = $2 WHERE id = $1`, [row.id, reason])
  const entries = await client.query(
    'SELECT user_id, nickname, fee_paid FROM tournament_entries WHERE tournament_id = $1 AND user_id IS NOT NULL ORDER BY id ASC',
    [row.id],
  )
  const refunds: Refund[] = []
  const entrants: Refund[] = []
  for (const entry of entries.rows) {
    const fee = paidFee(entry, row)
    const who = { userId: String(entry.user_id), name: String(entry.nickname), fee: Math.max(0, fee) }
    if (fee <= 0) {
      entrants.push(who)
      continue
    }
    if (await refundIn(client, entry.user_id, fee)) {
      refunds.push(who)
      entrants.push(who)
    } else {
      console.error('[tournaments] iade edilecek cüzdan yok', entry.user_id)
      entrants.push({ ...who, fee: 0 })
    }
  }
  await client.query(
    `UPDATE game_tables SET status = 'iptal', updated_at = now(), options = COALESCE(options, '{}'::jsonb) || '{"how":"iptal"}'::jsonb
     WHERE tournament_id = $1 AND status = 'oynaniyor'`,
    [row.id],
  )
  return { id: Number(row.id), status: 'iptal', reason, title: String(row.title), refunds, entrants }
}

/** History rows, badges and messages are written after the commit: they may fail without undoing a cancel or a result. */
async function afterClose(closed: Closed | null) {
  if (!closed) return false
  for (const r of closed.refunds) await noteFee(r.userId, r.name, `İptal iadesi: ${closed.title}`, r.fee, true)
  for (const p of closed.prizes ?? []) {
    await recordHistory({ userId: p.userId, userName: p.name, game: TOURNAMENT_MONEY_GAME, mode: 'odul', opponent: `${p.what}: ${closed.title}`, stake: 0, result: 'win', delta: p.amount }).catch((error) =>
      console.error('[tournaments] ödül geçmişi yazılamadı', (error as Error).message),
    )
  }
  if (closed.champion) {
    const { rewardTournamentWin } = await import('@/lib/kanka-puan')
    await rewardTournamentWin(closed.champion, closed.id, closed.title)
  }
  if (closed.status === 'iptal' && closed.entrants.length) {
    const { notifyCancelled } = await import('./tournament-notify')
    await notifyCancelled({ title: closed.title, reason: closed.reason, entrants: closed.entrants })
  }
  tournamentChanged()
  return true
}

/** Closes an open or running tournament and returns every fee. */
async function closeAndRefund(id: number, reason: FinishReason) {
  await ensureAll()
  const closed = await withTournament(id, async (client, row) => {
    if (!row || (row.status !== 'kayit' && row.status !== 'basladi')) return null
    return cancelIn(client, row, reason)
  })
  return afterClose(closed)
}

export async function cancelTournament(id: number) {
  await closeAndRefund(id, 'panel')
}

export async function deleteTournament(id: number) {
  await closeAndRefund(id, 'panel')
  await pool.query(`UPDATE game_tables SET status = 'iptal' WHERE tournament_id = $1 AND status = 'oynaniyor'`, [id])
  await pool.query('DELETE FROM tournament_entries WHERE tournament_id = $1', [id])
  await pool.query('DELETE FROM tournaments WHERE id = $1', [id])
  tournamentChanged()
}

export async function joinTournament(m: Member, id: number) {
  await assertCanPlay(m.id)
  const { withUserLock } = await import('@/lib/user-lock')
  return withUserLock(`tournament:${id}:${m.id}`, () => joinTournamentLocked(m, id))
}

async function joinTournamentLocked(m: Member, id: number) {
  // The wallet has to exist before the transaction: creating it inside would be rolled back with a refused entry.
  await Promise.all([ensureAll(), getBalance(m.id)])
  const paid = await withTournament(id, async (client, row) => {
    if (!row || row.status !== 'kayit') throw new Error('Bu turnuvanın kayıtları kapalı.')
    // Entries close at the start time itself, not whenever the start happens to be processed.
    if (passed(row.starts_at)) throw new Error('Kayıt süresi doldu, turnuva başlıyor.')
    const taken = await client.query(
      'SELECT count(*)::int AS n, (count(*) FILTER (WHERE user_id = $2))::int AS mine FROM tournament_entries WHERE tournament_id = $1',
      [id, m.id],
    )
    if (taken.rows[0].mine) throw new Error('Bu turnuvaya zaten kayıtlısın.')
    if (taken.rows[0].n >= Number(row.max_players)) throw new Error('Turnuva kontenjanı doldu.')
    const fee = Number(row.entry_fee)
    if (fee > 0 && (await applyCoins(m.id, -fee, 'Turnuva giriş ücreti', { min: 0, client })) === null) throw new Error('Yetersiz Kanka Coin.')
    await client.query(`INSERT INTO tournament_entries (tournament_id, nickname, telegram, user_id, fee_paid) VALUES ($1, $2, '', $3, $4)`, [
      id,
      m.name,
      m.id,
      fee,
    ])
    return { fee, title: String(row.title) }
  })
  if (paid.fee > 0) await noteFee(m.id, m.name, `Kayıt: ${paid.title}`, paid.fee, false)
}

export async function leaveTournament(m: Member, id: number) {
  await Promise.all([ensureAll(), getBalance(m.id)])
  const back = await withTournament(id, async (client, row) => {
    if (!row || row.status !== 'kayit') throw new Error('Turnuva başladıktan sonra ayrılamazsın.')
    const del = await client.query('DELETE FROM tournament_entries WHERE tournament_id = $1 AND user_id = $2 RETURNING fee_paid', [id, m.id])
    if (!del.rowCount) return null
    const fee = paidFee(del.rows[0], row)
    if (!(await refundIn(client, m.id, fee))) throw new Error('Ücret iade edilemedi, kaydın duruyor. Birazdan tekrar dene.')
    return { fee, title: String(row.title) }
  })
  if (back && back.fee > 0) await noteFee(m.id, m.name, `İade: ${back.title}`, back.fee, true)
}

export async function removeEntry(entryId: number) {
  await ensureAll()
  const found = await pool.query('SELECT tournament_id, user_id FROM tournament_entries WHERE id = $1', [entryId])
  const entry = found.rows[0]
  if (!entry) throw new Error('Kayıt bulunamadı. Sayfayı yenile.')
  if (entry.user_id) await getBalance(entry.user_id)
  const back = await withTournament(Number(entry.tournament_id), async (client, row) => {
    if (!row || row.status !== 'kayit') throw new Error('Turnuva başladıktan sonra katılımcı çıkarılamaz.')
    const del = await client.query('DELETE FROM tournament_entries WHERE id = $1 RETURNING user_id, nickname, fee_paid', [entryId])
    const gone = del.rows[0]
    if (!gone) throw new Error('Kayıt bulunamadı. Sayfayı yenile.')
    const who = { name: String(gone.nickname), title: String(row.title) }
    if (!gone.user_id) return { ...who, userId: null, fee: 0 }
    const fee = paidFee(gone, row)
    if (!(await refundIn(client, gone.user_id, fee))) throw new Error('Ücret iade edilemedi, kayıt silinmedi.')
    return { ...who, userId: String(gone.user_id), fee }
  })
  if (back.userId && back.fee > 0) await noteFee(back.userId, back.name, `Kayıt iadesi: ${back.title}`, back.fee, true)
  return { name: back.name, title: back.title, fee: Math.max(0, back.fee) }
}

/** Pairs the entrants inside the caller's transaction. The entrants are read under the tournament's lock: whoever is paired is exactly whoever is registered. */
async function pairIn(client: PoolClient, row: Row) {
  const seats = tournamentSeats(String(row.game))
  if (!seats) throw new Error('Bu oyunda turnuva oynanamıyor.')
  const entries = await client.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1 ORDER BY created_at ASC', [row.id])
  if (entries.rows.length < minEntrants(seats)) throw new Error(`Başlatmak için en az ${minEntrants(seats)} oyuncu gerekli.`)
  const keys = entries.rows.map(entryKey)
  const bracket = seats > 2 ? createTableBracket(keys, seats, TABLE_PASS) : row.format === 'lig' ? createLeague(keys) : createBracket(keys, 2)
  await client.query(`UPDATE tournaments SET status = 'basladi', bracket = $2::jsonb, winner = NULL, table_size = $3 WHERE id = $1`, [
    row.id,
    JSON.stringify(bracket),
    seats,
  ])
}

/** Why this tournament cannot be paired at all, whoever has entered: its game or its format has no tournament any more. */
function unplayable(row: Row) {
  const seats = tournamentSeats(String(row.game))
  if (!seats) return 'Bu oyunda artık turnuva oynanmıyor. Turnuvayı iptal et ya da "Bilgileri düzenle"den oyunu değiştir.'
  if (seats > 2 && row.format === 'lig') return 'Bu oyun ortak masalarda oynanıyor, lig düzeni yok. "Bilgileri düzenle"den düzeni eleme yap.'
  return null
}

/** The panel's "start now": pairs every entrant at once and opens all first-round tables together. */
export async function startTournament(id: number) {
  await ensureAll()
  const started = await withTournament(id, async (client, row) => {
    if (!row || row.status !== 'kayit') return false
    const blocked = unplayable(row)
    if (blocked) throw new Error(blocked)
    if (passed(row.ends_at)) throw new Error('Bitiş saati geçmiş. Önce "Bilgileri düzenle"den bitiş saatini ileri al.')
    await pairIn(client, row)
    return true
  })
  if (!started) return
  await openReadyMatches(id)
  tournamentChanged()
}

/**
 * The start time has come. With enough entrants (two for a duel, one full table otherwise) the
 * tournament starts; otherwise, or when it could not be played any more, it is cancelled and every fee goes back.
 */
export async function startDueTournament(id: number) {
  await ensureAll()
  const out = await withTournament(id, async (client, row) => {
    if (!row || row.status !== 'kayit' || !passed(row.starts_at)) return null
    const entered = await client.query('SELECT count(*)::int AS n FROM tournament_entries WHERE tournament_id = $1', [id])
    const reason: FinishReason | null = passed(row.ends_at)
      ? 'gec'
      : unplayable(row)
        ? 'oyun'
        : entered.rows[0].n < minEntrants(tournamentSeats(String(row.game)) ?? 2)
          ? 'kayit-yok'
          : null
    if (reason) return { closed: await cancelIn(client, row, reason) }
    await pairIn(client, row)
    return { closed: null }
  })
  if (!out) return
  if (out.closed) {
    await afterClose(out.closed)
    return
  }
  await openReadyMatches(id)
  tournamentChanged()
}

type Opened = { game: string; title: string; round: string; joinMinutes: number; shared: boolean; matches: { tableId: string; players: { id: string; name: string }[] }[] }

/**
 * Opens a table for every match whose players are known and still unplayed, but only
 * once the whole previous round has finished so winners wait and advance together. When
 * nothing is left to play it closes the tournament instead. At a shared table the seats
 * nobody is named for go to bots, which can neither go through nor win anything.
 */
async function openReadyMatches(id: number) {
  await ensureAll()
  const out = await withTournament(id, async (client, row): Promise<{ closed?: Closed | null; opened?: Opened } | null> => {
    if (!row || row.status !== 'basladi' || !row.bracket) return null
    const bracket = row.bracket as Bracket
    if (bracketOver(bracket)) return { closed: await finishTournament(client, row, bracket, 'tamam') }
    // Past the end time no new match opens: the tournament is about to be closed as it stands.
    if (passed(row.ends_at)) return null
    const roundIdx = openRound(bracket)
    if (roundIdx < 0) return null
    const seats = bracket.seats ?? 2
    const setup = tournamentTable(String(row.game), seats)
    const existing = await client.query(
      `SELECT match_no FROM game_tables WHERE tournament_id = $1 AND round_no = $2 AND status IN ('oynaniyor','bitti')`,
      [id, roundIdx],
    )
    const opened = new Set(existing.rows.map((e) => Number(e.match_no)))
    const names = await client.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1', [id])
    const nicknames = new Map<string, string>(names.rows.map((n) => [entryKey(n), String(n.nickname)]))
    const tables: { match_no: number; players: unknown; state: unknown; bots: number }[] = []
    for (const [mi, match] of bracket.rounds[roundIdx].entries()) {
      if (!isRealMatch(match) || isDecided(match) || opened.has(mi)) continue
      const keys = match.players.filter((p): p is string => Boolean(p))
      const botSeats = Array.from({ length: Math.max(0, seats - keys.length) }, (_, i) => keys.length + i)
      const botNames = pickBotNames(botSeats.length)
      tables.push({
        match_no: mi,
        players: [
          ...keys.map((key, seat) => ({ id: key, name: nicknames.get(key) ?? key, seat })),
          ...botSeats.map((seat, i) => ({ id: `bot:${seat}`, name: botNames[i], seat, bot: true })),
        ],
        state: initState(row.game as never, { ...setup, bots: botSeats.length, botSeats }),
        bots: botSeats.length,
      })
    }
    if (!tables.length) return null
    const league = row.format === 'lig'
    const shared = seats > 2
    const joinMinutes = joinMinutesOf(row)
    const round = roundName(league, roundIdx, bracket.rounds.length)
    const tour: TableTour = {
      title: String(row.title),
      round,
      league,
      joinBy: new Date(Date.now() + joinMinutes * 60_000).toISOString(),
      ...(shared ? { pass: roundIdx === bracket.rounds.length - 1 ? 1 : Math.max(1, bracket.pass ?? 1) } : {}),
    }
    // One statement for the whole round: a 1024-player bracket opens 512 tables while the tournament row is locked.
    const made = await client.query(
      `INSERT INTO game_tables (game, stake, seats, status, players, state, created_by, mode, tournament_id, round_no, match_no, options)
       SELECT $1, 0, $6, 'oynaniyor', t.players, t.state, 'turnuva', 'turnuva', $2, $3, t.match_no, $5::jsonb || jsonb_build_object('bots', t.bots)
       FROM jsonb_to_recordset($4::jsonb) AS t(match_no int, players jsonb, state jsonb, bots int)
       RETURNING id, players`,
      [row.game, id, roundIdx, JSON.stringify(tables), JSON.stringify({ ...setup, tour }), seats],
    )
    return {
      opened: {
        game: String(row.game),
        title: String(row.title),
        round,
        joinMinutes,
        shared,
        matches: made.rows.map((t) => ({
          tableId: String(t.id),
          players: ((t.players as { id: string; name: string; bot?: boolean }[]) ?? []).filter((p) => !p.bot),
        })),
      },
    }
  })
  if (!out) return
  if (out.closed !== undefined) {
    await afterClose(out.closed)
    return
  }
  if (out.opened?.matches.length) {
    const { notifyMatchReady } = await import('./tournament-notify')
    await notifyMatchReady(out.opened)
  }
}

/**
 * Writes the result inside the caller's transaction. `tamam`: every match is decided. `sure`: the end
 * time came first, so the league stands as it is and a knockout without a champion shares its top prizes.
 * A tournament in which nobody won a single match was not played: it is cancelled and the fees go back.
 */
async function finishTournament(client: PoolClient, row: Row, bracket: Bracket, reason: 'tamam' | 'sure'): Promise<Closed | null> {
  if (!anyWin(bracket)) return cancelIn(client, row, 'oynanmadi')
  const entries = await client.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1 ORDER BY created_at ASC', [row.id])
  const order = entries.rows.map(entryKey)
  const format: TournamentFormat = row.format === 'lig' ? 'lig' : 'eleme'
  const champion = format === 'lig' ? (leagueStandings(bracket, order)[0]?.key ?? null) : bracketChampion(bracket)
  const who = champion ? entries.rows.find((x) => entryKey(x) === champion) : undefined
  const upd = await client.query(
    `UPDATE tournaments SET status = 'bitti', winner = $2, bracket = $3::jsonb, finished_at = now(), finish_reason = $4
     WHERE id = $1 AND status = 'basladi' RETURNING id`,
    [row.id, champion ? String(who?.nickname ?? champion) : null, JSON.stringify(bracket), reason],
  )
  if (!upd.rowCount) return null
  if (reason === 'sure') {
    await client.query(
      `UPDATE game_tables SET status = 'iptal', updated_at = now(), options = COALESCE(options, '{}'::jsonb) || '{"how":"bitis"}'::jsonb
       WHERE tournament_id = $1 AND status = 'oynaniyor'`,
      [row.id],
    )
  }
  const maxPlayers = Number(row.max_players)
  const tableSize = bracket.seats ?? 2
  const payouts = tournamentPayouts(
    { format, maxPlayers, tableSize, prizes: cleanPrizes(row.prizes, format, maxPlayers, tableSize), prizePool: Number(row.prize_pool) },
    bracket,
    order,
    reason === 'sure',
  )
  const prizes: PaidPrize[] = []
  for (const p of payouts) {
    const player = entries.rows.find((x) => entryKey(x) === p.key)
    if (!player?.user_id) continue
    const paid = await payPrizeIn(client, Number(row.id), { userId: String(player.user_id), name: String(player.nickname), key: p.key }, p)
    if (paid) prizes.push(paid)
  }
  return { id: Number(row.id), status: 'bitti', reason, title: String(row.title), refunds: [], entrants: [], prizes, champion: who?.user_id ? String(who.user_id) : null }
}

/**
 * Pays one place inside the caller's transaction, so the result and every prize are written together or
 * not at all. It must not reach for another connection: requests waiting for this tournament's row each
 * hold one, and a payout that needed one more would wait for them for ever.
 * The claim row keeps a place that was already paid from being paid again.
 */
async function payPrizeIn(client: PoolClient, tournamentId: number, player: { userId: string; name: string; key: string }, prize: Payout): Promise<PaidPrize | null> {
  if (!Number.isInteger(prize.amount) || prize.amount <= 0) return null
  const claim = await client.query(
    `INSERT INTO tournament_payouts (tournament_id, player_key, place, amount) VALUES ($1, $2, $3, $4)
     ON CONFLICT (tournament_id, player_key) DO NOTHING RETURNING tournament_id`,
    [tournamentId, player.key, prize.place, prize.amount],
  )
  if (!claim.rowCount) return null
  if ((await applyCoins(player.userId, prize.amount, 'Turnuva ödülü', { client })) === null) {
    // Every entrant got a wallet when joining; one that is gone since has nowhere to be paid into.
    await client.query('DELETE FROM tournament_payouts WHERE tournament_id = $1 AND player_key = $2', [tournamentId, player.key])
    console.error('[tournaments] ödül yüklenecek cüzdan yok', player.userId)
    return null
  }
  const what = prize.shared ? 'Süre bitimi ödül payı' : prize.place === 0 ? 'Şampiyonluk' : `${prize.label} sıra ödülü`
  return { userId: player.userId, name: player.name, amount: prize.amount, what }
}

/** Changes one match of a running tournament, then opens the next round or closes the tournament. */
async function settleMatch(id: number, change: (bracket: Bracket, league: boolean) => Bracket) {
  await ensureAll()
  await withTournament(id, async (client, row) => {
    if (row?.status !== 'basladi' || !row.bracket) return
    const next = change(row.bracket as Bracket, row.format === 'lig')
    await client.query('UPDATE tournaments SET bracket = $2::jsonb WHERE id = $1', [id, JSON.stringify(next)])
  })
  await openReadyMatches(id)
  tournamentChanged()
}

/** Records a match result. `noShow` names a loser who never sat down; such a player earns no ranking prize from this match. */
export async function advanceTournament(id: number, round: number, match: number, winnerKey: string, noShow: string[] = []) {
  await settleMatch(id, (bracket, league) => (league ? setLeagueWinner : setMatchWinner)(bracket, round, match, winnerKey, noShow))
}

/** Closes a match nobody won: both players are out of it. `noShow` names those who never sat down. */
export async function voidTournamentMatch(id: number, round: number, match: number, noShow: string[] = []) {
  await settleMatch(id, (bracket, league) => (league ? voidLeagueMatch : voidMatch)(bracket, round, match, noShow))
}

/**
 * Records how a shared table finished: `rank` is the whole table from best to worst, `through` the
 * players who finished it and go on. `noShow` names those who never sat down.
 */
export async function settleTournamentTable(id: number, round: number, match: number, rank: string[], through: string[], noShow: string[] = []) {
  await settleMatch(id, (bracket) => setTableResult(bracket, round, match, rank, through, noShow))
}

/**
 * The panel names the winner of a match that is still open. A written result stays as it is: changing
 * it would leave the next round's table with a player who no longer belongs there.
 * Returns the names for the panel's log.
 */
export async function adminSetMatchWinner(id: number, round: number, match: number, winnerKey: string) {
  const found = await pool.query(`SELECT status, format, game, bracket FROM tournaments WHERE id = $1`, [id])
  const row = found.rows[0]
  if (!row) throw new Error('Turnuva bulunamadı. Sayfayı yenile.')
  if (row.status !== 'basladi' || !row.bracket) throw new Error('Sonuç ancak devam eden bir turnuvada girilebilir.')
  const bracket = row.bracket as Bracket
  const league = row.format === 'lig'
  const m = bracket.rounds[round]?.[match]
  if (!m || !isRealMatch(m)) throw new Error('Maç bulunamadı. Sayfayı yenile.')
  if (isDecided(m)) throw new Error('Bu maçın sonucu yazılmış. Biten bir maçın sonucu değiştirilemez.')
  if (!m.players.includes(winnerKey)) throw new Error('Seçilen oyuncu bu maçta değil. Sayfayı yenile.')
  const names = await pool.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1', [id])
  const nameOf = (key: string) => String(names.rows.find((n) => entryKey(n) === key)?.nickname ?? key)
  const said = {
    round: roundName(league, round, bracket.rounds.length),
    winner: nameOf(winnerKey),
    players: m.players.filter((p): p is string => Boolean(p)).map(nameOf),
  }
  const { adminFinishTourTable, adminFinishDuelTable } = await import('./pvp/tables')
  if (bracket.seats) {
    // A shared table sends more than one player on, so its result is read from the open table itself.
    if (!(await adminFinishTourTable(id, round, match, winnerKey))) throw new Error('Bu masa açık değil ya da seçilen oyuncu masada değil. Sonuç ancak açık bir masada girilebilir.')
    return said
  }
  if (await adminFinishDuelTable(id, round, match, winnerKey)) return said
  // No open table. Only a match of the round being played can be named: a later round's players are
  // not settled yet, and its tables open by themselves once this round is over.
  if (round !== openRound(bracket)) throw new Error('Bu maçın turu henüz açılmadı. Önce açık turdaki maçlar bitmeli.')
  // A tournament from before a table was opened for every match. The result goes straight into the
  // pairing, and only while the match is still undecided under the tournament's lock.
  let written = false
  await settleMatch(id, (b, lig) => {
    const now = b.rounds[round]?.[match]
    if (!now || isDecided(now) || !now.players.includes(winnerKey)) return b
    written = true
    return (lig ? setLeagueWinner : setMatchWinner)(b, round, match, winnerKey)
  })
  if (!written) throw new Error('Bu maçın sonucu az önce yazıldı. Sayfayı yenile.')
  for (const key of m.players) {
    const entrant = key ? names.rows.find((n) => entryKey(n) === key) : undefined
    if (!entrant?.user_id) continue
    const rival = m.players.find((p) => p && p !== key)
    await recordHistory({
      userId: String(entrant.user_id),
      userName: String(entrant.nickname),
      game: String(row.game),
      mode: 'turnuva',
      opponent: `${rival ? nameOf(rival) : 'Rakip'} (${MATCH_END_LABEL.panel})`,
      stake: 0,
      result: key === winnerKey ? 'win' : 'loss',
      delta: 0,
    }).catch((error) => console.error('[tournaments] elle sonuç geçmişe yazılamadı', (error as Error).message))
  }
  return said
}

/**
 * The end time has come: open tables close and the result is written from what has been played.
 * Does nothing before the end time or once the tournament is closed.
 */
export async function cutTournament(id: number) {
  await ensureAll()
  const closed = await withTournament(id, async (client, row) => {
    if (!row || row.status !== 'basladi' || !row.bracket || !passed(row.ends_at)) return null
    return finishTournament(client, row, row.bracket as Bracket, 'sure')
  })
  await afterClose(closed)
}

/** The member's open tournament tables, oldest first. Empty without a query while no tournament is being played. */
export async function myMatches(userId: string): Promise<MyMatch[]> {
  if (!(await anyRunning())) return []
  const r = await pool.query(
    `SELECT g.id, g.game, g.round_no, g.seats, t.id AS tournament_id, t.title, t.format,
            jsonb_array_length(COALESCE(t.bracket->'rounds', '[]'::jsonb)) AS rounds,
            COALESCE(g.options->'seen', '{}'::jsonb) ? $2 AS seated,
            CASE WHEN COALESCE(g.options->'seen', '{}'::jsonb) ? $2 THEN NULL ELSE g.options->'tour'->>'joinBy' END AS join_by
     FROM game_tables g JOIN tournaments t ON t.id = g.tournament_id
     WHERE g.status = 'oynaniyor' AND t.status = 'basladi' AND g.players @> $1::jsonb
     ORDER BY g.created_at ASC`,
    [JSON.stringify([{ id: userId }]), userId],
  )
  return r.rows.map((x) => ({
    tableId: String(x.id),
    tournamentId: Number(x.tournament_id),
    game: String(x.game),
    title: String(x.title),
    round: roundName(x.format === 'lig', Number(x.round_no), Number(x.rounds)),
    joinBy: x.join_by ? new Date(String(x.join_by)).toISOString() : null,
    seated: x.seated === true,
    shared: Number(x.seats) > 2,
  }))
}
