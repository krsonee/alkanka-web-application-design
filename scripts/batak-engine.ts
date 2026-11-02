import assert from 'node:assert/strict'
import {
  BATAK_VARIANTS,
  batakBotTurn,
  batakStep,
  initBatak,
  legalCards,
  mustBid,
  trickWinner,
  tricksPerHand,
  type BCard,
  type BatakState,
  type BatakVariant,
  type Play,
} from '../lib/games/batak'

const GAMES_PER_VARIANT = 25
const MAX_STEPS = 20_000

let passed = 0
const failures: string[] = []

function scenario(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ok   ${name}`)
  } catch (err) {
    failures.push(name)
    console.log(`  FAIL ${name}\n       ${(err as Error).message.split('\n')[0]}`)
  }
}

const c = (s: number, r: number): BCard => ({ s, r })
const p = (seat: number, card: BCard): Play => ({ seat, card })
const key = (x: BCard) => `${x.s}:${x.r}`
const keys = (cards: BCard[]) => cards.map(key).sort()

/** Every one of the 52 cards must be in exactly one place at all times. `played` already includes the open trick. */
function assertCardsConserved(s: BatakState) {
  const inPlayed = new Set(s.played.map(key))
  assert.ok(s.trick.every((t) => inPlayed.has(key(t.card))), `hand ${s.handNo}: trick card missing from played`)
  const all = [...s.hands.flat(), ...s.played, ...s.kitty, ...(s.buried ?? [])]
  const unique = new Set(all.map(key))
  assert.equal(unique.size, all.length, `hand ${s.handNo}: duplicate card`)
  assert.equal(all.length, 52, `hand ${s.handNo} phase ${s.phase}: ${all.length} cards instead of 52`)
}

function playFullGame(variant: BatakVariant, target: number) {
  let s = initBatak({ botSeats: [0, 1, 2, 3], rounds: target, variant })
  s = { ...s, bots: Array.from({ length: s.seats }, (_, i) => i) }
  const seats = s.seats
  for (let step = 0; step < MAX_STEPS; step++) {
    const before = s
    const r = batakBotTurn(s, s.turn)
    if (before.phase === 'play') {
      const card = r.state.handNo === before.handNo ? findPlayed(before, r.state) : null
      if (card) {
        const legal = legalCards(before.hands[before.turn], before.trick, before.trump, before.broken)
        assert.ok(legal.some((x) => key(x) === key(card)), `bot played illegal card ${key(card)}`)
      }
    }
    if (r.winners) return { state: r.state, winners: r.winners, seats }
    s = r.state
    if (s.phase === 'play' || s.phase === 'bid' || s.phase === 'predict') assertCardsConserved(s)
  }
  throw new Error(`${variant}: game did not finish in ${MAX_STEPS} steps`)
}

/** The card the acting seat removed from their hand in this step. */
function findPlayed(before: BatakState, after: BatakState): BCard | null {
  const seat = before.turn
  const left = new Set(after.hands[seat].map(key))
  return before.hands[seat].find((x) => !left.has(key(x))) ?? null
}

console.log('\nBatak engine\n')

scenario('trickWinner: highest card of the led suit wins without trump', () => {
  const w = trickWinner([p(0, c(1, 10)), p(1, c(1, 14)), p(2, c(2, 14)), p(3, c(1, 2))], null)
  assert.equal(w?.seat, 1)
})

scenario('trickWinner: any trump beats the led suit, highest trump wins', () => {
  const w = trickWinner([p(0, c(1, 14)), p(1, c(0, 2)), p(2, c(0, 9)), p(3, c(1, 13))], 0)
  assert.equal(w?.seat, 2)
})

scenario('legalCards: must follow suit and beat when possible', () => {
  const hand = [c(1, 5), c(1, 12), c(2, 14)]
  assert.deepEqual(keys(legalCards(hand, [p(0, c(1, 10))], 0, false)), keys([c(1, 12)]))
})

scenario('legalCards: follow suit with any card when it cannot beat', () => {
  const hand = [c(1, 5), c(1, 7), c(2, 14)]
  assert.deepEqual(keys(legalCards(hand, [p(0, c(1, 10))], 0, false)), keys([c(1, 5), c(1, 7)]))
})

scenario('legalCards: void in led suit must trump, and over-trump if possible', () => {
  const hand = [c(0, 3), c(0, 11), c(2, 14)]
  assert.deepEqual(keys(legalCards(hand, [p(0, c(1, 10))], 0, false)), keys([c(0, 3), c(0, 11)]))
  assert.deepEqual(keys(legalCards(hand, [p(0, c(1, 10)), p(1, c(0, 9))], 0, false)), keys([c(0, 11)]))
})

scenario('legalCards: cannot lead trump before it is broken', () => {
  const hand = [c(0, 14), c(2, 3)]
  assert.deepEqual(keys(legalCards(hand, [], 0, false)), keys([c(2, 3)]))
  assert.deepEqual(keys(legalCards(hand, [], 0, true)), keys(hand))
  assert.deepEqual(keys(legalCards([c(0, 14)], [], 0, false)), keys([c(0, 14)]))
})

scenario('bid: the last player cannot pass after everyone else passed', () => {
  let s = initBatak({ variant: 'klasik' })
  for (let i = 0; i < s.seats - 1; i++) s = batakStep(s, s.turn, { type: 'bid', amount: 'pass' }).state
  assert.equal(mustBid(s, s.turn), true)
  assert.throws(() => batakStep(s, s.turn, { type: 'bid', amount: 'pass' }))
})

scenario('play: an illegal card is rejected and the state is unchanged', () => {
  let s = initBatak({ botSeats: [0, 1, 2, 3], variant: 'klasik' })
  s = { ...s, bots: [0, 1, 2, 3] }
  for (let i = 0; i < 200 && !(s.phase === 'play' && s.trick.length > 0); i++) s = batakBotTurn(s, s.turn).state
  assert.equal(s.phase, 'play')
  const hand = s.hands[s.turn]
  const legal = new Set(legalCards(hand, s.trick, s.trump, s.broken).map(key))
  const bad = hand.find((x) => !legal.has(key(x)))
  if (!bad) return
  const snapshot = JSON.stringify(s)
  assert.throws(() => batakStep(s, s.turn, { type: 'play', s: bad.s, r: bad.r }))
  assert.equal(JSON.stringify(s), snapshot)
})

scenario('play: a card the player does not hold is rejected', () => {
  let s = initBatak({ botSeats: [0, 1, 2, 3], variant: 'klasik' })
  s = { ...s, bots: [0, 1, 2, 3] }
  for (let i = 0; i < 200 && s.phase !== 'play'; i++) s = batakBotTurn(s, s.turn).state
  const other = s.hands[(s.turn + 1) % s.seats][0]
  assert.throws(() => batakStep(s, s.turn, { type: 'play', s: other.s, r: other.r }))
})

scenario('play: acting out of turn is rejected', () => {
  const s = initBatak({ variant: 'klasik' })
  assert.throws(() => batakStep(s, (s.turn + 1) % s.seats, { type: 'bid', amount: 'pass' }), /sıra/i)
})

for (const { value: variant } of BATAK_VARIANTS) {
  scenario(`${variant}: ${GAMES_PER_VARIANT} full bot games finish with consistent scores`, () => {
    for (let g = 0; g < GAMES_PER_VARIANT; g++) {
      const target = [31, 51][g % 2]
      const { state, winners, seats } = playFullGame(variant, target)
      assert.ok(winners.length > 0, 'no winner')
      assert.ok(winners.every((w) => w >= 0 && w < seats), 'winner seat out of range')
      const perHand = tricksPerHand({ seats })
      for (const r of state.results) {
        assert.equal(r.taken.reduce((a, b) => a + b, 0), perHand, `hand ${r.hand}: tricks do not add up`)
      }
      const summed = Array.from({ length: seats }, (_, i) => state.results.reduce((a, r) => a + (r.scores[i] ?? 0), 0))
      assert.deepEqual(summed, state.totals, 'totals differ from the sum of hand scores')
      assert.ok(Math.max(...state.totals) >= target, `nobody reached the target ${target}`)
    }
  })
}

console.log(`\n${passed} passed, ${failures.length} failed\n`)
if (failures.length) process.exit(1)
