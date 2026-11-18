import 'server-only'
import { revalidatePath } from 'next/cache'
import type { PoolClient } from 'pg'
import { pool } from '@/lib/db'
import { credit, getBalance, recordHistory, type Member } from '@/lib/member'
import { assertCanPlay } from '@/lib/member-limits'
import { applyCoins, ensureLedger } from '@/lib/wallet-ledger'
import type { ArenaGame } from './arena'
import { anyWin, bracketChampion, bracketOver, createBracket, isDecided, isRealMatch, setMatchWinner, voidMatch, type Bracket } from './bracket'
import { createLeague, leagueStandings, MAX_LEAGUE_PLAYERS, setLeagueWinner, voidLeagueMatch } from './league'
import { initState } from './pvp/rules'
import { tournamentTable } from './tournament-games'
import { cleanPrizes, prizeTotal, tournamentPayouts, type Payout } from './tournament-prizes'
import {
  MAX_TOURNAMENT_PLAYERS,
  TOURNAMENT_MONEY_GAME,
  cleanJoinMinutes,
  isFinishReason,
  roundName,
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
    prizes: cleanPrizes(r.prizes, r.format === 'lig' ? 'lig' : 'eleme', Number(r.max_players)),
    prizeNote: String(r.prize_note ?? ''),
    maxPlayers: Number(r.max_players),
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
  })().catch((error) => {
    columnsReady = null
    throw error
  })
  return columnsReady
}

function prizeColumns(t: TournamentInput) {
  const maxPlayers = clampPlayers(t.maxPlayers, t.format)
  const prizes = cleanPrizes(t.prizes, t.format, maxPlayers)
  return { maxPlayers, prizes: JSON.stringify(prizes), pool: prizeTotal(t.format, maxPlayers, prizes) }
}

const settingsOf = (t: TournamentInput) => JSON.stringify({ joinMinutes: cleanJoinMinutes(t.joinMinutes) })

export async function createTournament(t: TournamentInput) {
  await ensureColumns()
  const p = prizeColumns(t)
  await pool.query(
    `INSERT INTO tournaments (game, title, description, rules, entry_fee, prize_pool, prize_note, max_players, starts_at, format, table_size, prizes, ends_at, settings)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,2,$11::jsonb,$12,$13::jsonb)`,
    [t.game, t.title, t.description, t.rules, t.entryFee, p.pool, t.prizeNote, p.maxPlayers, t.startsAt, t.format, p.prizes, t.endsAt ?? null, settingsOf(t)],
  )
}

/** Everything can change while entries are open. False when the tournament has already started or closed. */
export async function updateTournament(id: number, t: TournamentInput) {
  await ensureColumns()
  const p = prizeColumns(t)
  const r = await pool.query(
    `UPDATE tournaments SET game=$2, title=$3, description=$4, rules=$5, entry_fee=$6, prize_pool=$7, prize_note=$8,
       max_players=$9, starts_at=$10, format=$11, prizes=$12::jsonb, ends_at=$13, settings=$14::jsonb WHERE id=$1 AND status = 'kayit' RETURNING id`,
    [id, t.game, t.title, t.description, t.rules, t.entryFee, p.pool, t.prizeNote, p.maxPlayers, t.startsAt, t.format, p.prizes, t.endsAt ?? null, settingsOf(t)],
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
    if (indexes.includes('tournament_entries_unique')) await pool.query('DROP INDEX IF EXISTS tournament_entries_unique')
    if (!indexes.includes('tournament_entries_member')) {
      await pool
        .query(`CREATE UNIQUE INDEX IF NOT EXISTS tournament_entries_member ON tournament_entries (tournament_id, user_id) WHERE user_id IS NOT NULL`)
        .catch((error) => console.error('[tournaments] üye dizini kurulamadı', (error as Error).message))
    }
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

/** What closing a tournament leaves to do once its transaction has committed. */
type Closed = { status: 'bitti' | 'iptal'; reason: FinishReason; title: string; refunds: Refund[]; entrants: Refund[] }

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
  return { status: 'iptal', reason, title: String(row.title), refunds, entrants }
}

/** History rows and messages are written after the commit: they may fail without undoing a cancel or a result. */
async function afterClose(closed: Closed | null) {
  if (!closed) return false
  for (const r of closed.refunds) await noteFee(r.userId, r.name, `İptal iadesi: ${closed.title}`, r.fee, true)
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
    if (!gone.user_id) return null
    const fee = paidFee(gone, row)
    if (!(await refundIn(client, gone.user_id, fee))) throw new Error('Ücret iade edilemedi, kayıt silinmedi.')
    return { userId: String(gone.user_id), name: String(gone.nickname), fee, title: String(row.title) }
  })
  if (back && back.fee > 0) await noteFee(back.userId, back.name, `Kayıt iadesi: ${back.title}`, back.fee, true)
}

/** Pairs the entrants inside the caller's transaction. The entrants are read under the tournament's lock: whoever is paired is exactly whoever is registered. */
async function pairIn(client: PoolClient, row: Row) {
  const entries = await client.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1 ORDER BY created_at ASC', [row.id])
  if (entries.rows.length < 2) throw new Error('Başlatmak için en az 2 oyuncu gerekli.')
  const keys = entries.rows.map(entryKey)
  const bracket = row.format === 'lig' ? createLeague(keys) : createBracket(keys, 2)
  await client.query(`UPDATE tournaments SET status = 'basladi', bracket = $2::jsonb, winner = NULL WHERE id = $1`, [row.id, JSON.stringify(bracket)])
}

/** The panel's "start now": pairs every entrant at once and opens all first-round tables together. */
export async function startTournament(id: number) {
  await ensureAll()
  const started = await withTournament(id, async (client, row) => {
    if (!row || row.status !== 'kayit') return false
    if (!tournamentTable(String(row.game))) throw new Error('Bu oyun iki kişiyle oynanamadığı için turnuvası başlatılamaz.')
    if (passed(row.ends_at)) throw new Error('Bitiş saati geçmiş. Önce "Bilgileri düzenle"den bitiş saatini ileri al.')
    await pairIn(client, row)
    return true
  })
  if (!started) return
  await openReadyMatches(id)
  tournamentChanged()
}

/**
 * The start time has come. With two or more entrants the tournament starts; otherwise, or when it
 * could not be played any more, it is cancelled and every fee goes back.
 */
export async function startDueTournament(id: number) {
  await ensureAll()
  const out = await withTournament(id, async (client, row) => {
    if (!row || row.status !== 'kayit' || !passed(row.starts_at)) return null
    const entered = await client.query('SELECT count(*)::int AS n FROM tournament_entries WHERE tournament_id = $1', [id])
    const reason: FinishReason | null = passed(row.ends_at)
      ? 'gec'
      : entered.rows[0].n < 2
        ? 'kayit-yok'
        : tournamentTable(String(row.game))
          ? null
          : 'oyun'
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

type Opened = { game: string; title: string; round: string; joinMinutes: number; matches: { tableId: string; players: { id: string; name: string }[] }[] }

/**
 * Opens a table for every match whose two players are known and still unplayed, but only
 * once the whole previous round has finished so winners wait and advance together. When
 * nothing is left to play it closes the tournament instead.
 */
async function openReadyMatches(id: number) {
  await ensureAll()
  const out = await withTournament(id, async (client, row): Promise<{ closed?: Closed | null; opened?: Opened } | null> => {
    if (!row || row.status !== 'basladi' || !row.bracket) return null
    const bracket = row.bracket as Bracket
    if (bracketOver(bracket)) return { closed: await finishTournament(client, row, bracket, 'tamam') }
    // Past the end time no new match opens: the tournament is about to be closed as it stands.
    if (passed(row.ends_at)) return null
    const roundIdx = bracket.rounds.findIndex((round) => round.some((m) => isRealMatch(m) && !isDecided(m)))
    if (roundIdx < 0) return null
    const earlierOpen = bracket.rounds.slice(0, roundIdx).some((round) => round.some((m) => !isDecided(m) && m.players.some(Boolean)))
    if (earlierOpen) return null
    const setup = tournamentTable(String(row.game))
    if (!setup) return null
    const existing = await client.query(
      `SELECT match_no FROM game_tables WHERE tournament_id = $1 AND round_no = $2 AND status IN ('oynaniyor','bitti')`,
      [id, roundIdx],
    )
    const opened = new Set(existing.rows.map((e) => Number(e.match_no)))
    const names = await client.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1', [id])
    const nicknames = new Map<string, string>(names.rows.map((n) => [entryKey(n), String(n.nickname)]))
    const tables: { match_no: number; players: unknown; state: unknown }[] = []
    for (const [mi, match] of bracket.rounds[roundIdx].entries()) {
      if (!isRealMatch(match) || isDecided(match) || opened.has(mi)) continue
      tables.push({
        match_no: mi,
        players: (match.players as string[]).map((key, seat) => ({ id: key, name: nicknames.get(key) ?? key, seat })),
        state: initState(row.game as never, { ...setup, botSeats: [] }),
      })
    }
    if (!tables.length) return null
    const league = row.format === 'lig'
    const joinMinutes = joinMinutesOf(row)
    const round = roundName(league, roundIdx, bracket.rounds.length)
    const tour: TableTour = { title: String(row.title), round, league, joinBy: new Date(Date.now() + joinMinutes * 60_000).toISOString() }
    // One statement for the whole round: a 1024-player bracket opens 512 tables while the tournament row is locked.
    const made = await client.query(
      `INSERT INTO game_tables (game, stake, seats, status, players, state, created_by, mode, tournament_id, round_no, match_no, options)
       SELECT $1, 0, 2, 'oynaniyor', t.players, t.state, 'turnuva', 'turnuva', $2, $3, t.match_no, $5::jsonb
       FROM jsonb_to_recordset($4::jsonb) AS t(match_no int, players jsonb, state jsonb)
       RETURNING id, players`,
      [row.game, id, roundIdx, JSON.stringify(tables), JSON.stringify({ ...setup, tour })],
    )
    return {
      opened: {
        game: String(row.game),
        title: String(row.title),
        round,
        joinMinutes,
        matches: made.rows.map((t) => ({ tableId: String(t.id), players: (t.players as { id: string; name: string }[]) ?? [] })),
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
  if (who?.user_id) {
    const { rewardTournamentWin } = await import('@/lib/kanka-puan')
    await rewardTournamentWin(who.user_id, Number(row.id), String(row.title))
  }
  const maxPlayers = Number(row.max_players)
  const payouts = tournamentPayouts(
    { format, maxPlayers, prizes: cleanPrizes(row.prizes, format, maxPlayers), prizePool: Number(row.prize_pool) },
    bracket,
    order,
    reason === 'sure',
  )
  for (const p of payouts) {
    const player = entries.rows.find((x) => entryKey(x) === p.key)
    if (!player?.user_id) continue
    await payPrize(Number(row.id), { userId: player.user_id, name: player.nickname, key: p.key }, p, { game: String(row.game), title: String(row.title) })
  }
  return { status: 'bitti', reason, title: String(row.title), refunds: [], entrants: [] }
}

/**
 * The claim row is what makes a payout happen once: finishing runs inside a transaction that can be
 * retried, and a retry must not pay the places that were already credited.
 */
async function payPrize(
  tournamentId: number,
  player: { userId: string; name: string; key: string },
  prize: Payout,
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
  const what = prize.shared ? 'Süre bitimi ödül payı' : prize.place === 0 ? 'Şampiyonluk' : `${prize.label} sıra ödülü`
  await recordHistory({ userId: player.userId, userName: player.name, game: TOURNAMENT_MONEY_GAME, mode: 'odul', opponent: `${what}: ${t.title}`, stake: 0, result: 'win', delta: prize.amount }).catch((error) =>
    console.error('[tournaments] ödül geçmişi yazılamadı', (error as Error).message),
  )
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

/** Admin override for no-shows: closes the live table and advances the chosen player. */
export async function adminSetMatchWinner(id: number, round: number, match: number, winnerKey: string) {
  await pool.query(
    `UPDATE game_tables SET status = 'bitti', winner_id = $4, updated_at = now(), options = COALESCE(options, '{}'::jsonb) || '{"how":"panel"}'::jsonb
     WHERE tournament_id = $1 AND round_no = $2 AND match_no = $3 AND status = 'oynaniyor'`,
    [id, round, match, winnerKey],
  )
  await advanceTournament(id, round, match, winnerKey)
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
    `SELECT g.id, g.game, g.round_no, t.id AS tournament_id, t.title, t.format,
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
  }))
}
