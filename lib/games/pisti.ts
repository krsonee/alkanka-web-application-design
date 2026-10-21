/**
 * Pişti, 52 cards. Ranks 2..14 (11 = Vale, 14 = As). Suits 0 ♠, 1 ♥, 2 ♦, 3 ♣.
 * 2 players, or 4 players in two teams (0+2, 1+3). Four cards go to the floor (3 face down), four to each hand.
 * Same rank or a Vale takes the pile. Taking a single card with the same rank is a pişti (10), Vale on Vale is 20.
 * Hand scoring: most cards 3 (nobody on a tie), every As and Vale 1, ♣2 = 2, ♦10 = 3. First side to reach the target wins.
 */
export type PCard = { s: number; r: number }
export type PistiTarget = 101 | 151
export type PistiEventKind = 'drop' | 'capture' | 'pisti' | 'jpisti' | 'sweep' | 'deal' | 'hand' | 'cut'
export type PistiEvent = {
  seq: number
  seat: number
  kind: PistiEventKind
  card?: PCard
  taken: number
  points: number
  pileTop: PCard | null
  pileCount: number
  text: string
}
export type PistiHandResult = { hand: number; cards: number[]; majority: number[]; cardPoints: number[]; pisti: number[]; total: number[] }

export type PistiRules = {
  /** The open floor card may not be a Vale; it goes back into the deck. */
  valeGeri: boolean
  /** A pişti made with the very last card of the hand does not score. */
  sonPistiYok: boolean
  /** Before the deal the deck is cut and the bottom card is shown to everyone. */
  kesme: boolean
}
export const PISTI_RULE_OPTIONS: { key: keyof PistiRules; label: string; hint: string }[] = [
  { key: 'valeGeri', label: 'İlk Vale desteye döner', hint: 'Yerde açık kart Vale çıkarsa desteye karışır' },
  { key: 'sonPistiYok', label: 'Son kartla pişti yok', hint: 'Elin en son kartıyla yapılan pişti sayılmaz' },
  { key: 'kesme', label: 'Deste kesilir', hint: 'Dağıtmadan önce kesilir, alttaki kart herkese görünür' },
]
export const DEFAULT_PISTI_RULES: PistiRules = { valeGeri: true, sonPistiYok: false, kesme: true }
export function normalizePistiRules(input: unknown): PistiRules {
  if (!Array.isArray(input)) return { ...DEFAULT_PISTI_RULES }
  const list = input.map(String)
  return { valeGeri: list.includes('valeGeri'), sonPistiYok: list.includes('sonPistiYok'), kesme: list.includes('kesme') }
}
export const pistiRulesToList = (r: PistiRules) => (Object.keys(r) as (keyof PistiRules)[]).filter((k) => r[k])

export type PistiState = {
  kind: 'pisti'
  seats: number
  team: boolean
  bots: number[]
  rules?: PistiRules
  deck: PCard[]
  hands: PCard[][]
  pile: PCard[]
  hidden: number
  captured: PCard[][]
  pistiPts: number[]
  pistiCount: number[]
  played: PCard[]
  /** Card shown to everyone when the deck was cut; it is the dealer's last card. */
  cutCard?: PCard | null
  lastCapturer: number | null
  turn: number
  dealer: number
  target: PistiTarget
  totals: number[]
  handNo: number
  results: PistiHandResult[]
  log: PistiEvent[]
  seq: number
  note: string
}

export const PISTI_TARGETS: { value: string; label: string; hint: string }[] = [
  { value: '101', label: '101 puan', hint: 'Kısa, hızlı maç' },
  { value: '151', label: '151 puan', hint: 'Uzun, klasik maç' },
]
export const normalizeTarget = (v: unknown): PistiTarget => (String(v) === '101' ? 101 : 151)

export const SUIT_NAMES = ['Maça', 'Kupa', 'Karo', 'Sinek']
export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣']
export const RANK_LABEL = (r: number) => (r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r))
export const cardName = (c: PCard) => `${SUIT_NAMES[c.s]} ${RANK_LABEL(c.r)}`
export const cardPoints = (c: PCard) => (c.r === 14 || c.r === 11 ? 1 : c.s === 3 && c.r === 2 ? 2 : c.s === 2 && c.r === 10 ? 3 : 0)
export const sideCount = (s: Pick<PistiState, 'team' | 'seats'>) => (s.team ? 2 : s.seats)
export const sideOf = (s: Pick<PistiState, 'team'>, seat: number) => (s.team ? seat % 2 : seat)
const rulesOf = (s: PistiState) => s.rules ?? DEFAULT_PISTI_RULES

type Act = { type: string; [k: string]: unknown }
export type PistiStep = { state: PistiState; winners: number[] | null }

const same = (a: PCard, b: PCard) => a.s === b.s && a.r === b.r
const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const sum = (cards: PCard[]) => cards.reduce((a, c) => a + cardPoints(c), 0)
const LOG_MAX = 24

function shuffled() {
  const deck: PCard[] = []
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ s, r })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function pushEvent(s: PistiState, e: Omit<PistiEvent, 'seq' | 'pileTop' | 'pileCount'>): PistiState {
  const seq = s.seq + 1
  const ev: PistiEvent = { ...e, seq, pileTop: s.pile.at(-1) ?? null, pileCount: s.pile.length }
  return { ...s, seq, log: [...s.log, ev].slice(-LOG_MAX), note: e.text }
}

function dealRound(s: PistiState): PistiState {
  const deck = [...s.deck]
  const hands = s.hands.map((h) => [...h])
  for (let k = 0; k < 4; k++) for (let i = 1; i <= s.seats; i++) hands[(s.dealer + i) % s.seats].push(deck.shift()!)
  return { ...s, deck, hands }
}

type Base = Pick<PistiState, 'seats' | 'team' | 'bots' | 'rules' | 'dealer' | 'target' | 'totals' | 'handNo' | 'results' | 'log' | 'seq'>

function freshHand(base: Base): PistiState {
  const rules = base.rules ?? DEFAULT_PISTI_RULES
  let deck = shuffled()
  const cutter = (base.dealer + base.seats - 1) % base.seats
  if (rules.kesme) {
    const at = 8 + Math.floor(Math.random() * (deck.length - 16))
    deck = [...deck.slice(at), ...deck.slice(0, at)]
  }
  const pile = deck.splice(0, 4)
  // A Vale may not be the open floor card; it is shuffled back into the deck and a new card is opened.
  if (rules.valeGeri) {
    while (pile[3].r === 11) {
      const vale = pile.pop()!
      const at = 1 + Math.floor(Math.random() * (deck.length - 1))
      deck.splice(at, 0, vale)
      pile.push(deck.shift()!)
    }
  }
  const cutCard = rules.kesme ? deck.at(-1)! : null
  const sides = sideCount(base)
  let s: PistiState = {
    kind: 'pisti',
    ...base,
    rules,
    deck,
    hands: range(base.seats).map(() => []),
    pile,
    hidden: 3,
    captured: range(sides).map(() => []),
    pistiPts: range(sides).map(() => 0),
    pistiCount: range(sides).map(() => 0),
    played: [pile[3]],
    cutCard,
    lastCapturer: null,
    turn: (base.dealer + 1) % base.seats,
    note: '',
  }
  if (cutCard) s = pushEvent(s, { seat: cutter, kind: 'cut', card: cutCard, taken: 0, points: 0, text: `desteyi kesti. Alttaki kart ${cardName(cutCard)}, son elde dağıtana gider.` })
  return pushEvent(dealRound(s), { seat: base.dealer, kind: 'deal', taken: 0, points: 0, text: `${base.handNo}. el dağıtıldı. Yerde 4 kart var.` })
}

export function initPisti(opts: { seats?: number; botSeats?: number[]; target?: unknown; team?: boolean; rules?: unknown }): PistiState {
  const seats = opts.seats === 4 ? 4 : 2
  const team = seats === 4 && opts.team !== false
  return freshHand({
    seats,
    team,
    bots: opts.botSeats ?? [],
    rules: normalizePistiRules(opts.rules),
    dealer: Math.floor(Math.random() * seats),
    target: normalizeTarget(opts.target),
    totals: range(team ? 2 : seats).map(() => 0),
    handNo: 1,
    results: [],
    log: [],
    seq: 0,
  })
}

/** Most cards wins 3; nobody gets it on a tie. */
export const majorityOf = (cards: number[]) => {
  const most = Math.max(...cards)
  const unique = cards.filter((x) => x === most).length === 1
  return cards.map((c) => (unique && c === most && most > 0 ? 3 : 0))
}

function endHand(state: PistiState): PistiStep {
  let s = state
  const n = sideCount(s)
  if (s.pile.length && s.lastCapturer != null) {
    const side = sideOf(s, s.lastCapturer)
    const count = s.pile.length
    const captured = s.captured.map((c, i) => (i === side ? [...c, ...s.pile] : c))
    s = { ...s, captured, pile: [], hidden: 0 }
    s = pushEvent(s, { seat: state.lastCapturer!, kind: 'sweep', taken: count, points: sum(state.pile), text: `Yerde kalan ${count} kart son alana gitti.` })
  }
  const cards = s.captured.map((c) => c.length)
  const majority = majorityOf(cards)
  const cp = s.captured.map(sum)
  const total = range(n).map((i) => majority[i] + cp[i] + s.pistiPts[i])
  const totals = s.totals.map((t, i) => t + total[i])
  const result: PistiHandResult = { hand: s.handNo, cards, majority, cardPoints: cp, pisti: s.pistiPts, total }
  const results = [...s.results, result]
  const max = Math.max(...totals)
  const leaders = totals.map((t, i) => (t === max ? i : -1)).filter((i) => i >= 0)
  s = { ...s, totals, results }
  if (max >= s.target && leaders.length === 1) {
    s = pushEvent(s, { seat: -1, kind: 'hand', taken: 0, points: 0, text: `Oyun bitti! ${s.target} puana ilk ulaşan kazandı.` })
    return { state: s, winners: range(s.seats).filter((seat) => sideOf(s, seat) === leaders[0]) }
  }
  const tied = max >= s.target ? ' Puanlar eşit, bir el daha.' : ''
  const ended = pushEvent(s, { seat: -1, kind: 'hand', taken: 0, points: 0, text: `${s.handNo}. el bitti.${tied}` })
  return {
    state: freshHand({ ...ended, dealer: (s.dealer + 1) % s.seats, handNo: s.handNo + 1 }),
    winners: null,
  }
}

/** True when this card is the very last one of the whole hand. */
const isLastCard = (s: PistiState) => s.deck.length === 0 && s.hands.reduce((a, h) => a + h.length, 0) === 1

export function pistiStep(state: PistiState, seat: number, a: Act): PistiStep {
  const s = state
  if (s.turn !== seat) throw new Error('Sıra sende değil')
  if (a.type !== 'play') throw new Error('Bilinmeyen hamle')
  const card = { s: Math.floor(Number(a.s)), r: Math.floor(Number(a.r)) }
  const hand = s.hands[seat]
  if (!hand.some((c) => same(c, card))) throw new Error('Bu kart elinde yok')
  const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => !same(c, card)) : h))
  const top = s.pile.at(-1)
  const side = sideOf(s, seat)
  let next: PistiState = { ...s, hands, played: [...s.played, card], turn: (seat + 1) % s.seats }

  if (top && (card.r === top.r || card.r === 11)) {
    const taken = [...s.pile, card]
    const shape = s.pile.length === 1 && card.r === top.r
    const voided = shape && rulesOf(s).sonPistiYok && isLastCard(s)
    const pisti = shape && !voided
    const bonus = pisti ? (card.r === 11 ? 20 : 10) : 0
    const captured = s.captured.map((c, i) => (i === side ? [...c, ...taken] : c))
    const pistiPts = s.pistiPts.map((p, i) => (i === side ? p + bonus : p))
    const pistiCount = s.pistiCount.map((p, i) => (i === side && pisti ? p + 1 : p))
    next = { ...next, pile: [], hidden: 0, captured, pistiPts, pistiCount, lastCapturer: seat }
    const value = sum(taken) + bonus
    const text = voided
      ? `Son kartla pişti sayılmaz, ${taken.length} kartı aldı`
      : pisti
        ? card.r === 11
          ? `Vale ile Vale pişti! +20`
          : `Pişti! ${RANK_LABEL(card.r)} ile tek kartı aldı, +10`
        : card.r === 11 && top.r !== 11
          ? `Vale ile yerdeki ${taken.length - 1} kartı süpürdü`
          : `${RANK_LABEL(card.r)} ile ${taken.length - 1} kart aldı`
    next = pushEvent(next, { seat, kind: pisti ? (card.r === 11 ? 'jpisti' : 'pisti') : 'capture', card, taken: taken.length, points: value, text })
  } else {
    next = { ...next, pile: [...s.pile, card] }
    next = pushEvent(next, { seat, kind: 'drop', card, taken: 0, points: 0, text: `${cardName(card)} attı` })
  }

  if (next.hands.every((h) => h.length === 0)) {
    if (next.deck.length) {
      next = dealRound(next)
      next = pushEvent(next, { seat: next.dealer, kind: 'deal', taken: 0, points: 0, text: `Yeni kartlar dağıtıldı. Destede ${next.deck.length} kart kaldı.` })
    } else return endHand(next)
  }
  return { state: next, winners: null }
}

// ---------- Bot ----------

/**
 * The bot only uses what a player at the table could know: its own hand, every face-up card played,
 * the cut card and how many cards each player holds. It scores every card in hand and plays the best one.
 */
export function pistiBotTurn(s: PistiState, seat: number): PistiStep {
  const hand = s.hands[seat]
  const top = s.pile.at(-1) ?? null
  const play = (c: PCard) => pistiStep(s, seat, { type: 'play', s: c.s, r: c.r })
  if (hand.length === 1) return play(hand[0])

  const rules = rulesOf(s)
  const known = [...s.played, ...hand]
  if (s.cutCard && !s.played.some((c) => same(c, s.cutCard!)) && !hand.some((c) => same(c, s.cutCard!))) known.push(s.cutCard)
  const seenRank = (r: number) => known.filter((c) => c.r === r).length
  const unknownPool = Math.max(1, 52 - known.length)
  const holds = (r: number, cards: number) => {
    const k = Math.max(0, 4 - seenRank(r))
    if (!k || cards <= 0) return 0
    return 1 - Math.pow(1 - k / unknownPool, cards)
  }
  const nextSeat = (seat + 1) % s.seats
  const partnerSeat = s.team ? (seat + 2) % 4 : -1
  const nextCards = s.hands[nextSeat].length
  const lastRound = s.deck.length === 0
  const cardsLeft = s.hands.reduce((a, h) => a + h.length, 0)
  const pileValue = sum(s.pile) + s.pile.length * 0.22 + (s.hidden ? 0.6 : 0)
  // A Vale is worth keeping for a bigger pile while there are still many cards to come.
  const valeKeep = lastRound ? 0.6 : 2.2 + Math.min(2, s.deck.length / 12)
  const lastCardBonus = (taken: number) => (lastRound && cardsLeft <= s.seats ? taken * 0.22 + 1.5 : 0)

  const scoreOf = (c: PCard) => {
    const vale = c.r === 11
    if (top && (c.r === top.r || vale)) {
      const shape = s.pile.length === 1 && c.r === top.r
      const bonus = shape && !(rules.sonPistiYok && cardsLeft === 1) ? (vale ? 20 : 10) : 0
      return pileValue + cardPoints(c) + bonus + lastCardBonus(s.pile.length + 1) - (vale && !shape ? valeKeep : 0) + 5
    }
    // Dropping: estimate what the next player (always an opponent) can do with it.
    const after = [...s.pile, c]
    const afterValue = sum(after) + after.length * 0.22 + (s.hidden ? 0.6 : 0)
    const pRank = holds(c.r, nextCards)
    const pVale = vale ? pRank : holds(11, nextCards)
    const pistiRisk = s.pile.length === 0 ? pRank * (vale ? 20 : 10) : 0
    const takeRisk = (pRank + (1 - pRank) * pVale * (afterValue >= 2 || lastRound ? 1 : 0.35)) * afterValue
    let score = -(pistiRisk + takeRisk) - cardPoints(c) * 0.8 - (vale ? valeKeep + 2 : 0)
    // In teams the partner plays right after the opponent and may take what the opponent leaves.
    if (partnerSeat >= 0) {
      const pPartner = holds(c.r, s.hands[partnerSeat].length)
      score += (1 - pRank) * (1 - pVale) * pPartner * afterValue * 0.6
    }
    // Cards whose rank is mostly gone are safe to throw.
    score += seenRank(c.r) * 0.25
    return score
  }
  const pick = [...hand].sort((a, b) => scoreOf(b) - scoreOf(a))[0]
  return play(pick)
}

export function runPistiBots(state: PistiState): PistiStep {
  let s = state
  for (let guard = 0; guard < 400 && s.bots.includes(s.turn); guard++) {
    const r = pistiBotTurn(s, s.turn)
    if (r.winners) return r
    s = r.state
  }
  return { state: s, winners: null }
}

/** Delay before the next bot move, so every capture and pişti can be followed. */
export function pistiPaceMs(s: PistiState) {
  const last = s.log.at(-1)?.kind
  if (s.log.some((e) => e.kind === 'hand') && s.log.at(-1)?.kind === 'deal' && s.played.length === 1) return 6000
  if (last === 'jpisti' || last === 'pisti') return 3000
  if (last === 'capture' || last === 'sweep') return 2200
  if (last === 'deal' || last === 'cut') return 1800
  return 1400 + ((s.played.length * 7 + s.turn * 13) % 7) * 100
}

export function viewPisti(s: PistiState, seat: number) {
  const visible = s.pile.slice(s.hidden)
  const capturedCounts = s.captured.map((c) => c.length)
  return {
    kind: s.kind,
    seats: s.seats,
    team: s.team,
    bots: s.bots,
    rules: rulesOf(s),
    turn: s.turn,
    dealer: s.dealer,
    target: s.target,
    totals: s.totals,
    handNo: s.handNo,
    results: s.results,
    log: s.log,
    seq: s.seq,
    note: s.note,
    hand: seat >= 0 ? s.hands[seat] : ([] as PCard[]),
    handCounts: s.hands.map((h) => h.length),
    deckCount: s.deck.length,
    pileCount: s.pile.length,
    pileHidden: s.hidden,
    pileTop: s.pile.at(-1) ?? null,
    pileFan: visible.slice(-4),
    pileVisiblePoints: sum(visible),
    cutCard: s.cutCard ?? null,
    capturedCounts,
    capturedPoints: s.captured.map(sum),
    majorityLive: majorityOf(capturedCounts),
    pistiPts: s.pistiPts,
    pistiCount: s.pistiCount,
  }
}
export type PistiView = ReturnType<typeof viewPisti>
