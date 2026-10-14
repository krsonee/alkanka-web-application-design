import 'server-only'
import { createHmac } from 'node:crypto'
import type { PoolClient } from 'pg'
import { pool } from '@/lib/db'
import { credit, debit, getBalance, recordHistory, type Member } from '@/lib/member'
import { BJ_BET_MS, BJ_JOIN_GRACE_MS, BJ_PLAY_MS, BJ_RESULT_MS, BJ_SEATS, handValue, type BlackjackPhase, type Card } from '@/lib/casino'
import { capPayout } from '@/lib/member-limits'

/** Every card is derived from the server secret, so nobody can predict the next card but every viewer sees the same table. */
function cardAt(roundId: number, who: string, i: number): Card {
  const secret = process.env.BETTER_AUTH_SECRET ?? 'alkanka-blackjack'
  const v = createHmac('sha256', secret).update(`bj:${roundId}:${who}:${i}`).digest().readUInt32BE(0) % 52
  return { r: (v % 13) + 1, s: Math.floor(v / 13) }
}

const seatCards = (roundId: number, seat: number, n: number) => Array.from({ length: n }, (_, i) => cardAt(roundId, `s${seat}`, i))

function dealerHand(roundId: number) {
  const cards: Card[] = [cardAt(roundId, 'd', 0), cardAt(roundId, 'd', 1)]
  while (handValue(cards) < 17) cards.push(cardAt(roundId, 'd', cards.length))
  return cards
}

const isNatural = (cards: Card[]) => cards.length === 2 && handValue(cards) === 21

type Outcome = 'blackjack' | 'win' | 'push' | 'loss'

function outcome(player: Card[], doubled: boolean, dealer: Card[]): { result: Outcome; multiplier: number } {
  const pv = handValue(player)
  const pBj = isNatural(player) && !doubled
  const dBj = isNatural(dealer)
  const dv = handValue(dealer)
  if (pv > 21) return { result: 'loss', multiplier: 0 }
  if (pBj && dBj) return { result: 'push', multiplier: 1 }
  if (pBj) return { result: 'blackjack', multiplier: 2.5 }
  if (dBj) return { result: 'loss', multiplier: 0 }
  if (dv > 21 || pv > dv) return { result: 'win', multiplier: 2 }
  if (pv === dv) return { result: 'push', multiplier: 1 }
  return { result: 'loss', multiplier: 0 }
}

type Round = { id: number; phase: BlackjackPhase; endsAt: number | null }

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

const toRound = (r: { id: string | number; phase: string; phase_ends_at: Date | null }): Round => ({
  id: Number(r.id),
  phase: r.phase as BlackjackPhase,
  endsAt: r.phase_ends_at ? new Date(r.phase_ends_at).getTime() : null,
})

async function setPhase(c: PoolClient, id: number, phase: BlackjackPhase, ms: number | null) {
  const r = await c.query(
    `UPDATE blackjack_round SET phase = $2, phase_ends_at = CASE WHEN $3::int IS NULL THEN NULL ELSE now() + ($3::int * interval '1 millisecond') END WHERE id = $1 RETURNING id, phase, phase_ends_at`,
    [id, phase, ms],
  )
  return toRound(r.rows[0])
}

async function newRound(c: PoolClient, after: number) {
  const r = await c.query(
    `INSERT INTO blackjack_round (id, phase) VALUES ($1, 'waiting') ON CONFLICT (id) DO UPDATE SET phase = blackjack_round.phase RETURNING id, phase, phase_ends_at`,
    [after + 1],
  )
  return toRound(r.rows[0])
}

/** Locks the current round and moves it forward as far as the clock and the players allow. Every read and action goes through here, so the table never waits on a fixed timer. */
async function advance(c: PoolClient): Promise<Round> {
  const cur = await c.query(`SELECT id, phase, phase_ends_at FROM blackjack_round ORDER BY id DESC LIMIT 1 FOR UPDATE`)
  let round: Round
  if (!cur.rowCount) {
    const seed = await c.query(`SELECT COALESCE(MAX(round_id), 0) AS m FROM blackjack_live`)
    round = await newRound(c, Number(seed.rows[0].m))
  } else {
    round = toRound(cur.rows[0])
  }

  for (let guard = 0; guard < 4; guard++) {
    const now = Date.now()
    const expired = round.endsAt !== null && now >= round.endsAt
    if (round.phase === 'waiting') break

    const seats = await c.query(`SELECT id, seat, drawn, stood, ready FROM blackjack_live WHERE round_id = $1`, [round.id])
    if (round.phase === 'bet') {
      if (!seats.rowCount) {
        round = await setPhase(c, round.id, 'waiting', null)
        break
      }
      const allReady = seats.rows.every((s) => s.ready)
      if (!expired && !allReady) break
      round = await setPhase(c, round.id, 'play', BJ_PLAY_MS)
      continue
    }
    if (round.phase === 'play') {
      const allDone = seats.rows.every((s) => s.stood || handValue(seatCards(round.id, Number(s.seat), Number(s.drawn))) >= 21)
      if (!expired && !allDone) break
      await c.query(`UPDATE blackjack_live SET stood = true WHERE round_id = $1 AND stood = false`, [round.id])
      round = await setPhase(c, round.id, 'result', BJ_RESULT_MS)
      continue
    }
    if (round.phase === 'result') {
      if (!expired) break
      round = await newRound(c, round.id)
      continue
    }
    break
  }
  return round
}

/** Pays out every finished hand. The row lock makes it safe when several viewers poll at once. */
async function settleFinished(round: Round) {
  const r = await pool.query(
    `UPDATE blackjack_live SET settled = true
     WHERE id IN (SELECT id FROM blackjack_live WHERE settled = false AND (round_id < $1 OR round_id = $2) ORDER BY id LIMIT 60 FOR UPDATE SKIP LOCKED)
     RETURNING id, round_id, seat, user_id, user_name, bet, drawn, doubled`,
    [round.id, round.phase === 'result' ? round.id : -1],
  )
  for (const row of r.rows) {
    const roundId = Number(row.round_id)
    const stake = Number(row.bet) * (row.doubled ? 2 : 1)
    const cards = seatCards(roundId, Number(row.seat), Number(row.drawn))
    const dealer = dealerHand(roundId)
    const { result, multiplier } = outcome(cards, !!row.doubled, dealer)
    const returned = await capPayout(String(row.user_id), stake, Math.floor(stake * multiplier))
    await pool.query(`UPDATE blackjack_live SET returned = $2 WHERE id = $1`, [row.id, returned])
    if (returned) await credit(String(row.user_id), returned)
    await recordHistory({
      userId: String(row.user_id),
      userName: String(row.user_name),
      game: 'blackjack',
      mode: 'masa',
      opponent: `Krupiye ${handValue(dealer)} · Sen ${handValue(cards)}`,
      stake,
      result: result === 'push' ? 'draw' : result === 'loss' ? 'loss' : 'win',
      delta: returned - stake,
      score: handValue(cards),
    })
  }
}

export async function sitAtTable(member: Member, seat: number, bet: number, allowedBets: number[]) {
  if (!Number.isInteger(seat) || seat < 1 || seat > BJ_SEATS) throw new Error('Geçersiz koltuk.')
  if (!allowedBets.includes(bet)) throw new Error('Geçersiz bahis.')
  if (!(await debit(member.id, bet))) throw new Error('Yetersiz Kanka Coin.')
  try {
    await inTx(async (c) => {
      let round = await advance(c)
      if (round.phase === 'waiting') round = await setPhase(c, round.id, 'bet', BJ_BET_MS)
      if (round.phase !== 'bet') throw new Error('Bu el başladı, bir sonraki eli bekle.')
      const ins = await c.query(
        `INSERT INTO blackjack_live (round_id, seat, user_id, user_name, bet) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id`,
        [round.id, seat, member.id, member.name, bet],
      )
      if (!ins.rowCount) throw new Error('Bu koltuk dolu ya da bu elde zaten oturuyorsun.')
      // A late joiner always gets a few seconds to press "deal" before cards come out.
      if (round.endsAt !== null && round.endsAt - Date.now() < BJ_JOIN_GRACE_MS) await setPhase(c, round.id, 'bet', BJ_JOIN_GRACE_MS)
    })
  } catch (e) {
    await credit(member.id, bet)
    throw e
  }
  return { balance: await getBalance(member.id) }
}

/** Seated player says "deal now". Once every seated player has said it, cards come out without waiting for the timer. */
export async function readyAtTable(member: Member) {
  await inTx(async (c) => {
    const round = await advance(c)
    if (round.phase !== 'bet') throw new Error('Kartlar zaten dağıtıldı.')
    const r = await c.query(`UPDATE blackjack_live SET ready = true WHERE round_id = $1 AND user_id = $2`, [round.id, member.id])
    if (!r.rowCount) throw new Error('Önce bir koltuğa otur.')
    await advance(c)
  })
  return { balance: await getBalance(member.id) }
}

export async function actAtTable(member: Member, action: 'hit' | 'stand' | 'double') {
  await inTx(async (c) => {
    const round = await advance(c)
    if (round.phase !== 'play') throw new Error('Şu an hamle sırası değil.')
    const r = await c.query(`SELECT id, seat, bet, drawn FROM blackjack_live WHERE round_id = $1 AND user_id = $2 AND stood = false`, [round.id, member.id])
    const row = r.rows[0]
    if (!row) throw new Error('Bu elde oynayacak kartın yok.')
    const drawn = Number(row.drawn)
    const cards = seatCards(round.id, Number(row.seat), drawn)
    if (handValue(cards) >= 21) throw new Error('Elin tamamlandı.')

    if (action === 'stand') {
      await c.query(`UPDATE blackjack_live SET stood = true WHERE id = $1`, [row.id])
    } else if (action === 'hit') {
      const next = seatCards(round.id, Number(row.seat), drawn + 1)
      await c.query(`UPDATE blackjack_live SET drawn = $2, stood = $3 WHERE id = $1`, [row.id, drawn + 1, handValue(next) >= 21])
    } else {
      if (drawn !== 2) throw new Error('Sadece ilk iki kartta ikiye katlayabilirsin.')
      if (!(await debit(member.id, Number(row.bet)))) throw new Error('İkiye katlamak için yeterli KC yok.')
      try {
        await c.query(`UPDATE blackjack_live SET drawn = 3, doubled = true, stood = true WHERE id = $1`, [row.id])
      } catch (e) {
        await credit(member.id, Number(row.bet))
        throw e
      }
    }
    // If that was the last open hand, the dealer reveals right away.
    await advance(c)
  })
  return { balance: await getBalance(member.id) }
}

const PHASE_TOTAL: Record<BlackjackPhase, number | null> = { waiting: null, bet: BJ_BET_MS, play: BJ_PLAY_MS, result: BJ_RESULT_MS }

export async function blackjackLiveState(member: Member | null) {
  const round = await inTx(advance)
  await settleFinished(round)
  const { id: roundId, phase } = round

  const rows = await pool.query(
    `SELECT seat, user_id, user_name, bet, drawn, stood, doubled, ready FROM blackjack_live WHERE round_id = $1 ORDER BY seat`,
    [roundId],
  )
  const dealing = phase === 'play' || phase === 'result'
  const dealerFull = dealerHand(roundId)
  const reveal = phase === 'result'
  const dealer = !dealing ? [] : reveal ? dealerFull : [dealerFull[0]]

  const seats = Array.from({ length: BJ_SEATS }, (_, i) => {
    const row = rows.rows.find((x) => Number(x.seat) === i + 1)
    if (!row) return null
    const cards = dealing ? seatCards(roundId, i + 1, Number(row.drawn)) : []
    const value = handValue(cards)
    const doubled = !!row.doubled
    const res = reveal ? outcome(cards, doubled, dealerFull) : null
    const stake = Number(row.bet) * (doubled ? 2 : 1)
    return {
      seat: i + 1,
      name: String(row.user_name),
      mine: member ? row.user_id === member.id : false,
      bet: stake,
      cards,
      value,
      doubled,
      ready: !!row.ready,
      done: phase === 'play' ? !!row.stood || value >= 21 : phase === 'result',
      result: res?.result ?? null,
      delta: res ? Math.floor(stake * res.multiplier) - stake : null,
    }
  })

  const prevQ = await pool.query(
    `SELECT round_id FROM blackjack_live WHERE returned IS NOT NULL AND round_id ${reveal ? '<=' : '<'} $1 ORDER BY round_id DESC LIMIT 1`,
    [roundId],
  )
  const lastId = prevQ.rowCount ? Number(prevQ.rows[0].round_id) : null
  const prev = lastId
    ? await pool.query(
        `SELECT user_name, bet, doubled, returned FROM blackjack_live WHERE round_id = $1 AND returned IS NOT NULL ORDER BY (returned - bet * (CASE WHEN doubled THEN 2 ELSE 1 END)) DESC LIMIT 6`,
        [lastId],
      )
    : { rows: [] as { user_name: string; bet: number; doubled: boolean; returned: number }[] }
  const winners = prev.rows
    .map((p) => ({ name: String(p.user_name), won: Number(p.returned) - Number(p.bet) * (p.doubled ? 2 : 1) }))
    .filter((w) => w.won > 0)

  return {
    roundId,
    phase,
    phaseEndsAt: round.endsAt,
    phaseTotal: PHASE_TOTAL[phase],
    serverNow: Date.now(),
    seats,
    dealer,
    dealerHidden: phase === 'play',
    dealerValue: handValue(dealer),
    lastRound: lastId ? { id: lastId, dealerValue: handValue(dealerHand(lastId)), winners } : null,
    balance: member ? await getBalance(member.id) : null,
  }
}

export type BlackjackLiveState = Awaited<ReturnType<typeof blackjackLiveState>>
