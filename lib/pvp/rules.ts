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
  isWinningHand,
  okeyFrom,
  wantsDiscard,
  type Tile,
} from '@/components/alkanka/arena/okey-engine'
import * as Pool from '@/lib/games/bilardo'

import { initOkey101, okey101BotTurn, okey101Step, runOkey101Bots, viewOkey101, type Okey101State } from '@/lib/games/okey101'
import { batakBotTurn, batakStep, initBatak, runBatakBots, viewBatak, type BatakState } from '@/lib/games/batak'
import { initMonopoly, monopolyBotTurn, monopolyStep, runMonopolyBots, type MonopolyState } from '@/lib/games/monopoly'
import { initPisti, pistiBotTurn, pistiStep, runPistiBots, viewPisti, type PistiState } from '@/lib/games/pisti'
import { initPapaz, papazBotTurn, papazStep, runPapazBots, viewPapaz, type PapazState } from '@/lib/games/papaz'

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
  if (game === 'okey101') return runOkey101Bots(initOkey101({ seats: opts?.seats, botSeats: opts?.botSeats, rounds: opts?.rounds })).state
  if (game === 'batak') return runBatakBots(initBatak({ botSeats: opts?.botSeats, rounds: opts?.rounds, variant: opts?.variant })).state
  if (game === 'monopoly') return runMonopolyBots(initMonopoly({ seats: opts?.seats, botSeats: opts?.botSeats, rounds: opts?.rounds })).state
  if (game === 'papaz') return runPapazBots(initPapaz({ seats: opts?.seats, botSeats: opts?.botSeats })).state
  if (game === 'pisti') return runPistiBots(initPisti({ seats: opts?.seats, botSeats: opts?.botSeats, target: opts?.variant, team: opts?.team })).state
  if (game === 'tavla') {
    const target = [1, 3, 5].includes(Number(opts?.rounds)) ? Number(opts?.rounds) : 1
    return newTavlaHand({ target, score: [0, 0], hand: 1, lastHand: null })
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
  return state.turn
}
