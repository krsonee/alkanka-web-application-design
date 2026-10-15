/** İhaleli batak, 4 players, single (no partners). Ranks 2..14 (14 = As). Suits 0 ♠, 1 ♥, 2 ♦, 3 ♣. */
export type BCard = { s: number; r: number }
export type Play = { seat: number; card: BCard }
export type BatakResult = { hand: number; scores: number[]; bidder: number; bid: number; taken: number[]; made: boolean }

export type BatakState = {
  kind: 'batak'
  seats: 4
  bots: number[]
  hands: BCard[][]
  phase: 'bid' | 'trump' | 'play'
  dealer: number
  turn: number
  bids: (number | null)[]
  passed: boolean[]
  highBid: number
  bidder: number | null
  trump: number | null
  trick: Play[]
  broken: boolean
  taken: number[]
  played: BCard[]
  lastTrick: Play[] | null
  lastWinner: number | null
  totals: number[]
  handNo: number
  handsTotal: number
  results: BatakResult[]
  note: string
}

export const SUIT_NAMES = ['Maça', 'Kupa', 'Karo', 'Sinek']
export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣']
export const RANK_LABEL = (r: number) => (r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r))
export const MIN_BID = 4
export const cardName = (c: BCard) => `${SUIT_NAMES[c.s]} ${RANK_LABEL(c.r)}`

type Act = { type: string; [k: string]: unknown }
export type BatakStep = { state: BatakState; winners: number[] | null }

const same = (a: BCard, b: BCard) => a.s === b.s && a.r === b.r
const sortHand = (h: BCard[]) => [...h].sort((a, b) => (a.s - b.s) * 100 + (b.r - a.r))

function dealHands() {
  const deck: BCard[] = []
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ s, r })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return [0, 1, 2, 3].map((i) => sortHand(deck.slice(i * 13, i * 13 + 13)))
}

function freshHand(base: Omit<BatakState, 'hands' | 'phase' | 'turn' | 'bids' | 'passed' | 'highBid' | 'bidder' | 'trump' | 'trick' | 'broken' | 'taken' | 'played' | 'lastTrick' | 'lastWinner'>): BatakState {
  return {
    ...base,
    hands: dealHands(),
    phase: 'bid',
    turn: (base.dealer + 1) % 4,
    bids: [null, null, null, null],
    passed: [false, false, false, false],
    highBid: 0,
    bidder: null,
    trump: null,
    trick: [],
    broken: false,
    taken: [0, 0, 0, 0],
    played: [],
    lastTrick: null,
    lastWinner: null,
  }
}

export function initBatak(opts: { botSeats?: number[]; rounds?: number }): BatakState {
  return freshHand({
    kind: 'batak',
    seats: 4,
    bots: opts.botSeats ?? [],
    dealer: Math.floor(Math.random() * 4),
    totals: [0, 0, 0, 0],
    handNo: 1,
    handsTotal: opts.rounds && opts.rounds > 1 ? Math.min(5, Math.floor(opts.rounds)) : 1,
    results: [],
    note: 'Kartlar dağıtıldı, ihale başlıyor.',
  })
}

/** Highest card currently winning the trick. */
export function trickWinner(trick: Play[], trump: number | null): Play | null {
  if (!trick.length) return null
  const led = trick[0].card.s
  let best = trick[0]
  for (const p of trick.slice(1)) {
    const b = best.card
    const c = p.card
    const cTrump = trump != null && c.s === trump
    const bTrump = trump != null && b.s === trump
    if (cTrump && !bTrump) best = p
    else if (cTrump === bTrump && c.s === b.s && c.r > b.r) best = p
    else if (!cTrump && !bTrump && c.s === led && b.s !== led) best = p
  }
  return best
}

/** Cards the player is allowed to play: follow suit, beat if possible, otherwise trump (over-trump if possible). */
export function legalCards(hand: BCard[], trick: Play[], trump: number | null, broken: boolean): BCard[] {
  if (!trick.length) {
    const nonTrump = hand.filter((c) => c.s !== trump)
    return !broken && nonTrump.length ? nonTrump : hand
  }
  const led = trick[0].card.s
  const win = trickWinner(trick, trump)!.card
  const follow = hand.filter((c) => c.s === led)
  if (follow.length) {
    const trumped = trump != null && led !== trump && win.s === trump
    if (trumped) return follow
    const higher = follow.filter((c) => c.r > win.r)
    return higher.length ? higher : follow
  }
  const trumps = trump == null ? [] : hand.filter((c) => c.s === trump)
  if (trumps.length) {
    if (win.s === trump) {
      const over = trumps.filter((c) => c.r > win.r)
      return over.length ? over : trumps
    }
    return trumps
  }
  return hand
}

function nextActive(passed: boolean[], from: number) {
  for (let i = 1; i <= 4; i++) {
    const s = (from + i) % 4
    if (!passed[s]) return s
  }
  return from
}

/** The last player may not pass when everybody else passed without a bid; they take it at the minimum. */
export const mustBid = (s: BatakState, seat: number) => s.bidder == null && s.passed.filter((p, i) => p && i !== seat).length === 3

function endHand(s: BatakState): BatakStep {
  const bidder = s.bidder!
  const made = s.taken[bidder] >= s.highBid
  const scores = s.taken.map((t, i) => (i === bidder ? (made ? t : -s.highBid) : t))
  const totals = s.totals.map((t, i) => t + scores[i])
  const results = [...s.results, { hand: s.handNo, scores, bidder, bid: s.highBid, taken: s.taken, made }]
  const note = made ? `İhale tuttu: ${s.taken[bidder]}/${s.highBid}.` : `İhale battı! ${s.taken[bidder]}/${s.highBid} (−${s.highBid}).`
  if (s.handNo < s.handsTotal) {
    return {
      state: freshHand({ ...s, dealer: (s.dealer + 1) % 4, totals, results, handNo: s.handNo + 1, note: `${s.handNo}. el: ${note} Yeni el dağıtıldı.` }),
      winners: null,
    }
  }
  const max = Math.max(...totals)
  const winners = totals.map((t, i) => (t === max ? i : -1)).filter((i) => i >= 0)
  return { state: { ...s, totals, results, note: `${note} Oyun bitti.` }, winners }
}

export function batakStep(s: BatakState, seat: number, a: Act): BatakStep {
  if (s.turn !== seat) throw new Error('Sıra sende değil')

  if (a.type === 'bid') {
    if (s.phase !== 'bid') throw new Error('İhale bitti')
    const pass = a.amount === 'pass' || a.amount == null
    const bids = [...s.bids]
    const passed = [...s.passed]
    let { highBid, bidder } = s
    if (pass) {
      if (mustBid(s, seat)) throw new Error(`Herkes pas geçti, ihaleyi en az ${MIN_BID} ile almak zorundasın.`)
      passed[seat] = true
      bids[seat] = 0
    } else {
      const amount = Math.floor(Number(a.amount))
      if (!Number.isFinite(amount) || amount < Math.max(MIN_BID, highBid + 1) || amount > 13) throw new Error('Geçersiz ihale')
      highBid = amount
      bidder = seat
      bids[seat] = amount
    }
    const active = passed.filter((p) => !p).length
    if ((bidder != null && active === 1) || highBid === 13) {
      return { state: { ...s, bids, passed, highBid, bidder, phase: 'trump', turn: bidder!, note: `İhale ${highBid} ile kapandı.` }, winners: null }
    }
    return { state: { ...s, bids, passed, highBid, bidder, turn: nextActive(passed, seat), note: '' }, winners: null }
  }

  if (a.type === 'trump') {
    if (s.phase !== 'trump') throw new Error('Koz seçme zamanı değil')
    const suit = Math.floor(Number(a.suit))
    if (!(suit >= 0 && suit <= 3)) throw new Error('Geçersiz koz')
    return { state: { ...s, trump: suit, phase: 'play', turn: seat, note: `Koz: ${SUIT_NAMES[suit]}` }, winners: null }
  }

  if (a.type === 'play') {
    if (s.phase !== 'play') throw new Error('Henüz kart oynanmıyor')
    const card = { s: Math.floor(Number(a.s)), r: Math.floor(Number(a.r)) }
    const hand = s.hands[seat]
    if (!hand.some((c) => same(c, card))) throw new Error('Bu kart elinde yok')
    if (!legalCards(hand, s.trick, s.trump, s.broken).some((c) => same(c, card))) throw new Error('Bu kartı oynayamazsın: renge uy, büyüğü at ya da koz çak.')
    const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => !same(c, card)) : h))
    const trick = [...s.trick, { seat, card }]
    const broken = s.broken || card.s === s.trump
    const played = [...s.played, card]
    if (trick.length < 4) return { state: { ...s, hands, trick, broken, played, turn: (seat + 1) % 4, note: '' }, winners: null }
    const winner = trickWinner(trick, s.trump)!.seat
    const taken = s.taken.map((t, i) => (i === winner ? t + 1 : t))
    const next: BatakState = { ...s, hands, trick: [], broken, played, taken, lastTrick: trick, lastWinner: winner, turn: winner, note: '' }
    if (hands.every((h) => h.length === 0)) return endHand(next)
    return { state: next, winners: null }
  }
  throw new Error('Bilinmeyen hamle')
}

// ---------- Bot ----------

function estimate(hand: BCard[]) {
  let best = { suit: 0, score: -1 }
  let tricks = 0
  for (let s = 0; s < 4; s++) {
    const cards = hand.filter((c) => c.s === s)
    const len = cards.length
    const has = (r: number) => cards.some((c) => c.r === r)
    let hi = 0
    if (has(14)) hi += 1
    if (has(13)) hi += len >= 2 ? 0.8 : 0.3
    if (has(12)) hi += len >= 3 ? 0.5 : 0.1
    if (has(11)) hi += len >= 4 ? 0.3 : 0
    tricks += hi
    const score = len * 1.3 + hi
    if (score > best.score) best = { suit: s, score }
  }
  const trumpLen = hand.filter((c) => c.s === best.suit).length
  tricks += Math.max(0, trumpLen - 3) * 0.9
  return { tricks: Math.floor(tricks), suit: best.suit }
}

function isTopRemaining(card: BCard, s: BatakState, hand: BCard[]) {
  for (let r = card.r + 1; r <= 14; r++) {
    const c = { s: card.s, r }
    if (!s.played.some((p) => same(p, c)) && !hand.some((h) => same(h, c))) return false
  }
  return true
}

export function batakBotTurn(s: BatakState, seat: number): BatakStep {
  const hand = s.hands[seat]
  if (s.phase === 'bid') {
    const { tricks } = estimate(hand)
    const need = Math.max(MIN_BID, s.highBid + 1)
    if (mustBid(s, seat)) return batakStep(s, seat, { type: 'bid', amount: Math.max(need, Math.min(13, tricks)) })
    if (tricks >= need && need <= 13) return batakStep(s, seat, { type: 'bid', amount: need })
    return batakStep(s, seat, { type: 'bid', amount: 'pass' })
  }
  if (s.phase === 'trump') return batakStep(s, seat, { type: 'trump', suit: estimate(hand).suit })

  const legal = legalCards(hand, s.trick, s.trump, s.broken)
  const low = (cards: BCard[]) => [...cards].sort((a, b) => (a.s === s.trump ? 100 : 0) + a.r - ((b.s === s.trump ? 100 : 0) + b.r))[0]
  let pick: BCard
  if (!s.trick.length) {
    const winners = legal.filter((c) => isTopRemaining(c, s, hand))
    const nonTrumpWinners = winners.filter((c) => c.s !== s.trump)
    if (nonTrumpWinners.length) pick = nonTrumpWinners[0]
    else if (winners.length && seat === s.bidder) pick = winners[0]
    else {
      const bySuit = [0, 1, 2, 3]
        .filter((x) => x !== s.trump)
        .map((x) => legal.filter((c) => c.s === x))
        .filter((g) => g.length)
        .sort((a, b) => b.length - a.length)[0]
      pick = bySuit ? low(bySuit) : low(legal)
    }
  } else {
    const winning = legal.filter((c) => trickWinner([...s.trick, { seat, card: c }], s.trump)!.seat === seat)
    pick = winning.length ? low(winning) : low(legal)
  }
  return batakStep(s, seat, { type: 'play', s: pick.s, r: pick.r })
}

export function runBatakBots(state: BatakState): BatakStep {
  let s = state
  for (let guard = 0; guard < 80 && s.bots.includes(s.turn); guard++) {
    const r = batakBotTurn(s, s.turn)
    if (r.winners) return r
    s = r.state
  }
  return { state: s, winners: null }
}

export function viewBatak(s: BatakState, seat: number) {
  return { ...s, hands: s.hands.map((h, i) => (i === seat ? h : [])), handCounts: s.hands.map((h) => h.length) }
}
export type BatakView = ReturnType<typeof viewBatak>
