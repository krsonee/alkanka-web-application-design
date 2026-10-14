import 'server-only'
import { createHmac } from 'node:crypto'
import { pool } from '@/lib/db'
import { credit, debit, getBalance, recordHistory, type Member } from '@/lib/member'
import { BJ_SEATS, blackjackClock as clock, handValue, type Card } from '@/lib/casino'

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

function resolvedRound(now = Date.now()) {
  const c = clock(now)
  return c.phase === 'result' ? c.roundId : c.roundId - 1
}

/** Pays out every finished hand. The row lock makes it safe when several viewers poll at once. */
async function settleFinished() {
  const r = await pool.query(
    `UPDATE blackjack_live SET settled = true
     WHERE id IN (SELECT id FROM blackjack_live WHERE settled = false AND round_id <= $1 ORDER BY id LIMIT 60 FOR UPDATE SKIP LOCKED)
     RETURNING id, round_id, seat, user_id, user_name, bet, drawn, doubled`,
    [resolvedRound()],
  )
  for (const row of r.rows) {
    const roundId = Number(row.round_id)
    const stake = Number(row.bet) * (row.doubled ? 2 : 1)
    const cards = seatCards(roundId, Number(row.seat), Number(row.drawn))
    const dealer = dealerHand(roundId)
    const { result, multiplier } = outcome(cards, !!row.doubled, dealer)
    const returned = Math.floor(stake * multiplier)
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
  const c = clock()
  if (c.phase !== 'bet' || c.phaseEndsAt - c.now < 800) throw new Error('Bahisler kapandı, bir sonraki eli bekle.')
  if (!Number.isInteger(seat) || seat < 1 || seat > BJ_SEATS) throw new Error('Geçersiz koltuk.')
  if (!allowedBets.includes(bet)) throw new Error('Geçersiz bahis.')
  if (!(await debit(member.id, bet))) throw new Error('Yetersiz Kanka Coin.')
  const r = await pool.query(
    `INSERT INTO blackjack_live (round_id, seat, user_id, user_name, bet) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id`,
    [c.roundId, seat, member.id, member.name, bet],
  )
  if (!r.rowCount) {
    await credit(member.id, bet)
    throw new Error('Bu koltuk dolu ya da bu elde zaten oturuyorsun.')
  }
  return { balance: await getBalance(member.id) }
}

export async function actAtTable(member: Member, action: 'hit' | 'stand' | 'double') {
  const c = clock()
  if (c.phase !== 'play') throw new Error('Şu an hamle sırası değil.')
  const r = await pool.query(`SELECT id, seat, bet, drawn FROM blackjack_live WHERE round_id = $1 AND user_id = $2 AND stood = false`, [c.roundId, member.id])
  const row = r.rows[0]
  if (!row) throw new Error('Bu elde oynayacak kartın yok.')
  const drawn = Number(row.drawn)
  const cards = seatCards(c.roundId, Number(row.seat), drawn)
  if (handValue(cards) >= 21) throw new Error('Elin tamamlandı.')

  if (action === 'stand') {
    await pool.query(`UPDATE blackjack_live SET stood = true WHERE id = $1`, [row.id])
  } else if (action === 'hit') {
    const next = seatCards(c.roundId, Number(row.seat), drawn + 1)
    await pool.query(`UPDATE blackjack_live SET drawn = $2, stood = $3 WHERE id = $1 AND drawn = $4 AND stood = false`, [
      row.id,
      drawn + 1,
      handValue(next) >= 21,
      drawn,
    ])
  } else {
    if (drawn !== 2) throw new Error('Sadece ilk iki kartta ikiye katlayabilirsin.')
    if (!(await debit(member.id, Number(row.bet)))) throw new Error('İkiye katlamak için yeterli KC yok.')
    const upd = await pool.query(`UPDATE blackjack_live SET drawn = 3, doubled = true, stood = true WHERE id = $1 AND drawn = 2 AND stood = false`, [row.id])
    if (!upd.rowCount) {
      await credit(member.id, Number(row.bet))
      throw new Error('El zaten değişti, tekrar dene.')
    }
  }
  return { balance: await getBalance(member.id) }
}

export async function blackjackLiveState(member: Member | null) {
  await settleFinished()
  const c = clock()
  const rows = await pool.query(
    `SELECT seat, user_id, user_name, bet, drawn, stood, doubled, returned FROM blackjack_live WHERE round_id = $1 ORDER BY seat`,
    [c.roundId],
  )
  const dealerFull = dealerHand(c.roundId)
  const reveal = c.phase === 'result'
  const dealer = c.phase === 'bet' ? [] : reveal ? dealerFull : [dealerFull[0]]

  const seats = Array.from({ length: BJ_SEATS }, (_, i) => {
    const row = rows.rows.find((x) => Number(x.seat) === i + 1)
    if (!row) return null
    const cards = c.phase === 'bet' ? [] : seatCards(c.roundId, i + 1, Number(row.drawn))
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
      done: c.phase === 'play' ? !!row.stood || value >= 21 : c.phase === 'result',
      result: res?.result ?? null,
      delta: res ? Math.floor(stake * res.multiplier) - stake : null,
    }
  })

  const lastId = resolvedRound()
  const prev = await pool.query(
    `SELECT user_name, bet, doubled, returned FROM blackjack_live WHERE round_id = $1 AND returned IS NOT NULL ORDER BY (returned - bet * (CASE WHEN doubled THEN 2 ELSE 1 END)) DESC LIMIT 6`,
    [lastId],
  )
  const winners = prev.rows
    .map((p) => ({ name: String(p.user_name), won: Number(p.returned) - Number(p.bet) * (p.doubled ? 2 : 1) }))
    .filter((w) => w.won > 0)

  return {
    ...c,
    serverNow: Date.now(),
    seats,
    dealer,
    dealerHidden: c.phase === 'play',
    dealerValue: handValue(dealer),
    lastRound: { id: lastId, dealerValue: handValue(dealerHand(lastId)), winners },
    balance: member ? await getBalance(member.id) : null,
  }
}

export type BlackjackLiveState = Awaited<ReturnType<typeof blackjackLiveState>>
