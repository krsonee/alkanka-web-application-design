import 'server-only'
import { pool } from '@/lib/db'
import { credit, debit, recordHistory, type Member } from '@/lib/member'
import type { ArenaGame } from './arena'
import { bracketChampion, createBracket, setMatchWinner, type Bracket } from './bracket'
import { initState } from './pvp/rules'
import { MAX_TOURNAMENT_PLAYERS, type LiveMatch, type Tournament, type TournamentStatus } from './tournaments-shared'

export { TOURNAMENT_STATUSES, STATUS_LABEL, MAX_TOURNAMENT_PLAYERS } from './tournaments-shared'
export type { Tournament, TournamentStatus } from './tournaments-shared'

type Row = Record<string, unknown>

const entryKey = (e: Row) => (e.user_id ? String(e.user_id) : `misafir:${e.nickname}`)

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
    prizeNote: String(r.prize_note ?? ''),
    maxPlayers: Number(r.max_players),
    startsAt: new Date(String(r.starts_at)).toISOString(),
    status: r.status as TournamentStatus,
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

export async function listTournaments(): Promise<Tournament[]> {
  try {
    await autoStartDue()
    return await load(
      `ORDER BY CASE status WHEN 'basladi' THEN 0 WHEN 'kayit' THEN 1 WHEN 'bitti' THEN 2 ELSE 3 END, starts_at ASC`,
      [],
    )
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
  prizePool: number
  prizeNote: string
  maxPlayers: number
  startsAt: string
}

const clampPlayers = (n: number) => Math.min(MAX_TOURNAMENT_PLAYERS, Math.max(2, Math.floor(n)))

export async function createTournament(t: TournamentInput) {
  await pool.query(
    `INSERT INTO tournaments (game, title, description, rules, entry_fee, prize_pool, prize_note, max_players, starts_at, format, table_size)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'eleme',2)`,
    [t.game, t.title, t.description, t.rules, t.entryFee, t.prizePool, t.prizeNote, clampPlayers(t.maxPlayers), t.startsAt],
  )
}

export async function updateTournament(id: number, t: TournamentInput) {
  await pool.query(
    `UPDATE tournaments SET game=$2, title=$3, description=$4, rules=$5, entry_fee=$6, prize_pool=$7, prize_note=$8,
       max_players=$9, starts_at=$10 WHERE id=$1 AND status = 'kayit'`,
    [id, t.game, t.title, t.description, t.rules, t.entryFee, t.prizePool, t.prizeNote, clampPlayers(t.maxPlayers), t.startsAt],
  )
}

async function refundAll(id: number) {
  const t = await pool.query('SELECT entry_fee, game FROM tournaments WHERE id = $1', [id])
  const fee = Number(t.rows[0]?.entry_fee ?? 0)
  if (!fee) return
  const e = await pool.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1 AND user_id IS NOT NULL', [id])
  for (const row of e.rows) {
    await credit(row.user_id, fee)
    await recordHistory({ userId: row.user_id, userName: row.nickname, game: t.rows[0].game, mode: 'turnuva', opponent: 'Turnuva iadesi', stake: fee, result: 'refund', delta: fee })
  }
}

export async function cancelTournament(id: number) {
  const r = await pool.query(`UPDATE tournaments SET status = 'iptal' WHERE id = $1 AND status IN ('kayit','basladi') RETURNING id`, [id])
  if (!r.rowCount) return
  await pool.query(`UPDATE game_tables SET status = 'iptal', updated_at = now() WHERE tournament_id = $1 AND status = 'oynaniyor'`, [id])
  await refundAll(id)
}

export async function deleteTournament(id: number) {
  const t = await pool.query('SELECT status FROM tournaments WHERE id = $1', [id])
  if (t.rows[0]?.status === 'kayit' || t.rows[0]?.status === 'basladi') await refundAll(id)
  await pool.query(`UPDATE game_tables SET status = 'iptal' WHERE tournament_id = $1 AND status = 'oynaniyor'`, [id])
  await pool.query('DELETE FROM tournament_entries WHERE tournament_id = $1', [id])
  await pool.query('DELETE FROM tournaments WHERE id = $1', [id])
}

export async function joinTournament(m: Member, id: number) {
  const t = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id])
  const row = t.rows[0]
  if (!row || row.status !== 'kayit') throw new Error('Bu turnuvanın kayıtları kapalı.')
  const exists = await pool.query('SELECT 1 FROM tournament_entries WHERE tournament_id = $1 AND user_id = $2', [id, m.id])
  if (exists.rowCount) throw new Error('Bu turnuvaya zaten kayıtlısın.')
  const fee = Number(row.entry_fee)
  if (fee > 0 && !(await debit(m.id, fee))) throw new Error('Yetersiz Kanka Coin.')
  const ins = await pool.query(
    `INSERT INTO tournament_entries (tournament_id, nickname, telegram, user_id)
     SELECT $1, $2, '', $3 WHERE (SELECT count(*) FROM tournament_entries WHERE tournament_id = $1) < $4
     RETURNING id`,
    [id, m.name, m.id, Number(row.max_players)],
  )
  if (!ins.rowCount) {
    if (fee > 0) await credit(m.id, fee)
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
    await credit(m.id, fee)
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
    await credit(row.user_id, fee)
    await recordHistory({ userId: row.user_id, userName: row.nickname, game: t.rows[0].game, mode: 'turnuva', opponent: 'Kayıt iadesi', stake: fee, result: 'refund', delta: fee })
  }
}

async function autoStartDue() {
  const due = await pool.query(
    `SELECT id FROM tournaments t WHERE status = 'kayit' AND starts_at <= now()
       AND (SELECT count(*) FROM tournament_entries e WHERE e.tournament_id = t.id) >= 2`,
  )
  for (const r of due.rows) await startTournament(Number(r.id)).catch((e) => console.error('[tournaments] otomatik başlatma', e))
}

/** Pairs every entrant at once and opens all first-round tables simultaneously. */
export async function startTournament(id: number) {
  const entries = await pool.query('SELECT * FROM tournament_entries WHERE tournament_id = $1', [id])
  if (entries.rowCount! < 2) throw new Error('Başlatmak için en az 2 oyuncu gerekli.')
  const keys = entries.rows.map(entryKey)
  const bracket = createBracket(keys, 2)
  const r = await pool.query(
    `UPDATE tournaments SET status = 'basladi', bracket = $2::jsonb, winner = NULL WHERE id = $1 AND status = 'kayit' RETURNING id`,
    [id, JSON.stringify(bracket)],
  )
  if (!r.rowCount) return
  await openReadyMatches(id)
}

/**
 * Opens a table for every match whose two players are known and still unplayed, but only
 * once the whole previous round has finished so winners wait and advance together.
 */
async function openReadyMatches(id: number) {
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
    const champion = bracketChampion(bracket)
    if (champion) {
      await finishTournament(client, row, bracket, champion)
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
    const nameOf = (key: string) => names.rows.find((n) => (n.user_id ?? `misafir:${n.nickname}`) === key)?.nickname ?? key
    for (const [mi, match] of bracket.rounds[roundIdx].entries()) {
      const real = match.players.filter((p): p is string => Boolean(p))
      if (match.winner || real.length !== 2 || opened.has(mi)) continue
      const players = real.map((key, seat) => ({ id: key, name: nameOf(key), seat }))
      await client.query(
        `INSERT INTO game_tables (game, stake, seats, status, players, state, created_by, mode, tournament_id, round_no, match_no)
         VALUES ($1, 0, 2, 'oynaniyor', $2::jsonb, $3::jsonb, 'turnuva', 'turnuva', $4, $5, $6)`,
        [row.game, JSON.stringify(players), JSON.stringify(initState(row.game)), id, roundIdx, mi],
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

async function finishTournament(client: { query: typeof pool.query }, row: Row, bracket: Bracket, champion: string) {
  const names = await client.query('SELECT user_id, nickname FROM tournament_entries WHERE tournament_id = $1', [row.id])
  const n = names.rows.find((x) => (x.user_id ?? `misafir:${x.nickname}`) === champion)
  const display = n?.nickname ?? champion
  const upd = await client.query(
    `UPDATE tournaments SET status = 'bitti', winner = $2, bracket = $3::jsonb WHERE id = $1 AND status = 'basladi' RETURNING id`,
    [row.id, display, JSON.stringify(bracket)],
  )
  if (upd.rowCount && n?.user_id) {
    const { rewardTournamentWin } = await import('@/lib/kanka-puan')
    await rewardTournamentWin(n.user_id, Number(row.id), String(row.title))
  }
  const prize = Number(row.prize_pool)
  if (upd.rowCount && prize > 0 && n?.user_id) {
    await credit(n.user_id, prize)
    await recordHistory({ userId: n.user_id, userName: display, game: String(row.game), mode: 'turnuva', opponent: `Şampiyonluk: ${row.title}`, stake: 0, result: 'win', delta: prize })
  }
}

/** Records a match result, then opens the next round once every match in this round is decided. */
export async function advanceTournament(id: number, round: number, match: number, winnerKey: string) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const t = await client.query('SELECT bracket, status FROM tournaments WHERE id = $1 FOR UPDATE', [id])
    const row = t.rows[0]
    if (row?.status === 'basladi' && row.bracket) {
      const next = setMatchWinner(row.bracket as Bracket, round, match, winnerKey)
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

export async function myTournamentTables(userId: string) {
  const r = await pool.query(
    `SELECT g.id, g.game, g.round_no, t.title FROM game_tables g JOIN tournaments t ON t.id = g.tournament_id
     WHERE g.status = 'oynaniyor' AND g.players @> $1::jsonb`,
    [JSON.stringify([{ id: userId }])],
  )
  return r.rows.map((x) => ({ id: String(x.id), game: String(x.game), round: Number(x.round_no), title: String(x.title) }))
}
