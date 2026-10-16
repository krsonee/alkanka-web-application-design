import { capPayout } from '@/lib/member-limits'
import 'server-only'
import { pool } from '@/lib/db'
import { credit, debit, recordHistory, type Member } from '@/lib/member'
import { getArenaSettings } from '@/lib/arena-server'
import { TURN_SECONDS } from '@/lib/arena'
import {
  autoMove,
  applyAction,
  currentTurn,
  initState,
  isPvpGame,
  isSeatGame,
  okeySeats,
  seatGameToBot,
  seatToBot,
  viewState,
  type Outcome,
  type PvpState,
  type TableOptions,
} from './rules'

import { normalizeVariant } from '@/lib/games/batak'
import { normalizeTarget } from '@/lib/games/pisti'

export type Player = { id: string; name: string; seat: number; bot?: boolean }

export type TableRow = {
  id: string
  game: string
  stake: number
  seats: number
  status: 'bekliyor' | 'oynaniyor' | 'bitti' | 'iptal'
  players: Player[]
  state: PvpState | null
  version: number
  winnerId: string | null
  options: TableOptions & { winners?: string[]; lastActs?: Record<string, string>; forfeits?: number }
  createdBy: string
  tournamentId: number | null
  roundNo: number | null
  matchNo: number | null
  updatedAt: string
  createdAt: string
}

export const TURN_TIMEOUT_MS = 3 * 60 * 1000
export const DUEL_TIMEOUT_MS = 10 * 60 * 1000
export const IDLE_KICK_MS = 15 * 60 * 1000
const BOT_NAMES = ['Jako Bot', 'Kanka Bot', 'Usta Bot']

function mapTable(r: Record<string, unknown>): TableRow {
  const seats = Number(r.seats ?? 2) || 2
  const raw = (r.options as Partial<TableRow['options']> | null) ?? {}
  return {
    id: String(r.id),
    game: String(r.game),
    stake: Number(r.stake),
    seats,
    status: r.status as TableRow['status'],
    players: (r.players as Player[]) ?? [],
    state: (r.state as PvpState | null) ?? null,
    version: Number(r.version),
    winnerId: (r.winner_id as string | null) ?? null,
    options: {
      seats,
      team: raw.team === true,
      bots: Number(raw.bots ?? 0),
      ...(raw.rounds ? { rounds: Number(raw.rounds) } : {}),
      ...(raw.variant ? { variant: raw.variant } : {}),
      winners: raw.winners,
      lastActs: raw.lastActs,
      forfeits: Number(raw.forfeits ?? 0) || 0,
    },
    createdBy: String(r.created_by ?? ''),
    tournamentId: r.tournament_id == null ? null : Number(r.tournament_id),
    roundNo: r.round_no == null ? null : Number(r.round_no),
    matchNo: r.match_no == null ? null : Number(r.match_no),
    updatedAt: new Date(String(r.updated_at)).toISOString(),
    createdAt: new Date(String(r.created_at)).toISOString(),
  }
}

const humans = (t: TableRow) => t.players.filter((p) => !p.bot)
const seatsNeeded = (t: TableRow) => t.seats

export async function getTableRow(id: string) {
  const r = await pool.query('SELECT * FROM game_tables WHERE id = $1', [id])
  return r.rows[0] ? mapTable(r.rows[0]) : null
}

export function tableView(t: TableRow, userId: string | null) {
  const seat = t.players.find((p) => p.id === userId && !p.bot)?.seat ?? -1
  return {
    id: t.id,
    game: t.game,
    stake: t.stake,
    seats: t.seats,
    team: t.options.team,
    bots: t.options.bots,
    variant: t.options.variant ?? null,
    winners: t.options.winners ?? (t.winnerId ? [t.winnerId] : []),
    status: t.status,
    players: t.players,
    version: t.version,
    winnerId: t.winnerId,
    tournamentId: t.tournamentId,
    roundNo: t.roundNo,
    updatedAt: t.updatedAt,
    seat,
    spectator: seat < 0,
    turn: currentTurn(t.state),
    state: viewState(t.state, seat),
  }
}
export type TableView = ReturnType<typeof tableView>

export async function listOpenTables(game?: string) {
  const r = await pool.query(
    `SELECT * FROM game_tables WHERE tournament_id IS NULL AND status IN ('bekliyor','oynaniyor')
       AND ($1::text IS NULL OR game = $1) ORDER BY status ASC, created_at DESC LIMIT 60`,
    [game ?? null],
  )
  return r.rows.map(mapTable)
}

/** Every live table across all multiplayer games, tournaments included, for the spectator lobby. */
export async function listLiveTables() {
  const r = await pool.query(
    `SELECT * FROM game_tables WHERE status = 'oynaniyor' ORDER BY updated_at DESC LIMIT 80`,
  )
  return r.rows.map(mapTable)
}

export async function listMyActiveTables(userId: string) {
  const r = await pool.query(
    `SELECT * FROM game_tables WHERE status IN ('bekliyor','oynaniyor') AND players @> $1::jsonb ORDER BY updated_at DESC`,
    [JSON.stringify([{ id: userId }])],
  )
  return r.rows.map(mapTable)
}

const SEAT_RULES: Record<string, { seats: number[]; rounds: number[] }> = {
  okey101: { seats: [2, 4], rounds: [1, 3, 5] },
  batak: { seats: [4], rounds: [1, 3, 5] },
  monopoly: { seats: [2, 3, 4], rounds: [] },
  pisti: { seats: [2, 4], rounds: [] },
}

function normalizeOptions(game: string, input?: Partial<TableOptions>): TableOptions {
  const rule = SEAT_RULES[game]
  if (game === 'batak') {
    const variant = normalizeVariant(input?.variant)
    const seats = variant === 'gommeli' ? 3 : 4
    const bots = Math.max(0, Math.min(seats - 1, Math.floor(Number(input?.bots) || 0)))
    const rounds = rule.rounds.includes(Number(input?.rounds)) ? Number(input?.rounds) : rule.rounds[0]
    return { seats, team: variant === 'esli', bots, rounds, variant }
  }
  if (game === 'pisti') {
    const seats = Number(input?.seats) === 4 ? 4 : 2
    const bots = Math.max(0, Math.min(seats - 1, Math.floor(Number(input?.bots) || 0)))
    return { seats, team: seats === 4, bots, variant: String(normalizeTarget(input?.variant)) }
  }
  if (rule) {
    const seats = rule.seats.includes(Number(input?.seats)) ? Number(input?.seats) : rule.seats[rule.seats.length - 1]
    const bots = Math.max(0, Math.min(seats - 1, Math.floor(Number(input?.bots) || 0)))
    const rounds = rule.rounds.includes(Number(input?.rounds)) ? Number(input?.rounds) : rule.rounds[0]
    return { seats, team: false, bots, ...(rounds ? { rounds } : {}) }
  }
  if (game !== 'okey') return { seats: 2, team: false, bots: 0 }
  const seats = input?.seats === 4 ? 4 : 2
  if (typeof input?.team !== 'boolean') throw new Error('Takımlı ya da tekli oyun modunu seçmelisin.')
  if (input.team && seats !== 4) throw new Error('Takımlı okey sadece 4 kişilik masada oynanır.')
  const bots = seats === 4 ? Math.max(0, Math.min(2, Math.floor(Number(input?.bots) || 0))) : 0
  return { seats, team: input.team, bots }
}

export async function createTable(m: Member, game: string, stake: number, input?: Partial<TableOptions>) {
  if (!isPvpGame(game)) throw new Error('Bu oyun için kanka masası yok.')
  const settings = (await getArenaSettings())[game]
  if (!settings.enabled || !settings.pvpEnabled) throw new Error('Kanka masaları şu an kapalı.')
  if (!settings.bets.includes(stake)) throw new Error('Geçersiz bahis.')
  const opts = normalizeOptions(game, input)
  const open = await pool.query(
    `SELECT count(*)::int AS n FROM game_tables WHERE status IN ('bekliyor','oynaniyor') AND tournament_id IS NULL AND players @> $1::jsonb`,
    [JSON.stringify([{ id: m.id }])],
  )
  if (open.rows[0].n >= 3) throw new Error('Aynı anda en fazla 3 masada oturabilirsin.')
  if (!(await debit(m.id, stake))) throw new Error('Yetersiz Kanka Coin.')
  const humanSeats = opts.seats - opts.bots
  const players: Player[] = [{ id: m.id, name: m.name, seat: 0 }]
  for (let s = humanSeats; s < opts.seats; s++) {
    players.push({ id: `bot:${s}`, name: BOT_NAMES[(s - humanSeats) % BOT_NAMES.length], seat: s, bot: true })
  }
  // A table already filled with bots starts right away.
  const full = players.length >= opts.seats
  const state = full ? initState(game, { ...opts, botSeats: players.filter((p) => p.bot).map((p) => p.seat) }) : null
  const r = await pool.query(
    `INSERT INTO game_tables (game, stake, seats, status, players, created_by, mode, options, state)
     VALUES ($1,$2,$3,$7,$4::jsonb,$5,'pvp',$6::jsonb,$8::jsonb) RETURNING id`,
    [
      game,
      stake,
      opts.seats,
      JSON.stringify(players),
      m.id,
      JSON.stringify(full ? { ...opts, lastActs: { [m.id]: new Date().toISOString() } } : opts),
      full ? 'oynaniyor' : 'bekliyor',
      state ? JSON.stringify(state) : null,
    ],
  )
  return String(r.rows[0].id)
}

export async function joinTable(m: Member, id: string) {
  const t = await getTableRow(id)
  if (!t || t.status !== 'bekliyor' || t.tournamentId) throw new Error('Masa artık müsait değil.')
  if (t.players.some((p) => p.id === m.id)) return
  const taken = new Set(t.players.map((p) => p.seat))
  const seat = Array.from({ length: t.seats }, (_, i) => i).find((i) => !taken.has(i))
  if (seat === undefined) throw new Error('Masa dolu.')
  if (!(await debit(m.id, t.stake))) throw new Error('Yetersiz Kanka Coin.')
  const players = [...t.players, { id: m.id, name: m.name, seat }].sort((a, b) => a.seat - b.seat)
  const full = players.length >= seatsNeeded(t)
  const state = full
    ? initState(t.game as never, { ...t.options, botSeats: players.filter((p) => p.bot).map((p) => p.seat) })
    : null
  const now = new Date().toISOString()
  const lastActs = full ? Object.fromEntries(players.filter((p) => !p.bot).map((p) => [p.id, now])) : {}
  const r = await pool.query(
    `UPDATE game_tables SET players = $2::jsonb, state = $3::jsonb, status = $4, version = version + 1, updated_at = now(),
       options = COALESCE(options, '{}'::jsonb) || $6::jsonb
     WHERE id = $1 AND status = 'bekliyor' AND jsonb_array_length(players) = $5 RETURNING id`,
    [id, JSON.stringify(players), state ? JSON.stringify(state) : null, full ? 'oynaniyor' : 'bekliyor', t.players.length, JSON.stringify(full ? { lastActs } : {})],
  )
  if (r.rowCount === 0) {
    await credit(m.id, t.stake)
    throw new Error('Masa az önce güncellendi, tekrar dene.')
  }
}

export async function cancelTable(id: string, opts: { byUser?: string; admin?: boolean }) {
  const t = await getTableRow(id)
  if (!t) throw new Error('Masa bulunamadı.')
  if (t.status === 'bekliyor') {
    if (!opts.admin && t.createdBy !== opts.byUser) throw new Error('Bu masayı sadece açan kapatabilir.')
    const r = await pool.query(`UPDATE game_tables SET status = 'iptal', updated_at = now() WHERE id = $1 AND status = 'bekliyor' RETURNING id`, [id])
    if (r.rowCount) for (const p of humans(t)) await credit(p.id, t.stake)
    return
  }
  if (t.status === 'oynaniyor' && opts.admin) {
    const r = await pool.query(`UPDATE game_tables SET status = 'iptal', updated_at = now() WHERE id = $1 AND status = 'oynaniyor' RETURNING id`, [id])
    if (r.rowCount) {
      for (const p of humans(t)) {
        await credit(p.id, t.stake)
        await recordHistory({ userId: p.id, userName: p.name, game: t.game, mode: t.tournamentId ? 'turnuva' : 'pvp', opponent: rivalName(t, p.id), stake: t.stake, result: 'refund', delta: 0, tableId: t.id })
      }
    }
  }
}

const rivalName = (t: TableRow, userId: string) =>
  t.players
    .filter((p) => p.id !== userId)
    .map((p) => p.name)
    .join(', ')
    .slice(0, 120) || '-'

async function saveState(t: TableRow, version: number, state: PvpState) {
  const r = await pool.query(
    `UPDATE game_tables SET state = $3::jsonb, version = version + 1, updated_at = now() WHERE id = $1 AND version = $2 AND status = 'oynaniyor' RETURNING id`,
    [t.id, version, JSON.stringify(state)],
  )
  if (r.rowCount === 0) throw new Error('Masa güncellendi, tekrar dene.')
}

export async function actOnTable(m: Member, id: string, version: number, action: { type: string; [k: string]: unknown }) {
  const t = await getTableRow(id)
  if (!t || t.status !== 'oynaniyor' || !t.state) throw new Error('Oyun aktif değil.')
  const seat = t.players.find((p) => p.id === m.id && !p.bot)?.seat
  if (seat === undefined) throw new Error('Bu masada oyuncu değilsin.')
  if (t.version !== version) throw new Error('Masa güncellendi, tekrar dene.')
  const { state, outcome } = applyAction(t.state, seat, action)
  await saveState(t, version, state)
  await touchPlayer(t.id, m.id)
  if (outcome) await finishTable({ ...t, state, version: version + 1 }, outcome)
}

async function touchPlayer(tableId: string, userId: string) {
  await pool.query(
    `UPDATE game_tables SET options = COALESCE(options, '{}'::jsonb)
       || jsonb_build_object('lastActs', COALESCE(options->'lastActs', '{}'::jsonb) || jsonb_build_object($2::text, now()))
     WHERE id = $1`,
    [tableId, userId],
  )
}

/**
 * Removes a player from a table. Waiting tables refund the stake; running tables count as a
 * forfeit — the seat goes to a bot when the game supports it, otherwise the rivals win.
 */
export async function leaveTable(m: Pick<Member, 'id'>, id: string, reason: 'leave' | 'idle' = 'leave') {
  const t = await getTableRow(id)
  if (!t || (t.status !== 'bekliyor' && t.status !== 'oynaniyor')) return
  if (t.tournamentId) throw new Error('Turnuva masasından kalkamazsın.')
  const me = t.players.find((p) => p.id === m.id && !p.bot)
  if (!me) throw new Error('Bu masada oyuncu değilsin.')

  if (t.status === 'bekliyor') {
    const others = humans(t).filter((p) => p.id !== me.id)
    if (t.createdBy === me.id || others.length === 0) {
      const r = await pool.query(`UPDATE game_tables SET status = 'iptal', updated_at = now() WHERE id = $1 AND status = 'bekliyor' RETURNING id`, [id])
      if (r.rowCount) for (const p of humans(t)) await credit(p.id, t.stake)
      return
    }
    const players = t.players.filter((p) => p.id !== me.id)
    const r = await pool.query(
      `UPDATE game_tables SET players = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1 AND status = 'bekliyor' AND version = $3 RETURNING id`,
      [id, JSON.stringify(players), t.version],
    )
    if (r.rowCount === 0) throw new Error('Masa güncellendi, tekrar dene.')
    await credit(me.id, t.stake)
    return
  }

  if (!t.state) return
  const recordLoss = () =>
    recordHistory({ userId: me.id, userName: me.name, game: t.game, mode: 'pvp', opponent: rivalName(t, me.id), stake: t.stake, result: 'loss', delta: -t.stake, tableId: t.id })
  const others = humans(t).filter((p) => p.id !== me.id)

  if (others.length === 0) {
    // Only bots left at the table: the game simply ends and the stake is lost.
    const r = await pool.query(
      `UPDATE game_tables SET status = 'bitti', winner_id = NULL, updated_at = now() WHERE id = $1 AND status = 'oynaniyor' RETURNING id`,
      [id],
    )
    if (r.rowCount) await recordLoss()
    return
  }

  const handsToBot = isSeatGame(t.game) || (t.state.kind === 'okey' && okeySeats(t.state) > 2 && !t.state.team)
  const { state, outcome } = applyAction(t.state, me.seat, { type: 'resign' })

  if (!handsToBot) {
    await saveState(t, t.version, state)
    if (outcome) await finishTable({ ...t, state, version: t.version + 1 }, outcome)
    return
  }

  const label = reason === 'idle' ? 'AFK' : 'ayrıldı'
  const players = t.players.map((p) => (p.id === me.id ? { id: `bot:${p.seat}`, name: `${p.name} (${label})`, seat: p.seat, bot: true } : p))
  const r = await pool.query(
    `UPDATE game_tables SET players = $3::jsonb, state = $4::jsonb, version = version + 1, updated_at = now(),
       options = COALESCE(options, '{}'::jsonb) || jsonb_build_object('forfeits', COALESCE((options->>'forfeits')::int, 0) + 1)
     WHERE id = $1 AND version = $2 AND status = 'oynaniyor' RETURNING id`,
    [id, t.version, JSON.stringify(players), JSON.stringify(state)],
  )
  if (r.rowCount === 0) throw new Error('Masa güncellendi, tekrar dene.')
  await recordLoss()
  if (outcome) {
    const fresh = await getTableRow(id)
    if (fresh) await finishTable(fresh, outcome)
  }
}

/** Kicks every human who has not made a move for IDLE_KICK_MS and cancels long-abandoned waiting tables. */
export async function kickIdlePlayers(t: TableRow): Promise<boolean> {
  if (t.tournamentId) return false
  const now = Date.now()
  if (t.status === 'bekliyor') {
    if (now - new Date(t.updatedAt).getTime() < IDLE_KICK_MS) return false
    const r = await pool.query(`UPDATE game_tables SET status = 'iptal', updated_at = now() WHERE id = $1 AND status = 'bekliyor' RETURNING id`, [t.id])
    if (r.rowCount) for (const p of humans(t)) await credit(p.id, t.stake)
    return Boolean(r.rowCount)
  }
  if (t.status !== 'oynaniyor' || !t.state) return false
  // Older tables have no per-player activity yet; fall back to the last table update.
  const fallback = new Date(t.options.lastActs ? t.createdAt : t.updatedAt).getTime()
  const state = t.state
  const idle = humans(t).filter((p) => {
    if (state.kind === 'duel' && state.scores[p.seat]) return false
    const last = t.options.lastActs?.[p.id]
    return now - (last ? new Date(last).getTime() : fallback) >= IDLE_KICK_MS
  })
  let changed = false
  for (const p of idle) {
    const fresh = await getTableRow(t.id)
    if (!fresh || fresh.status !== 'oynaniyor') break
    try {
      await leaveTable(p, t.id, 'idle')
      changed = true
    } catch {
      break
    }
  }
  return changed
}

let lastSweep = 0
/** Throttled sweep over all running tables so abandoned ones never block their players. */
export async function sweepIdleTables() {
  if (Date.now() - lastSweep < 30_000) return
  lastSweep = Date.now()
  const r = await pool.query(
    `SELECT * FROM game_tables WHERE tournament_id IS NULL AND status IN ('bekliyor','oynaniyor')
       AND created_at < now() - interval '15 minutes' ORDER BY updated_at ASC LIMIT 100`,
  )
  for (const row of r.rows) {
    try {
      await kickIdlePlayers(mapTable(row))
    } catch (e) {
      console.error('[tables] idle sweep failed', e)
    }
  }
}

/**
 * Called on every table poll. When the current player's turn clock has expired the server
 * plays an automatic move for them. The version check in saveState makes concurrent polls safe.
 */
export async function enforceTurnClock(t: TableRow): Promise<TableRow> {
  if (t.status !== 'oynaniyor' || !t.state || t.tournamentId) return t
  const limit = TURN_SECONDS[t.game as keyof typeof TURN_SECONDS]
  const turn = currentTurn(t.state)
  if (!limit || turn == null) return t
  if (Date.now() - new Date(t.updatedAt).getTime() < limit * 1000) return t
  if (t.players.find((p) => p.seat === turn)?.bot) return t
  const result = autoMove(t.state)
  if (!result) return t
  try {
    await saveState(t, t.version, result.state)
  } catch {
    return (await getTableRow(t.id)) ?? t
  }
  if (result.outcome) await finishTable({ ...t, state: result.state, version: t.version + 1 }, result.outcome)
  return (await getTableRow(t.id)) ?? t
}

/** A waiting player may claim the win (2 seats) or hand the idle seat to a bot (4 seats). */
export async function claimTimeout(m: Member, id: string) {
  const t = await getTableRow(id)
  if (!t || t.status !== 'oynaniyor' || !t.state) throw new Error('Oyun aktif değil.')
  const seat = t.players.find((p) => p.id === m.id && !p.bot)?.seat
  if (seat === undefined) throw new Error('Bu masada oyuncu değilsin.')
  const idle = Date.now() - new Date(t.updatedAt).getTime()
  if (t.state.kind === 'duel') {
    if (!t.state.scores[seat] || t.state.scores[seat ? 0 : 1]) throw new Error('Henüz talep edemezsin.')
    if (idle < DUEL_TIMEOUT_MS) throw new Error('Rakibin için süre dolmadı.')
    await finishTable(t, { winnerSeat: seat })
    return
  }
  const turn = currentTurn(t.state)
  if (turn === seat) throw new Error('Sıra sende.')
  if (idle < TURN_TIMEOUT_MS) throw new Error('Rakibin için süre dolmadı.')
  if (isSeatGame(t.game) && turn != null) {
    const res = seatGameToBot(t.state, turn)
    if (res) {
      await saveState(t, t.version, res.state)
      if (res.outcome) await finishTable({ ...t, state: res.state, version: t.version + 1 }, res.outcome)
      return
    }
  }
  if (t.state.kind === 'okey' && okeySeats(t.state) > 2 && turn != null) {
    const { state, outcome } = seatToBot(t.state, turn)
    await saveState(t, t.version, state)
    if (outcome) await finishTable({ ...t, state, version: t.version + 1 }, outcome)
    return
  }
  await finishTable(t, { winnerSeat: seat })
}

async function finishTable(t: TableRow, outcome: NonNullable<Outcome>) {
  const winnerSeats = outcome.winnerSeats ?? (outcome.winnerSeat === null ? [] : [outcome.winnerSeat])
  const isDraw = outcome.winnerSeat === null && outcome.winnerSeats === undefined
  const winners = t.players.filter((p) => winnerSeats.includes(p.seat))
  const humanWinners = winners.filter((p) => !p.bot)
  const isTournament = Boolean(t.tournamentId)

  if (isTournament && humanWinners.length === 0) {
    // Tournament draws are replayed on a fresh board with the same pairing.
    await pool.query(`UPDATE game_tables SET state = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1`, [
      t.id,
      JSON.stringify(initState(t.game as never)),
    ])
    return
  }

  const r = await pool.query(
    `UPDATE game_tables SET status = 'bitti', winner_id = $2, options = options || $3::jsonb, updated_at = now()
     WHERE id = $1 AND status = 'oynaniyor' RETURNING id`,
    [t.id, winners[0]?.id ?? null, JSON.stringify({ winners: winners.map((p) => p.id) })],
  )
  if (r.rowCount === 0) return

  if (isTournament) {
    const champ = humanWinners[0]
    for (const p of humans(t)) {
      await recordHistory({ userId: p.id, userName: p.name, game: t.game, mode: 'turnuva', opponent: rivalName(t, p.id), stake: 0, result: p.id === champ.id ? 'win' : 'loss', delta: 0, tableId: t.id })
    }
    const { advanceTournament } = await import('@/lib/tournaments')
    await advanceTournament(t.tournamentId!, t.roundNo!, t.matchNo!, champ.id)
    return
  }

  const people = humans(t)
  if (isDraw) {
    for (const p of people) {
      await credit(p.id, t.stake)
      await recordHistory({ userId: p.id, userName: p.name, game: t.game, mode: 'pvp', opponent: rivalName(t, p.id), stake: t.stake, result: 'draw', delta: 0, tableId: t.id })
    }
    return
  }

  const settings = (await getArenaSettings())[t.game as keyof Awaited<ReturnType<typeof getArenaSettings>>]
  // In 101 / Batak / Monopoly the bots together put in one extra stake, so beating bots alone pays double.
  const botBonus = isSeatGame(t.game) && t.players.some((p) => p.bot) ? t.stake : 0
  // Players who left mid-game leave their stake in the pot.
  const pot = t.stake * (people.length + (t.options.forfeits ?? 0)) + botBonus
  const prizeEach = humanWinners.length ? Math.floor((pot * (1 - (settings?.commission ?? 0) / 100)) / humanWinners.length) : 0
  const paid = new Map<string, number>()
  for (const p of humanWinners) {
    const amount = await capPayout(p.id, t.stake, prizeEach)
    paid.set(p.id, amount)
    await credit(p.id, amount)
  }
  for (const p of people) {
    const won = paid.has(p.id)
    await recordHistory({ userId: p.id, userName: p.name, game: t.game, mode: 'pvp', opponent: rivalName(t, p.id), stake: t.stake, result: won ? 'win' : 'loss', delta: won ? (paid.get(p.id) ?? 0) - t.stake : -t.stake, tableId: t.id })
  }
}

export async function adminListTables(status?: string) {
  const r = await pool.query(
    `SELECT * FROM game_tables WHERE ($1::text IS NULL OR status = $1) ORDER BY updated_at DESC LIMIT 200`,
    [status ?? null],
  )
  return r.rows.map(mapTable)
}
