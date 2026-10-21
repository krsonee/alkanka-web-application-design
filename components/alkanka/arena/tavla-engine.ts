export type Side = 'p' | 'b'
export type Board = { pts: number[]; bar: Record<Side, number>; off: Record<Side, number> }
export type From = number | 'bar'
export type To = number | 'off'
export type Move = { from: From; to: To; die: number; hit: boolean }

export function initialBoard(): Board {
  const pts = Array(24).fill(0)
  pts[23] = 2
  pts[12] = 5
  pts[7] = 3
  pts[5] = 5
  pts[0] = -2
  pts[11] = -5
  pts[16] = -3
  pts[18] = -5
  return { pts, bar: { p: 0, b: 0 }, off: { p: 0, b: 0 } }
}

const own = (v: number, s: Side) => (s === 'p' ? v > 0 : v < 0)
const opp = (v: number, s: Side) => (s === 'p' ? v < 0 : v > 0)

function allHome(b: Board, s: Side) {
  if (b.bar[s] > 0) return false
  for (let i = 0; i < 24; i++) {
    const inHome = s === 'p' ? i <= 5 : i >= 18
    if (!inHome && own(b.pts[i], s)) return false
  }
  return true
}

function targetOpen(b: Board, s: Side, i: number) {
  const v = b.pts[i]
  return !opp(v, s) || Math.abs(v) === 1
}

function movesForDie(b: Board, s: Side, die: number): Move[] {
  const out: Move[] = []
  if (b.bar[s] > 0) {
    const to = s === 'p' ? 24 - die : die - 1
    if (targetOpen(b, s, to)) out.push({ from: 'bar', to, die, hit: opp(b.pts[to], s) })
    return out
  }
  const home = allHome(b, s)
  for (let i = 0; i < 24; i++) {
    if (!own(b.pts[i], s)) continue
    const t = s === 'p' ? i - die : i + die
    if (t >= 0 && t <= 23) {
      if (targetOpen(b, s, t)) out.push({ from: i, to: t, die, hit: opp(b.pts[t], s) })
      continue
    }
    if (!home) continue
    const exact = s === 'p' ? t === -1 : t === 24
    if (exact) {
      out.push({ from: i, to: 'off', die, hit: false })
      continue
    }
    let farther = false
    if (s === 'p') for (let k = i + 1; k <= 5; k++) farther ||= own(b.pts[k], s)
    else for (let k = 18; k < i; k++) farther ||= own(b.pts[k], s)
    if (!farther) out.push({ from: i, to: 'off', die, hit: false })
  }
  return out
}

export function applyMove(b: Board, s: Side, m: Move): Board {
  const n: Board = { pts: [...b.pts], bar: { ...b.bar }, off: { ...b.off } }
  const sign = s === 'p' ? 1 : -1
  if (m.from === 'bar') n.bar[s]--
  else n.pts[m.from] -= sign
  if (m.to === 'off') n.off[s]++
  else {
    if (m.hit) {
      n.pts[m.to] = 0
      n.bar[s === 'p' ? 'b' : 'p']++
    }
    n.pts[m.to] += sign
  }
  return n
}

function removeDie(dice: number[], die: number) {
  const i = dice.indexOf(die)
  return [...dice.slice(0, i), ...dice.slice(i + 1)]
}

function maxDepth(b: Board, s: Side, dice: number[]): number {
  if (!dice.length) return 0
  let best = 0
  for (const d of new Set(dice)) {
    for (const m of movesForDie(b, s, d)) {
      best = Math.max(best, 1 + maxDepth(applyMove(b, s, m), s, removeDie(dice, d)))
      if (best === dice.length) return best
    }
  }
  return best
}

export function legalMoves(b: Board, s: Side, dice: number[]): Move[] {
  const candidates: { m: Move; depth: number }[] = []
  for (const d of new Set(dice)) {
    for (const m of movesForDie(b, s, d)) {
      candidates.push({ m, depth: 1 + maxDepth(applyMove(b, s, m), s, removeDie(dice, d)) })
    }
  }
  const best = Math.max(0, ...candidates.map((c) => c.depth))
  let legal = candidates.filter((c) => c.depth === best).map((c) => c.m)
  if (best === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const high = Math.max(...dice)
    if (legal.some((m) => m.die === high)) legal = legal.filter((m) => m.die === high)
  }
  return legal
}

export function rollDice(): number[] {
  const a = 1 + Math.floor(Math.random() * 6)
  const b = 1 + Math.floor(Math.random() * 6)
  return a === b ? [a, a, a, a] : [a, b]
}

export function pipCount(b: Board, s: Side) {
  let total = b.bar[s] * 25
  for (let i = 0; i < 24; i++) if (own(b.pts[i], s)) total += Math.abs(b.pts[i]) * (s === 'p' ? i + 1 : 24 - i)
  return total
}

function evaluate(b: Board): number {
  let score = (pipCount(b, 'p') - pipCount(b, 'b')) * 1.0
  score += b.off.b * 12 + b.bar.p * 14 - b.bar.b * 18
  for (let i = 0; i < 24; i++) {
    const v = b.pts[i]
    if (v <= -2) score += i >= 12 ? 5 : 3
    if (v === -1) {
      let threat = b.bar.p > 0 && i >= 18 ? 1 : 0
      for (let k = i + 1; k < 24 && k <= i + 12; k++) if (b.pts[k] > 0) threat++
      score -= threat * (i >= 12 ? 3.5 : 2)
    }
  }
  return score
}

export function botPlan(b: Board, dice: number[]): Move[] {
  let bestSeq: Move[] = []
  let bestScore = -Infinity
  let explored = 0
  const walk = (board: Board, left: number[], seq: Move[]) => {
    if (explored > 4000) return
    const legal = left.length ? legalMoves(board, 'b', left) : []
    if (!legal.length) {
      explored++
      const s = evaluate(board) + Math.random() * 0.5
      if (s > bestScore) {
        bestScore = s
        bestSeq = seq
      }
      return
    }
    const seen = new Set<string>()
    for (const m of legal) {
      const key = `${m.from}-${m.to}`
      if (seen.has(key)) continue
      seen.add(key)
      walk(applyMove(board, 'b', m), removeDie(left, m.die), [...seq, m])
    }
  }
  walk(b, dice, [])
  return bestSeq
}

export type WinKind = 'normal' | 'mars' | 'agir'

/**
 * How big a finished game is for the winner. Mars: the loser has borne off nothing.
 * Ağır mars: on top of that a loser checker is still on the bar or inside the winner's home board.
 */
export function winKind(b: Board, winner: Side): WinKind {
  const loser: Side = winner === 'p' ? 'b' : 'p'
  if (b.off[loser] > 0) return 'normal'
  if (b.bar[loser] > 0) return 'agir'
  for (let i = 0; i < 24; i++) {
    const inWinnerHome = winner === 'p' ? i <= 5 : i >= 18
    if (inWinnerHome && own(b.pts[i], loser)) return 'agir'
  }
  return 'mars'
}

export const WIN_POINTS: Record<WinKind, number> = { normal: 1, mars: 2, agir: 3 }
export const WIN_LABEL: Record<WinKind, string> = { normal: 'Normal galibiyet', mars: 'Mars', agir: 'Ağır Mars' }

/** Rolls the opening dice until they differ. The higher die starts and plays both values. */
export function openingRoll(): [number, number] {
  let a = 0
  let b = 0
  while (a === b) {
    a = 1 + Math.floor(Math.random() * 6)
    b = 1 + Math.floor(Math.random() * 6)
  }
  return [a, b]
}

export function spendDie(dice: number[], die: number) {
  return removeDie(dice, die)
}

/**
 * Every destination a single checker can reach this turn, including chained
 * moves that use several dice (e.g. 3+5 or a full double), each step legal.
 */
export function routesFrom(b: Board, s: Side, dice: number[], from: From): Map<To, Move[]> {
  const out = new Map<To, Move[]>()
  const walk = (board: Board, left: number[], pos: From, seq: Move[]) => {
    if (!left.length) return
    for (const m of legalMoves(board, s, left)) {
      if (m.from !== pos) continue
      const next = [...seq, m]
      const prev = out.get(m.to)
      if (!prev || prev.length > next.length) out.set(m.to, next)
      if (m.to !== 'off') walk(applyMove(board, s, m), removeDie(left, m.die), m.to, next)
    }
  }
  walk(b, dice, from, [])
  return out
}
