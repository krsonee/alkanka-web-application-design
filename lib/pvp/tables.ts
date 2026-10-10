import 'server-only'
import { pool } from '@/lib/db'
import { credit, debit, recordHistory, type Member } from '@/lib/member'
import { getArenaSettings } from '@/lib/arena-server'
import { applyAction, currentTurn, initState, isPvpGame, viewState, type Outcome, type PvpState } from './rules'

export type Player = { id: string; name: string; seat: number }

export type TableRow = {
  id: string
  game: string
  stake: number
  status: 'bekliyor' | 'oynaniyor' | 'bitti' | 'iptal'
  players: Player[]
  state: PvpState | null
  version: number
  winnerId: string | null
  createdBy: string
  tournamentId: number | null
  roundNo: number | null
  matchNo: number | null
  updatedAt: string
  createdAt: string
}

export const TURN_TIMEOUT_MS = 3 * 60 * 1000
export const DUEL_TIMEOUT_MS = 10 * 60 * 1000

function mapTable(r: Record<string, unknown>): TableRow {
  return {
    id: String(r.id),
    game: String(r.game),
    stake: Number(r.stake),
    status: r.status as TableRow['status'],
    players: (r.players as Player[]) ?? [],
    state: (r.state as PvpState | null) ?? null,
    version: Number(r.version),
    winnerId: (r.winner_id as string | null) ?? null,
    createdBy: String(r.created_by ?? ''),
    tournamentId: r.tournament_id == null ? null : Number(r.tournament_id),
    roundNo: r.round_no == null ? null : Number(r.round_no),
    matchNo: r.match_no == null ? null : Number(r.match_no),
    updatedAt: new Date(String(r.updated_at)).toISOString(),
    createdAt: new Date(String(r.created_at)).toISOString(),
  }
}

export async function getTableRow(id: string) {
  const r = await pool.query('SELECT * FROM game_tables WHERE id = $1', [id])
  return r.rows[0] ? mapTable(r.rows[0]) : null
}

export function tableView(t: TableRow, userId: string | null) {
  const seat = t.players.find((p) => p.id === userId)?.seat ?? -1
  return {
    id: t.id,
    game: t.game,
    stake: t.stake,
    status: t.status,
    players: t.players,
    version: t.version,
    winnerId: t.winnerId,
    tournamentId: t.tournamentId,
    roundNo: t.roundNo,
    updatedAt: t.updatedAt,
    seat,
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

export async function listMyActiveTables(userId: string) {
  const r = await pool.query(
    `SELECT * FROM game_tables WHERE status IN ('bekliyor','oynaniyor') AND players @> $1::jsonb ORDER BY updated_at DESC`,
    [JSON.stringify([{ id: userId }])],
  )
  return r.rows.map(mapTable)
}

export async function createTable(m: Member, game: string, stake: number) {
  if (!isPvpGame(game)) throw new Error('Bu oyun için kanka masası yok.')
  const settings = (await getArenaSettings())[game]
  if (!settings.enabled || !settings.pvpEnabled) throw new Error('Kanka masaları şu an kapalı.')
  if (!settings.bets.includes(stake)) throw new Error('Geçersiz bahis.')
  const open = await pool.query(
    `SELECT count(*)::int AS n FROM game_tables WHERE status IN ('bekliyor','oynaniyor') AND tournament_id IS NULL AND players @> $1::jsonb`,
    [JSON.stringify([{ id: m.id }])],
  )
  if (open.rows[0].n >= 3) throw new Error('Aynı anda en fazla 3 masada oturabilirsin.')
  if (!(await debit(m.id, stake))) throw new Error('Yetersiz Kanka Coin.')
  const players: Player[] = [{ id: m.id, name: m.name, seat: 0 }]
  const r = await pool.query(
    `INSERT INTO game_tables (game, stake, seats, status, players, created_by, mode) VALUES ($1,$2,2,'bekliyor',$3::jsonb,$4,'pvp') RETURNING id`,
    [game, stake, JSON.stringify(players), m.id],
  )
  return String(r.rows[0].id)
}

export async function joinTable(m: Member, id: string) {
  const t = await getTableRow(id)
  if (!t || t.status !== 'bekliyor' || t.tournamentId) throw new Error('Masa artık müsait değil.')
  if (t.players.some((p) => p.id === m.id)) return
  if (!(await debit(m.id, t.stake))) throw new Error('Yetersiz Kanka Coin.')
  const players = [...t.players, { id: m.id, name: m.name, seat: 1 }]
  const state = initState(t.game as never)
  const r = await pool.query(
    `UPDATE game_tables SET players = $2::jsonb, state = $3::jsonb, status = 'oynaniyor', version = version + 1, updated_at = now()
     WHERE id = $1 AND status = 'bekliyor' AND jsonb_array_length(players) = 1 RETURNING id`,
    [id, JSON.stringify(players), JSON.stringify(state)],
  )
  if (r.rowCount === 0) {
    await credit(m.id, t.stake)
    throw new Error('Masa az önce doldu.')
  }
}

export async function cancelTable(id: string, opts: { byUser?: string; admin?: boolean }) {
  const t = await getTableRow(id)
  if (!t) throw new Error('Masa bulunamadı.')
  if (t.status === 'bekliyor') {
    if (!opts.admin && t.createdBy !== opts.byUser) throw new Error('Bu masayı sadece açan kapatabilir.')
    const r = await pool.query(`UPDATE game_tables SET status = 'iptal', updated_at = now() WHERE id = $1 AND status = 'bekliyor' RETURNING id`, [id])
    if (r.rowCount) for (const p of t.players) await credit(p.id, t.stake)
    return
  }
  if (t.status === 'oynaniyor' && opts.admin) {
    const r = await pool.query(`UPDATE game_tables SET status = 'iptal', updated_at = now() WHERE id = $1 AND status = 'oynaniyor' RETURNING id`, [id])
    if (r.rowCount) {
      for (const p of t.players) {
        await credit(p.id, t.stake)
        await recordHistory({ userId: p.id, userName: p.name, game: t.game, mode: t.tournamentId ? 'turnuva' : 'pvp', opponent: rivalName(t, p.id), stake: t.stake, result: 'refund', delta: 0, tableId: t.id })
      }
    }
  }
}

const rivalName = (t: TableRow, userId: string) => t.players.find((p) => p.id !== userId)?.name ?? '-'

export async function actOnTable(m: Member, id: string, version: number, action: { type: string; [k: string]: unknown }) {
  const t = await getTableRow(id)
  if (!t || t.status !== 'oynaniyor' || !t.state) throw new Error('Oyun aktif değil.')
  const seat = t.players.find((p) => p.id === m.id)?.seat
  if (seat === undefined) throw new Error('Bu masada oyuncu değilsin.')
  if (t.version !== version) throw new Error('Masa güncellendi, tekrar dene.')
  const { state, outcome } = applyAction(t.state, seat, action)
  const r = await pool.query(
    `UPDATE game_tables SET state = $3::jsonb, version = version + 1, updated_at = now() WHERE id = $1 AND version = $2 AND status = 'oynaniyor' RETURNING id`,
    [id, version, JSON.stringify(state)],
  )
  if (r.rowCount === 0) throw new Error('Masa güncellendi, tekrar dene.')
  if (outcome) await finishTable({ ...t, state, version: version + 1 }, outcome)
}

/** The waiting player may claim the win when the rival stops playing. */
export async function claimTimeout(m: Member, id: string) {
  const t = await getTableRow(id)
  if (!t || t.status !== 'oynaniyor' || !t.state) throw new Error('Oyun aktif değil.')
  const seat = t.players.find((p) => p.id === m.id)?.seat
  if (seat === undefined) throw new Error('Bu masada oyuncu değilsin.')
  const idle = Date.now() - new Date(t.updatedAt).getTime()
  if (t.state.kind === 'duel') {
    if (!t.state.scores[seat] || t.state.scores[seat ? 0 : 1]) throw new Error('Henüz talep edemezsin.')
    if (idle < DUEL_TIMEOUT_MS) throw new Error('Rakibin için süre dolmadı.')
  } else {
    if (currentTurn(t.state) === seat) throw new Error('Sıra sende.')
    if (idle < TURN_TIMEOUT_MS) throw new Error('Rakibin için süre dolmadı.')
  }
  await finishTable(t, { winnerSeat: seat })
}

async function finishTable(t: TableRow, outcome: NonNullable<Outcome>) {
  const winner = outcome.winnerSeat === null ? null : t.players.find((p) => p.seat === outcome.winnerSeat) ?? null
  const isTournament = Boolean(t.tournamentId)

  if (isTournament && !winner) {
    // Tournament draws are replayed on a fresh board with the same pairing.
    await pool.query(`UPDATE game_tables SET state = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1`, [
      t.id,
      JSON.stringify(initState(t.game as never)),
    ])
    return
  }

  const r = await pool.query(
    `UPDATE game_tables SET status = 'bitti', winner_id = $2, updated_at = now() WHERE id = $1 AND status = 'oynaniyor' RETURNING id`,
    [t.id, winner?.id ?? null],
  )
  if (r.rowCount === 0) return

  if (isTournament) {
    for (const p of t.players) {
      await recordHistory({ userId: p.id, userName: p.name, game: t.game, mode: 'turnuva', opponent: rivalName(t, p.id), stake: 0, result: p.id === winner?.id ? 'win' : 'loss', delta: 0, tableId: t.id })
    }
    const { advanceTournament } = await import('@/lib/tournaments')
    await advanceTournament(t.tournamentId!, t.roundNo!, t.matchNo!, winner!.id)
    return
  }

  const settings = (await getArenaSettings())[t.game as keyof Awaited<ReturnType<typeof getArenaSettings>>]
  const pot = t.stake * t.players.length
  if (!winner) {
    for (const p of t.players) {
      await credit(p.id, t.stake)
      await recordHistory({ userId: p.id, userName: p.name, game: t.game, mode: 'pvp', opponent: rivalName(t, p.id), stake: t.stake, result: 'draw', delta: 0, tableId: t.id })
    }
    return
  }
  const prize = Math.floor(pot * (1 - (settings?.commission ?? 0) / 100))
  await credit(winner.id, prize)
  for (const p of t.players) {
    const won = p.id === winner.id
    await recordHistory({ userId: p.id, userName: p.name, game: t.game, mode: 'pvp', opponent: rivalName(t, p.id), stake: t.stake, result: won ? 'win' : 'loss', delta: won ? prize - t.stake : -t.stake, tableId: t.id })
  }
}

export async function adminListTables(status?: string) {
  const r = await pool.query(
    `SELECT * FROM game_tables WHERE ($1::text IS NULL OR status = $1) ORDER BY updated_at DESC LIMIT 200`,
    [status ?? null],
  )
  return r.rows.map(mapTable)
}
