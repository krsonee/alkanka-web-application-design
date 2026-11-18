import 'server-only'
import { revalidatePath } from 'next/cache'
import type { PoolClient } from 'pg'
import { pool } from '@/lib/db'
import { credit, getBalance, recordHistory, type Member } from '@/lib/member'
import { assertCanPlay } from '@/lib/member-limits'
import { applyCoins, ensureLedger } from '@/lib/wallet-ledger'
import type { ArenaGame } from './arena'
import { bracketChampion, createBracket, setMatchWinner, type Bracket } from './bracket'
import { createLeague, leagueChampion, MAX_LEAGUE_PLAYERS, setLeagueWinner } from './league'
import { initState } from './pvp/rules'
import { cleanPrizes, prizeTotal, tournamentPayouts } from './tournament-prizes'
import {
  MAX_TOURNAMENT_PLAYERS,
  TOURNAMENT_MONEY_GAME,
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

/**
 * Runs `fn` in one transaction that holds the tournament's row. Joining, leaving, removing an entrant,
 * starting and cancelling all go through here, so none of them can see a half-finished other.
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
 * Closes an open or running tournament and returns every fee. The status change and all refunds commit
 * together, so a failure half way leaves the tournament untouched and the cancel can simply be repeated.
 */
async function closeAndRefund(id: number) {
  await Promise.all([ensureEntries(), ensureLedger()])
  const closed = await withTournament(id, async (client, row) => {
    if (!row || (row.status !== 'kayit' && row.status !== 'basladi')) return null
    await client.query(`UPDATE tournaments SET status = 'iptal' WHERE id = $1`, [id])
    const entries = await client.query(
      'SELECT user_id, nickname, fee_paid FROM tournament_entries WHERE tournament_id = $1 AND user_id IS NOT NULL ORDER BY id ASC',
      [id],
    )
    const refunds: Refund[] = []
    for (const entry of entries.rows) {
      const fee = paidFee(entry, row)
      if (fee <= 0) continue
      if (await refundIn(client, entry.user_id, fee)) refunds.push({ userId: entry.user_id, name: entry.nickname, fee })
      else console.error('[tournaments] iade edilecek cüzdan yok', entry.user_id)
    }
    return { refunds, title: String(row.title) }
  })
  if (!closed) return false
  await pool.query(`UPDATE game_tables SET status = 'iptal', updated_at = now() WHERE tournament_id = $1 AND status = 'oynaniyor'`, [id])
  for (const r of closed.refunds) await noteFee(r.userId, r.name, `İptal iadesi: ${closed.title}`, r.fee, true)
  return true
}

export async function cancelTournament(id: number) {
  if (await closeAndRefund(id)) tournamentChanged()
}

export async function deleteTournament(id: number) {
  await closeAndRefund(id)
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
  await Promise.all([ensureEntries(), ensureLedger(), getBalance(m.id)])
  const paid = await withTournament(id, async (client, row) => {
    if (!row || row.status !== 'kayit') throw new Error('Bu turnuvanın kayıtları kapalı.')
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
  await Promise.all([ensureEntries(), ensureLedger(), getBalance(m.id)])
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
  await Promise.all([ensureEntries(), ensureLedger()])
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

export async function autoStartDue() {
  const due = await pool.query(
    `SELECT id FROM tournaments t WHERE status = 'kayit' AND starts_at <= now()
       AND (SELECT count(*) FROM tournament_entries e WHERE e.tournament_id = t.id) >= 2`,
  )
  for (const r of due.rows) await startTournament(Number(r.id)).catch((e) => console.error('[tournaments] otomatik başlatma', e))
}

/** Pairs every entrant at once and opens all first-round tables simultaneously. */
export async function startTournament(id: number) {
  // The entrants are read under the tournament's lock: whoever is paired is exactly whoever is registered.
  const started = await withTournament(id, async (client, row) => {
    if (!row || row.status !== 'kayit') return false
    const entries = await client.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1 ORDER BY created_at ASC', [id])
    if (entries.rows.length < 2) throw new Error('Başlatmak için en az 2 oyuncu gerekli.')
    const keys = entries.rows.map(entryKey)
    const bracket = row.format === 'lig' ? createLeague(keys) : createBracket(keys, 2)
    await client.query(`UPDATE tournaments SET status = 'basladi', bracket = $2::jsonb, winner = NULL WHERE id = $1`, [id, JSON.stringify(bracket)])
    return true
  })
  if (!started) return
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
  await recordHistory({ userId: player.userId, userName: player.name, game: TOURNAMENT_MONEY_GAME, mode: 'odul', opponent: `${what}: ${t.title}`, stake: 0, result: 'win', delta: prize.amount }).catch((error) =>
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
