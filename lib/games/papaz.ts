/**
 * Papaz Kimde (Old Maid), 51 cards: Sinek Papaz is taken out, so Maça Papaz has no pair.
 * Pairs are the same rank and the same colour (black with black, red with red); they are laid down automatically.
 * On your turn you draw one face-down card from the next player who still has cards.
 * A player whose hand empties is safe. The one left holding the Papaz loses; everyone else wins.
 * Suits 0 ♠, 1 ♥, 2 ♦, 3 ♣. Ranks 2..14 (13 = Papaz).
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
}

export type PapazState = {
  kind: 'papaz'
  seats: number
  bots: number[]
  hands: PzCard[][]
  discards: PzCard[][]
  finished: number[]
  turn: number
  loser: number | null
  log: PapazEvent[]
  seq: number
  note: string
}

export const PAPAZ: PzCard = { s: 0, r: 13 }
export const SUIT_NAMES = ['Maça', 'Kupa', 'Karo', 'Sinek']
export const RANK_LABEL = (r: number) => (r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r))
export const cardName = (c: PzCard) => `${SUIT_NAMES[c.s]} ${c.r === 13 ? 'Papaz' : c.r === 12 ? 'Kız' : c.r === 11 ? 'Vale' : c.r === 14 ? 'As' : c.r}`
export const isPapaz = (c: PzCard) => c.s === PAPAZ.s && c.r === PAPAZ.r
export const PAPAZ_SEATS = [2, 3, 4, 5, 6]

type Act = { type: string; [k: string]: unknown }
export type PapazStep = { state: PapazState; winners: number[] | null }

const same = (a: PzCard, b: PzCard) => a.s === b.s && a.r === b.r
const black = (s: number) => s === 0 || s === 3
const pairsWith = (a: PzCard, b: PzCard) => a.r === b.r && black(a.s) === black(b.s) && !same(a, b)
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

export function initPapaz(opts: { seats?: number; botSeats?: number[] }): PapazState {
  const seats = PAPAZ_SEATS.includes(Number(opts.seats)) ? Number(opts.seats) : 4
  for (let attempt = 0; attempt < 50; attempt++) {
    const deck: PzCard[] = []
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) if (!(s === 3 && r === 13)) deck.push({ s, r })
    const cards = shuffle(deck)
    const raw: PzCard[][] = range(seats).map(() => [])
    cards.forEach((c, i) => raw[i % seats].push(c))
    const stripped = raw.map(stripPairs)
    const hands = stripped.map((x) => shuffle(x.left))
    const discards = stripped.map((x) => x.laid)
    if (hands.filter((h) => h.length).length < 2) continue
    const holders = hands.map((h, i) => (h.length ? i : -1)).filter((i) => i >= 0)
    const finished = range(seats).filter((i) => !hands[i].length)
    const state: PapazState = {
      kind: 'papaz',
      seats,
      bots: opts.botSeats ?? [],
      hands,
      discards,
      finished,
      turn: holders[Math.floor(Math.random() * holders.length)],
      loser: null,
      log: [],
      seq: 0,
      note: '',
    }
    return pushEvent(state, { kind: 'deal', seat: -1, from: -1 }, 'Kartlar dağıtıldı, eşler yere atıldı. Papaz kimde?')
  }
  throw new Error('Kartlar dağıtılamadı')
}

export function papazStep(state: PapazState, seat: number, a: Act): PapazStep {
  const s = state
  if (s.loser != null) throw new Error('Oyun bitti')
  if (s.turn !== seat) throw new Error('Sıra sende değil')
  if (a.type !== 'draw') throw new Error('Bilinmeyen hamle')
  const from = nextHolder(s, seat)
  if (from < 0) throw new Error('Çekilecek kart yok')
  const target = s.hands[from]
  const index = Math.floor(Number(a.index))
  if (!Number.isFinite(index) || index < 0 || index >= target.length) throw new Error('Geçersiz kart')

  const card = target[index]
  const fromHand = shuffle(target.filter((_, i) => i !== index))
  const mine = s.hands[seat]
  const k = mine.findIndex((c) => pairsWith(c, card))
  const pair = k >= 0 ? [mine[k], card] : null
  const myHand = pair ? mine.filter((_, i) => i !== k) : [...mine, card]
  const hands = s.hands.map((h, i) => (i === seat ? shuffle(myHand) : i === from ? fromHand : h))
  const discards = pair ? s.discards.map((d, i) => (i === seat ? [...d, ...pair] : d)) : s.discards

  let next: PapazState = { ...s, hands, discards }
  next = pushEvent(next, { kind: pair ? 'pair' : 'draw', seat, from, card, index, ...(pair ? { pair } : {}) }, '')

  const finished = [...s.finished]
  for (const x of [from, seat]) {
    if (!hands[x].length && !finished.includes(x)) {
      finished.push(x)
      next = pushEvent({ ...next, finished }, { kind: 'out', seat: x, from: -1 }, '')
    }
  }
  next = { ...next, finished }

  const left = active(next)
  if (left.length <= 1) {
    const loser = left[0] ?? seat
    next = pushEvent({ ...next, loser, turn: loser }, { kind: 'end', seat: loser, from: -1 }, 'Oyun bitti. Papaz elinde kalan kaybetti.')
    return { state: next, winners: range(s.seats).filter((x) => x !== loser) }
  }
  // Play passes to the player who was just drawn from (or the next holder if they emptied).
  const turn = hands[from].length ? from : nextHolder(next, from)
  return { state: { ...next, turn }, winners: null }
}

// ---------- Bot ----------

export function papazBotTurn(s: PapazState, seat: number): PapazStep {
  const from = nextHolder(s, seat)
  const count = from >= 0 ? s.hands[from].length : 0
  return papazStep(s, seat, { type: 'draw', index: Math.floor(Math.random() * Math.max(1, count)) })
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

/** Hides other hands; a drawn card stays secret to the two players involved unless it made a pair. */
export function viewPapaz(s: PapazState, seat: number) {
  const ended = s.loser != null
  return {
    kind: s.kind,
    seats: s.seats,
    bots: s.bots,
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
    papazHolder: ended ? s.loser : seat >= 0 && s.hands[seat].some(isPapaz) ? seat : -1,
    log: s.log.map((e) => (e.kind === 'draw' && !ended && seat !== e.seat && seat !== e.from ? { ...e, card: undefined } : e)),
  }
}
export type PapazView = ReturnType<typeof viewPapaz>
