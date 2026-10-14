export type Card = { r: number; s: number }
export const SUITS = ['♠', '♥', '♦', '♣']
export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function shoe(decks = 4): Card[] {
  const cards: Card[] = []
  for (let d = 0; d < decks; d++) for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) cards.push({ r, s })
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

export function handValue(hand: Card[]) {
  let total = 0
  let aces = 0
  for (const c of hand) {
    total += c.r === 1 ? 11 : Math.min(10, c.r)
    if (c.r === 1) aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}

export const isBlackjack = (hand: Card[]) => hand.length === 2 && handValue(hand) === 21

export type BjPhase = 'player' | 'done'
export type BjResult = 'blackjack' | 'win' | 'push' | 'loss' | null
export type BjState = { deck: Card[]; player: Card[]; dealer: Card[]; bet: number; phase: BjPhase; result: BjResult; doubled: boolean }

export function bjDeal(bet: number): BjState {
  const deck = shoe()
  const player = [deck.pop()!, deck.pop()!]
  const dealer = [deck.pop()!, deck.pop()!]
  const s: BjState = { deck, player, dealer, bet, phase: 'player', result: null, doubled: false }
  if (isBlackjack(player) || isBlackjack(dealer)) return bjSettle(s)
  return s
}

function bjSettle(s: BjState): BjState {
  const dealer = [...s.dealer]
  const deck = [...s.deck]
  const pv = handValue(s.player)
  const pBj = isBlackjack(s.player)
  const dBj = isBlackjack(dealer)
  if (!pBj && pv <= 21 && !dBj) while (handValue(dealer) < 17) dealer.push(deck.pop()!)
  const dv = handValue(dealer)
  let result: BjResult
  if (pBj && dBj) result = 'push'
  else if (pBj) result = 'blackjack'
  else if (dBj) result = 'loss'
  else if (pv > 21) result = 'loss'
  else if (dv > 21 || pv > dv) result = 'win'
  else if (pv === dv) result = 'push'
  else result = 'loss'
  return { ...s, deck, dealer, phase: 'done', result }
}

export function bjAct(s: BjState, action: 'hit' | 'stand' | 'double'): BjState {
  if (s.phase !== 'player') return s
  const deck = [...s.deck]
  if (action === 'hit') {
    const player = [...s.player, deck.pop()!]
    const next = { ...s, deck, player }
    return handValue(player) >= 21 ? bjSettle(next) : next
  }
  if (action === 'double') {
    if (s.player.length !== 2) return s
    const player = [...s.player, deck.pop()!]
    return bjSettle({ ...s, deck, player, bet: s.bet * 2, doubled: true })
  }
  return bjSettle(s)
}

/** Total returned to the player (stake included). */
export function bjPayout(s: BjState) {
  if (s.result === 'blackjack') return Math.floor(s.bet * 2.5)
  if (s.result === 'win') return s.bet * 2
  if (s.result === 'push') return s.bet
  return 0
}

export function bjPublic(s: BjState) {
  const hide = s.phase === 'player'
  return {
    player: s.player,
    dealer: hide ? [s.dealer[0]] : s.dealer,
    dealerHidden: hide,
    bet: s.bet,
    phase: s.phase,
    result: s.result,
    doubled: s.doubled,
    playerValue: handValue(s.player),
    dealerValue: hide ? handValue([s.dealer[0]]) : handValue(s.dealer),
  }
}
export type BjPublic = ReturnType<typeof bjPublic>

export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
/** European wheel order, clockwise from 0. */
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]

export type RouletteBet = { kind: 'number' | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high' | 'dozen'; value?: number; amount: number }

export function betLabel(b: RouletteBet) {
  const map = { red: 'Kırmızı', black: 'Siyah', even: 'Çift', odd: 'Tek', low: '1-18', high: '19-36' } as const
  if (b.kind === 'number') return `Sayı ${b.value}`
  if (b.kind === 'dozen') return `${b.value}. düzine`
  return map[b.kind]
}

/** Total returned for one bet (stake included). */
export function betReturn(b: RouletteBet, n: number) {
  if (b.kind === 'number') return b.value === n ? b.amount * 36 : 0
  if (n === 0) return 0
  const win =
    (b.kind === 'red' && RED.has(n)) ||
    (b.kind === 'black' && !RED.has(n)) ||
    (b.kind === 'even' && n % 2 === 0) ||
    (b.kind === 'odd' && n % 2 === 1) ||
    (b.kind === 'low' && n <= 18) ||
    (b.kind === 'high' && n >= 19)
  if (b.kind === 'dozen') return Math.ceil(n / 12) === b.value ? b.amount * 3 : 0
  return win ? b.amount * 2 : 0
}

export function validBet(b: RouletteBet) {
  if (!Number.isInteger(b.amount) || b.amount <= 0) return false
  if (b.kind === 'number') return Number.isInteger(b.value) && b.value! >= 0 && b.value! <= 36
  if (b.kind === 'dozen') return b.value === 1 || b.value === 2 || b.value === 3
  return ['red', 'black', 'even', 'odd', 'low', 'high'].includes(b.kind)
}

/** Shared live roulette table timing. Client and server derive the same phase from the clock. */
export const RL_BET_MS = 22_000
export const RL_SPIN_MS = 9_000
export const RL_RESULT_MS = 6_000
export const RL_CYCLE_MS = RL_BET_MS + RL_SPIN_MS + RL_RESULT_MS
export type RoulettePhase = 'bet' | 'spin' | 'result'

export const BJ_SEATS = 6
/** Live blackjack runs on events: the bet window opens when someone sits and ends early once every seat is ready; play ends once every hand is done. These are only the upper limits. */
export const BJ_BET_MS = 8_000
export const BJ_JOIN_GRACE_MS = 3_000
export const BJ_PLAY_MS = 20_000
export const BJ_RESULT_MS = 5_000
export type BlackjackPhase = 'waiting' | 'bet' | 'play' | 'result'

export function rouletteClock(now = Date.now()) {
  const roundId = Math.floor(now / RL_CYCLE_MS)
  const start = roundId * RL_CYCLE_MS
  const offset = now - start
  const phase: RoulettePhase = offset < RL_BET_MS ? 'bet' : offset < RL_BET_MS + RL_SPIN_MS ? 'spin' : 'result'
  const phaseEndsAt = phase === 'bet' ? start + RL_BET_MS : phase === 'spin' ? start + RL_BET_MS + RL_SPIN_MS : start + RL_CYCLE_MS
  return { roundId, phase, phaseEndsAt, spinStartsAt: start + RL_BET_MS, now }
}
