/**
 * Deterministic "Jako Çemberi" physics. The server and every browser run this exact code from the same seed,
 * so the elimination order matches everywhere without streaming the match.
 *
 * Determinism rules: only +, -, *, / and Math.sqrt / Math.floor / Math.abs (all exactly specified by IEEE-754 / ECMAScript).
 * Never use Math.sin/cos/atan2/hypot/pow/exp here: their precision is engine-dependent.
 */

export const STEP = 1 / 60
export const ARENA = 1
const GRAVITY = 1.15
const MAX_SPEED = 3.2
const BALL_BOUNCE = 0.94
const WALL_BOUNCE = 1.0
const MIN_KICK = 0.55
const SPIN = 0.85
export const MAX_SECONDS = 210
/** Goals stay shut for the first seconds so the crowd spreads out before anyone can drop. */
export const WARMUP = 3.5

const TAU = 6.283185307179586
const PI = 3.141592653589793
const HALF_PI = 1.5707963267948966

/** Polynomial sine with exact-arithmetic range reduction, identical across JS engines. */
export function dsin(x: number) {
  let a = x - Math.floor(x / TAU) * TAU
  if (a > PI) a -= TAU
  if (a > HALF_PI) a = PI - a
  else if (a < -HALF_PI) a = -PI - a
  const a2 = a * a
  return a * (1 - a2 / 6 * (1 - a2 / 20 * (1 - a2 / 42 * (1 - a2 / 72 * (1 - a2 / 110 * (1 - a2 / 156))))))
}

export function dcos(x: number) {
  return dsin(x + HALF_PI)
}

export function mulberry(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Ball = { x: number; y: number; vx: number; vy: number; alive: boolean; out: boolean; outAt: number }

export type SimState = {
  balls: Ball[]
  step: number
  alive: number
  radius: number
  rotation: number
  gapHalf: number
  /** Indexes in elimination order. */
  order: number[]
  winner: number | null
}

export function targetRadius(alive: number) {
  return Math.min(0.085, 0.37 / Math.sqrt(Math.max(alive, 1)))
}

/** Goal half-width in radians: it keeps breathing (shrink/grow) and slowly widens so the round always finishes. */
export function gapHalfAt(t: number, radius: number, alive = 99) {
  const duel = alive <= 2 ? 0.7 : alive <= 4 ? 0.85 : 1
  const base = (0.13 + Math.min(0.1, t * 0.0009)) * duel + (t > 120 ? (t - 120) * 0.0015 : 0)
  const breathe = 1 + 0.42 * dsin(t * 1.85) * (0.75 + 0.25 * dsin(t * 0.53 + 1.3))
  return Math.max(radius * 1.05 + 0.03, Math.min(0.5, base * breathe))
}

export function rotationAt(t: number) {
  return t * SPIN + 0.55 * dsin(t * 0.31) + 0.25 * dsin(t * 0.87 + 2)
}

export function createSim(count: number, seed: number): SimState {
  const rand = mulberry(seed)
  const balls: Ball[] = []
  const golden = 2.399963229728653
  for (let i = 0; i < count; i++) {
    const d = Math.sqrt((i + 0.5) / Math.max(count, 1)) * 0.78
    const a = i * golden + rand() * 0.2
    const speed = 0.4 + rand() * 0.6
    const dir = rand() * TAU
    balls.push({ x: dcos(a) * d, y: dsin(a) * d, vx: dcos(dir) * speed, vy: dsin(dir) * speed, alive: true, out: false, outAt: 0 })
  }
  const radius = targetRadius(count)
  const state: SimState = { balls, step: 0, alive: count, radius, rotation: 0, gapHalf: gapHalfAt(0, radius), order: [], winner: count === 1 ? 0 : null }
  return state
}

function inGap(x: number, y: number, dist: number, rotation: number, gapHalf: number) {
  const ux = x / dist
  const uy = y / dist
  const gx = dcos(rotation)
  const gy = dsin(rotation)
  const dot = ux * gx + uy * gy
  const limit = dcos(gapHalf)
  return dot > limit || -dot > limit
}

export function stepSim(s: SimState) {
  if (s.winner !== null) return
  const t = s.step * STEP
  s.radius += (targetRadius(s.alive) - s.radius) * 0.03
  s.rotation = rotationAt(t)
  s.gapHalf = gapHalfAt(t, s.radius, s.alive)
  const r = s.radius
  const balls = s.balls
  const n = balls.length

  for (let i = 0; i < n; i++) {
    const b = balls[i]
    if (!b.alive) continue
    b.vy += GRAVITY * STEP
    const sp2 = b.vx * b.vx + b.vy * b.vy
    if (sp2 > MAX_SPEED * MAX_SPEED) {
      const k = MAX_SPEED / Math.sqrt(sp2)
      b.vx *= k
      b.vy *= k
    }
    b.x += b.vx * STEP
    b.y += b.vy * STEP
  }

  // Uniform grid broad phase; only balls still inside the ring collide with each other.
  const cell = r * 2
  const cols = Math.floor((ARENA * 2 + 1) / cell) + 1
  const grid = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const b = balls[i]
    if (!b.alive || b.out) continue
    const cx = Math.floor((b.x + ARENA + 0.5) / cell)
    const cy = Math.floor((b.y + ARENA + 0.5) / cell)
    const key = cy * cols + cx
    const list = grid.get(key)
    if (list) list.push(i)
    else grid.set(key, [i])
  }
  const minD = r * 2
  for (let i = 0; i < n; i++) {
    const a = balls[i]
    if (!a.alive || a.out) continue
    const cx = Math.floor((a.x + ARENA + 0.5) / cell)
    const cy = Math.floor((a.y + ARENA + 0.5) / cell)
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const list = grid.get((cy + oy) * cols + cx + ox)
        if (!list) continue
        for (const j of list) {
          if (j <= i) continue
          const b = balls[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const d2 = dx * dx + dy * dy
          if (d2 >= minD * minD || d2 === 0) continue
          const d = Math.sqrt(d2)
          const nx = dx / d
          const ny = dy / d
          const overlap = (minD - d) / 2
          a.x -= nx * overlap
          a.y -= ny * overlap
          b.x += nx * overlap
          b.y += ny * overlap
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
          if (rel < 0) {
            const imp = (-(1 + BALL_BOUNCE) * rel) / 2
            a.vx -= imp * nx
            a.vy -= imp * ny
            b.vx += imp * nx
            b.vy += imp * ny
          }
        }
      }
    }
  }

  const tangentSpeed = SPIN * ARENA * 0.35
  const exits: number[] = []
  for (let i = 0; i < n; i++) {
    const b = balls[i]
    if (!b.alive) continue
    const dist = Math.sqrt(b.x * b.x + b.y * b.y)
    if (b.out) {
      if (dist > ARENA + r * 2.2) exits.push(i)
      continue
    }
    if (dist + r <= ARENA || dist === 0) continue
    if (t >= WARMUP && inGap(b.x, b.y, dist, s.rotation, s.gapHalf)) {
      b.out = true
      continue
    }
    const nx = b.x / dist
    const ny = b.y / dist
    b.x = nx * (ARENA - r)
    b.y = ny * (ARENA - r)
    const vn = b.vx * nx + b.vy * ny
    if (vn > 0) {
      b.vx -= (1 + WALL_BOUNCE) * vn * nx
      b.vy -= (1 + WALL_BOUNCE) * vn * ny
      // The spinning rim drags balls along its tangent, which keeps the pile moving.
      b.vx += -ny * tangentSpeed * 0.12
      b.vy += nx * tangentSpeed * 0.12
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
      if (sp < MIN_KICK) {
        const k = MIN_KICK / Math.max(sp, 0.0001)
        b.vx *= k
        b.vy *= k
      }
    }
  }

  for (const i of exits) {
    if (s.alive <= 1) break
    const b = balls[i]
    b.alive = false
    b.outAt = s.step
    s.alive -= 1
    s.order.push(i)
  }

  s.step += 1
  if (s.alive === 1) {
    s.winner = balls.findIndex((b) => b.alive)
    return
  }
  if (s.step * STEP >= MAX_SECONDS) {
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < n; i++) {
      const b = balls[i]
      if (!b.alive) continue
      const d = b.out ? 99 + b.x * b.x + b.y * b.y : b.x * b.x + b.y * b.y
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    for (let i = 0; i < n; i++) {
      if (i !== best && balls[i].alive) {
        balls[i].alive = false
        balls[i].outAt = s.step
        s.order.push(i)
      }
    }
    s.alive = 1
    s.winner = best
  }
}

/** Runs a whole round headless; used by the server to settle the prize. */
export function runSim(count: number, seed: number) {
  const s = createSim(count, seed)
  while (s.winner === null) stepSim(s)
  return { winner: s.winner, steps: s.step, order: s.order }
}
