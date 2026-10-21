/**
 * Batak, 52 cards. Ranks 2..14 (14 = As). Suits 0 ♠, 1 ♥, 2 ♦, 3 ♣. Play goes counter-clockwise (seat + 1).
 * Variants:
 * - klasik: 4 players, 13 cards each, bidding (min 5), bidder picks trump and leads.
 * - koz-maca: 4 players, no bidding, trump is always Maça, everyone predicts their tricks.
 * - esli: 4 players in two teams (0+2, 1+3), bidding (min 8). Hands stay hidden.
 * - gommeli: 3 players, 16 cards each, 4 cards in the kitty; the bidder takes them, picks trump, then buries 4.
 */
export type BCard = { s: number; r: number }
export type Play = { seat: number; card: BCard }
export type BatakVariant = 'klasik' | 'koz-maca' | 'esli' | 'gommeli'
export type BatakRules = { batma: boolean; gommeYasak: boolean; ikiKat: boolean; kozsuz: boolean }
export type BatakResult = {
  hand: number
  scores: number[]
  bidder: number | null
  bid: number
  taken: number[]
  made: boolean
  predictions?: number[]
  trump?: number | null
  noTrump?: boolean
  totals?: number[]
}

export type BatakState = {
  kind: 'batak'
  variant: BatakVariant
  seats: number
  bots: number[]
  hands: BCard[][]
  kitty: BCard[]
  buried?: BCard[]
  phase: 'bid' | 'predict' | 'bury' | 'trump' | 'play'
  dealer: number
  turn: number
  bids: (number | null)[]
  passed: boolean[]
  highBid: number
  bidder: number | null
  trump: number | null
  noTrump?: boolean
  trick: Play[]
  broken: boolean
  taken: number[]
  played: BCard[]
  lastTrick: Play[] | null
  lastWinner: number | null
  totals: number[]
  handNo: number
  handsTotal: number
  /** 0 means the game ends after handsTotal hands; otherwise first to reach this score wins. */
  target?: number
  rules?: BatakRules
  results: BatakResult[]
  note: string
}

export const BATAK_VARIANTS: { value: BatakVariant; label: string; seats: number; hint: string }[] = [
  { value: 'klasik', label: 'Klasik İhaleli', seats: 4, hint: '4 kişi, en az 5 ihale' },
  { value: 'koz-maca', label: 'Koz Maça', seats: 4, hint: 'İhale yok, koz hep maça' },
  { value: 'esli', label: 'Eşli', seats: 4, hint: '2+2 takım, en az 8 ihale' },
  { value: 'gommeli', label: 'Gömmeli', seats: 3, hint: '3 kişi, 4 kart gömülür' },
]
export const BATAK_TARGETS = [31, 51, 101] as const
export const BATAK_ROUND_OPTIONS = [1, ...BATAK_TARGETS] as const

export const BATAK_RULE_OPTIONS: { key: keyof BatakRules; label: string; hint: string; variants: BatakVariant[] }[] = [
  { key: 'batma', label: 'Batma cezası', hint: 'Hiç el alamayan −5 yer', variants: ['klasik', 'esli', 'gommeli'] },
  { key: 'gommeYasak', label: 'As ve koz gömülmez', hint: 'Gömerken as ve koz seçilemez', variants: ['gommeli'] },
  { key: 'ikiKat', label: 'Batana 2 kat ceza', hint: '8 dedi battı: −16', variants: ['klasik', 'esli', 'gommeli'] },
  { key: 'kozsuz', label: 'Kozsuz ihale', hint: 'En az +1 fazla verilir, tutarsa 2 kat', variants: ['klasik', 'esli', 'gommeli'] },
]
export const NO_RULES: BatakRules = { batma: false, gommeYasak: false, ikiKat: false, kozsuz: false }

export const variantLabel = (v: BatakVariant) => BATAK_VARIANTS.find((x) => x.value === v)?.label ?? 'Batak'
export const normalizeVariant = (v: unknown): BatakVariant => (BATAK_VARIANTS.some((x) => x.value === v) ? (v as BatakVariant) : 'klasik')
export function normalizeRules(input: unknown, variant: BatakVariant): BatakRules {
  const list = Array.isArray(input) ? input.map(String) : []
  const on = (k: keyof BatakRules) => list.includes(k) && BATAK_RULE_OPTIONS.find((o) => o.key === k)!.variants.includes(variant)
  return { batma: on('batma'), gommeYasak: on('gommeYasak'), ikiKat: on('ikiKat'), kozsuz: on('kozsuz') }
}
export const rulesToList = (r: BatakRules) => (Object.keys(r) as (keyof BatakRules)[]).filter((k) => r[k])

export const SUIT_NAMES = ['Maça', 'Kupa', 'Karo', 'Sinek']
export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣']
export const RANK_LABEL = (r: number) => (r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r))
export const cardName = (c: BCard) => `${SUIT_NAMES[c.s]} ${RANK_LABEL(c.r)}`
export const BURY_COUNT = 4
export const ZERO_BONUS = 10
export const BATMA_PENALTY = 5

export const minBidFor = (v: BatakVariant) => (v === 'esli' ? 8 : 5)
export const tricksPerHand = (s: Pick<BatakState, 'seats'>) => (s.seats === 3 ? 16 : 13)
export const partnerOf = (s: Pick<BatakState, 'variant'>, seat: number) => (s.variant === 'esli' ? (seat + 2) % 4 : null)
export const teamOf = (seat: number) => seat % 2
/** Kozsuz needs at least one more than the minimum bid. */
export const canNoTrump = (s: Pick<BatakState, 'variant' | 'highBid' | 'rules'>) =>
  Boolean(s.rules?.kozsuz) && s.variant !== 'koz-maca' && s.highBid >= minBidFor(s.variant) + 1
/** Cards the bidder may bury in gömmeli. */
export function buryable(hand: BCard[], s: Pick<BatakState, 'rules' | 'trump'>) {
  if (!s.rules?.gommeYasak) return hand
  const ok = hand.filter((c) => c.r !== 14 && c.s !== s.trump)
  return ok.length >= BURY_COUNT ? ok : hand
}
// Backwards-compatible export used by older UI code.
export const MIN_BID = 5

type Act = { type: string; [k: string]: unknown }
export type BatakStep = { state: BatakState; winners: number[] | null }

const same = (a: BCard, b: BCard) => a.s === b.s && a.r === b.r
const sortHand = (h: BCard[]) => [...h].sort((a, b) => (a.s - b.s) * 100 + (b.r - a.r))
const range = (n: number) => Array.from({ length: n }, (_, i) => i)

function deal(seats: number) {
  const deck: BCard[] = []
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ s, r })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  const per = seats === 3 ? 16 : 13
  return { hands: range(seats).map((i) => sortHand(deck.slice(i * per, i * per + per))), kitty: deck.slice(seats * per) }
}

type Base = Pick<BatakState, 'kind' | 'variant' | 'seats' | 'bots' | 'dealer' | 'totals' | 'handNo' | 'handsTotal' | 'target' | 'rules' | 'results' | 'note'>

function freshHand(base: Base): BatakState {
  const n = base.seats
  const { hands, kitty } = deal(n)
  const kozMaca = base.variant === 'koz-maca'
  return {
    ...base,
    hands,
    kitty,
    buried: [],
    phase: kozMaca ? 'predict' : 'bid',
    turn: (base.dealer + 1) % n,
    bids: range(n).map(() => null),
    passed: range(n).map(() => false),
    highBid: 0,
    bidder: null,
    trump: kozMaca ? 0 : null,
    noTrump: false,
    trick: [],
    broken: false,
    taken: range(n).map(() => 0),
    played: [],
    lastTrick: null,
    lastWinner: null,
  }
}

export function initBatak(opts: { botSeats?: number[]; rounds?: number; variant?: unknown; rules?: unknown }): BatakState {
  const variant = normalizeVariant(opts.variant)
  const seats = variant === 'gommeli' ? 3 : 4
  const rounds = Math.floor(Number(opts.rounds) || 1)
  const target = (BATAK_TARGETS as readonly number[]).includes(rounds) ? rounds : 0
  return freshHand({
    kind: 'batak',
    variant,
    seats,
    bots: opts.botSeats ?? [],
    dealer: Math.floor(Math.random() * seats),
    totals: range(seats).map(() => 0),
    handNo: 1,
    // Older tables used 3 or 5 hands; keep supporting them.
    handsTotal: target ? 0 : rounds > 1 ? Math.min(5, rounds) : 1,
    target,
    rules: normalizeRules(opts.rules, variant),
    results: [],
    note: variant === 'koz-maca' ? 'Kartlar dağıtıldı. Koz maça, herkes alacağı eli tahmin ediyor.' : 'Kartlar dağıtıldı, ihale başlıyor.',
  })
}

/** Older saved tables predate variants and rule options; fill in the defaults. */
export function migrateBatak(s: BatakState): BatakState {
  if (s.variant && s.rules) return s
  return { ...s, variant: s.variant ?? 'klasik', seats: s.seats ?? 4, kitty: s.kitty ?? [], rules: s.rules ?? NO_RULES, target: s.target ?? 0 }
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

/** Follow suit (and beat if you can); without the suit you must trump (over-trump if possible); otherwise anything. */
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
  const n = passed.length
  for (let i = 1; i <= n; i++) {
    const s = (from + i) % n
    if (!passed[s]) return s
  }
  return from
}

/** The last player may not pass when everybody else passed without a bid; they take it at the minimum. */
export const mustBid = (s: BatakState, seat: number) =>
  s.phase === 'bid' && s.bidder == null && s.passed.filter((p, i) => p && i !== seat).length === s.seats - 1

/** Points for one hand, explained per seat so the UI can show why. */
export function scoreHand(s: BatakState): { scores: number[]; made: boolean; note: string } {
  const rules = s.rules ?? NO_RULES
  if (s.variant === 'koz-maca') {
    const preds = s.bids.map((b) => b ?? 0)
    const scores = s.taken.map((t, i) => {
      if (preds[i] === 0) return t === 0 ? ZERO_BONUS : -ZERO_BONUS
      return t >= preds[i] ? t : -preds[i]
    })
    const missed = scores.filter((x) => x < 0).length
    return { scores, made: missed === 0, note: missed ? `${missed} oyuncu tahminini tutturamadı.` : 'Herkes tahminini tuttu.' }
  }
  const bidder = s.bidder!
  const fail = s.highBid * (rules.ikiKat ? 2 : 1)
  const madeMult = s.noTrump ? 2 : 1
  const other = (t: number) => (rules.batma && t === 0 ? -BATMA_PENALTY : t)
  if (s.variant === 'esli') {
    const teamTaken = (t: number) => s.taken.reduce((a, x, i) => a + (teamOf(i) === t ? x : 0), 0)
    const bt = teamOf(bidder)
    const got = teamTaken(bt)
    const made = got >= s.highBid
    const scores = s.taken.map((_, i) => (teamOf(i) === bt ? (made ? got * madeMult : -fail) : other(teamTaken(1 - bt))))
    return { scores, made, note: made ? `İhale tuttu: takım ${got}/${s.highBid}.` : `İhale battı! Takım ${got}/${s.highBid} (−${fail}).` }
  }
  const made = s.taken[bidder] >= s.highBid
  const scores = s.taken.map((t, i) => (i === bidder ? (made ? t * madeMult : -fail) : other(t)))
  return { scores, made, note: made ? `İhale tuttu: ${s.taken[bidder]}/${s.highBid}.` : `İhale battı! ${s.taken[bidder]}/${s.highBid} (−${fail}).` }
}

/** Seats at the top; in eşli both partners share the same total so the team wins together. */
function leaders(totals: number[]) {
  const max = Math.max(...totals)
  return totals.map((t, i) => (t === max ? i : -1)).filter((i) => i >= 0)
}

function singleWinner(s: BatakState, totals: number[], top: number[]): number[] {
  const team = s.variant === 'esli'
  const groupOf = (seat: number) => (team ? teamOf(seat) : seat)
  if (new Set(top.map(groupOf)).size === 1) return top
  // Tie: whoever held the bid wins, otherwise the one who took the most tricks this hand.
  if (s.bidder != null && top.includes(s.bidder)) return top.filter((i) => groupOf(i) === groupOf(s.bidder!))
  const tricks = (seat: number) => (team ? s.taken.reduce((a, x, i) => a + (teamOf(i) === teamOf(seat) ? x : 0), 0) : s.taken[seat])
  const best = Math.max(...top.map(tricks))
  const byTricks = top.filter((i) => tricks(i) === best)
  if (new Set(byTricks.map(groupOf)).size === 1) return byTricks
  void totals
  return byTricks
}

function endHand(s: BatakState): BatakStep {
  const { scores, made, note } = scoreHand(s)
  const totals = s.totals.map((t, i) => t + scores[i])
  const result: BatakResult = {
    hand: s.handNo,
    scores,
    bidder: s.bidder,
    bid: s.highBid,
    taken: s.taken,
    made,
    trump: s.trump,
    noTrump: Boolean(s.noTrump),
    totals,
    ...(s.variant === 'koz-maca' ? { predictions: s.bids.map((b) => b ?? 0) } : {}),
  }
  const results = [...s.results, result]
  const target = s.target ?? 0
  const top = leaders(totals)
  const groupOf = (seat: number) => (s.variant === 'esli' ? teamOf(seat) : seat)
  const finalState = { ...s, totals, results, note: `${note} Oyun bitti.` }

  if (target > 0) {
    const reached = totals[top[0]] >= target
    // A tie at the top means one more hand.
    if (reached && new Set(top.map(groupOf)).size === 1) return { state: finalState, winners: top }
    const why = reached ? ' Puanlar eşit, bir el daha.' : ''
    return {
      state: freshHand({ ...s, dealer: (s.dealer + 1) % s.seats, totals, results, handNo: s.handNo + 1, note: `${s.handNo}. el: ${note}${why} Yeni el dağıtıldı.` }),
      winners: null,
    }
  }
  if (s.handNo < s.handsTotal) {
    return {
      state: freshHand({ ...s, dealer: (s.dealer + 1) % s.seats, totals, results, handNo: s.handNo + 1, note: `${s.handNo}. el: ${note} Yeni el dağıtıldı.` }),
      winners: null,
    }
  }
  return { state: finalState, winners: singleWinner(s, totals, top) }
}

export function batakStep(state: BatakState, seat: number, a: Act): BatakStep {
  const s = migrateBatak(state)
  if (s.turn !== seat) throw new Error('Sıra sende değil')
  const n = s.seats
  const maxTricks = tricksPerHand(s)

  if (a.type === 'predict') {
    if (s.phase !== 'predict') throw new Error('Tahmin zamanı değil')
    const amount = Math.floor(Number(a.amount))
    if (!Number.isFinite(amount) || amount < 0 || amount > maxTricks) throw new Error('Geçersiz tahmin')
    const bids = s.bids.map((b, i) => (i === seat ? amount : b))
    if (bids.every((b) => b != null)) {
      const lead = (s.dealer + 1) % n
      return { state: { ...s, bids, phase: 'play', turn: lead, note: 'Tahminler tamam. Koz maça, oyun başladı.' }, winners: null }
    }
    return { state: { ...s, bids, turn: (seat + 1) % n, note: '' }, winners: null }
  }

  if (a.type === 'bid') {
    if (s.phase !== 'bid') throw new Error('İhale bitti')
    const pass = a.amount === 'pass' || a.amount == null
    const bids = [...s.bids]
    const passed = [...s.passed]
    let { highBid, bidder } = s
    const min = minBidFor(s.variant)
    if (pass) {
      if (mustBid(s, seat)) throw new Error(`Herkes pas geçti, ihaleyi en az ${min} ile almak zorundasın.`)
      passed[seat] = true
      bids[seat] = 0
    } else {
      const amount = Math.floor(Number(a.amount))
      if (!Number.isFinite(amount) || amount < Math.max(min, highBid + 1) || amount > maxTricks) throw new Error('Geçersiz ihale')
      highBid = amount
      bidder = seat
      bids[seat] = amount
    }
    const active = passed.filter((p) => !p).length
    if ((bidder != null && active === 1) || highBid === maxTricks) {
      const b = bidder!
      if (s.variant === 'gommeli') {
        const hands = s.hands.map((h, i) => (i === b ? sortHand([...h, ...s.kitty]) : h))
        return {
          state: { ...s, hands, kitty: [], bids, passed, highBid, bidder: b, phase: 'trump', turn: b, note: `İhale ${highBid} ile kapandı. Yerdeki 4 kart ihale sahibine geçti, önce kozu seçecek.` },
          winners: null,
        }
      }
      return { state: { ...s, bids, passed, highBid, bidder: b, phase: 'trump', turn: b, note: `İhale ${highBid} ile kapandı.` }, winners: null }
    }
    return { state: { ...s, bids, passed, highBid, bidder, turn: nextActive(passed, seat), note: '' }, winners: null }
  }

  if (a.type === 'trump') {
    if (s.phase !== 'trump') throw new Error('Koz seçme zamanı değil')
    const noTrump = a.suit === 'none' || Number(a.suit) === -1
    const suit = Math.floor(Number(a.suit))
    if (noTrump) {
      if (!canNoTrump(s)) throw new Error(`Kozsuz için ihale en az ${minBidFor(s.variant) + 1} olmalı.`)
    } else if (!(suit >= 0 && suit <= 3)) throw new Error('Geçersiz koz')
    const trump = noTrump ? null : suit
    const label = noTrump ? 'Kozsuz oynanıyor, tutarsa puan 2 kat.' : `Koz: ${SUIT_NAMES[suit]}`
    // Gömmeli bidder still holds the 4 extra cards and buries after choosing trump.
    if (s.variant === 'gommeli' && s.hands[seat].length > maxTricks) {
      return { state: { ...s, trump, noTrump, phase: 'bury', note: `${label}. Şimdi 4 kart göm.` }, winners: null }
    }
    return { state: { ...s, trump, noTrump, phase: 'play', turn: seat, note: label }, winners: null }
  }

  if (a.type === 'bury') {
    if (s.phase !== 'bury') throw new Error('Gömme zamanı değil')
    const raw = Array.isArray(a.cards) ? (a.cards as { s: unknown; r: unknown }[]) : []
    const cards = raw.map((c) => ({ s: Math.floor(Number(c.s)), r: Math.floor(Number(c.r)) }))
    const hand = s.hands[seat]
    const allowed = buryable(hand, s)
    const unique = cards.filter((c, i) => cards.findIndex((d) => same(c, d)) === i)
    if (unique.length !== BURY_COUNT || !unique.every((c) => hand.some((h) => same(h, c)))) throw new Error(`Elinden ${BURY_COUNT} kart seçip gömmelisin.`)
    if (!unique.every((c) => allowed.some((h) => same(h, c)))) throw new Error('Bu masada as ve koz gömülemez.')
    const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => !unique.some((u) => same(u, c))) : h))
    const chosen = s.trump != null || s.noTrump
    return {
      state: chosen
        ? { ...s, hands, buried: unique, phase: 'play', turn: seat, note: '4 kart gömüldü, oyun başladı.' }
        : { ...s, hands, buried: unique, phase: 'trump', note: '4 kart gömüldü. Şimdi kozu seç.' },
      winners: null,
    }
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
    if (trick.length < n) return { state: { ...s, hands, trick, broken, played, turn: (seat + 1) % n, note: '' }, winners: null }
    const winner = trickWinner(trick, s.trump)!.seat
    const taken = s.taken.map((t, i) => (i === winner ? t + 1 : t))
    const next: BatakState = { ...s, hands, trick: [], broken, played, taken, lastTrick: trick, lastWinner: winner, turn: winner, note: '' }
    if (hands.every((h) => h.length === 0)) return endHand(next)
    return { state: next, winners: null }
  }
  throw new Error('Bilinmeyen hamle')
}

// ---------- Bot ----------

function estimate(hand: BCard[], fixedTrump?: number) {
  let best = { suit: fixedTrump ?? 0, score: -1 }
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
    if (fixedTrump == null && score > best.score) best = { suit: s, score }
  }
  const trumpLen = hand.filter((c) => c.s === best.suit).length
  tricks += Math.max(0, trumpLen - 3) * 0.9
  return { tricks: Math.floor(tricks), raw: tricks, suit: best.suit }
}

function isTopRemaining(card: BCard, s: BatakState, hand: BCard[]) {
  for (let r = card.r + 1; r <= 14; r++) {
    const c = { s: card.s, r }
    if (!s.played.some((p) => same(p, c)) && !hand.some((h) => same(h, c))) return false
  }
  return true
}

function botBid(s: BatakState, seat: number, hand: BCard[]) {
  const maxTricks = tricksPerHand(s)
  const need = Math.max(minBidFor(s.variant), s.highBid + 1)
  const own = estimate(hand)
  let est = own.tricks
  if (s.variant === 'gommeli') {
    // The 4 kitty cards are unseen; on average they add about one trick, more with a long trump suit.
    const trumpLen = hand.filter((c) => c.s === own.suit).length
    est = Math.floor(own.raw + 0.9 + (trumpLen >= 6 ? 0.4 : 0))
  }
  if (s.variant === 'esli') {
    const partner = partnerOf(s, seat)!
    // Don't overbid a partner who already holds the bid unless the hand is clearly strong.
    if (s.bidder === partner && own.tricks < 6 && !mustBid(s, seat)) return { type: 'bid', amount: 'pass' as const }
    const partnerShare = Math.round((maxTricks - own.tricks) / 4)
    est = own.tricks + partnerShare
  }
  if (mustBid(s, seat)) return { type: 'bid', amount: Math.min(maxTricks, Math.max(need, est)) }
  if (est >= need && need <= maxTricks) return { type: 'bid', amount: need }
  return { type: 'bid', amount: 'pass' as const }
}

export function batakBotTurn(state: BatakState, seat: number): BatakStep {
  const s = migrateBatak(state)
  const hand = s.hands[seat]
  const maxTricks = tricksPerHand(s)
  if (s.phase === 'predict') {
    const est = estimate(hand, 0)
    const strong = hand.some((c) => c.r >= 13) || hand.filter((c) => c.s === 0).length >= 4
    const amount = est.tricks === 0 && !strong ? 0 : Math.max(1, est.tricks)
    return batakStep(s, seat, { type: 'predict', amount: Math.min(maxTricks, amount) })
  }
  if (s.phase === 'bid') return batakStep(s, seat, botBid(s, seat, hand))
  if (s.phase === 'trump') return batakStep(s, seat, { type: 'trump', suit: estimate(hand).suit })
  if (s.phase === 'bury') {
    const trump = s.trump ?? -1
    const keep = (c: BCard) => (c.s === trump ? 100 : 0) + (c.r === 14 ? 50 : 0) + c.r
    const pool = [...buryable(hand, s)].sort((a, b) => keep(a) - keep(b))
    return batakStep(s, seat, { type: 'bury', cards: pool.slice(0, BURY_COUNT) })
  }

  const legal = legalCards(hand, s.trick, s.trump, s.broken)
  const low = (cards: BCard[]) => [...cards].sort((a, b) => (a.s === s.trump ? 100 : 0) + a.r - ((b.s === s.trump ? 100 : 0) + b.r))[0]
  const partner = partnerOf(s, seat)
  let pick: BCard
  if (!s.trick.length) {
    const winners = legal.filter((c) => isTopRemaining(c, s, hand))
    const nonTrumpWinners = winners.filter((c) => c.s !== s.trump)
    if (nonTrumpWinners.length) pick = nonTrumpWinners[0]
    else if (winners.length && (seat === s.bidder || (partner != null && partner === s.bidder))) pick = winners[0]
    else {
      const bySuit = [0, 1, 2, 3]
        .filter((x) => x !== s.trump)
        .map((x) => legal.filter((c) => c.s === x))
        .filter((g) => g.length)
        .sort((a, b) => b.length - a.length)[0]
      pick = bySuit ? low(bySuit) : low(legal)
    }
  } else {
    const current = trickWinner(s.trick, s.trump)!
    const lastToPlay = s.trick.length === s.seats - 1
    // Partner is safe when we're last, or their card is the top one left and the led suit isn't being trumped.
    const partnerSafe =
      partner != null &&
      current.seat === partner &&
      (lastToPlay || (isTopRemaining(current.card, s, hand) && (current.card.s === s.trump || s.trump == null || hand.some((c) => c.s === s.trick[0].card.s))))
    const winning = legal.filter((c) => trickWinner([...s.trick, { seat, card: c }], s.trump)!.seat === seat)
    pick = partnerSafe || !winning.length ? low(legal) : low(winning)
  }
  return batakStep(s, seat, { type: 'play', s: pick.s, r: pick.r })
}

export function runBatakBots(state: BatakState): BatakStep {
  let s = migrateBatak(state)
  for (let guard = 0; guard < 1200 && s.bots.includes(s.turn); guard++) {
    const r = batakBotTurn(s, s.turn)
    if (r.winners) return r
    s = r.state
  }
  return { state: s, winners: null }
}

/** How long the server waits before a bot moves, so humans can follow every card. */
export function batakPaceMs(state: BatakState) {
  const s = migrateBatak(state)
  const freshDeal = s.played.length === 0 && s.handNo > 1 && s.bids.every((b) => b == null) && s.trick.length === 0
  if (freshDeal) return 4500
  if (s.phase === 'bid' || s.phase === 'predict') return 1800
  if (s.phase === 'trump' || s.phase === 'bury') return 1500
  if (s.trick.length === 0 && s.lastTrick) return 2600
  // Deterministic jitter between 1.4 and 2.0 seconds.
  return 1400 + ((s.played.length * 7 + s.turn * 13) % 7) * 100
}

export function viewBatak(state: BatakState, seat: number) {
  const s = migrateBatak(state)
  const showBuried = seat === s.bidder || s.results.length > 0
  return {
    ...s,
    kitty: [] as BCard[],
    kittyCount: s.kitty.length,
    buried: showBuried && seat === s.bidder ? (s.buried ?? []) : [],
    hands: s.hands.map((h, i) => (i === seat ? h : [])),
    handCounts: s.hands.map((h) => h.length),
    openSeat: -1,
    rules: s.rules ?? NO_RULES,
    target: s.target ?? 0,
  }
}
export type BatakView = ReturnType<typeof viewBatak>
