/**
 * Deterministic "Jako Çemberi" physics. The server and every browser run this exact code from the same seed,
 * so the elimination order matches everywhere without streaming the match.
 *
 * Determinism rules: only +, -, *, / and Math.sqrt / Math.floor / Math.abs (all exactly specified by IEEE-754 / ECMAScript).
 * Never use Math.sin/cos/atan2/hypot/pow/exp here: their precision is engine-dependent.
 *
 * Feel: balls pile up under gravity inside a pitch-shaped ring. Two goals sit opposite each other on the rim,
 * spin around with the pitch and keep breathing (narrow ↔ wide). The spinning rim drags the pile, so whenever a
 * goal sweeps under the crowd a few drop out one by one.
 */

export const STEP = 1 / 60
export const ARENA = 1
const GRAVITY = 1.7
const MAX_SPEED = 3.4
const BALL_BOUNCE = 0.55
const WALL_BOUNCE = 0.62
const RIM_GRIP = 0.22
const SOLVER_PASSES = 2
export const MAX_SECONDS = 210
/** Goals stay shut for the first seconds so the pile settles before anyone can drop. */
export const WARMUP = 2.5
/** Small rounds would otherwise end in a couple of seconds; eliminations are spread so every round plays at least this long. */
export const MIN_SECONDS = 24
/** A lone qualifier still gets a short lap on the pitch before being crowned. */
const SOLO_SECONDS = 6

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

export type Ball = { x: number; y: number; vx: number; vy: number; alive: boolean; out: boolean; outAt: number; outStep: number }

export type SimState = {
  balls: Ball[]
  step: number
  alive: number
  /** Balls already through a goal but not yet counted. */
  leaving: number
  radius: number
  rotation: number
  gapHalf: number
  /** Indexes in elimination order. */
  order: number[]
  winner: number | null
  /** Per-run phase offsets so every round moves differently. */
  phase: number
  dir: number
}

export function targetRadius(alive: number) {
  return Math.min(0.078, Math.sqrt(0.34 / Math.max(alive, 1)))
}

/** Goal half-width in radians: always breathing, never wider than ~25°, slowly loosening late so a round always ends. */
export function gapHalfAt(t: number, radius: number, phase = 0) {
  const breathe = 0.5 + 0.5 * dsin(t * 1.35 + phase)
  const wobble = 0.72 + 0.28 * dsin(t * 0.47 + phase * 1.7)
  const late = t > 75 ? Math.min(0.12, (t - 75) * 0.0018) : 0
  return Math.min(0.46, radius * 1.18 + 0.045 + 0.2 * breathe * wobble + late)
}

export function rotationAt(t: number, phase = 0, dir = 1) {
  return phase * 3 + dir * (0.6 * t + 2.1 * dsin(t * 0.32 + phase))
}

function omegaAt(t: number, phase: number, dir: number) {
  return dir * (0.6 + 2.1 * 0.32 * dcos(t * 0.32 + phase))
}

export function createSim(count: number, seed: number): SimState {
  const rand = mulberry(seed)
  const balls: Ball[] = []
  const golden = 2.399963229728653
  const radius = targetRadius(count)
  const spread = Math.min(0.86, 0.2 + radius * Math.sqrt(count) * 1.05)
  for (let i = 0; i < count; i++) {
    const d = Math.sqrt((i + 0.5) / Math.max(count, 1)) * spread
    const a = i * golden + rand() * 0.15
    balls.push({
      x: dcos(a) * d,
      y: dsin(a) * d,
      vx: (rand() - 0.5) * 0.8,
      vy: (rand() - 0.5) * 0.8,
      alive: true,
      out: false,
      outAt: 0,
      outStep: 0,
    })
  }
  const phase = rand() * TAU
  const dir = rand() < 0.5 ? -1 : 1
  return {
    balls,
    step: 0,
    alive: count,
    leaving: 0,
    radius,
    rotation: rotationAt(0, phase, dir),
    gapHalf: gapHalfAt(0, radius, phase),
    order: [],
    winner: null,
    phase,
    dir,
  }
}

function inGap(x: number, y: number, dist: number, rotation: number, gapHalf: number) {
  const ux = x / dist
  const uy = y / dist
  const dot = ux * dcos(rotation) + uy * dsin(rotation)
  const limit = dcos(gapHalf)
  return dot > limit || -dot > limit
}

function collide(s: SimState) {
  const balls = s.balls
  const n = balls.length
  const r = s.radius
  const cell = r * 2
  const cols = Math.floor((ARENA * 2 + 1) / cell) + 1
  const grid = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const b = balls[i]
    if (!b.alive || b.out) continue
    const key = Math.floor((b.y + ARENA + 0.5) / cell) * cols + Math.floor((b.x + ARENA + 0.5) / cell)
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
}

export function stepSim(s: SimState) {
  if (s.winner !== null) return
  const t = s.step * STEP
  s.radius += (targetRadius(s.alive) - s.radius) * 0.02
  s.rotation = rotationAt(t, s.phase, s.dir)
  s.gapHalf = gapHalfAt(t, s.radius, s.phase)
  const omega = omegaAt(t, s.phase, s.dir)
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

  for (let pass = 0; pass < SOLVER_PASSES; pass++) collide(s)

  const pace = n > 1 ? Math.max(0, (MIN_SECONDS - WARMUP) / (n - 1)) : 0
  const goalsOpen = t >= WARMUP + pace * (s.order.length + s.leaving + 1)
  const exits: number[] = []
  for (let i = 0; i < n; i++) {
    const b = balls[i]
    if (!b.alive) continue
    const dist = Math.sqrt(b.x * b.x + b.y * b.y)
    if (b.out) {
      if (dist > ARENA + r * 1.2 || s.step - b.outStep > 45) exits.push(i)
      continue
    }
    if (dist + r <= ARENA || dist === 0) continue
    const nx = b.x / dist
    const ny = b.y / dist
    // The last ball still on the pitch can never leave: that ball is the winner.
    if (goalsOpen && s.alive - s.leaving > 1 && inGap(b.x, b.y, dist, s.rotation, s.gapHalf)) {
      b.out = true
      b.outStep = s.step
      s.leaving += 1
      const vn = b.vx * nx + b.vy * ny
      if (vn < 0.9) {
        b.vx += (0.9 - vn) * nx
        b.vy += (0.9 - vn) * ny
      }
      continue
    }
    b.x = nx * (ARENA - r)
    b.y = ny * (ARENA - r)
    const vn = b.vx * nx + b.vy * ny
    if (vn > 0) {
      b.vx -= (1 + WALL_BOUNCE) * vn * nx
      b.vy -= (1 + WALL_BOUNCE) * vn * ny
    }
    // The spinning rim grips the ball and drags it along, so the pile keeps rolling toward the goals.
    const tx = -ny
    const ty = nx
    const vt = b.vx * tx + b.vy * ty
    const push = (omega * ARENA - vt) * RIM_GRIP
    b.vx += tx * push
    b.vy += ty * push
  }

  for (const i of exits) {
    const b = balls[i]
    b.alive = false
    b.outAt = s.step
    s.alive -= 1
    s.leaving -= 1
    s.order.push(i)
  }

  s.step += 1
  if (s.alive === 1 && (n > 1 || t >= SOLO_SECONDS)) {
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
