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

type Round = { id: number; tableNo: number; phase: BlackjackPhase; endsAt: number | null }

/** Serialises table creation and auto-seating so two people never open the same new table at once. */
const JOIN_LOCK = 4_200_117

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

const toRound = (r: { id: string | number; table_no: string | number; phase: string; phase_ends_at: Date | null }): Round => ({
  id: Number(r.id),
  tableNo: Number(r.table_no),
  phase: r.phase as BlackjackPhase,
  endsAt: r.phase_ends_at ? new Date(r.phase_ends_at).getTime() : null,
})

const ROUND_COLS = 'id, table_no, phase, phase_ends_at'

async function setPhase(c: PoolClient, id: number, phase: BlackjackPhase, ms: number | null) {
  const r = await c.query(
    `UPDATE blackjack_round SET phase = $2, phase_ends_at = CASE WHEN $3::int IS NULL THEN NULL ELSE now() + ($3::int * interval '1 millisecond') END WHERE id = $1 RETURNING ${ROUND_COLS}`,
    [id, phase, ms],
  )
  return toRound(r.rows[0])
}

/** Round ids are global across tables because the card shuffle is keyed by round id. */
async function newRound(c: PoolClient, tableNo: number) {
  await c.query(`SELECT pg_advisory_xact_lock($1)`, [JOIN_LOCK + 1])
  const r = await c.query(
    `INSERT INTO blackjack_round (id, phase, table_no)
     VALUES (GREATEST((SELECT COALESCE(MAX(id), 0) FROM blackjack_round), (SELECT COALESCE(MAX(round_id), 0) FROM blackjack_live)) + 1, 'waiting', $1)
     RETURNING ${ROUND_COLS}`,
    [tableNo],
  )
  return toRound(r.rows[0])
}

/** Locks a table's current round and moves it forward as far as the clock and the players allow. Every read and action goes through here, so a table never waits on a fixed timer. */
async function advance(c: PoolClient, tableNo: number): Promise<Round> {
  const cur = await c.query(`SELECT ${ROUND_COLS} FROM blackjack_round WHERE table_no = $1 ORDER BY id DESC LIMIT 1 FOR UPDATE`, [tableNo])
  let round = cur.rowCount ? toRound(cur.rows[0]) : await newRound(c, tableNo)

  for (let guard = 0; guard < 4; guard++) {
    const expired = round.endsAt !== null && Date.now() >= round.endsAt
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
      round = await newRound(c, tableNo)
      continue
    }
    break
  }
  return round
}

async function tableNumbers(c: PoolClient | typeof pool) {
  const r = await c.query(`SELECT DISTINCT table_no FROM blackjack_round ORDER BY table_no`)
  const nos = r.rows.map((x) => Number(x.table_no))
  return nos.length ? nos : [1]
}

/** Pays out every finished hand on every table. A hand is finished once its round shows the result or a newer round exists on the same table. */
async function settleFinished() {
  const r = await pool.query(
    `UPDATE blackjack_live SET settled = true
     WHERE id IN (
       SELECT l.id FROM blackjack_live l
       LEFT JOIN blackjack_round r ON r.id = l.round_id
       WHERE l.settled = false
         AND (r.id IS NULL OR r.phase = 'result' OR r.id < (SELECT MAX(r2.id) FROM blackjack_round r2 WHERE r2.table_no = r.table_no))
       ORDER BY l.id LIMIT 60
       FOR UPDATE OF l SKIP LOCKED)
     RETURNING id, round_id, seat, user_id, user_name, bet, drawn, doubled`,
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

/** The table this member is playing at right now (their newest hand that is still on the table's current round). */
async function seatedTable(c: PoolClient | typeof pool, userId: string) {
  const r = await c.query(
    `SELECT r.table_no FROM blackjack_live l
     JOIN blackjack_round r ON r.id = l.round_id
     WHERE l.user_id = $1 AND r.id = (SELECT MAX(r2.id) FROM blackjack_round r2 WHERE r2.table_no = r.table_no)
     ORDER BY l.id DESC LIMIT 1`,
    [userId],
  )
  return r.rowCount ? Number(r.rows[0].table_no) : null
}

export type JoinResult = { balance: number; tableNo: number; seated: boolean }

/**
 * One button, no seat picking: the member lands on the first table that has a free seat and is taking bets.
 * If the only tables with room are mid-hand, they are sent there to wait for the next hand.
 * Only when every table is full does a fresh 6-seat table open.
 */
export async function joinBlackjack(member: Member, bet: number, allowedBets: number[], prefer?: number | null): Promise<JoinResult> {
  if (!allowedBets.includes(bet)) throw new Error('Geçersiz bahis.')
  if (!(await debit(member.id, bet))) throw new Error('Yetersiz Kanka Coin.')
  let out: { tableNo: number; seated: boolean; charged: boolean }
  try {
    out = await inTx(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock($1)`, [JOIN_LOCK])
      const already = await seatedTable(c, member.id)
      if (already !== null) {
        const round = await advance(c, already)
        if (round.phase !== 'result') return { tableNo: already, seated: true, charged: false }
      }

      const nos = await tableNumbers(c)
      const ordered = prefer && nos.includes(prefer) ? [prefer, ...nos.filter((n) => n !== prefer)] : nos
      let waitAt: number | null = null

      for (const no of ordered) {
        let round = await advance(c, no)
        const taken = await c.query(`SELECT seat FROM blackjack_live WHERE round_id = $1`, [round.id])
        if (taken.rowCount! >= BJ_SEATS) continue
        const open = round.phase === 'waiting' || (round.phase === 'bet' && (round.endsAt ?? 0) - Date.now() > 1000)
        if (!open) {
          waitAt ??= no
          continue
        }
        const used = new Set(taken.rows.map((x) => Number(x.seat)))
        const seat = Array.from({ length: BJ_SEATS }, (_, i) => i + 1).find((s) => !used.has(s))!
        if (round.phase === 'waiting') round = await setPhase(c, round.id, 'bet', BJ_BET_MS)
        await c.query(`INSERT INTO blackjack_live (round_id, seat, user_id, user_name, bet) VALUES ($1,$2,$3,$4,$5)`, [
          round.id,
          seat,
          member.id,
          member.name,
          bet,
        ])
        // A late joiner always gets a few seconds to press "deal" before cards come out.
        if (round.endsAt !== null && round.endsAt - Date.now() < BJ_JOIN_GRACE_MS) await setPhase(c, round.id, 'bet', BJ_JOIN_GRACE_MS)
        return { tableNo: no, seated: true, charged: true }
      }

      if (waitAt !== null) return { tableNo: waitAt, seated: false, charged: false }

      const fresh = Math.max(...nos) + 1
      const round = await setPhase(c, (await newRound(c, fresh)).id, 'bet', BJ_BET_MS)
      await c.query(`INSERT INTO blackjack_live (round_id, seat, user_id, user_name, bet) VALUES ($1,1,$2,$3,$4)`, [round.id, member.id, member.name, bet])
      return { tableNo: fresh, seated: true, charged: true }
    })
  } catch (e) {
    await credit(member.id, bet)
    throw e
  }
  if (!out.charged) await credit(member.id, bet)
  return { balance: await getBalance(member.id), tableNo: out.tableNo, seated: out.seated }
}

async function myTable(c: PoolClient, member: Member) {
  const no = await seatedTable(c, member.id)
  if (no === null) throw new Error('Önce masaya otur.')
  return no
}

/** Seated player says "deal now". Once every seated player has said it, cards come out without waiting for the timer. */
export async function readyAtTable(member: Member) {
  await inTx(async (c) => {
    const no = await myTable(c, member)
    const round = await advance(c, no)
    if (round.phase !== 'bet') throw new Error('Kartlar zaten dağıtıldı.')
    const r = await c.query(`UPDATE blackjack_live SET ready = true WHERE round_id = $1 AND user_id = $2`, [round.id, member.id])
    if (!r.rowCount) throw new Error('Önce masaya otur.')
    await advance(c, no)
  })
  return { balance: await getBalance(member.id) }
}

export async function actAtTable(member: Member, action: 'hit' | 'stand' | 'double') {
  await inTx(async (c) => {
    const no = await myTable(c, member)
    const round = await advance(c, no)
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
    await advance(c, no)
  })
  return { balance: await getBalance(member.id) }
}

const PHASE_TOTAL: Record<BlackjackPhase, number | null> = { waiting: null, bet: BJ_BET_MS, play: BJ_PLAY_MS, result: BJ_RESULT_MS }

/** Overview of every table so viewers can hop between them. Empty extra tables are hidden. */
async function tableList(viewing: number) {
  const r = await pool.query(
    `SELECT DISTINCT ON (r.table_no) r.table_no, r.phase, (SELECT COUNT(*) FROM blackjack_live l WHERE l.round_id = r.id) AS seated
     FROM blackjack_round r ORDER BY r.table_no, r.id DESC`,
  )
  return r.rows
    .map((x) => ({ no: Number(x.table_no), phase: String(x.phase) as BlackjackPhase, seated: Number(x.seated) }))
    .filter((t) => t.no === 1 || t.seated > 0 || t.no === viewing)
}

export async function blackjackLiveState(member: Member | null, requested?: number | null) {
  const mine = member ? await seatedTable(pool, member.id) : null
  const nos = await tableNumbers(pool)
  const tableNo = mine ?? (requested && nos.includes(requested) ? requested : nos[0])

  const round = await inTx((c) => advance(c, tableNo))
  await settleFinished()
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
    `SELECT l.round_id FROM blackjack_live l JOIN blackjack_round r ON r.id = l.round_id
     WHERE r.table_no = $2 AND l.returned IS NOT NULL AND l.round_id ${reveal ? '<=' : '<'} $1
     ORDER BY l.round_id DESC LIMIT 1`,
    [roundId, tableNo],
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
    tableNo,
    tables: await tableList(tableNo),
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
