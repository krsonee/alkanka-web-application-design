/**
 * Pişti, 52 cards. Ranks 2..14 (11 = Vale, 14 = As). Suits 0 ♠, 1 ♥, 2 ♦, 3 ♣.
 * 2 players, or 4 players in two teams (0+2, 1+3). Four cards go to the floor (3 face down), four to each hand.
 * Same rank or a Vale takes the pile. Taking a single card with the same rank is a pişti (10), Vale on Vale is 20.
 * Hand scoring: most cards 3, every As and Vale 1, ♣2 = 2, ♦10 = 3. First side to reach the target wins.
 */
export type PCard = { s: number; r: number }
export type PistiTarget = 101 | 151
export type PistiEventKind = 'drop' | 'capture' | 'pisti' | 'jpisti' | 'sweep' | 'deal' | 'hand'
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

export type PistiState = {
  kind: 'pisti'
  seats: number
  team: boolean
  bots: number[]
  deck: PCard[]
  hands: PCard[][]
  pile: PCard[]
  hidden: number
  captured: PCard[][]
  pistiPts: number[]
  pistiCount: number[]
  played: PCard[]
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

type Base = Pick<PistiState, 'seats' | 'team' | 'bots' | 'dealer' | 'target' | 'totals' | 'handNo' | 'results' | 'log' | 'seq'>

function freshHand(base: Base): PistiState {
  const deck = shuffled()
  const pile = deck.splice(0, 4)
  // The open floor card may not be a Vale; swap it with one from the deck.
  if (pile[3].r === 11) {
    const k = deck.findIndex((c) => c.r !== 11)
    ;[pile[3], deck[k]] = [deck[k], pile[3]]
  }
  const sides = sideCount(base)
  const s: PistiState = {
    kind: 'pisti',
    ...base,
    deck,
    hands: range(base.seats).map(() => []),
    pile,
    hidden: 3,
    captured: range(sides).map(() => []),
    pistiPts: range(sides).map(() => 0),
    pistiCount: range(sides).map(() => 0),
    played: [pile[3]],
    lastCapturer: null,
    turn: (base.dealer + 1) % base.seats,
    note: '',
  }
  return pushEvent(dealRound(s), { seat: base.dealer, kind: 'deal', taken: 0, points: 0, text: `${base.handNo}. el dağıtıldı. Yerde 4 kart var.` })
}

export function initPisti(opts: { seats?: number; botSeats?: number[]; target?: unknown }): PistiState {
  const seats = opts.seats === 4 ? 4 : 2
  const team = seats === 4
  return freshHand({
    seats,
    team,
    bots: opts.botSeats ?? [],
    dealer: Math.floor(Math.random() * seats),
    target: normalizeTarget(opts.target),
    totals: range(team ? 2 : seats).map(() => 0),
    handNo: 1,
    results: [],
    log: [],
    seq: 0,
  })
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
  const most = Math.max(...cards)
  const majority = cards.map((c) => (c === most && cards.filter((x) => x === most).length === 1 ? 3 : 0))
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
    const pisti = s.pile.length === 1 && card.r === top.r
    const bonus = pisti ? (card.r === 11 ? 20 : 10) : 0
    const captured = s.captured.map((c, i) => (i === side ? [...c, ...taken] : c))
    const pistiPts = s.pistiPts.map((p, i) => (i === side ? p + bonus : p))
    const pistiCount = s.pistiCount.map((p, i) => (i === side && pisti ? p + 1 : p))
    next = { ...next, pile: [], hidden: 0, captured, pistiPts, pistiCount, lastCapturer: seat }
    const value = sum(taken) + bonus
    const text = pisti
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

export function pistiBotTurn(s: PistiState, seat: number): PistiStep {
  const hand = s.hands[seat]
  const top = s.pile.at(-1)
  const play = (c: PCard) => pistiStep(s, seat, { type: 'play', s: c.s, r: c.r })
  if (top) {
    if (s.pile.length === 1) {
      const p = hand.find((c) => c.r === top.r)
      if (p) return play(p)
    }
    const match = hand.filter((c) => c.r === top.r && c.r !== 11).sort((a, b) => cardPoints(a) - cardPoints(b))
    if (match.length) return play(match[0])
    const vale = hand.find((c) => c.r === 11)
    const worth = sum(s.pile) + s.pile.length * 0.4
    if (vale && (worth >= 2 || hand.length === 1 || (s.deck.length === 0 && hand.length <= 2))) return play(vale)
  }
  const seen = (r: number) => s.played.filter((c) => c.r === r).length + hand.filter((c) => c.r === r).length
  const risk = (c: PCard) => (c.r === 11 ? 100 : 0) + cardPoints(c) * 4 + Math.max(0, 4 - seen(c.r)) * (top ? 1.5 : 3)
  const pick = [...hand].sort((a, b) => risk(a) - risk(b))[0]
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

export function viewPisti(s: PistiState, seat: number) {
  const visible = s.pile.slice(s.hidden)
  return {
    kind: s.kind,
    seats: s.seats,
    team: s.team,
    bots: s.bots,
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
    capturedCounts: s.captured.map((c) => c.length),
    capturedPoints: s.captured.map(sum),
    pistiPts: s.pistiPts,
    pistiCount: s.pistiCount,
  }
}
export type PistiView = ReturnType<typeof viewPisti>
