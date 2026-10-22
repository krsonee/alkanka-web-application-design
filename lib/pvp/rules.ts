import {
  applyMove,
  initialBoard,
  legalMoves,
  openingRoll,
  rollDice,
  spendDie,
  winKind,
  WIN_LABEL,
  WIN_POINTS,
  type Board,
  type Move,
  type Side,
  type WinKind,
} from '@/components/alkanka/arena/tavla-engine'
import {
  chooseDiscard,
  createDeck,
  findWinningDiscard,
  isJoker,
  isWinningHand,
  okeyFrom,
  wantsDiscard,
  type Tile,
} from '@/components/alkanka/arena/okey-engine'
import * as Pool from '@/lib/games/bilardo'

import { initOkey101, okey101BotTurn, okey101Step, runOkey101Bots, viewOkey101, type Okey101State } from '@/lib/games/okey101'
import { batakBotTurn, batakPaceMs, batakStep, initBatak, runBatakBots, viewBatak, type BatakState } from '@/lib/games/batak'
import { initMonopoly, monoActor, monopolyBotTurn, monopolyPaceMs, monopolyStep, runMonopolyBots, type MonopolyState } from '@/lib/games/monopoly'
import { initPisti, pistiBotTurn, pistiPaceMs, pistiStep, runPistiBots, viewPisti, type PistiState } from '@/lib/games/pisti'
import { initPapaz, papazBotTurn, papazPaceMs, papazStep, runPapazBots, viewPapaz, type PapazState } from '@/lib/games/papaz'

export const PVP_GAMES = ['tavla', 'okey', 'bilardo', 'blackjack', 'rulet', 'kafa-topu', 'kafa-basketbolu', 'okey101', 'batak', 'monopoly', 'pisti', 'papaz'] as const
/** Multi-seat games with server-side bots that can fill any empty seat. */
export const SEAT_GAMES = ['okey101', 'batak', 'monopoly', 'pisti', 'papaz'] as const
export const isSeatGame = (g: string) => (SEAT_GAMES as readonly string[]).includes(g)
type SeatState = Okey101State | BatakState | MonopolyState | PistiState | PapazState
const isSeatState = (s: PvpState): s is SeatState =>
  s.kind === 'okey101' || s.kind === 'batak' || s.kind === 'monopoly' || s.kind === 'pisti' || s.kind === 'papaz'
/** Games where both players play their own round and the scores are compared. */
export const DUEL_GAMES = ['blackjack', 'rulet', 'kafa-topu', 'kafa-basketbolu'] as const
export const isDuelGame = (g: string) => (DUEL_GAMES as readonly string[]).includes(g)
export type PvpGame = (typeof PVP_GAMES)[number]
export const isPvpGame = (g: string): g is PvpGame => (PVP_GAMES as readonly string[]).includes(g)

export type TavlaState = {
  kind: 'tavla'
  board: Board
  dice: number[]
  rolled: number[]
  turn: number
  phase: 'roll' | 'move'
  lastMoves: Move[]
  note: string
  /** Points needed to win the series. 1 means a single game. Older states omit it. */
  target?: number
  score?: [number, number]
  hand?: number
  /** Result of the previous hand in a series, shown on the board for a moment. */
  lastHand?: { winner: number; kind: WinKind; points: number } | null
  /** Seat that won the opening roll for the current hand. */
  opener?: number
}

export type OkeyLast = { seat: number; type: 'pile' | 'discard' | 'throw'; tile?: Tile }

export type OkeyState = {
  kind: 'okey'
  /** 2 or 4. Older 2-seat states may omit it. */
  seats?: number
  team?: boolean
  bots?: number[]
  deck: Tile[]
  indicator: Tile
  hands: Tile[][]
  discards: Tile[][]
  turn: number
  phase: 'draw' | 'discard'
  note: string
  last?: OkeyLast[]
  /** Starting points for a scored game (10, 20 or 30). Missing or 0 means a single hand. */
  target?: number
  scores?: number[]
  hand?: number
  /** Seat that opened the current hand; the next hand opens one seat to the right. */
  starter?: number
  /** Seats that already threw a tile this hand (the indicator can only be shown before that). */
  played?: boolean[]
  shown?: boolean[]
  /** Tile picked from the floor this turn. It cannot be thrown back in the same turn. */
  takenId?: number | null
  /** Tiles each seat picked from the floor this hand, public info bots use to avoid feeding them. */
  taken?: Tile[][]
  /** The finished hand, revealed to everyone. */
  reveal?: OkeyReveal | null
}

export type OkeyReveal = {
  seat: number
  tiles: Tile[]
  kind: 'seri' | 'cift' | 'deste'
  okeyFinish: boolean
  penalty: number
  hand: number
}

export const OKEY_TARGETS = [10, 20, 30] as const
export const isOkeyScored = (s: OkeyState) => (s.target ?? 0) > 0

export type TableOptions = { seats: number; team: boolean; bots: number; rounds?: number; variant?: string; extras?: string[] }

export const okeySeats = (s: OkeyState) => s.seats ?? s.hands.length
/** In okey you draw from the discard pile of the player who played right before you. */
export const leftOf = (seat: number, n: number) => (seat - 1 + n) % n
export const teamOf = (seat: number) => seat % 2

export type BallState = { id: number; x: number; y: number; vx: number; vy: number; inPocket: boolean }

export type BilardoState = {
  kind: 'bilardo'
  balls: BallState[]
  groups: [('solid' | 'stripe') | null, ('solid' | 'stripe') | null]
  turn: number
  /** The last shot, replayed by the other clients from the previous positions. Legacy shots only carry `angle`. */
  shot: {
    dx?: number
    dy?: number
    angle?: number
    pow: number
    spinX?: number
    spinY?: number
    cueX?: number
    cueY?: number
    call?: number | null
    by: number
    seq: number
  } | null
  seq: number
  note: string
  /** The player to move after a foul may place the cue ball anywhere. */
  ballInHand?: boolean
  /** False until the opening break has been played. */
  broken?: boolean
}

export type DuelState = {
  kind: 'duel'
  scores: [{ for: number; against: number } | null, { for: number; against: number } | null]
}

export type PvpState = TavlaState | OkeyState | BilardoState | DuelState | Okey101State | BatakState | MonopolyState | PistiState | PapazState

/** winnerSeats lists every seat that shares the win (team okey). An empty list means nobody at the table is paid. */
/** mult > 1 marks a tavla mars (2) or ağır mars (3) that pays a multiple of the stake. */
export type Outcome = { winnerSeat: number | null; winnerSeats?: number[]; draw?: boolean; replay?: boolean; mult?: number } | null

export type ActResult = { state: PvpState; outcome: Outcome }

export const seatSide = (seat: number): Side => (seat === 0 ? 'p' : 'b')

export function initState(game: PvpGame, opts?: Partial<TableOptions> & { botSeats?: number[] }): PvpState {
  if (game === 'okey101') return initOkey101({ seats: opts?.seats, botSeats: opts?.botSeats, rounds: opts?.rounds, team: opts?.team })
  // Batak bots are paced by the table poll, so the first bids show up one by one.
  if (game === 'batak') return initBatak({ botSeats: opts?.botSeats, rounds: opts?.rounds, variant: opts?.variant, rules: opts?.extras })
  if (game === 'monopoly') return initMonopoly({ seats: opts?.seats, botSeats: opts?.botSeats, rounds: opts?.rounds, rules: opts?.extras })
  if (game === 'papaz') return initPapaz({ seats: opts?.seats, botSeats: opts?.botSeats, rules: opts?.extras })
  if (game === 'pisti') return initPisti({ seats: opts?.seats, botSeats: opts?.botSeats, target: opts?.variant, team: opts?.team, rules: opts?.extras })
  if (game === 'tavla') {
    const target = [1, 3, 5].includes(Number(opts?.rounds)) ? Number(opts?.rounds) : 1
    return newTavlaHand({ target, score: [0, 0], hand: 1, lastHand: null })
  }
  if (game === 'okey') {
    const seats = opts?.seats === 4 ? 4 : 2
    const target = (OKEY_TARGETS as readonly number[]).includes(Number(opts?.rounds)) ? Number(opts?.rounds) : 0
    const state = dealOkey({
      seats,
      team: seats === 4 && opts?.team === true,
      bots: opts?.botSeats ?? [],
      target,
      scores: target ? Array(seats).fill(target) : undefined,
      hand: 1,
      starter: Math.floor(Math.random() * seats),
      reveal: null,
    })
    return runBots(state).state
  }
  if (game === 'bilardo') {
    return { kind: 'bilardo', balls: Pool.rack().map(Pool.toState), groups: [null, null], turn: 0, shot: null, seq: 0, note: 'Açılış vuruşu', broken: false }
  }
  return { kind: 'duel', scores: [null, null] }
}

type Action = { type: string; [k: string]: unknown }

const other = (seat: number) => (seat === 0 ? 1 : 0)

const seatOutcome = (winners: number[] | null): Outcome => (winners ? { winnerSeat: winners[0] ?? null, winnerSeats: winners } : null)

function seatStep(s: SeatState, seat: number, a: Action) {
  if (s.kind === 'okey101') return okey101Step(s, seat, a)
  if (s.kind === 'batak') return batakStep(s, seat, a)
  if (s.kind === 'pisti') return pistiStep(s, seat, a)
  if (s.kind === 'papaz') return papazStep(s, seat, a)
  return monopolyStep(s, seat, a)
}
function seatBots(s: SeatState) {
  if (s.kind === 'okey101') return runOkey101Bots(s)
  if (s.kind === 'batak') return runBatakBots(s)
  if (s.kind === 'pisti') return runPistiBots(s)
  if (s.kind === 'papaz') return runPapazBots(s)
  return runMonopolyBots(s)
}
function seatBotTurn(s: SeatState, seat: number) {
  if (s.kind === 'okey101') return okey101BotTurn(s, seat)
  if (s.kind === 'batak') return batakBotTurn(s, seat)
  if (s.kind === 'pisti') return pistiBotTurn(s, seat)
  if (s.kind === 'papaz') return papazBotTurn(s, seat)
  return monopolyBotTurn(s, seat)
}
const seatCount = (s: SeatState) => s.seats

/** Games whose bots play one turn per poll so humans can follow every move. */
const pacedBots = (s: SeatState) => s.kind === 'okey101' || s.kind === 'batak' || s.kind === 'pisti' || s.kind === 'papaz' || s.kind === 'monopoly'
/** Monopoly auctions and trade answers can hand the move to a seat other than the turn holder. */
const actorOf = (s: SeatState) => (s.kind === 'monopoly' ? monoActor(s) : s.turn)

export const BOT_PACE_MS = 1100

/** Delay before the next paced bot move for this state. */
export function botPaceMs(state: PvpState) {
  if (state.kind === 'batak') return batakPaceMs(state)
  if (state.kind === 'pisti') return pistiPaceMs(state)
  if (state.kind === 'papaz') return papazPaceMs(state)
  if (state.kind === 'monopoly') return monopolyPaceMs(state)
  return BOT_PACE_MS
}

/** Plays a single paced bot turn when the seat to move belongs to a bot. */
export function paceBotTurn(state: PvpState): ActResult | null {
  if (!isSeatState(state) || !pacedBots(state) || !state.bots.includes(actorOf(state))) return null
  const r = seatBotTurn(state, actorOf(state))
  return { state: r.state, outcome: seatOutcome(r.winners) }
}

function seatAct(s: SeatState, seat: number, a: Action): ActResult {
  if (s.bots.includes(seat)) throw new Error('Bu koltuk bota devredildi')
  const r = seatStep(s, seat, a)
  if (r.winners) return { state: r.state, outcome: seatOutcome(r.winners) }
  if (pacedBots(r.state)) return { state: r.state, outcome: null }
  const b = seatBots(r.state)
  return { state: b.state, outcome: seatOutcome(b.winners) }
}

/** Hands an absent player's seat in a multi-seat game to a bot. */
export function seatGameToBot(state: PvpState, seat: number): ActResult | null {
  if (!isSeatState(state)) return null
  const bots = Array.from(new Set([...state.bots, seat]))
  const s = { ...state, bots, note: 'Ayrılan oyuncunun yerine bot geçti' } as SeatState
  if (bots.length >= seatCount(s)) return { state: s, outcome: { winnerSeat: null, winnerSeats: [] } }
  if (pacedBots(s)) return { state: s, outcome: null }
  const b = seatBots(s)
  return { state: b.state, outcome: seatOutcome(b.winners) }
}

export function applyAction(state: PvpState, seat: number, action: Action): ActResult {
  if (isSeatState(state)) {
    if (action.type === 'resign') return seatGameToBot(state, seat)!
    return seatAct(state, seat, action)
  }
  if (action.type === 'resign') {
    if (state.kind === 'okey' && okeySeats(state) > 2) {
      if (state.team) {
        const winners = [0, 1, 2, 3].filter((x) => teamOf(x) !== teamOf(seat))
        return { state, outcome: { winnerSeat: winners[0], winnerSeats: winners } }
      }
      return seatToBot(state, seat)
    }
    return { state, outcome: { winnerSeat: other(seat) } }
  }

  if (state.kind === 'tavla') return tavlaAct(state, seat, action)
  if (state.kind === 'okey') return okeyAct(state, seat, action)
  if (state.kind === 'bilardo') return bilardoAct(state, seat, action)
  return duelAct(state, seat, action)
}

/**
 * Opening roll: seat 0 throws the first die, seat 1 the second. The higher one starts and
 * plays exactly those two dice, no extra roll (real tavla rule).
 */
function newTavlaHand(meta: Pick<TavlaState, 'target' | 'score' | 'hand' | 'lastHand'>): TavlaState {
  const [a, b] = openingRoll()
  const turn = a > b ? 0 : 1
  return {
    kind: 'tavla',
    board: initialBoard(),
    dice: [a, b],
    rolled: [a, b],
    turn,
    phase: 'move',
    lastMoves: [],
    note: `Başlangıç zarı ${a} - ${b}`,
    opener: turn,
    ...meta,
  }
}

function tavlaWin(s: TavlaState, board: Board, seat: number, moves: Move[]): ActResult {
  const kind = winKind(board, seatSide(seat))
  const points = WIN_POINTS[kind]
  const target = s.target ?? 1
  const finalState: TavlaState = { ...s, board, dice: [], phase: 'roll', lastMoves: moves, note: WIN_LABEL[kind], lastHand: { winner: seat, kind, points } }
  if (target <= 1) return { state: finalState, outcome: { winnerSeat: seat, mult: points } }
  const score: [number, number] = [...(s.score ?? [0, 0])] as [number, number]
  score[seat] += points
  if (score[seat] >= target) return { state: { ...finalState, score }, outcome: { winnerSeat: seat } }
  const next = newTavlaHand({ target, score, hand: (s.hand ?? 1) + 1, lastHand: { winner: seat, kind, points } })
  return { state: { ...next, note: `${WIN_LABEL[kind]} +${points} puan. ${next.note}` }, outcome: null }
}

function tavlaAct(s: TavlaState, seat: number, a: Action): ActResult {
  if (s.turn !== seat) throw new Error('Sıra sende değil')
  const side = seatSide(seat)
  if (a.type === 'roll') {
    if (s.phase !== 'roll') throw new Error('Zar zaten atıldı')
    const dice = rollDice()
    const rolled = dice.slice(0, 2)
    if (legalMoves(s.board, side, dice).length === 0) {
      return {
        state: { ...s, rolled, dice: [], turn: other(seat), phase: 'roll', lastMoves: [], note: 'Oynanacak hamle yok, sıra geçti' },
        outcome: null,
      }
    }
    return { state: { ...s, rolled, dice, phase: 'move', note: '' }, outcome: null }
  }
  if (a.type === 'moves') {
    if (s.phase !== 'move') throw new Error('Önce zar at')
    const moves = Array.isArray(a.moves) ? (a.moves as Move[]) : []
    if (moves.length > 4) throw new Error('Geçersiz hamle')
    let board = s.board
    let dice = [...s.dice]
    for (const m of moves) {
      const legal = legalMoves(board, side, dice).find((l) => l.from === m.from && l.to === m.to && l.die === m.die)
      if (!legal) throw new Error('Geçersiz hamle')
      board = applyMove(board, side, legal)
      dice = spendDie(dice, legal.die)
    }
    if (board.off[side] < 15 && dice.length > 0 && legalMoves(board, side, dice).length > 0)
      throw new Error('Tüm zarları oynamalısın')
    if (board.off[side] >= 15) return tavlaWin(s, board, seat, moves)
    const next: TavlaState = { ...s, board, dice: [], turn: other(seat), phase: 'roll', lastMoves: moves, note: '', opener: undefined }
    return { state: next, outcome: null }
  }
  throw new Error('Bilinmeyen hamle')
}

type OkeyMeta = Pick<OkeyState, 'seats' | 'team' | 'bots' | 'target' | 'scores' | 'hand' | 'starter' | 'reveal'>

/** Deals a fresh hand. The starter gets 15 tiles and opens by throwing one. */
function dealOkey(meta: OkeyMeta): OkeyState {
  const seats = meta.seats ?? 2
  const deck = createDeck()
  const idx = deck.findIndex((t) => !t.fake)
  const [indicator] = deck.splice(idx, 1)
  const first = (meta.starter ?? 0) % seats
  const hands = Array.from({ length: seats }, (_, i) => deck.splice(0, i === first ? 15 : 14))
  return {
    kind: 'okey',
    ...meta,
    seats,
    starter: first,
    deck,
    indicator,
    hands,
    discards: Array.from({ length: seats }, () => []),
    turn: first,
    phase: 'discard',
    note: meta.hand && meta.hand > 1 ? `${meta.hand}. el dağıtıldı` : 'Taşlar dağıtıldı',
    last: [],
    played: Array(seats).fill(false),
    shown: Array(seats).fill(false),
    takenId: null,
    taken: Array.from({ length: seats }, () => []),
  }
}

const okeyMeta = (s: OkeyState): OkeyMeta => ({
  seats: okeySeats(s),
  team: s.team,
  bots: s.bots,
  target: s.target,
  scores: s.scores,
  hand: s.hand,
  starter: s.starter,
  reveal: s.reveal,
})

function okeyWinners(s: OkeyState, seat: number): Outcome {
  if (s.team) return { winnerSeat: seat, winnerSeats: [0, 1, 2, 3].filter((x) => teamOf(x) === teamOf(seat)) }
  return { winnerSeat: seat }
}

/** Seats that lose points when `seat` scores: everyone else, or only the rival team. */
const rivalsOf = (s: OkeyState, seat: number) =>
  Array.from({ length: okeySeats(s) }, (_, i) => i).filter((i) => (s.team ? teamOf(i) !== teamOf(seat) : i !== seat))

/** Ends the scored game once anyone hits zero. The highest score (team total in team play) wins; ties go to `fallback`. */
function scoredOutcome(s: OkeyState, scores: number[], fallback: number): Outcome {
  if (!scores.some((v) => v <= 0)) return null
  if (s.team) {
    const a = scores[0] + scores[2]
    const b = scores[1] + scores[3]
    const team = a === b ? teamOf(fallback) : a > b ? 0 : 1
    const winners = [0, 1, 2, 3].filter((x) => teamOf(x) === team)
    return { winnerSeat: winners[0], winnerSeats: winners }
  }
  const best = Math.max(...scores)
  const top = scores.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0)
  return { winnerSeat: top.includes(fallback) ? fallback : top[0] }
}

/** Normal finish costs rivals 2, çift or throwing the okey doubles it, both together make 8. */
export const okeyPenalty = (kind: 'seri' | 'cift', okeyFinish: boolean) => 2 * (kind === 'cift' ? 2 : 1) * (okeyFinish ? 2 : 1)

function nextOkeyHand(s: OkeyState, reveal: OkeyReveal, scores: number[] | undefined, note: string): OkeyState {
  const next = dealOkey({ ...okeyMeta(s), scores, hand: (s.hand ?? 1) + 1, starter: ((s.starter ?? 0) + 1) % okeySeats(s), reveal })
  return { ...next, note: `${note} ${next.note}` }
}

const pushLast = (s: OkeyState, entry: OkeyLast) => [...(s.last ?? []), entry].slice(-8)

export function canShowIndicator(s: OkeyState, seat: number) {
  if (!isOkeyScored(s) || s.turn !== seat || s.phase !== 'discard') return false
  if (s.played?.[seat] || s.shown?.[seat]) return false
  return s.hands[seat]?.some((t) => !t.fake && t.color === s.indicator.color && t.num === s.indicator.num) ?? false
}

/** One okey step for any seat (human or bot). Does not check whose client sent it. */
function okeyStep(s: OkeyState, seat: number, a: Action): ActResult {
  if (s.turn !== seat) throw new Error('Sıra sende değil')
  const n = okeySeats(s)
  const hands = s.hands.map((h) => [...h])
  const discards = s.discards.map((d) => [...d])
  if (a.type === 'show') {
    if (!canShowIndicator(s, seat)) throw new Error('Göstergeyi şu an gösteremezsin')
    const scores = [...(s.scores ?? [])]
    for (const r of rivalsOf(s, seat)) scores[r] -= 1
    const shown = [...(s.shown ?? Array(n).fill(false))]
    shown[seat] = true
    const next: OkeyState = { ...s, scores, shown, note: 'Gösterge gösterildi, rakipler 1 puan kaybetti' }
    return { state: next, outcome: scoredOutcome(s, scores, seat) }
  }
  if (a.type === 'draw') {
    if (s.phase !== 'draw') throw new Error('Önce taş at')
    if (a.from === 'discard') {
      const t = discards[leftOf(seat, n)].pop()
      if (!t) throw new Error('Alınacak taş yok')
      hands[seat].push(t)
      const taken = (s.taken ?? Array.from({ length: n }, () => [])).map((x, i) => (i === seat ? [...x, t] : x))
      return {
        state: { ...s, hands, discards, phase: 'discard', note: '', takenId: t.id, taken, last: pushLast(s, { seat, type: 'discard', tile: t }) },
        outcome: null,
      }
    }
    const deck = [...s.deck]
    const t = deck.shift()
    if (!t) return deckOut(s)
    hands[seat].push(t)
    return { state: { ...s, deck, hands, phase: 'discard', note: '', takenId: null, last: pushLast(s, { seat, type: 'pile' }) }, outcome: null }
  }
  if (a.type === 'discard' || a.type === 'finish') {
    if (s.phase !== 'discard') throw new Error('Önce taş çek')
    if (s.takenId != null && a.tileId === s.takenId) throw new Error('Yerden aldığın taşı aynı elde geri atamazsın')
    const idx = hands[seat].findIndex((t) => t.id === a.tileId)
    if (idx < 0) throw new Error('Taş bulunamadı')
    const [tile] = hands[seat].splice(idx, 1)
    discards[seat].push(tile)
    const last = pushLast(s, { seat, type: 'throw', tile })
    const played = [...(s.played ?? Array(n).fill(false))]
    played[seat] = true
    if (a.type === 'finish') {
      const ok = okeyFrom(s.indicator)
      const kind = isWinningHand(hands[seat], ok)
      if (!kind) throw new Error('El henüz bitmedi')
      const okeyFinish = isJoker(tile, ok)
      const penalty = okeyPenalty(kind, okeyFinish)
      const reveal: OkeyReveal = { seat, tiles: hands[seat], kind, okeyFinish, penalty, hand: s.hand ?? 1 }
      const label = `${okeyFinish ? 'Okey atarak ' : ''}${kind === 'cift' ? 'çiftten ' : ''}bitti`
      const done: OkeyState = { ...s, hands, discards, last, played, takenId: null, reveal, note: `El ${label}` }
      if (!isOkeyScored(s)) return { state: done, outcome: okeyWinners(s, seat) }
      const scores = [...(s.scores ?? [])]
      for (const r of rivalsOf(s, seat)) scores[r] -= penalty
      const end = scoredOutcome(s, scores, seat)
      if (end) return { state: { ...done, scores }, outcome: end }
      return { state: nextOkeyHand(s, reveal, scores, `El ${label}, rakipler −${penalty}.`), outcome: null }
    }
    const next: OkeyState = { ...s, hands, discards, last, played, takenId: null }
    if (s.deck.length === 0) return deckOut(next)
    return { state: { ...next, turn: (seat + 1) % n, phase: 'draw', note: '' }, outcome: null }
  }
  throw new Error('Bilinmeyen hamle')
}

/** Nobody finished before the pile ran out: a single hand is a draw, a scored game redeals without points. */
function deckOut(s: OkeyState): ActResult {
  if (!isOkeyScored(s)) return { state: s, outcome: { winnerSeat: null, draw: true } }
  const reveal: OkeyReveal = { seat: -1, tiles: [], kind: 'deste', okeyFinish: false, penalty: 0, hand: s.hand ?? 1 }
  return { state: nextOkeyHand(s, reveal, s.scores, 'Deste bitti, el puansız geçti.'), outcome: null }
}

/** Plays every consecutive bot turn on the server so bots can never be steered by a client. */
export function runBots(state: OkeyState): ActResult {
  let s = state
  const bots = s.bots ?? []
  for (let guard = 0; guard < 16 && bots.includes(s.turn); guard++) {
    const r = okeyBotTurn(s, s.turn)
    if (r.outcome) return r
    s = r.state as OkeyState
  }
  return { state: s, outcome: null }
}

/** Plays one full okey turn (draw if needed, then discard) for the given seat with the bot strategy. */
function okeyBotTurn(state: OkeyState, seat: number): ActResult {
  let s = state
  const ok = okeyFrom(s.indicator)
  if (s.phase === 'draw') {
    const top = s.discards[leftOf(seat, okeySeats(s))].at(-1)
    const r = okeyStep(s, seat, { type: 'draw', from: top && wantsDiscard(s.hands[seat], top, ok) ? 'discard' : 'pile' })
    if (r.outcome) return r
    s = r.state as OkeyState
  }
  if (canShowIndicator(s, seat)) {
    const r = okeyStep(s, seat, { type: 'show' })
    if (r.outcome) return r
    s = r.state as OkeyState
  }
  const n = okeySeats(s)
  const nextSeat = (seat + 1) % n
  // In team play the next seat is always a rival, so feeding them is the main thing to avoid.
  const avoid = s.team && teamOf(nextSeat) === teamOf(seat) ? [] : (s.taken?.[nextSeat] ?? [])
  const win = findWinningDiscard(s.hands[seat], ok, s.takenId)
  const tile = win?.tile ?? chooseDiscard(s.hands[seat], ok, { exclude: s.takenId, avoid })
  return okeyStep(s, seat, { type: win ? 'finish' : 'discard', tileId: tile.id })
}

/**
 * Plays a move for a player whose turn clock ran out, so the game never stalls:
 * tavla rolls and plays random legal moves, okey plays one bot turn, bilardo passes the turn.
 */
export function autoMove(state: PvpState): ActResult | null {
  if (isSeatState(state)) {
    const r = seatBotTurn(state, actorOf(state))
    if (r.winners) return { state: r.state, outcome: seatOutcome(r.winners) }
    if (pacedBots(r.state)) return { state: { ...r.state, note: 'Süre doldu, otomatik hamle yapıldı' } as PvpState, outcome: null }
    const b = seatBots(r.state)
    return { state: { ...b.state, note: b.state.note || 'Süre doldu, otomatik hamle yapıldı' } as PvpState, outcome: seatOutcome(b.winners) }
  }
  if (state.kind === 'tavla') {
    const seat = state.turn
    const side = seatSide(seat)
    let s = state
    if (s.phase === 'roll') {
      const r = tavlaAct(s, seat, { type: 'roll' })
      if (r.state.kind !== 'tavla' || r.state.turn !== seat) return { ...r, state: { ...r.state, note: 'Süre doldu, otomatik zar atıldı' } as PvpState }
      s = r.state
    }
    let board = s.board
    let dice = [...s.dice]
    const moves: Move[] = []
    for (let guard = 0; guard < 4 && dice.length > 0; guard++) {
      const legal = legalMoves(board, side, dice)
      if (!legal.length) break
      const pick = legal[Math.floor(Math.random() * legal.length)]
      moves.push(pick)
      board = applyMove(board, side, pick)
      dice = spendDie(dice, pick.die)
      if (board.off[side] >= 15) break
    }
    const r = tavlaAct(s, seat, { type: 'moves', moves })
    return { ...r, state: { ...r.state, note: 'Süre doldu, otomatik hamle yapıldı' } as PvpState }
  }
  if (state.kind === 'okey') {
    const r = okeyBotTurn(state, state.turn)
    if (r.outcome) return r
    const next = runBots(r.state as OkeyState)
    return next.outcome ? next : { ...next, state: { ...next.state, note: 'Süre doldu, otomatik taş atıldı' } as PvpState }
  }
  if (state.kind === 'bilardo') {
    return {
      state: { ...state, turn: other(state.turn), shot: null, seq: state.seq + 1, ballInHand: true, note: 'Süre doldu, faul. Beyaz rakipte.' },
      outcome: null,
    }
  }
  return null
}

/** Hands an absent player's seat to a bot. */
export function seatToBot(state: OkeyState, seat: number): ActResult {
  const bots = Array.from(new Set([...(state.bots ?? []), seat]))
  const s: OkeyState = { ...state, bots, note: 'Ayrılan oyuncunun yerine bot geçti' }
  if (bots.length >= okeySeats(s)) return { state: s, outcome: { winnerSeat: null, winnerSeats: [] } }
  return runBots(s)
}

function okeyAct(s: OkeyState, seat: number, a: Action): ActResult {
  if ((s.bots ?? []).includes(seat)) throw new Error('Bu koltuk bota devredildi')
  const r = okeyStep(s, seat, a)
  if (r.outcome) return r
  return runBots(r.state as OkeyState)
}

const clampSpin = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0
}

/**
 * The client only sends the cue input (direction, power, spin, cue placement, called pocket).
 * The server re-simulates the shot with the shared deterministic engine and applies 8-ball rules itself,
 * so a client can never report fake positions or a fake win.
 */
function bilardoAct(s: BilardoState, seat: number, a: Action): ActResult {
  if (s.turn !== seat) throw new Error('Sıra sende değil')
  if (a.type !== 'shot') throw new Error('Bilinmeyen hamle')
  const dx = Number(a.dx)
  const dy = Number(a.dy)
  const pow = Number(a.pow)
  if (![dx, dy, pow].every(Number.isFinite) || (dx === 0 && dy === 0) || pow <= 0 || pow > 1) throw new Error('Geçersiz vuruş')
  const start = s.balls.length ? s.balls : Pool.rack(Pool.seeded(Pool.FALLBACK_SEED)).map(Pool.toState)
  const balls = start.map(Pool.fromState)
  let cueX: number | undefined
  let cueY: number | undefined
  if (s.ballInHand && a.cueX !== undefined && a.cueX !== null) {
    const x = Number(a.cueX)
    const y = Number(a.cueY)
    if (!Pool.canPlaceCue(balls, x, y)) throw new Error('Beyaz buraya konamaz')
    balls[0].x = cueX = x
    balls[0].y = cueY = y
  }
  const broken = s.broken ?? s.seq > 0
  const mustCall = broken && Pool.needsCall(balls, s.groups, seat)
  const rawCall = a.call === null || a.call === undefined ? NaN : Number(a.call)
  const call = mustCall && Number.isInteger(rawCall) && rawCall >= 0 && rawCall < Pool.POCKETS.length ? rawCall : null
  if (mustCall && call === null) throw new Error('Siyah için delik seç')
  const spinX = clampSpin(a.spinX)
  const spinY = clampSpin(a.spinY)
  const ev = Pool.simulate(balls, { dx, dy, pow, spinX, spinY })
  const r = Pool.resolveShot(balls, ev, { shooter: seat, groups: s.groups, broken, call })
  const seq = s.seq + 1
  const next: BilardoState = {
    ...s,
    balls: balls.map(Pool.toState),
    groups: r.groups,
    seq,
    shot: { dx, dy, pow, spinX, spinY, cueX, cueY, call, by: seat, seq },
    turn: r.winner !== null || r.keep ? seat : other(seat),
    note: r.note,
    ballInHand: r.ballInHand,
    broken: true,
  }
  if (r.winner !== null) return { state: next, outcome: { winnerSeat: r.winner } }
  return { state: next, outcome: null }
}

function duelAct(s: DuelState, seat: number, a: Action): ActResult {
  if (a.type !== 'score') throw new Error('Bilinmeyen hamle')
  if (s.scores[seat]) throw new Error('Skorun zaten kaydedildi')
  const f = Math.max(0, Math.min(100000, Math.floor(Number(a.for) || 0)))
  const ag = Math.max(0, Math.min(100000, Math.floor(Number(a.against) || 0)))
  const scores: DuelState['scores'] = [s.scores[0], s.scores[1]]
  scores[seat] = { for: f, against: ag }
  const next: DuelState = { ...s, scores }
  if (scores[0] && scores[1]) {
    const d0 = scores[0].for - scores[0].against
    const d1 = scores[1].for - scores[1].against
    if (d0 === d1) {
      if (scores[0].for === scores[1].for) return { state: next, outcome: { winnerSeat: null, draw: true } }
      return { state: next, outcome: { winnerSeat: scores[0].for > scores[1].for ? 0 : 1 } }
    }
    return { state: next, outcome: { winnerSeat: d0 > d1 ? 0 : 1 } }
  }
  return { state: next, outcome: null }
}

/** Hides information the given seat must not see. */
export function viewState(state: PvpState | null, seat: number) {
  if (!state) return null
  if (state.kind === 'okey101') return viewOkey101(state, seat)
  if (state.kind === 'batak') return viewBatak(state, seat)
  if (state.kind === 'pisti') return viewPisti(state, seat)
  if (state.kind === 'papaz') return viewPapaz(state, seat)
  if (state.kind === 'okey') {
    const n = okeySeats(state)
    return {
      ...state,
      seats: n,
      team: state.team ?? false,
      bots: state.bots ?? [],
      last: state.last ?? [],
      deck: [],
      deckCount: state.deck.length,
      hands: state.hands.map((h, i) => (i === seat ? h : [])),
      handCounts: state.hands.map((h) => h.length),
      oppSeat: seat < 0 ? 1 : leftOf(seat, n),
    }
  }
  if (state.kind === 'duel' && seat >= 0) {
    // A player does not see the rival score before submitting their own.
    const mine = state.scores[seat]
    return mine ? state : { ...state, scores: state.scores.map((sc, i) => (i === seat ? sc : sc ? { hidden: true } : null)) }
  }
  return state
}

export function currentTurn(state: PvpState | null): number | null {
  if (!state) return null
  if (state.kind === 'duel') return null
  if (state.kind === 'monopoly') return monoActor(state)
  return state.turn
}
