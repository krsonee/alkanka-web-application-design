import {
  applyMove,
  initialBoard,
  legalMoves,
  rollDice,
  spendDie,
  type Board,
  type Move,
  type Side,
} from '@/components/alkanka/arena/tavla-engine'
import {
  chooseDiscard,
  createDeck,
  findWinningDiscard,
  isWinningHand,
  okeyFrom,
  wantsDiscard,
  type Tile,
} from '@/components/alkanka/arena/okey-engine'

import { initOkey101, okey101BotTurn, okey101Step, runOkey101Bots, viewOkey101, type Okey101State } from '@/lib/games/okey101'
import { batakBotTurn, batakStep, initBatak, runBatakBots, viewBatak, type BatakState } from '@/lib/games/batak'
import { initMonopoly, monopolyBotTurn, monopolyStep, runMonopolyBots, type MonopolyState } from '@/lib/games/monopoly'
import { initPisti, pistiBotTurn, pistiStep, runPistiBots, viewPisti, type PistiState } from '@/lib/games/pisti'

export const PVP_GAMES = ['tavla', 'okey', 'bilardo', 'blackjack', 'rulet', 'kafa-topu', 'kafa-basketbolu', 'okey101', 'batak', 'monopoly', 'pisti'] as const
/** Multi-seat games with server-side bots that can fill any empty seat. */
export const SEAT_GAMES = ['okey101', 'batak', 'monopoly', 'pisti'] as const
export const isSeatGame = (g: string) => (SEAT_GAMES as readonly string[]).includes(g)
type SeatState = Okey101State | BatakState | MonopolyState | PistiState
const isSeatState = (s: PvpState): s is SeatState => s.kind === 'okey101' || s.kind === 'batak' || s.kind === 'monopoly' || s.kind === 'pisti'
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
}

export type TableOptions = { seats: number; team: boolean; bots: number; rounds?: number; variant?: string }

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
  shot: { angle: number; pow: number; spinX?: number; spinY?: number; by: number; seq: number } | null
  seq: number
  note: string
  /** The player to move after a foul may place the cue ball anywhere. */
  ballInHand?: boolean
}

export type DuelState = {
  kind: 'duel'
  scores: [{ for: number; against: number } | null, { for: number; against: number } | null]
}

export type PvpState = TavlaState | OkeyState | BilardoState | DuelState | Okey101State | BatakState | MonopolyState | PistiState

/** winnerSeats lists every seat that shares the win (team okey). An empty list means nobody at the table is paid. */
export type Outcome = { winnerSeat: number | null; winnerSeats?: number[]; draw?: boolean; replay?: boolean } | null

export type ActResult = { state: PvpState; outcome: Outcome }

export const seatSide = (seat: number): Side => (seat === 0 ? 'p' : 'b')

export function initState(game: PvpGame, opts?: Partial<TableOptions> & { botSeats?: number[] }): PvpState {
  if (game === 'okey101') return runOkey101Bots(initOkey101({ seats: opts?.seats, botSeats: opts?.botSeats, rounds: opts?.rounds })).state
  if (game === 'batak') return runBatakBots(initBatak({ botSeats: opts?.botSeats, rounds: opts?.rounds, variant: opts?.variant })).state
  if (game === 'monopoly') return runMonopolyBots(initMonopoly({ seats: opts?.seats, botSeats: opts?.botSeats, rounds: opts?.rounds })).state
  if (game === 'pisti') return runPistiBots(initPisti({ seats: opts?.seats, botSeats: opts?.botSeats, target: opts?.variant, team: opts?.team })).state
  if (game === 'tavla') {
    let a = 0
    let b = 0
    while (a === b) [a, b] = rollDice().slice(0, 2)
    return {
      kind: 'tavla',
      board: initialBoard(),
      dice: [],
      rolled: [a, b],
      turn: a > b ? 0 : 1,
      phase: 'roll',
      lastMoves: [],
      note: `Başlangıç zarı ${a} - ${b}`,
    }
  }
  if (game === 'okey') {
    const deck = createDeck()
    const idx = deck.findIndex((t) => !t.fake)
    const [indicator] = deck.splice(idx, 1)
    const seats = opts?.seats === 4 ? 4 : 2
    const first = Math.floor(Math.random() * seats)
    const hands = Array.from({ length: seats }, (_, i) => deck.splice(0, i === first ? 15 : 14))
    const state: OkeyState = {
      kind: 'okey',
      seats,
      team: seats === 4 && opts?.team === true,
      bots: opts?.botSeats ?? [],
      deck,
      indicator,
      hands,
      discards: Array.from({ length: seats }, () => []),
      turn: first,
      phase: 'discard',
      note: 'Taşlar dağıtıldı',
      last: [],
    }
    return runBots(state).state
  }
  if (game === 'bilardo') {
    return { kind: 'bilardo', balls: [], groups: [null, null], turn: 0, shot: null, seq: 0, note: 'Açılış vuruşu' }
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
  return monopolyStep(s, seat, a)
}
function seatBots(s: SeatState) {
  if (s.kind === 'okey101') return runOkey101Bots(s)
  if (s.kind === 'batak') return runBatakBots(s)
  if (s.kind === 'pisti') return runPistiBots(s)
  return runMonopolyBots(s)
}
function seatBotTurn(s: SeatState, seat: number) {
  if (s.kind === 'okey101') return okey101BotTurn(s, seat)
  if (s.kind === 'batak') return batakBotTurn(s, seat)
  if (s.kind === 'pisti') return pistiBotTurn(s, seat)
  return monopolyBotTurn(s, seat)
}
const seatCount = (s: SeatState) => s.seats

function seatAct(s: SeatState, seat: number, a: Action): ActResult {
  if (s.bots.includes(seat)) throw new Error('Bu koltuk bota devredildi')
  const r = seatStep(s, seat, a)
  if (r.winners) return { state: r.state, outcome: seatOutcome(r.winners) }
  const b = seatBots(r.state)
  return { state: b.state, outcome: seatOutcome(b.winners) }
}

/** Hands an absent player's seat in a multi-seat game to a bot. */
export function seatGameToBot(state: PvpState, seat: number): ActResult | null {
  if (!isSeatState(state)) return null
  const bots = Array.from(new Set([...state.bots, seat]))
  const s = { ...state, bots, note: 'Ayrılan oyuncunun yerine bot geçti' } as SeatState
  if (bots.length >= seatCount(s)) return { state: s, outcome: { winnerSeat: null, winnerSeats: [] } }
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
    const next: TavlaState = { ...s, board, dice: [], turn: other(seat), phase: 'roll', lastMoves: moves, note: '' }
    if (board.off[side] >= 15) return { state: next, outcome: { winnerSeat: seat } }
    return { state: next, outcome: null }
  }
  throw new Error('Bilinmeyen hamle')
}

function okeyWin(s: OkeyState, seat: number): Outcome {
  if (s.team) return { winnerSeat: seat, winnerSeats: [0, 1, 2, 3].filter((x) => teamOf(x) === teamOf(seat)) }
  return { winnerSeat: seat }
}

const pushLast = (s: OkeyState, entry: OkeyLast) => [...(s.last ?? []), entry].slice(-8)

/** One okey step for any seat (human or bot). Does not check whose client sent it. */
function okeyStep(s: OkeyState, seat: number, a: Action): ActResult {
  if (s.turn !== seat) throw new Error('Sıra sende değil')
  const n = okeySeats(s)
  const hands = s.hands.map((h) => [...h])
  const discards = s.discards.map((d) => [...d])
  if (a.type === 'draw') {
    if (s.phase !== 'draw') throw new Error('Önce taş at')
    if (a.from === 'discard') {
      const t = discards[leftOf(seat, n)].pop()
      if (!t) throw new Error('Alınacak taş yok')
      hands[seat].push(t)
      return { state: { ...s, hands, discards, phase: 'discard', note: '', last: pushLast(s, { seat, type: 'discard', tile: t }) }, outcome: null }
    }
    const deck = [...s.deck]
    const t = deck.shift()
    if (!t) return { state: s, outcome: { winnerSeat: null, draw: true } }
    hands[seat].push(t)
    return { state: { ...s, deck, hands, phase: 'discard', note: '', last: pushLast(s, { seat, type: 'pile' }) }, outcome: null }
  }
  if (a.type === 'discard' || a.type === 'finish') {
    if (s.phase !== 'discard') throw new Error('Önce taş çek')
    const idx = hands[seat].findIndex((t) => t.id === a.tileId)
    if (idx < 0) throw new Error('Taş bulunamadı')
    const [tile] = hands[seat].splice(idx, 1)
    discards[seat].push(tile)
    const last = pushLast(s, { seat, type: 'throw', tile })
    if (a.type === 'finish') {
      if (!isWinningHand(hands[seat], okeyFrom(s.indicator))) throw new Error('El henüz bitmedi')
      return { state: { ...s, hands, discards, last, note: 'El bitti' }, outcome: okeyWin(s, seat) }
    }
    if (s.deck.length === 0) return { state: { ...s, hands, discards, last }, outcome: { winnerSeat: null, draw: true } }
    return { state: { ...s, hands, discards, last, turn: (seat + 1) % n, phase: 'draw', note: '' }, outcome: null }
  }
  throw new Error('Bilinmeyen hamle')
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
  const win = findWinningDiscard(s.hands[seat], ok)
  const tile = win?.tile ?? chooseDiscard(s.hands[seat], ok)
  return okeyStep(s, seat, { type: win ? 'finish' : 'discard', tileId: tile.id })
}

/**
 * Plays a move for a player whose turn clock ran out, so the game never stalls:
 * tavla rolls and plays random legal moves, okey plays one bot turn, bilardo passes the turn.
 */
export function autoMove(state: PvpState): ActResult | null {
  if (isSeatState(state)) {
    const r = seatBotTurn(state, state.turn)
    if (r.winners) return { state: r.state, outcome: seatOutcome(r.winners) }
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

function bilardoAct(s: BilardoState, seat: number, a: Action): ActResult {
  if (s.turn !== seat) throw new Error('Sıra sende değil')
  if (a.type !== 'shot') throw new Error('Bilinmeyen hamle')
  const angle = Number(a.angle)
  const pow = Number(a.pow)
  if (!Number.isFinite(angle) || !Number.isFinite(pow) || pow < 0 || pow > 1) throw new Error('Geçersiz vuruş')
  const balls = Array.isArray(a.balls) ? (a.balls as BallState[]).slice(0, 16) : s.balls
  const groups = (Array.isArray(a.groups) ? a.groups : s.groups) as BilardoState['groups']
  const keep = a.keepTurn === true
  const seq = s.seq + 1
  const next: BilardoState = {
    ...s,
    balls,
    groups,
    seq,
    shot: { angle, pow, spinX: clampSpin(a.spinX), spinY: clampSpin(a.spinY), by: seat, seq },
    turn: keep ? seat : other(seat),
    note: typeof a.note === 'string' ? a.note.slice(0, 80) : '',
    ballInHand: !keep && a.ballInHand === true,
  }
  if (a.result === 'win') return { state: next, outcome: { winnerSeat: seat } }
  if (a.result === 'lose') return { state: next, outcome: { winnerSeat: other(seat) } }
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
  return state.turn
}
