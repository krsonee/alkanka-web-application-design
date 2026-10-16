import 'server-only'
import { createHmac } from 'node:crypto'
import type { PoolClient } from 'pg'
import { pool } from '@/lib/db'
import { credit, debit, getBalance, recordHistory, type Member } from '@/lib/member'
import { BJ_BET_MS, BJ_JOIN_GRACE_MS, BJ_PLAY_MS, BJ_RESULT_MS, BJ_SEATS, BJ_SIDE_STAKES, handValue, pairsHit, threeCardHit, type BlackjackPhase, type Card } from '@/lib/casino'
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

/** Side bets settle on the opening deal: the seat's first two cards and the dealer's up card. */
function sideHits(roundId: number, seat: number) {
  const [a, b] = seatCards(roundId, seat, 2)
  const up = cardAt(roundId, 'd', 0)
  return { pairs: pairsHit(a, b), t213: threeCardHit([a, b, up]) }
}

const sideReturn = (stake: number, h: { x: number } | null) => (stake > 0 && h ? stake * (h.x + 1) : 0)

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

/** A player who lets this many hands in a row play out without touching anything is stood up, so an abandoned tab stops paying bets. */
const MAX_IDLE_HANDS = 2

/** Charges inside the table transaction, so a rolled-back hand never keeps the money. */
async function debitIn(c: PoolClient, userId: string, amount: number) {
  if (amount <= 0) return true
  const r = await c.query(`UPDATE wallets SET balance = balance - $2, updated_at = now() WHERE user_id = $1 AND balance >= $2 RETURNING balance`, [userId, amount])
  return (r.rowCount ?? 0) > 0
}

async function creditIn(c: PoolClient, userId: string, amount: number) {
  if (amount <= 0) return
  await c.query(`UPDATE wallets SET balance = balance + $2, updated_at = now() WHERE user_id = $1`, [userId, amount])
}

/**
 * Everyone who sat through the last hand keeps their seat and their stake for the next one.
 * Side bets drop off first when the balance can't cover them; a player who can't cover the main bet, asked to leave, or sat idle too long is stood up.
 */
async function carryOver(c: PoolClient, fromRound: number, round: Round): Promise<Round> {
  const prev = await c.query(
    `SELECT seat, user_id, user_name, bet, side_pairs, side_213, acted, idle FROM blackjack_live WHERE round_id = $1 AND leaving = false ORDER BY seat`,
    [fromRound],
  )
  let carried = 0
  for (const p of prev.rows) {
    const idle = p.acted ? 0 : Number(p.idle) + 1
    if (idle >= MAX_IDLE_HANDS) continue
    const userId = String(p.user_id)
    const bet = Number(p.bet)
    let pairs = Number(p.side_pairs) || 0
    let t213 = Number(p.side_213) || 0
    if (!(await debitIn(c, userId, bet + pairs + t213))) {
      pairs = 0
      t213 = 0
      if (!(await debitIn(c, userId, bet))) continue
    }
    await c.query(
      `INSERT INTO blackjack_live (round_id, seat, user_id, user_name, bet, side_pairs, side_213, idle) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [round.id, Number(p.seat), userId, String(p.user_name), bet, pairs, t213, idle],
    )
    carried++
  }
  return carried ? setPhase(c, round.id, 'bet', BJ_BET_MS) : round
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
      const finished = round.id
      round = await carryOver(c, finished, await newRound(c, tableNo))
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
     RETURNING id, round_id, seat, user_id, user_name, bet, drawn, doubled, side_pairs, side_213`,
  )
  for (const row of r.rows) {
    const roundId = Number(row.round_id)
    const stake = Number(row.bet) * (row.doubled ? 2 : 1)
    const cards = seatCards(roundId, Number(row.seat), Number(row.drawn))
    const dealer = dealerHand(roundId)
    const { result, multiplier } = outcome(cards, !!row.doubled, dealer)
    const sidePairs = Number(row.side_pairs) || 0
    const side213 = Number(row.side_213) || 0
    const hits = sideHits(roundId, Number(row.seat))
    const mainWin = Math.floor(stake * multiplier)
    const sideWin = sideReturn(sidePairs, hits.pairs) + sideReturn(side213, hits.t213)
    const totalStake = stake + sidePairs + side213
    const total = await capPayout(String(row.user_id), totalStake, mainWin + sideWin)
    const returned = Math.min(mainWin, total)
    const sideReturned = total - returned
    await pool.query(`UPDATE blackjack_live SET returned = $2, side_returned = $3 WHERE id = $1`, [row.id, returned, sideReturned])
    if (total) await credit(String(row.user_id), total)
    await recordHistory({
      userId: String(row.user_id),
      userName: String(row.user_name),
      game: 'blackjack',
      mode: 'masa',
      opponent: `Krupiye ${handValue(dealer)} · Sen ${handValue(cards)}`,
      stake: totalStake,
      result: total > totalStake ? 'win' : total === totalStake ? 'draw' : result === 'push' ? 'draw' : 'loss',
      delta: total - totalStake,
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
export type SideBets = { pairs: number; t213: number }

export async function joinBlackjack(member: Member, bet: number, allowedBets: number[], prefer?: number | null, side: SideBets = { pairs: 0, t213: 0 }, preferSeat: number | null = null): Promise<JoinResult> {
  if (!allowedBets.includes(bet)) throw new Error('Geçersiz bahis.')
  if (!BJ_SIDE_STAKES.includes(side.pairs) || !BJ_SIDE_STAKES.includes(side.t213)) throw new Error('Geçersiz yan bahis.')
  const total = bet + side.pairs + side.t213
  if (!(await debit(member.id, total))) throw new Error('Yetersiz Kanka Coin.')
  let out: { tableNo: number; seated: boolean; charged: boolean }
  try {
    out = await inTx(async (c) => {
      await c.query(`SELECT pg_advisory_xact_lock($1)`, [JOIN_LOCK])
      const already = await seatedTable(c, member.id)
      if (already !== null) {
        const round = await advance(c, already)
        const mine = await c.query(`SELECT leaving FROM blackjack_live WHERE round_id = $1 AND user_id = $2`, [round.id, member.id])
        const stays = mine.rowCount && !mine.rows[0].leaving
        if (stays || round.phase !== 'result') return { tableNo: already, seated: true, charged: false }
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
        const wantsThis = no === prefer && preferSeat !== null && preferSeat >= 1 && preferSeat <= BJ_SEATS
        if (wantsThis && used.has(preferSeat)) throw new Error(`Koltuk ${preferSeat} az önce doldu kanka, başka bir koltuk seç.`)
        const seat = wantsThis ? preferSeat : Array.from({ length: BJ_SEATS }, (_, i) => i + 1).find((s) => !used.has(s))!
        if (round.phase === 'waiting') round = await setPhase(c, round.id, 'bet', BJ_BET_MS)
        await c.query(`INSERT INTO blackjack_live (round_id, seat, user_id, user_name, bet, side_pairs, side_213) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
          round.id,
          seat,
          member.id,
          member.name,
          bet,
          side.pairs,
          side.t213,
        ])
        // A late joiner always gets a few seconds to press "deal" before cards come out.
        if (round.endsAt !== null && round.endsAt - Date.now() < BJ_JOIN_GRACE_MS) await setPhase(c, round.id, 'bet', BJ_JOIN_GRACE_MS)
        return { tableNo: no, seated: true, charged: true }
      }

      if (waitAt !== null) return { tableNo: waitAt, seated: false, charged: false }

      const fresh = Math.max(...nos) + 1
      const round = await setPhase(c, (await newRound(c, fresh)).id, 'bet', BJ_BET_MS)
      await c.query(`INSERT INTO blackjack_live (round_id, seat, user_id, user_name, bet, side_pairs, side_213) VALUES ($1,1,$2,$3,$4,$5,$6)`, [
        round.id,
        member.id,
        member.name,
        bet,
        side.pairs,
        side.t213,
      ])
      return { tableNo: fresh, seated: true, charged: true }
    })
  } catch (e) {
    await credit(member.id, total)
    throw e
  }
  if (!out.charged) await credit(member.id, total)
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
    const r = await c.query(`UPDATE blackjack_live SET ready = true, acted = true WHERE round_id = $1 AND user_id = $2`, [round.id, member.id])
    if (!r.rowCount) throw new Error('Önce masaya otur.')
    await advance(c, no)
  })
  return { balance: await getBalance(member.id) }
}

/**
 * Stands the member up. Before the cards come out the seat is freed and the stake refunded on the spot;
 * once a hand is running it plays out and pays as usual, and the seat simply isn't carried into the next hand.
 */
export async function leaveTable(member: Member) {
  const out = await inTx(async (c) => {
    const no = await myTable(c, member)
    const round = await advance(c, no)
    const r = await c.query(`SELECT id, bet, side_pairs, side_213 FROM blackjack_live WHERE round_id = $1 AND user_id = $2`, [round.id, member.id])
    const row = r.rows[0]
    if (!row) throw new Error('Zaten masada değilsin.')
    if (round.phase === 'waiting' || round.phase === 'bet') {
      await c.query(`DELETE FROM blackjack_live WHERE id = $1`, [row.id])
      await creditIn(c, member.id, Number(row.bet) + (Number(row.side_pairs) || 0) + (Number(row.side_213) || 0))
      await advance(c, no)
      return { left: true }
    }
    await c.query(`UPDATE blackjack_live SET leaving = true, acted = true WHERE id = $1`, [row.id])
    return { left: false }
  })
  return { balance: await getBalance(member.id), ...out }
}

/** Changes the stake for the coming hand while bets are still open; the difference is charged or refunded right away. */
export async function changeTableBet(member: Member, bet: number, allowedBets: number[]) {
  if (!allowedBets.includes(bet)) throw new Error('Geçersiz bahis.')
  await inTx(async (c) => {
    const no = await myTable(c, member)
    const round = await advance(c, no)
    if (round.phase !== 'bet') throw new Error('Bahis sadece kartlar dağıtılmadan değişir.')
    const r = await c.query(`SELECT id, bet FROM blackjack_live WHERE round_id = $1 AND user_id = $2 FOR UPDATE`, [round.id, member.id])
    const row = r.rows[0]
    if (!row) throw new Error('Önce masaya otur.')
    const diff = bet - Number(row.bet)
    if (diff > 0 && !(await debitIn(c, member.id, diff))) throw new Error('Yetersiz Kanka Coin.')
    if (diff < 0) await creditIn(c, member.id, -diff)
    await c.query(`UPDATE blackjack_live SET bet = $2, acted = true WHERE id = $1`, [row.id, bet])
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

    await c.query(`UPDATE blackjack_live SET acted = true WHERE id = $1`, [row.id])
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

/** A spectator counts as watching while their tab keeps polling; idle tabs poll every 30s. */
const WATCH_WINDOW_S = 45

async function markWatching(member: Member, tableNo: number | null) {
  if (tableNo === null) {
    await pool.query(`DELETE FROM blackjack_watch WHERE user_id = $1`, [member.id])
    return
  }
  await pool.query(`DELETE FROM blackjack_watch WHERE user_id = $1 AND table_no <> $2`, [member.id, tableNo])
  await pool.query(
    `INSERT INTO blackjack_watch (table_no, user_id, user_name, seen_at) VALUES ($1,$2,$3,now())
     ON CONFLICT (table_no, user_id) DO UPDATE SET seen_at = now(), user_name = EXCLUDED.user_name`,
    [tableNo, member.id, member.name.slice(0, 40)],
  )
  if (Math.random() < 0.05) await pool.query(`DELETE FROM blackjack_watch WHERE seen_at < now() - interval '10 minutes'`)
}

/** True when the member holds a seat on this table's current round. Used to tag chat messages from players. */
export async function isSeatedAt(userId: string, tableNo: number) {
  return (await seatedTable(pool, userId)) === tableNo
}

/** Overview of every table so viewers can hop between them. Empty extra tables are hidden. */
async function tableList(viewing: number) {
  const r = await pool.query(
    `SELECT DISTINCT ON (r.table_no) r.table_no, r.phase,
       (SELECT COUNT(*) FROM blackjack_live l WHERE l.round_id = r.id) AS seated,
       (SELECT COUNT(*) FROM blackjack_watch w WHERE w.table_no = r.table_no AND w.seen_at > now() - interval '${WATCH_WINDOW_S} seconds') AS watching
     FROM blackjack_round r ORDER BY r.table_no, r.id DESC`,
  )
  return r.rows
    .map((x) => ({ no: Number(x.table_no), phase: String(x.phase) as BlackjackPhase, seated: Number(x.seated), watching: Number(x.watching) }))
    .filter((t) => t.no === 1 || t.seated > 0 || t.no === viewing)
}

export async function blackjackLiveState(member: Member | null, requested?: number | null) {
  const mine = member ? await seatedTable(pool, member.id) : null
  const nos = await tableNumbers(pool)
  const tableNo = mine ?? (requested && nos.includes(requested) ? requested : nos[0])

  const round = await inTx((c) => advance(c, tableNo))
  await settleFinished()
  if (member) await markWatching(member, mine === null ? tableNo : null)
  const watchQ = await pool.query(
    `SELECT user_name FROM blackjack_watch WHERE table_no = $1 AND seen_at > now() - interval '${WATCH_WINDOW_S} seconds' ORDER BY seen_at DESC LIMIT 40`,
    [tableNo],
  )
  const watchers = watchQ.rows.map((w) => String(w.user_name))
  const { id: roundId, phase } = round

  const rows = await pool.query(
    `SELECT seat, user_id, user_name, bet, drawn, stood, doubled, ready, side_pairs, side_213, leaving, idle FROM blackjack_live WHERE round_id = $1 ORDER BY seat`,
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
    const hits = dealing ? sideHits(roundId, i + 1) : null
    const sp = Number(row.side_pairs) || 0
    const s3 = Number(row.side_213) || 0
    const side = {
      pairs: sp,
      t213: s3,
      pairsHit: sp > 0 ? (hits?.pairs ?? null) : null,
      t213Hit: s3 > 0 ? (hits?.t213 ?? null) : null,
      settled: dealing,
      won: dealing ? sideReturn(sp, hits?.pairs ?? null) + sideReturn(s3, hits?.t213 ?? null) : 0,
    }
    return {
      seat: i + 1,
      name: String(row.user_name),
      mine: member ? row.user_id === member.id : false,
      bet: stake,
      cards,
      value,
      doubled,
      ready: !!row.ready,
      leaving: !!row.leaving,
      idle: Number(row.idle) || 0,
      baseBet: Number(row.bet),
      done: phase === 'play' ? !!row.stood || value >= 21 : phase === 'result',
      result: res?.result ?? null,
      delta: res ? Math.floor(stake * res.multiplier) - stake : null,
      side,
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
        `SELECT user_name, bet, doubled, returned, side_pairs, side_213, COALESCE(side_returned, 0) AS side_returned FROM blackjack_live WHERE round_id = $1 AND returned IS NOT NULL
         ORDER BY (returned + COALESCE(side_returned, 0) - bet * (CASE WHEN doubled THEN 2 ELSE 1 END) - side_pairs - side_213) DESC LIMIT 6`,
        [lastId],
      )
    : { rows: [] as { user_name: string; bet: number; doubled: boolean; returned: number; side_pairs: number; side_213: number; side_returned: number }[] }
  const winners = prev.rows
    .map((p) => ({
      name: String(p.user_name),
      won: Number(p.returned) + Number(p.side_returned) - Number(p.bet) * (p.doubled ? 2 : 1) - Number(p.side_pairs) - Number(p.side_213),
    }))
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
    watchers,
    dealer,
    dealerHidden: phase === 'play',
    dealerValue: handValue(dealer),
    lastRound: lastId ? { id: lastId, dealerValue: handValue(dealerHand(lastId)), winners } : null,
    balance: member ? await getBalance(member.id) : null,
  }
}

export type BlackjackLiveState = Awaited<ReturnType<typeof blackjackLiveState>>
