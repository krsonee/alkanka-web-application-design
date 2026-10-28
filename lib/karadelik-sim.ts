/**
 * Deterministic "Kara Delik Arenası" physics, shared by the server (to settle winners up front) and every browser.
 * Same determinism rules as cember-sim: only + - * /, Math.sqrt/floor/abs, and the engine-independent dsin/dcos.
 */
import { dcos, dsin, mulberry } from './cember-sim'

export const KD_STEP = 1 / 120
export const KD_WALL = 0.95
export const KD_BAR_IN = 0.34
export const KD_BAR_OUT = 0.84
export const KD_BAR_T = 0.024
export const KD_HOLE_R = 0.16
export const KD_PULL_REACH = 0.7
export const KD_WARN = 3
const CYCLE = 11
const CLOSED = 5.5
/** The Final Battle's pull keeps growing, so rounds end on their own; this is only a safety net. */
const FINAL_CAP = 120
const PI = 3.141592653589793
const TAU = 6.283185307179586

export type KDBall = { x: number; y: number; vx: number; vy: number; alive: boolean }
export type KDHit = { x: number; y: number; s: number }
export type KDHole = { mode: 'closed' | 'warn' | 'open'; count: number; radius: number }

export type KDState = {
  n: number
  r: number
  duration: number
  winners: number
  balls: KDBall[]
  time: number
  step: number
  alive: number
  barAngle: number
  omega: number
  final: boolean
  finalAt: number
  finished: boolean
  /** Elimination order (ball indices). */
  order: number[]
  /** Per-step outputs, reset at the start of every step. */
  out: number[]
  hits: KDHit[]
  finalNow: boolean
}

export function kdHole(time: number, final: boolean, finalAt: number): KDHole {
  if (final) return { mode: 'open', count: 0, radius: KD_HOLE_R + Math.min(0.13, (time - finalAt) * 0.016) }
  const c = (time + 2) % CYCLE
  if (c < CLOSED) return { mode: 'closed', count: 0, radius: KD_HOLE_R }
  if (c < CLOSED + KD_WARN) return { mode: 'warn', count: Math.ceil(CLOSED + KD_WARN - c), radius: KD_HOLE_R }
  return { mode: 'open', count: 0, radius: KD_HOLE_R }
}

export function createKD(n: number, seed: number, duration: number, winners: number): KDState {
  const rand = mulberry(seed)
  const r = Math.min(0.1, Math.sqrt(0.28 / Math.max(1, n)))
  const balls: KDBall[] = []
  for (let i = 0; i < n; i++) {
    let x = 0
    let y = 0
    for (let tries = 0; tries < 300; tries++) {
      const a = rand() * TAU
      const d = 0.32 + rand() * (KD_WALL - r - 0.34)
      x = dcos(a) * d
      y = dsin(a) * d
      if (balls.every((b) => (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y) > 2.05 * r * (2.05 * r))) break
    }
    const va = rand() * TAU
    balls.push({ x, y, vx: dcos(va) * 0.5, vy: dsin(va) * 0.5, alive: true })
  }
  return {
    n,
    r,
    duration,
    winners: Math.max(1, winners),
    balls,
    time: 0,
    step: 0,
    alive: n,
    barAngle: 0,
    omega: 1,
    final: false,
    finalAt: 0,
    // Nobody needs eliminating when the arena already holds no more players than prize places.
    finished: n <= Math.max(1, winners),
    order: [],
    out: [],
    hits: [],
    finalNow: false,
  }
}

function eliminate(s: KDState, i: number) {
  s.balls[i].alive = false
  s.alive--
  s.order.push(i)
  s.out.push(i)
  if (s.alive <= s.winners) s.finished = true
}

export function stepKD(s: KDState) {
  s.out = []
  s.hits = []
  s.finalNow = false
  if (s.finished) return
  s.step++
  s.time = s.step * KD_STEP
  const { balls, n, r } = s

  if (!s.final && s.time >= s.duration) {
    if (s.alive > s.winners) {
      s.final = true
      s.finalAt = s.time
      s.finalNow = true
    } else {
      s.finished = true
      return
    }
  }

  // Safety net: drop the balls closest to the hole until only the winners remain.
  if (s.final && s.time - s.finalAt > FINAL_CAP) {
    const byDist = balls
      .map((b, i) => ({ i, d: b.x * b.x + b.y * b.y, alive: b.alive }))
      .filter((b) => b.alive)
      .sort((a, b) => a.d - b.d || a.i - b.i)
    for (const b of byDist) {
      if (s.finished) break
      eliminate(s, b.i)
    }
    return
  }

  const hole = kdHole(s.time, s.final, s.finalAt)
  const omega = s.final ? 1.7 : 1
  s.omega = omega
  s.barAngle += omega * KD_STEP
  const sinceFinal = s.final ? s.time - s.finalAt : 0
  const reach = s.final ? 1.3 : KD_PULL_REACH
  const pull = s.final ? 1.2 + sinceFinal * 0.3 : 1.4
  const maxSpeed = s.final ? 1.3 + Math.min(0.8, sinceFinal * 0.04) : 1.3
  const bars = [0, 1].map((k) => {
    const a = s.barAngle + k * PI
    return { ux: dcos(a), uy: dsin(a) }
  })

  for (let i = 0; i < n; i++) {
    const b = balls[i]
    if (!b.alive) continue
    let d = Math.sqrt(b.x * b.x + b.y * b.y) || 1e-6

    if (hole.mode === 'open' && d < reach) {
      const f = pull * (1 - d / reach) + 0.3
      b.vx += (-b.x / d) * f * KD_STEP + (-b.y / d) * 0.4 * KD_STEP
      b.vy += (-b.y / d) * f * KD_STEP + (b.x / d) * 0.4 * KD_STEP
    }

    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1e-6
    const target = sp < 0.35 ? 0.35 : sp > maxSpeed ? maxSpeed : sp
    b.vx *= target / sp
    b.vy *= target / sp
    b.x += b.vx * KD_STEP
    b.y += b.vy * KD_STEP
    d = Math.sqrt(b.x * b.x + b.y * b.y) || 1e-6

    if (d + r > KD_WALL) {
      const nx = b.x / d
      const ny = b.y / d
      b.x = nx * (KD_WALL - r)
      b.y = ny * (KD_WALL - r)
      const vn = b.vx * nx + b.vy * ny
      if (vn > 0) {
        b.vx -= 2 * vn * nx
        b.vy -= 2 * vn * ny
      }
    }

    if (hole.mode === 'open') {
      if (d < hole.radius - r * 0.2) {
        eliminate(s, i)
        if (s.finished) return
        continue
      }
    } else if (d < KD_HOLE_R + r) {
      const nx = b.x / d
      const ny = b.y / d
      b.x = nx * (KD_HOLE_R + r)
      b.y = ny * (KD_HOLE_R + r)
      const vn = b.vx * nx + b.vy * ny
      if (vn < 0) {
        b.vx -= 2 * vn * nx
        b.vy -= 2 * vn * ny
      }
    }

    for (const { ux, uy } of bars) {
      const proj = Math.min(KD_BAR_OUT, Math.max(KD_BAR_IN, b.x * ux + b.y * uy))
      const px = ux * proj
      const py = uy * proj
      const dx = b.x - px
      const dy = b.y - py
      const dist = Math.sqrt(dx * dx + dy * dy) || 1e-6
      if (dist < r + KD_BAR_T) {
        const nx = dx / dist
        const ny = dy / dist
        b.x = px + nx * (r + KD_BAR_T)
        b.y = py + ny * (r + KD_BAR_T)
        const bvx = -omega * py
        const bvy = omega * px
        const rn = (b.vx - bvx) * nx + (b.vy - bvy) * ny
        if (rn < 0) {
          b.vx -= 1.9 * rn * nx
          b.vy -= 1.9 * rn * ny
          if (-rn > 0.7) s.hits.push({ x: px + nx * KD_BAR_T, y: py + ny * KD_BAR_T, s: -rn })
        }
      }
    }
  }

  const min = 2 * r
  for (let i = 0; i < n; i++) {
    const a = balls[i]
    if (!a.alive) continue
    for (let j = i + 1; j < n; j++) {
      const b = balls[j]
      if (!b.alive) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d2 = dx * dx + dy * dy
      if (d2 >= min * min || d2 < 1e-12) continue
      const d = Math.sqrt(d2)
      const nx = dx / d
      const ny = dy / d
      const overlap = (min - d) / 2
      a.x -= nx * overlap
      a.y -= ny * overlap
      b.x += nx * overlap
      b.y += ny * overlap
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
      if (rel > 0) {
        a.vx -= rel * nx
        a.vy -= rel * ny
        b.vx += rel * nx
        b.vy += rel * ny
        if (rel > 0.95) s.hits.push({ x: a.x + nx * r, y: a.y + ny * r, s: rel * 0.6 })
      }
    }
  }
}

/** Plays the whole round headless: which ball indices survive and how many steps it takes. */
export function runKD(n: number, seed: number, duration: number, winners: number) {
  const s = createKD(n, seed, duration, winners)
  while (!s.finished) stepKD(s)
  return { survivors: s.balls.flatMap((b, i) => (b.alive ? [i] : [])), steps: s.step, order: s.order }
}
