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

export type BjPhase = 'insurance' | 'player' | 'done'
export type BjResult = 'blackjack' | 'win' | 'push' | 'loss' | 'surrender' | null
export type BjAction = 'hit' | 'stand' | 'double' | 'split' | 'surrender' | 'insure' | 'noInsure'
export type BjHand = { cards: Card[]; bet: number; doubled: boolean; done: boolean; result: BjResult; fromSplit: boolean }
export type BjState = {
  deck: Card[]
  dealer: Card[]
  phase: BjPhase
  hands: BjHand[]
  active: number
  insurance: number
  /** Overall outcome shown on the table; per-hand outcomes live in `hands`. */
  result: BjResult
  // Legacy fields from single-hand sessions, kept so unfinished hands still load.
  player?: Card[]
  bet?: number
  doubled?: boolean
}

export const BJ_MAX_HANDS = 4
const tenValue = (c: Card) => Math.min(10, c.r)

/** Upgrades sessions saved before split support existed. */
export function bjNormalize(s: BjState): BjState {
  if (Array.isArray(s.hands)) return s
  return {
    deck: s.deck,
    dealer: s.dealer,
    phase: s.phase,
    hands: [{ cards: s.player ?? [], bet: s.bet ?? 0, doubled: !!s.doubled, done: s.phase === 'done', result: s.result, fromSplit: false }],
    active: 0,
    insurance: 0,
    result: s.result,
  }
}

export function bjDeal(bet: number): BjState {
  const deck = shoe()
  const cards = [deck.pop()!, deck.pop()!]
  const dealer = [deck.pop()!, deck.pop()!]
  const s: BjState = {
    deck,
    dealer,
    phase: 'player',
    hands: [{ cards, bet, doubled: false, done: false, result: null, fromSplit: false }],
    active: 0,
    insurance: 0,
    result: null,
  }
  if (isBlackjack(cards)) return bjSettle(s)
  // Ace showing: offer insurance before the dealer peeks.
  if (dealer[0].r === 1) return { ...s, phase: 'insurance' }
  if (isBlackjack(dealer)) return bjSettle(s)
  return s
}

function aggregate(hands: BjHand[]): BjResult {
  const rs = hands.map((h) => h.result)
  if (rs.includes('blackjack')) return 'blackjack'
  if (rs.includes('win')) return 'win'
  if (rs.every((r) => r === 'surrender')) return 'surrender'
  if (rs.includes('push')) return 'push'
  return 'loss'
}

function bjSettle(s: BjState): BjState {
  const dealer = [...s.dealer]
  const deck = [...s.deck]
  const dBj = isBlackjack(dealer)
  const natural = (h: BjHand) => !h.fromSplit && isBlackjack(h.cards)
  const live = s.hands.some((h) => h.result !== 'surrender' && handValue(h.cards) <= 21 && !natural(h))
  if (live && !dBj) while (handValue(dealer) < 17) dealer.push(deck.pop()!)
  const dv = handValue(dealer)
  const hands = s.hands.map((h): BjHand => {
    if (h.result === 'surrender') return { ...h, done: true }
    const pv = handValue(h.cards)
    const pBj = natural(h)
    let result: BjResult
    if (pBj && dBj) result = 'push'
    else if (pBj) result = 'blackjack'
    else if (dBj) result = 'loss'
    else if (pv > 21) result = 'loss'
    else if (dv > 21 || pv > dv) result = 'win'
    else if (pv === dv) result = 'push'
    else result = 'loss'
    return { ...h, done: true, result }
  })
  return { ...s, deck, dealer, hands, phase: 'done', result: aggregate(hands) }
}

/** Moves to the next unfinished hand, or lets the dealer play once every hand is done. */
function advance(s: BjState): BjState {
  const next = s.hands.findIndex((h, i) => i > s.active && !h.done)
  if (next !== -1) return { ...s, active: next }
  return bjSettle(s)
}

export function bjCanSplit(s: BjState) {
  const h = s.hands[s.active]
  return s.phase === 'player' && !!h && h.cards.length === 2 && tenValue(h.cards[0]) === tenValue(h.cards[1]) && s.hands.length < BJ_MAX_HANDS
}
export function bjCanDouble(s: BjState) {
  const h = s.hands[s.active]
  return s.phase === 'player' && !!h && h.cards.length === 2 && !(h.fromSplit && h.cards[0].r === 1)
}
export function bjCanSurrender(s: BjState) {
  return s.phase === 'player' && s.hands.length === 1 && s.hands[0].cards.length === 2
}
/** Extra KC an action takes from the player before it is applied. */
export function bjActionCost(s: BjState, action: BjAction) {
  const h = s.hands[s.active]
  if (action === 'double' || action === 'split') return h?.bet ?? 0
  if (action === 'insure') return Math.floor((s.hands[0]?.bet ?? 0) / 2)
  return 0
}

export function bjAct(input: BjState, action: BjAction): BjState {
  const s = bjNormalize(input)
  const deck = [...s.deck]

  if (s.phase === 'insurance') {
    if (action !== 'insure' && action !== 'noInsure') return s
    const next: BjState = { ...s, phase: 'player', insurance: action === 'insure' ? bjActionCost(s, 'insure') : 0 }
    return isBlackjack(s.dealer) ? bjSettle(next) : next
  }
  if (s.phase !== 'player') return s

  const hands = s.hands.map((h) => ({ ...h, cards: [...h.cards] }))
  const h = hands[s.active]
  const finish = (st: BjState) => {
    st.hands[st.active].done = true
    return advance(st)
  }

  if (action === 'hit') {
    h.cards.push(deck.pop()!)
    const next = { ...s, deck, hands }
    return handValue(h.cards) >= 21 ? finish(next) : next
  }
  if (action === 'double') {
    if (!bjCanDouble(s)) return s
    h.cards.push(deck.pop()!)
    h.bet *= 2
    h.doubled = true
    return finish({ ...s, deck, hands })
  }
  if (action === 'split') {
    if (!bjCanSplit(s)) return s
    const aces = h.cards[0].r === 1
    const a: BjHand = { cards: [h.cards[0], deck.pop()!], bet: h.bet, doubled: false, done: aces, result: null, fromSplit: true }
    const b: BjHand = { cards: [h.cards[1], deck.pop()!], bet: h.bet, doubled: false, done: aces, result: null, fromSplit: true }
    hands.splice(s.active, 1, a, b)
    const next = { ...s, deck, hands }
    if (aces) return bjSettle(next)
    // A split hand that lands on 21 needs no decision.
    if (handValue(a.cards) === 21) return finish(next)
    return next
  }
  if (action === 'surrender') {
    if (!bjCanSurrender(s)) return s
    hands[0] = { ...h, done: true, result: 'surrender' }
    return bjSettle({ ...s, hands })
  }
  if (action === 'stand') return finish({ ...s, deck, hands })
  return s
}

/** Everything the player put on the table, insurance included. */
export function bjWagered(input: BjState) {
  const s = bjNormalize(input)
  return s.hands.reduce((t, h) => t + h.bet, 0) + s.insurance
}

/** Total returned to the player (stakes included). Insurance pays 2:1 when the dealer has blackjack. */
export function bjPayout(input: BjState) {
  const s = bjNormalize(input)
  let total = s.insurance && isBlackjack(s.dealer) ? s.insurance * 3 : 0
  for (const h of s.hands) {
    if (h.result === 'blackjack') total += Math.floor(h.bet * 2.5)
    else if (h.result === 'win') total += h.bet * 2
    else if (h.result === 'push') total += h.bet
    else if (h.result === 'surrender') total += Math.floor(h.bet / 2)
  }
  return total
}

export function bjPublic(input: BjState) {
  const s = bjNormalize(input)
  const hide = s.phase !== 'done'
  const first = s.hands[0]
  return {
    hands: s.hands.map((h) => ({ cards: h.cards, bet: h.bet, doubled: h.doubled, result: s.phase === 'done' ? h.result : null, value: handValue(h.cards) })),
    active: s.active,
    player: first.cards,
    dealer: hide ? [s.dealer[0]] : s.dealer,
    dealerHidden: hide,
    bet: bjWagered(s),
    insurance: s.insurance,
    phase: s.phase,
    result: s.result,
    doubled: first.doubled,
    canSplit: bjCanSplit(s),
    canDouble: bjCanDouble(s),
    canSurrender: bjCanSurrender(s),
    activeBet: s.hands[s.active]?.bet ?? 0,
    playerValue: handValue(first.cards),
    dealerValue: hide ? handValue([s.dealer[0]]) : handValue(s.dealer),
    payout: s.phase === 'done' ? bjPayout(s) : 0,
  }
}
export type BjPublic = ReturnType<typeof bjPublic>

export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
/** European wheel order, clockwise from 0. */
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]

export type RouletteBet = {
  kind: 'number' | 'split' | 'street' | 'corner' | 'line' | 'column' | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high' | 'dozen'
  /** number: the number. split: low*100+high. street/line: first number of the row. corner: lowest of the four. column/dozen: 1-3. */
  value?: number
  amount: number
}

const range = (from: number, count: number, step = 1) => Array.from({ length: count }, (_, i) => from + i * step)

/** Numbers covered by an inside bet or a column, or null when the bet is malformed. Outside bets return null. */
export function betNumbers(kind: RouletteBet['kind'], value: number | undefined): number[] | null {
  if (!Number.isInteger(value)) return null
  const v = value!
  switch (kind) {
    case 'number':
      return v >= 0 && v <= 36 ? [v] : null
    case 'split': {
      const a = Math.floor(v / 100)
      const b = v % 100
      if (b < 1 || b > 36 || a >= b) return null
      if (a === 0) return b <= 3 ? [0, b] : null
      const sideBySide = b === a + 1 && a % 3 !== 0
      const stacked = b === a + 3
      return sideBySide || stacked ? [a, b] : null
    }
    case 'street':
      return v >= 1 && v <= 34 && v % 3 === 1 ? range(v, 3) : null
    case 'line':
      return v >= 1 && v <= 31 && v % 3 === 1 ? range(v, 6) : null
    case 'corner':
      return v >= 1 && v <= 32 && v % 3 !== 0 ? [v, v + 1, v + 3, v + 4] : null
    case 'column':
      return v >= 1 && v <= 3 ? range(v, 12, 3) : null
    case 'dozen':
      return v >= 1 && v <= 3 ? range((v - 1) * 12 + 1, 12) : null
    default:
      return null
  }
}

const OUTSIDE_LABEL = { red: 'Kırmızı', black: 'Siyah', even: 'Çift', odd: 'Tek', low: '1-18', high: '19-36' } as const

export function betLabel(b: Pick<RouletteBet, 'kind' | 'value'>) {
  const nums = betNumbers(b.kind, b.value) ?? []
  switch (b.kind) {
    case 'number':
      return `Sayı ${b.value}`
    case 'split':
      return `Ayrık ${nums.join('-')}`
    case 'street':
      return `Sokak ${nums[0]}-${nums[2]}`
    case 'corner':
      return `Köşe ${nums.join('-')}`
    case 'line':
      return `Altılı ${nums[0]}-${nums[5]}`
    case 'column':
      return `${b.value}. kolon`
    case 'dozen':
      return `${b.value}. düzine`
    default:
      return OUTSIDE_LABEL[b.kind]
  }
}

/** Total returned for one bet (stake included). Inside bets pay 36 / covered numbers, e.g. split 18x, corner 9x. */
export function betReturn(b: RouletteBet, n: number) {
  const nums = betNumbers(b.kind, b.value)
  if (nums) return nums.includes(n) ? (b.amount * 36) / nums.length : 0
  if (n === 0) return 0
  const win =
    (b.kind === 'red' && RED.has(n)) ||
    (b.kind === 'black' && !RED.has(n)) ||
    (b.kind === 'even' && n % 2 === 0) ||
    (b.kind === 'odd' && n % 2 === 1) ||
    (b.kind === 'low' && n <= 18) ||
    (b.kind === 'high' && n >= 19)
  return win ? b.amount * 2 : 0
}

export function validBet(b: RouletteBet) {
  if (!Number.isInteger(b.amount) || b.amount <= 0) return false
  if (b.kind in OUTSIDE_LABEL) return b.value === undefined || b.value === null
  return betNumbers(b.kind, b.value) !== null
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
/** Only runs when the dealer's up card is an Ace: everyone decides on insurance before the dealer peeks. */
export const BJ_INS_MS = 8_000
export type BlackjackPhase = 'waiting' | 'bet' | 'insurance' | 'play' | 'result'

/** Optional side bets on the live table. 0 means the side bet is off. */
export const BJ_SIDE_STAKES = [0, 10, 25, 50]
export type SideHit = { key: string; label: string; x: number }

/** Perfect Pairs: judged on the player's first two cards. Payouts are "x to 1". */
export const BJ_PAIRS_TABLE: SideHit[] = [
  { key: 'perfect', label: 'Mükemmel çift', x: 25 },
  { key: 'colored', label: 'Renkli çift', x: 12 },
  { key: 'mixed', label: 'Karışık çift', x: 5 },
]

/** 21+3: player's first two cards plus the dealer's up card, read as a three-card poker hand. */
export const BJ_213_TABLE: SideHit[] = [
  { key: 'suited-trips', label: 'Aynı türden üçlü', x: 100 },
  { key: 'straight-flush', label: 'Floş kent', x: 40 },
  { key: 'trips', label: 'Üçlü', x: 30 },
  { key: 'straight', label: 'Kent', x: 10 },
  { key: 'flush', label: 'Floş', x: 5 },
]

const isRed = (c: Card) => c.s === 1 || c.s === 2
const hit = (table: SideHit[], key: string) => table.find((h) => h.key === key) ?? null

export function pairsHit(a: Card | undefined, b: Card | undefined) {
  if (!a || !b || a.r !== b.r) return null
  if (a.s === b.s) return hit(BJ_PAIRS_TABLE, 'perfect')
  return hit(BJ_PAIRS_TABLE, isRed(a) === isRed(b) ? 'colored' : 'mixed')
}

export function threeCardHit(cards: (Card | undefined)[]) {
  if (cards.length !== 3 || cards.some((c) => !c)) return null
  const [a, b, c] = cards as Card[]
  const flush = a.s === b.s && b.s === c.s
  const trips = a.r === b.r && b.r === c.r
  const ranks = [a.r, b.r, c.r].sort((x, y) => x - y)
  const straight = !trips && ((ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1) || (ranks[0] === 1 && ranks[1] === 12 && ranks[2] === 13))
  if (trips && flush) return hit(BJ_213_TABLE, 'suited-trips')
  if (straight && flush) return hit(BJ_213_TABLE, 'straight-flush')
  if (trips) return hit(BJ_213_TABLE, 'trips')
  if (straight) return hit(BJ_213_TABLE, 'straight')
  if (flush) return hit(BJ_213_TABLE, 'flush')
  return null
}

export function rouletteClock(now = Date.now()) {
  const roundId = Math.floor(now / RL_CYCLE_MS)
  const start = roundId * RL_CYCLE_MS
  const offset = now - start
  const phase: RoulettePhase = offset < RL_BET_MS ? 'bet' : offset < RL_BET_MS + RL_SPIN_MS ? 'spin' : 'result'
  const phaseEndsAt = phase === 'bet' ? start + RL_BET_MS : phase === 'spin' ? start + RL_BET_MS + RL_SPIN_MS : start + RL_CYCLE_MS
  return { roundId, phase, phaseEndsAt, spinStartsAt: start + RL_BET_MS, now }
}
