/**
 * Deterministic 8-ball engine shared by the browser and the server.
 * The server re-simulates every online shot with this exact code, so the result can't be forged
 * and both players' replays land on identical positions. Only +, *, / and Math.sqrt are used in
 * the step loop to keep floating point results identical across JS engines.
 */

export const W = 1000
export const H = 500
export const RAIL = 38
export const R = 12
// Scale: 1000 units = 100" playing surface (9 ft table), ball 2.25" ≈ 22.5 units.
export const POCKET_R = 22
const POCKET_R2 = POCKET_R * POCKET_R
const CORNER_MOUTH = 14
const SIDE_MOUTH = 16
export const MAX_SPEED = 30
const SUB = 8
// 0.987 per frame, split across the substeps.
const FRICTION = 0.9983656820109339
const FOLLOW_GAIN = 0.62
const ENGLISH_GAIN = 0.42
const MAX_FRAMES = 6000
const BREAK_RAIL_BALLS = 4

export const FALLBACK_SEED = 'alkanka-bilardo'

export const POCKETS = [
  [-6, -6],
  [W / 2, -8],
  [W + 6, -6],
  [-6, H + 6],
  [W / 2, H + 8],
  [W + 6, H + 6],
] as const

export type Ball = { id: number; x: number; y: number; vx: number; vy: number; in: boolean }
export type BallState = { id: number; x: number; y: number; vx: number; vy: number; inPocket: boolean }
export type Group = 'solid' | 'stripe'
export type Groups = [Group | null, Group | null]
/** Cue-ball spin. `side` > 0 is right english, `follow` > 0 is top spin, < 0 is draw. */
export type Spin = { side: number; follow: number; applied: boolean }
/** Direction is sent as a vector (not an angle) so no client's Math.cos/sin can make replays diverge. */
export type ShotInput = { dx: number; dy: number; pow: number; spinX: number; spinY: number }
export type ShotEvents = { first: number | null; potted: number[]; pocketOf: Record<number, number>; rail: boolean; railBalls: number[] }
export type StepHooks = { hit?: (a: Ball, b: Ball, rel: number) => void; pot?: (b: Ball, pocket: number) => void }

export const groupOf = (id: number): Group | 'eight' | 'cue' => (id === 0 ? 'cue' : id === 8 ? 'eight' : id < 8 ? 'solid' : 'stripe')
export const groupName = (g: Group) => (g === 'solid' ? 'Düz' : 'Çizgili')

export const toState = (b: Ball): BallState => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, inPocket: b.in })
export const fromState = (b: BallState): Ball => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, in: !!b.inPocket })
export const newEvents = (): ShotEvents => ({ first: null, potted: [], pocketOf: {}, rail: false, railBalls: [] })

export function seeded(seedText: string) {
  let h = 2166136261
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

export function rack(rand: () => number = Math.random): Ball[] {
  const balls: Ball[] = [{ id: 0, x: W * 0.25, y: H / 2, vx: 0, vy: 0, in: false }]
  const pool = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]
    .map((id) => ({ id, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.id)
  const apexX = W * 0.7
  let k = 0
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      const isEight = row === 2 && i === 1
      const id = isEight ? 8 : pool[k++]
      balls.push({ id, x: apexX + row * R * 1.75, y: H / 2 + (i - row / 2) * R * 2.02, vx: 0, vy: 0, in: false })
    }
  }
  return balls
}

const dist = (dx: number, dy: number) => Math.sqrt(dx * dx + dy * dy)
const inHorizontalMouth = (x: number) => x < CORNER_MOUTH || x > W - CORNER_MOUTH || Math.abs(x - W / 2) < SIDE_MOUTH
const inVerticalMouth = (y: number) => y < CORNER_MOUTH || y > H - CORNER_MOUTH

function cushion(b: Ball, axis: 'x' | 'y', spin: Spin) {
  if (b.id === 0 && Math.abs(spin.side) > 0.01) {
    const sp = dist(b.vx, b.vy) || 1
    // English pushes the rebound toward the shooter's side of the spin, along the rail.
    const rx = -b.vy / sp
    const ry = b.vx / sp
    if (axis === 'y') {
      b.vy = -b.vy * 0.82
      b.vx += rx * spin.side * ENGLISH_GAIN * sp
    } else {
      b.vx = -b.vx * 0.82
      b.vy += ry * spin.side * ENGLISH_GAIN * sp
    }
    spin.side *= 0.5
    return
  }
  if (axis === 'y') b.vy = -b.vy * 0.82
  else b.vx = -b.vx * 0.82
}

/** Sets the cue ball moving and returns the spin state for the shot. `pow` is 0..1. */
export function startShot(balls: Ball[], shot: ShotInput): Spin {
  const cue = balls[0]
  const speed = Math.max(0, Math.min(1, shot.pow)) * MAX_SPEED
  const len = dist(shot.dx, shot.dy) || 1
  cue.vx = (shot.dx / len) * speed
  cue.vy = (shot.dy / len) * speed
  return { side: shot.spinX, follow: shot.spinY, applied: false }
}

/** Advances the table by one frame and records rule-relevant events. */
export function stepShot(balls: Ball[], spin: Spin, ev: ShotEvents, hooks?: StepHooks) {
  for (let s = 0; s < SUB; s++) {
    for (const b of balls) {
      if (b.in) continue
      b.x += b.vx / SUB
      b.y += b.vy / SUB
      b.vx *= FRICTION
      b.vy *= FRICTION
      for (let p = 0; p < POCKETS.length; p++) {
        const dx = b.x - POCKETS[p][0]
        const dy = b.y - POCKETS[p][1]
        if (dx * dx + dy * dy < POCKET_R2) {
          b.in = true
          b.vx = b.vy = 0
          ev.potted.push(b.id)
          ev.pocketOf[b.id] = p
          hooks?.pot?.(b, p)
          break
        }
      }
      if (b.in) continue
      const mouthX = inHorizontalMouth(b.x)
      const mouthY = inVerticalMouth(b.y)
      let railed = false
      if (b.x < R && !mouthY && b.vx < 0) ((b.x = R), cushion(b, 'x', spin), (railed = true))
      if (b.x > W - R && !mouthY && b.vx > 0) ((b.x = W - R), cushion(b, 'x', spin), (railed = true))
      if (b.y < R && !mouthX && b.vy < 0) ((b.y = R), cushion(b, 'y', spin), (railed = true))
      if (b.y > H - R && !mouthX && b.vy > 0) ((b.y = H - R), cushion(b, 'y', spin), (railed = true))
      if (railed) {
        if (ev.first !== null) ev.rail = true
        if (b.id !== 0 && !ev.railBalls.includes(b.id)) ev.railBalls.push(b.id)
      }
      b.x = Math.min(Math.max(b.x, -10), W + 10)
      b.y = Math.min(Math.max(b.y, -10), H + 10)
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]
      if (a.in) continue
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]
        if (b.in) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = dist(dx, dy)
        if (d === 0 || d >= R * 2) continue
        const nx = dx / d
        const ny = dy / d
        const overlap = (R * 2 - d) / 2
        a.x -= nx * overlap
        a.y -= ny * overlap
        b.x += nx * overlap
        b.y += ny * overlap
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
        if (rel <= 0) continue
        const cue = !spin.applied ? (a.id === 0 ? a : b.id === 0 ? b : null) : null
        const pre = cue ? { vx: cue.vx, vy: cue.vy, sp: dist(cue.vx, cue.vy) } : null
        const imp = rel * 0.97
        a.vx -= imp * nx
        a.vy -= imp * ny
        b.vx += imp * nx
        b.vy += imp * ny
        if (cue && pre && pre.sp > 0) {
          // Top spin keeps the cue ball rolling forward, draw pulls it back along the shot line.
          cue.vx += (pre.vx / pre.sp) * spin.follow * FOLLOW_GAIN * pre.sp
          cue.vy += (pre.vy / pre.sp) * spin.follow * FOLLOW_GAIN * pre.sp
          spin.applied = true
        }
        if (ev.first === null) {
          if (a.id === 0) ev.first = b.id
          else if (b.id === 0) ev.first = a.id
        }
        hooks?.hit?.(a, b, rel)
      }
    }
  }
  for (const b of balls) if (b.vx * b.vx + b.vy * b.vy < 0.0036) b.vx = b.vy = 0
}

export const isStill = (balls: Ball[]) => balls.every((b) => b.in || (b.vx === 0 && b.vy === 0))

/** Runs a full shot to rest. Mutates `balls`. */
export function simulate(balls: Ball[], shot: ShotInput): ShotEvents {
  const spin = startShot(balls, shot)
  const ev = newEvents()
  for (let f = 0; f < MAX_FRAMES; f++) {
    stepShot(balls, spin, ev)
    if (isStill(balls)) break
  }
  for (const b of balls) b.vx = b.vy = 0
  return ev
}

export function canPlaceCue(balls: Ball[], x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  if (x < R * 1.5 || x > W - R * 1.5 || y < R * 1.5 || y > H - R * 1.5) return false
  if (POCKETS.some(([px, py]) => dist(px - x, py - y) < POCKET_R + R)) return false
  return balls.every((b) => b.id === 0 || b.in || dist(b.x - x, b.y - y) >= R * 2.1)
}

/** True when the seat's group is cleared and the next shot is on the black, which needs a called pocket. */
export function needsCall(balls: Ball[], groups: Groups, seat: number) {
  const g = groups[seat]
  return g !== null && balls.every((b) => groupOf(b.id) !== g || b.in)
}

function respotCue(balls: Ball[]) {
  const cue = balls[0]
  cue.in = false
  cue.vx = cue.vy = 0
  let x = W * 0.25
  while (balls.some((b) => b.id !== 0 && !b.in && dist(b.x - x, b.y - H / 2) < R * 2.2)) x += R * 2.5
  cue.x = x
  cue.y = H / 2
}

function respotEight(balls: Ball[]) {
  const eight = balls.find((b) => b.id === 8)
  if (!eight) return
  let x = W * 0.75
  while (x < W - R * 2 && balls.some((b) => b.id !== 8 && !b.in && dist(b.x - x, b.y - H / 2) < R * 2.1)) x += R * 2.1
  eight.in = false
  eight.vx = eight.vy = 0
  eight.x = x
  eight.y = H / 2
}

export type Resolution = {
  groups: Groups
  keep: boolean
  foul: boolean
  /** The next player may place the cue ball anywhere. */
  ballInHand: boolean
  /** Seat that won the frame, if the shot ended it. */
  winner: number | null
  /** Neutral, third-person summary of what happened. */
  note: string
  /** Group assigned on this shot. */
  assigned: Group | null
}

/**
 * Applies 8-ball rules to a finished shot. Mutates `balls` for respots (scratched cue, black on the break).
 * Rules: legal break needs a pot or 4 object balls to a rail; the table stays open after the break;
 * the first legal pot afterwards assigns groups; the black must be hit first and land in the called pocket.
 */
export function resolveShot(balls: Ball[], ev: ShotEvents, o: { shooter: number; groups: Groups; broken: boolean; call: number | null }): Resolution {
  const { shooter } = o
  const other = shooter === 0 ? 1 : 0
  const groups: Groups = [o.groups[0], o.groups[1]]
  const mine = groups[shooter]
  const scratch = balls[0].in
  const objPotted = ev.potted.filter((id) => id !== 0 && id !== 8)
  const cleared = mine !== null && balls.every((b) => groupOf(b.id) !== mine || (b.in && !ev.potted.includes(b.id)))
  const base = { groups, assigned: null, winner: null }
  const foul = (note: string): Resolution => {
    if (scratch) respotCue(balls)
    return { ...base, keep: false, foul: true, ballInHand: true, note }
  }
  const end = (winner: number, note: string): Resolution => ({ ...base, keep: false, foul: false, ballInHand: false, winner, note })

  if (!o.broken) {
    const eight = ev.potted.includes(8)
    if (eight) respotEight(balls)
    const spotted = eight ? ' Siyah yerine kondu.' : ''
    if (scratch) return foul(`Açılışta beyaz düştü, faul.${spotted}`)
    if (ev.first === null) return foul('Açılışta hiçbir topa değmedi, faul.')
    if (objPotted.length === 0 && !eight && ev.railBalls.length < BREAK_RAIL_BALLS) return foul('Zayıf açılış: en az 4 top banda gitmeli, faul.')
    const keep = objPotted.length > 0
    return { ...base, keep, foul: false, ballInHand: false, note: `${keep ? 'Açılışta top düştü.' : 'Açılış yapıldı.'}${spotted} Masa açık.` }
  }

  if (ev.potted.includes(8)) {
    if (!cleared) return end(other, 'Siyah erken düştü.')
    if (scratch) return end(other, 'Siyah girdi ama beyaz da düştü.')
    if (ev.first !== 8) return end(other, 'Siyaha önce vurulmadan siyah düştü.')
    if (o.call !== null && ev.pocketOf[8] !== o.call) return end(other, 'Siyah söylenen delikten girmedi.')
    return end(shooter, 'Siyah söylenen deliğe girdi.')
  }

  if (scratch) return foul('Beyaz top düştü, faul.')
  if (ev.first === null) return foul('Hiçbir topa değmedi, faul.')
  const fg = groupOf(ev.first)
  const wrongFirst = mine ? (cleared ? fg !== 'eight' : fg !== mine) : fg === 'eight'
  if (wrongFirst) return foul(cleared ? 'Önce siyaha vurulmalıydı, faul.' : 'Önce yanlış topa vuruldu, faul.')
  if (ev.potted.length === 0 && !ev.rail) return foul('Temastan sonra hiçbir top banda gitmedi, faul.')

  let assigned: Group | null = null
  if (!mine && objPotted.length) {
    assigned = groupOf(objPotted[0]) as Group
    groups[shooter] = assigned
    groups[other] = assigned === 'solid' ? 'stripe' : 'solid'
  }
  const keep = objPotted.some((id) => groupOf(id) === groups[shooter])
  const note = assigned ? `${groupName(assigned)} toplar seçildi.` : keep ? 'Top düştü.' : 'Top düşmedi.'
  return { groups, assigned, winner: null, keep, foul: false, ballInHand: false, note }
}
