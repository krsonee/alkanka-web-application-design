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
import { createDeck, isWinningHand, okeyFrom, type Tile } from '@/components/alkanka/arena/okey-engine'

export const PVP_GAMES = ['tavla', 'okey', 'bilardo', 'blackjack', 'rulet', 'kafa-topu', 'kafa-basketbolu'] as const
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

export type OkeyState = {
  kind: 'okey'
  deck: Tile[]
  indicator: Tile
  hands: [Tile[], Tile[]]
  discards: [Tile[], Tile[]]
  turn: number
  phase: 'draw' | 'discard'
  note: string
}

export type BallState = { id: number; x: number; y: number; vx: number; vy: number; inPocket: boolean }

export type BilardoState = {
  kind: 'bilardo'
  balls: BallState[]
  groups: [('solid' | 'stripe') | null, ('solid' | 'stripe') | null]
  turn: number
  shot: { angle: number; pow: number; by: number; seq: number } | null
  seq: number
  note: string
}

export type DuelState = {
  kind: 'duel'
  scores: [{ for: number; against: number } | null, { for: number; against: number } | null]
}

export type PvpState = TavlaState | OkeyState | BilardoState | DuelState

export type Outcome = { winnerSeat: number | null; draw?: boolean; replay?: boolean } | null

export type ActResult = { state: PvpState; outcome: Outcome }

export const seatSide = (seat: number): Side => (seat === 0 ? 'p' : 'b')

export function initState(game: PvpGame): PvpState {
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
    const h0 = deck.splice(0, 15)
    const h1 = deck.splice(0, 14)
    return {
      kind: 'okey',
      deck,
      indicator,
      hands: [h0, h1],
      discards: [[], []],
      turn: 0,
      phase: 'discard',
      note: 'Masa açıldı',
    }
  }
  if (game === 'bilardo') {
    return { kind: 'bilardo', balls: [], groups: [null, null], turn: 0, shot: null, seq: 0, note: 'Açılış vuruşu' }
  }
  return { kind: 'duel', scores: [null, null] }
}

type Action = { type: string; [k: string]: unknown }

const other = (seat: number) => (seat === 0 ? 1 : 0)

export function applyAction(state: PvpState, seat: number, action: Action): ActResult {
  if (action.type === 'resign') return { state, outcome: { winnerSeat: other(seat) } }

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

function okeyAct(s: OkeyState, seat: number, a: Action): ActResult {
  if (s.turn !== seat) throw new Error('Sıra sende değil')
  const hands: [Tile[], Tile[]] = [[...s.hands[0]], [...s.hands[1]]]
  const discards: [Tile[], Tile[]] = [[...s.discards[0]], [...s.discards[1]]]
  if (a.type === 'draw') {
    if (s.phase !== 'draw') throw new Error('Önce taş at')
    if (a.from === 'discard') {
      const pile = discards[other(seat)]
      const t = pile.pop()
      if (!t) throw new Error('Alınacak taş yok')
      hands[seat].push(t)
    } else {
      const deck = [...s.deck]
      const t = deck.shift()
      if (!t) return { state: s, outcome: { winnerSeat: null, draw: true } }
      hands[seat].push(t)
      return { state: { ...s, deck, hands, phase: 'discard', note: '' }, outcome: null }
    }
    return { state: { ...s, hands, discards, phase: 'discard', note: '' }, outcome: null }
  }
  if (a.type === 'discard' || a.type === 'finish') {
    if (s.phase !== 'discard') throw new Error('Önce taş çek')
    const idx = hands[seat].findIndex((t) => t.id === a.tileId)
    if (idx < 0) throw new Error('Taş bulunamadı')
    const [tile] = hands[seat].splice(idx, 1)
    if (a.type === 'finish') {
      if (!isWinningHand(hands[seat], okeyFrom(s.indicator))) throw new Error('El henüz bitmedi')
      discards[seat].push(tile)
      return { state: { ...s, hands, discards, note: 'El bitti' }, outcome: { winnerSeat: seat } }
    }
    discards[seat].push(tile)
    if (s.deck.length === 0) return { state: { ...s, hands, discards }, outcome: { winnerSeat: null, draw: true } }
    return { state: { ...s, hands, discards, turn: other(seat), phase: 'draw', note: '' }, outcome: null }
  }
  throw new Error('Bilinmeyen hamle')
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
    shot: { angle, pow, by: seat, seq },
    turn: keep ? seat : other(seat),
    note: typeof a.note === 'string' ? a.note.slice(0, 80) : '',
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
  if (state.kind === 'okey') {
    const opp = other(seat)
    return {
      ...state,
      deck: [],
      deckCount: state.deck.length,
      hands: seat < 0 ? [[], []] : seat === 0 ? [state.hands[0], []] : [[], state.hands[1]],
      handCounts: [state.hands[0].length, state.hands[1].length],
      oppSeat: opp,
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
