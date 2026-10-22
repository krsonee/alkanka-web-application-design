/**
 * Papaz Kimde (Old Maid), 51 cards: Sinek Papaz is taken out, so Maça Papaz has no pair.
 * In the "Kız Kimde" variant Sinek Kız is taken out instead and Maça Kız is the odd card.
 * Pairs are the same rank and the same colour (black with black, red with red).
 * On your turn you draw one face-down card from the next player who still has cards.
 * Card positions never move on their own: the holder decides where the odd card hides.
 * A player whose hand empties is safe. The one left holding the odd card loses.
 * Suits 0 ♠, 1 ♥, 2 ♦, 3 ♣. Ranks 2..14 (13 = Papaz, 12 = Kız).
 */
export type PzCard = { s: number; r: number }
export type PapazEventKind = 'deal' | 'draw' | 'pair' | 'out' | 'end'
export type PapazEvent = {
  seq: number
  kind: PapazEventKind
  seat: number
  from: number
  /** The drawn card. Only the two players involved may see it unless it formed a pair. */
  card?: PzCard
  pair?: PzCard[]
  index?: number
  /** Finishing place (1 = first out) for `out` events. */
  place?: number
}

export type PapazRules = {
  /** Players find and lay their own pairs; bots still pair automatically. */
  klasik: boolean
  /** Kız Kimde: Sinek Kız is removed and Maça Kız is the odd card. */
  kiz: boolean
}
export const PAPAZ_RULE_OPTIONS: { key: keyof PapazRules; label: string; hint: string }[] = [
  { key: 'klasik', label: 'Klasik eşleme', hint: 'Eşleri sen bulup yere atarsın, bulamazsan elinde kalır' },
  { key: 'kiz', label: 'Kız Kimde', hint: 'Sinek Kız çıkarılır, eşsiz kalan Maça Kız kaybettirir' },
]
export const DEFAULT_PAPAZ_RULES: PapazRules = { klasik: false, kiz: false }
export function normalizePapazRules(input: unknown): PapazRules {
  if (!Array.isArray(input)) return { ...DEFAULT_PAPAZ_RULES }
  const list = input.map(String)
  return { klasik: list.includes('klasik'), kiz: list.includes('kiz') }
}
export const papazRulesToList = (r: PapazRules) => (Object.keys(r) as (keyof PapazRules)[]).filter((k) => r[k])

/** Where the odd card sits and which seats know it. Bots use it to avoid drawing it back. */
type Spot = { holder: number; index: number; knows: number[] }

export type PapazState = {
  kind: 'papaz'
  seats: number
  bots: number[]
  rules?: PapazRules
  hands: PzCard[][]
  discards: PzCard[][]
  /** Seats in the order they emptied their hands. */
  finished: number[]
  turn: number
  loser: number | null
  spot?: Spot | null
  log: PapazEvent[]
  seq: number
  note: string
}

export const PAPAZ: PzCard = { s: 0, r: 13 }
export const SUIT_NAMES = ['Maça', 'Kupa', 'Karo', 'Sinek']
export const RANK_LABEL = (r: number) => (r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r))
export const cardName = (c: PzCard) => `${SUIT_NAMES[c.s]} ${c.r === 13 ? 'Papaz' : c.r === 12 ? 'Kız' : c.r === 11 ? 'Vale' : c.r === 14 ? 'As' : c.r}`
export const PAPAZ_SEATS = [2, 3, 4, 5, 6]

export const rulesOf = (s: Pick<PapazState, 'rules'>) => s.rules ?? DEFAULT_PAPAZ_RULES
/** The unpaired card that loses the game: Maça Papaz, or Maça Kız in Kız Kimde. */
export const oddCardOf = (r: PapazRules): PzCard => ({ s: 0, r: r.kiz ? 12 : 13 })
export const oddName = (r: PapazRules) => (r.kiz ? 'Kız' : 'Papaz')
export const isOdd = (c: PzCard, r: PapazRules = DEFAULT_PAPAZ_RULES) => c.s === 0 && c.r === oddCardOf(r).r
/** Kept for older callers: true for the default odd card. */
export const isPapaz = (c: PzCard) => isOdd(c)

type Act = { type: string; [k: string]: unknown }
export type PapazStep = { state: PapazState; winners: number[] | null }

const same = (a: PzCard, b: PzCard) => a.s === b.s && a.r === b.r
const black = (s: number) => s === 0 || s === 3
export const pairsWith = (a: PzCard, b: PzCard) => a.r === b.r && black(a.s) === black(b.s) && !same(a, b)
const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const LOG_MAX = 30

function shuffle<T>(arr: T[]) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Removes every pair from a hand, returning what is left and what was laid down. */
function stripPairs(hand: PzCard[]) {
  const left: PzCard[] = []
  const laid: PzCard[] = []
  for (const c of hand) {
    const k = left.findIndex((x) => pairsWith(x, c))
    if (k >= 0) {
      laid.push(left[k], c)
      left.splice(k, 1)
    } else left.push(c)
  }
  return { left, laid }
}

const active = (s: Pick<PapazState, 'hands'>) => s.hands.map((h, i) => (h.length ? i : -1)).filter((i) => i >= 0)
/** Bots always pair themselves; in klasik humans must do it by hand. */
const autoPairs = (s: PapazState, seat: number) => !rulesOf(s).klasik || s.bots.includes(seat)

/** First seat after `from` (clockwise, seat + 1) that still holds cards, skipping `skip`. */
export function nextHolder(s: Pick<PapazState, 'hands' | 'seats'>, from: number, skip = -1) {
  for (let i = 1; i <= s.seats; i++) {
    const x = (from + i) % s.seats
    if (x !== skip && s.hands[x].length) return x
  }
  return -1
}

function pushEvent(s: PapazState, e: Omit<PapazEvent, 'seq'>, note: string): PapazState {
  const seq = s.seq + 1
  return { ...s, seq, log: [...s.log, { ...e, seq }].slice(-LOG_MAX), note }
}

function locate(hands: PzCard[][], r: PapazRules, knows: number[]): Spot | null {
  for (let h = 0; h < hands.length; h++) {
    const index = hands[h].findIndex((c) => isOdd(c, r))
    if (index >= 0) return { holder: h, index, knows: Array.from(new Set([h, ...knows])) }
  }
  return null
}

export function initPapaz(opts: { seats?: number; botSeats?: number[]; rules?: unknown }): PapazState {
  const seats = PAPAZ_SEATS.includes(Number(opts.seats)) ? Number(opts.seats) : 4
  const rules = normalizePapazRules(opts.rules)
  const bots = opts.botSeats ?? []
  const removed = rules.kiz ? 12 : 13
  for (let attempt = 0; attempt < 50; attempt++) {
    const deck: PzCard[] = []
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) if (!(s === 3 && r === removed)) deck.push({ s, r })
    const cards = shuffle(deck)
    const raw: PzCard[][] = range(seats).map(() => [])
    cards.forEach((c, i) => raw[i % seats].push(c))
    const auto = (seat: number) => !rules.klasik || bots.includes(seat)
    const stripped = raw.map((h, i) => (auto(i) ? stripPairs(h) : { left: h, laid: [] as PzCard[] }))
    const hands = stripped.map((x) => shuffle(x.left))
    const discards = stripped.map((x) => x.laid)
    if (hands.filter((h) => h.length).length < 2) continue
    const holders = hands.map((h, i) => (h.length ? i : -1)).filter((i) => i >= 0)
    const finished = range(seats).filter((i) => !hands[i].length)
    const state: PapazState = {
      kind: 'papaz',
      seats,
      bots,
      rules,
      hands,
      discards,
      finished,
      turn: holders[Math.floor(Math.random() * holders.length)],
      loser: null,
      spot: locate(hands, rules, []),
      log: [],
      seq: 0,
      note: '',
    }
    const odd = oddName(rules)
    return pushEvent(
      state,
      { kind: 'deal', seat: -1, from: -1 },
      rules.klasik ? `Kartlar dağıtıldı. Eşlerini bul, yere at. ${odd} kimde?` : `Kartlar dağıtıldı, eşler yere atıldı. ${odd} kimde?`,
    )
  }
  throw new Error('Kartlar dağıtılamadı')
}

/** Marks newly emptied seats as safe and ends the game when one holder is left. */
function settle(next: PapazState, seats: number[]): PapazStep {
  const finished = [...next.finished]
  let s = next
  for (const x of seats) {
    if (x >= 0 && !s.hands[x].length && !finished.includes(x)) {
      finished.push(x)
      s = pushEvent({ ...s, finished }, { kind: 'out', seat: x, from: -1, place: finished.length }, '')
    }
  }
  s = { ...s, finished }
  const left = active(s)
  if (left.length <= 1) {
    const loser = left[0] ?? seats[0]
    const odd = oddName(rulesOf(s))
    s = pushEvent({ ...s, loser, turn: loser, spot: null }, { kind: 'end', seat: loser, from: -1 }, `Oyun bitti. ${odd} elinde kalan kaybetti.`)
    const order = [...s.finished.filter((x) => x !== loser), ...range(s.seats).filter((x) => x !== loser && !s.finished.includes(x))]
    return { state: s, winners: order }
  }
  if (!s.hands[s.turn]?.length) s = { ...s, turn: nextHolder(s, s.turn) }
  return { state: s, winners: null }
}

function drawCard(s: PapazState, seat: number, rawIndex: unknown): PapazStep {
  if (s.turn !== seat) throw new Error('Sıra sende değil')
  const from = nextHolder(s, seat)
  if (from < 0) throw new Error('Çekilecek kart yok')
  const target = s.hands[from]
  const index = Math.floor(Number(rawIndex))
  if (!Number.isFinite(index) || index < 0 || index >= target.length) throw new Error('Geçersiz kart')
  const r = rulesOf(s)
  const bot = s.bots.includes(seat)

  const card = target[index]
  const fromHand = target.filter((_, i) => i !== index)
  const mine = s.hands[seat]
  const k = autoPairs(s, seat) ? mine.findIndex((c) => pairsWith(c, card)) : -1
  const pair = k >= 0 ? [mine[k], card] : null
  let myHand: PzCard[]
  if (pair) myHand = mine.filter((_, i) => i !== k)
  else if (bot) {
    // Bots tuck the new card somewhere random, and reshuffle when they pick up the odd card.
    myHand = [...mine]
    myHand.splice(Math.floor(Math.random() * (mine.length + 1)), 0, card)
    if (isOdd(card, r)) myHand = shuffle(myHand)
  } else myHand = [...mine, card]
  const hands = s.hands.map((h, i) => (i === seat ? myHand : i === from ? fromHand : h))
  const discards = pair ? s.discards.map((d, i) => (i === seat ? [...d, ...pair] : d)) : s.discards

  let spot = s.spot ?? null
  if (isOdd(card, r)) spot = locate(hands, r, bot ? [] : [from])
  else if (spot) {
    const moved = spot.holder === seat ? locate(hands, r, spot.knows) : spot.holder === from && index < spot.index ? { ...spot, index: spot.index - 1 } : spot
    spot = moved
  }

  let next: PapazState = { ...s, hands, discards, spot }
  next = pushEvent(next, { kind: pair ? 'pair' : 'draw', seat, from, card, index, ...(pair ? { pair } : {}) }, '')
  const done = settle(next, [from, seat])
  if (done.winners) return done
  // Play passes to the player who was just drawn from (or the next holder if they emptied).
  const turn = hands[from].length ? from : nextHolder(done.state, from)
  return { state: { ...done.state, turn }, winners: null }
}

function layPair(s: PapazState, seat: number, a: Act): PapazStep {
  const hand = s.hands[seat] ?? []
  const i = Math.floor(Number(a.i))
  const j = Math.floor(Number(a.j))
  if (i === j || !hand[i] || !hand[j]) throw new Error('Geçersiz kart')
  if (!pairsWith(hand[i], hand[j])) throw new Error('Bu iki kart eş değil (aynı sayı ve aynı renk olmalı)')
  const pair = [hand[i], hand[j]]
  const hands = s.hands.map((h, x) => (x === seat ? h.filter((_, y) => y !== i && y !== j) : h))
  const discards = s.discards.map((d, x) => (x === seat ? [...d, ...pair] : d))
  const r = rulesOf(s)
  const spot = s.spot?.holder === seat ? locate(hands, r, s.spot.knows) : (s.spot ?? null)
  const next = pushEvent({ ...s, hands, discards, spot }, { kind: 'pair', seat, from: -1, pair }, '')
  return settle(next, [seat])
}

function reorder(s: PapazState, seat: number, a: Act): PapazStep {
  const hand = s.hands[seat] ?? []
  const order = Array.isArray(a.order) ? a.order.map((x) => Math.floor(Number(x))) : []
  const valid = order.length === hand.length && new Set(order).size === hand.length && order.every((x) => x >= 0 && x < hand.length)
  if (!valid) throw new Error('Geçersiz sıralama')
  const hands = s.hands.map((h, x) => (x === seat ? order.map((y) => hand[y]) : h))
  // Rearranging hides the odd card again from everyone else.
  const spot = s.spot?.holder === seat ? locate(hands, rulesOf(s), []) : (s.spot ?? null)
  return { state: { ...s, hands, spot }, winners: null }
}

export function papazStep(state: PapazState, seat: number, a: Act): PapazStep {
  const s = state
  if (s.loser != null) throw new Error('Oyun bitti')
  if (a.type === 'draw') return drawCard(s, seat, a.index)
  if (a.type === 'reorder') return reorder(s, seat, a)
  if (a.type === 'pair') {
    if (!rulesOf(s).klasik) throw new Error('Eşler otomatik atılıyor')
    return layPair(s, seat, a)
  }
  throw new Error('Bilinmeyen hamle')
}

// ---------- Bot ----------

/** Picks a card to draw, avoiding a remembered odd card; on timeout it also lays a human's pairs first. */
function layAllPairs(s: PapazState, seat: number): PapazStep {
  let state = s
  for (let guard = 0; guard < 30; guard++) {
    const h = state.hands[seat]
    const i = h.findIndex((c, x) => h.some((d, y) => y > x && pairsWith(c, d)))
    if (i < 0) break
    const j = h.findIndex((d, y) => y > i && pairsWith(h[i], d))
    const r = layPair(state, seat, { type: 'pair', i, j })
    if (r.winners) return r
    state = r.state
  }
  return { state, winners: null }
}

export function papazBotTurn(s: PapazState, seat: number): PapazStep {
  let state = s
  // On a klasik timeout the human's pairs are laid before and after the automatic draw, so idle tables still finish.
  const humanKlasik = rulesOf(state).klasik && !state.bots.includes(seat)
  if (humanKlasik) {
    const pre = layAllPairs(state, seat)
    if (pre.winners || pre.state.turn !== seat) return pre
    state = pre.state
  }
  const from = nextHolder(state, seat)
  const count = from >= 0 ? state.hands[from].length : 0
  const spot = state.spot
  const avoid = spot && spot.holder === from && spot.knows.includes(seat) ? spot.index : -1
  const choices = range(Math.max(1, count)).filter((i) => i !== avoid || count === 1)
  // Players often hide the odd card at the edges, so bots lean slightly towards the middle.
  const middle = choices.filter((i) => i > 0 && i < count - 1)
  const pool = middle.length && Math.random() < 0.55 ? middle : choices
  const drawn = papazStep(state, seat, { type: 'draw', index: pool[Math.floor(Math.random() * pool.length)] })
  if (!humanKlasik || drawn.winners) return drawn
  return layAllPairs(drawn.state, seat)
}

export function runPapazBots(state: PapazState): PapazStep {
  let s = state
  for (let guard = 0; guard < 600 && s.loser == null && s.bots.includes(s.turn); guard++) {
    const r = papazBotTurn(s, s.turn)
    if (r.winners) return r
    s = r.state
  }
  return { state: s, winners: null }
}

/** Delay before the next paced bot move, so every draw can be followed. */
export function papazPaceMs(s: PapazState) {
  const last = s.log.at(-1)
  const r = rulesOf(s)
  if (last?.kind === 'deal') return 2200
  if (last?.card && isOdd(last.card, r)) return 2800
  if (last?.kind === 'out') return 2400
  if (last?.kind === 'pair') return 2000
  return 1400 + ((s.seq * 7 + s.turn * 13) % 7) * 100
}

/** Hides other hands; a drawn card stays secret to the two players involved unless it made a pair. */
export function viewPapaz(s: PapazState, seat: number) {
  const ended = s.loser != null
  const r = rulesOf(s)
  return {
    kind: s.kind,
    seats: s.seats,
    bots: s.bots,
    rules: r,
    odd: oddCardOf(r),
    turn: s.turn,
    loser: s.loser,
    finished: s.finished,
    note: s.note,
    seq: s.seq,
    target: ended ? -1 : nextHolder(s, s.turn),
    hand: seat >= 0 ? s.hands[seat] : ([] as PzCard[]),
    handCounts: s.hands.map((h) => h.length),
    pairCounts: s.discards.map((d) => d.length / 2),
    lastPairs: s.discards.map((d) => d.slice(-2)),
    oddHolder: ended ? s.loser : seat >= 0 && s.hands[seat].some((c) => isOdd(c, r)) ? seat : -1,
    log: s.log.map((e) => (e.kind === 'draw' && !ended && seat !== e.seat && seat !== e.from ? { ...e, card: undefined } : e)),
  }
}
export type PapazView = ReturnType<typeof viewPapaz>
