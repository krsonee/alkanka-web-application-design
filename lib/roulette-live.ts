import 'server-only'
import { createHash, createHmac } from 'node:crypto'
import type { PoolClient } from 'pg'
import { pool } from '@/lib/db'
import { credit, debit, getBalance, recordHistory, type Member } from '@/lib/member'
import { betLabel, betReturn, rouletteClock as clock, validBet, type RouletteBet } from '@/lib/casino'
import { capPayout } from '@/lib/member-limits'

/** Distinct spots per player per round; chips on the same spot are merged into one entry. */
const MAX_SPOTS = 60
/** The server refuses bets this close to the end of the betting window. */
const CLOSE_MARGIN_MS = 800

function secret() {
  const s = process.env.ROULETTE_SECRET ?? process.env.BETTER_AUTH_SECRET
  if (!s) throw new Error('Rulet anahtarı tanımlı değil.')
  return s
}

/** Per-round seed. Its SHA-256 is published while bets are open, the seed itself only once betting has closed. */
export function roundSeed(roundId: number) {
  return createHmac('sha256', secret()).update(`rulet:${roundId}`).digest('hex')
}

export const roundCommit = (roundId: number) => createHash('sha256').update(roundSeed(roundId)).digest('hex')

/** First 32 bits of the seed modulo 37; anyone holding the revealed seed can recompute it. */
export const numberFromSeed = (seed: string) => parseInt(seed.slice(0, 8), 16) % 37

export const roundNumber = (roundId: number) => numberFromSeed(roundSeed(roundId))

function resolvedRound(now = Date.now()) {
  const c = clock(now)
  return c.phase === 'bet' ? c.roundId - 1 : c.roundId
}

type StoredBet = Pick<RouletteBet, 'kind' | 'value' | 'amount'>
const spotKey = (b: Pick<RouletteBet, 'kind' | 'value'>) => `${b.kind}:${b.value ?? ''}`

function merge(into: StoredBet[], add: StoredBet[], sign = 1) {
  const map = new Map<string, StoredBet>()
  for (const b of into) map.set(spotKey(b), { ...b })
  for (const b of add) {
    const k = spotKey(b)
    const cur = map.get(k)
    const amount = (cur?.amount ?? 0) + sign * b.amount
    if (amount > 0) map.set(k, { kind: b.kind, value: b.value, amount })
    else map.delete(k)
  }
  return Array.from(map.values())
}

/**
 * Pays every finished round for everyone, not just the viewer, so a player who leaves mid-spin is still paid
 * the moment anyone at the table loads the result. The UPDATE ... RETURNING claim makes double payment impossible.
 */
export async function settleRounds(userId?: string) {
  const last = resolvedRound()
  const r = await pool.query(
    `UPDATE roulette_bets SET settled = true
     WHERE id IN (SELECT id FROM roulette_bets WHERE settled = false AND round_id <= $1 ${userId ? 'AND user_id = $2' : ''} LIMIT 200)
     RETURNING id, round_id, user_id, user_name, bets, total`,
    userId ? [last, userId] : [last],
  )
  for (const row of r.rows) {
    const n = roundNumber(Number(row.round_id))
    const bets = row.bets as RouletteBet[]
    const total = Number(row.total)
    if (total <= 0) continue
    const userId = String(row.user_id)
    const returned = await capPayout(userId, total, bets.reduce((a, b) => a + betReturn(b, n), 0))
    await pool.query(`UPDATE roulette_bets SET returned = $2 WHERE id = $1`, [row.id, returned])
    if (returned) await credit(userId, returned)
    await recordHistory({
      userId,
      userName: String(row.user_name),
      game: 'rulet',
      mode: 'masa',
      opponent: `Sayı ${n} - ${bets.map(betLabel).join(', ').slice(0, 60)}`,
      stake: total,
      result: returned > total ? 'win' : returned === total ? 'draw' : 'loss',
      delta: returned - total,
      score: n,
    })
  }
}

export const settleFor = (member: Pick<Member, 'id'>) => settleRounds(member.id)

async function inTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const out = await fn(c)
    await c.query('COMMIT')
    return out
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    c.release()
  }
}

function assertOpen() {
  const c = clock()
  if (c.phase !== 'bet' || c.phaseEndsAt - c.now < CLOSE_MARGIN_MS) throw new Error('Bahisler kapandı, bir sonraki turu bekle.')
  return c
}

async function lockRow(c: PoolClient, roundId: number, member: Member) {
  await c.query(
    `INSERT INTO roulette_bets (round_id, user_id, user_name, bets, total) VALUES ($1,$2,$3,'[]'::jsonb,0) ON CONFLICT (round_id, user_id) DO NOTHING`,
    [roundId, member.id, member.name],
  )
  const r = await c.query(`SELECT id, bets FROM roulette_bets WHERE round_id = $1 AND user_id = $2 FOR UPDATE`, [roundId, member.id])
  return { id: r.rows[0].id, bets: (r.rows[0].bets ?? []) as StoredBet[] }
}

async function saveRow(c: PoolClient, id: unknown, bets: StoredBet[]) {
  const total = bets.reduce((a, b) => a + b.amount, 0)
  await c.query(`UPDATE roulette_bets SET bets = $2::jsonb, total = $3 WHERE id = $1`, [id, JSON.stringify(bets), total])
}

export async function placeLiveBets(member: Member, bets: RouletteBet[], spotLimit: number) {
  const c0 = assertOpen()
  if (!Array.isArray(bets) || bets.length === 0) throw new Error('En az bir bahis koy.')
  if (!bets.every(validBet)) throw new Error('Geçersiz bahis.')
  const clean = merge([], bets.map((b) => ({ kind: b.kind, value: b.value ?? undefined, amount: b.amount })))
  const total = clean.reduce((a, b) => a + b.amount, 0)
  await settleFor(member)
  if (!(await debit(member.id, total))) throw new Error('Yetersiz Kanka Coin.')
  try {
    await inTx(async (c) => {
      const row = await lockRow(c, c0.roundId, member)
      const next = merge(row.bets, clean)
      if (next.length > MAX_SPOTS) throw new Error(`Bu turda en fazla ${MAX_SPOTS} farklı alana bahis koyabilirsin.`)
      const over = next.find((b) => b.amount > spotLimit)
      if (over) throw new Error(`${betLabel(over)} için masa limiti ${spotLimit} KC.`)
      assertOpen()
      await saveRow(c, row.id, next)
    })
  } catch (e) {
    await credit(member.id, total)
    throw e
  }
  return { roundId: c0.roundId, balance: await getBalance(member.id) }
}

/** Takes chips back off the table while betting is still open. With no list, the whole round is cleared. */
export async function withdrawLiveBets(member: Member, bets?: StoredBet[]) {
  const c0 = assertOpen()
  if (bets && !bets.every((b) => validBet(b as RouletteBet))) throw new Error('Geçersiz bahis.')
  const refund = await inTx(async (c) => {
    const row = await lockRow(c, c0.roundId, member)
    const before = row.bets.reduce((a, b) => a + b.amount, 0)
    const next = bets ? merge(row.bets, bets, -1) : []
    const after = next.reduce((a, b) => a + b.amount, 0)
    await saveRow(c, row.id, next)
    return before - after
  })
  if (refund > 0) await credit(member.id, refund)
  return { roundId: c0.roundId, balance: await getBalance(member.id) }
}

export async function liveState(member: Member | null) {
  await settleRounds()
  const c = clock()
  const showNumber = c.phase !== 'bet'
  const lastId = c.phase === 'bet' ? c.roundId - 1 : c.roundId
  const history = Array.from({ length: 14 }, (_, i) => roundNumber(lastId - i))
  const players = await pool.query(
    `SELECT user_id, user_name, total, bets FROM roulette_bets WHERE round_id = $1 AND total > 0 ORDER BY total DESC LIMIT 40`,
    [c.roundId],
  )
  const n = showNumber ? roundNumber(c.roundId) : null
  const table = players.rows.map((p) => {
    const bets = p.bets as RouletteBet[]
    return {
      name: String(p.user_name),
      total: Number(p.total),
      mine: member ? p.user_id === member.id : false,
      bets: bets.map((b) => ({ kind: b.kind, value: b.value, amount: b.amount })),
      returned: c.phase === 'result' && n !== null ? bets.reduce((a, b) => a + betReturn(b, n), 0) : null,
    }
  })
  const lastN = roundNumber(lastId)
  const prev = await pool.query(`SELECT user_name, total, bets FROM roulette_bets WHERE round_id = $1 AND total > 0 LIMIT 60`, [lastId])
  const winners = prev.rows
    .map((p) => {
      const won = (p.bets as RouletteBet[]).reduce((a, b) => a + betReturn(b, lastN), 0) - Number(p.total)
      return { name: String(p.user_name), won }
    })
    .filter((w) => w.won > 0)
    .sort((a, b) => b.won - a.won)
    .slice(0, 8)
  return {
    ...c,
    serverNow: Date.now(),
    number: n,
    history,
    players: table,
    lastRound: { id: lastId, number: lastN, winners },
    fair: {
      roundId: c.roundId,
      commit: roundCommit(c.roundId),
      revealed: { roundId: lastId, seed: roundSeed(lastId), commit: roundCommit(lastId), number: lastN },
    },
    balance: member ? await getBalance(member.id) : null,
  }
}

export type RouletteLiveState = Awaited<ReturnType<typeof liveState>>
