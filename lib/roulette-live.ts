import 'server-only'
import { createHmac } from 'node:crypto'
import { pool } from '@/lib/db'
import { credit, debit, getBalance, recordHistory, type Member } from '@/lib/member'
import { betLabel, betReturn, rouletteClock as clock, validBet, type RouletteBet } from '@/lib/casino'
import { capPayout } from '@/lib/member-limits'

const MAX_ENTRIES = 30

/** Deterministic and unpredictable without the server secret, so every viewer sees the same number. */
export function roundNumber(roundId: number) {
  const secret = process.env.BETTER_AUTH_SECRET ?? 'alkanka-roulette'
  const h = createHmac('sha256', secret).update(`rulet:${roundId}`).digest()
  return h.readUInt32BE(0) % 37
}

function resolvedRound(now = Date.now()) {
  const c = clock(now)
  return c.phase === 'result' ? c.roundId : c.roundId - 1
}

export async function settleFor(member: Pick<Member, 'id' | 'name'>) {
  const last = resolvedRound()
  const r = await pool.query(
    `UPDATE roulette_bets SET settled = true WHERE user_id = $1 AND settled = false AND round_id <= $2 RETURNING id, round_id, bets, total`,
    [member.id, last],
  )
  for (const row of r.rows) {
    const n = roundNumber(Number(row.round_id))
    const bets = row.bets as RouletteBet[]
    const total = Number(row.total)
    const returned = await capPayout(member.id, total, bets.reduce((a, b) => a + betReturn(b, n), 0))
    await pool.query(`UPDATE roulette_bets SET returned = $2 WHERE id = $1`, [row.id, returned])
    if (returned) await credit(member.id, returned)
    await recordHistory({
      userId: member.id,
      userName: member.name,
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

export async function placeLiveBets(member: Member, bets: RouletteBet[], maxChip: number) {
  const c = clock()
  if (c.phase !== 'bet' || c.phaseEndsAt - c.now < 800) throw new Error('Bahisler kapandı, bir sonraki turu bekle.')
  if (!Array.isArray(bets) || bets.length === 0) throw new Error('En az bir bahis koy.')
  if (!bets.every(validBet) || bets.some((b) => b.amount > maxChip * 10)) throw new Error('Geçersiz bahis.')
  const clean = bets.map((b) => ({ kind: b.kind, value: b.value, amount: b.amount }))
  const total = clean.reduce((a, b) => a + b.amount, 0)
  const existing = await pool.query(`SELECT jsonb_array_length(bets) AS n FROM roulette_bets WHERE round_id = $1 AND user_id = $2`, [c.roundId, member.id])
  if (Number(existing.rows[0]?.n ?? 0) + clean.length > MAX_ENTRIES) throw new Error('Bu turda en fazla 30 bahis koyabilirsin.')
  await settleFor(member)
  if (!(await debit(member.id, total))) throw new Error('Yetersiz Kanka Coin.')
  await pool.query(
    `INSERT INTO roulette_bets (round_id, user_id, user_name, bets, total) VALUES ($1,$2,$3,$4::jsonb,$5)
     ON CONFLICT (round_id, user_id) DO UPDATE SET bets = roulette_bets.bets || EXCLUDED.bets, total = roulette_bets.total + EXCLUDED.total`,
    [c.roundId, member.id, member.name, JSON.stringify(clean), total],
  )
  return { roundId: c.roundId, balance: await getBalance(member.id) }
}

export async function liveState(member: Member | null) {
  if (member) await settleFor(member)
  const c = clock()
  const showNumber = c.phase !== 'bet'
  const history = Array.from({ length: 14 }, (_, i) => {
    const id = (c.phase === 'result' ? c.roundId : c.roundId - 1) - i
    return roundNumber(id)
  })
  const players = await pool.query(
    `SELECT user_id, user_name, total, bets FROM roulette_bets WHERE round_id = $1 ORDER BY total DESC LIMIT 40`,
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
  const lastId = c.phase === 'result' ? c.roundId : c.roundId - 1
  const lastN = roundNumber(lastId)
  const prev = await pool.query(`SELECT user_name, total, bets FROM roulette_bets WHERE round_id = $1 LIMIT 60`, [lastId])
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
    balance: member ? await getBalance(member.id) : null,
  }
}

export type RouletteLiveState = Awaited<ReturnType<typeof liveState>>
