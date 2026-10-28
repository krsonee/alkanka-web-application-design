/**
 * Deterministic "Survival Arena" physics (vertical football pitch, sliding goals on both sides), shared by the
 * server (to settle winners up front) and every browser. Same determinism rules as cember-sim: only + - * /,
 * Math.sqrt/floor/abs/min/max, and the engine-independent dsin/dcos.
 */
import { dsin, mulberry } from './cember-sim'

export const SV_STEP = 1 / 120
/** Pitch half-width / half-height in sim units (portrait pitch). */
export const SV_HW = 0.62
export const SV_HH = 1
export const SV_GOAL_DEPTH = 0.11
const GOAL_BASE = 0.115
const POST_R = 0.014
/** New players can't be knocked out while they fade in. */
export const SV_ENTER_GRACE = 0.9
const SHIELD_SECONDS = 1
const FINAL_CAP = 90
/** Even a huge queue ends eventually: past this the clock runs regardless. */
const QUEUE_CAP = 240
const PI = 3.141592653589793

export type SVRule = 'last' | 'most'
export type SVOptions = {
  n: number
  seed: number
  /** Seconds the countdown runs before the Final Battle. */
  duration: number
  /** Solo: survivors that take a prize. Ignored in team mode. */
  winners: number
  /** 0 = solo, 2 = two teams (gold vs blue), 5 = five teams of two (2v2v2v2v2). */
  teams: 0 | 2 | 5
  rule: SVRule
  /** Teammates bumping into each other get a short goal shield. */
  shield: boolean
  /** Each team's first player is its captain: if the captain falls, the whole team is out. */
  captain?: boolean
}

export const SV_TEAM_NAMES = ['Altın', 'Mavi', 'Yakut', 'Zümrüt', 'Gümüş'] as const

/** 0 waiting in the queue, 1 on the pitch, 2 knocked out. */
export type SVBall = { x: number; y: number; vx: number; vy: number; state: 0 | 1 | 2; team: number; enterAt: number; shieldUntil: number }
export type SVGoal = { side: -1 | 1; cy: number; h: number }
export type SVHit = { x: number; y: number; s: number }

export type SVState = {
  opts: SVOptions
  n: number
  r: number
  /** Players on the pitch at once. */
  field: number
  balls: SVBall[]
  queue: number[][]
  time: number
  /** Countdown clock; it only runs once the queue is empty. */
  clock: number
  step: number
  phase: number
  final: boolean
  finalAt: number
  /** Team "most" rule ended level: among the tied `contenders`, the first team to lose a player drops out. */
  suddenDeath: boolean
  contenders: number[]
  /** Team count actually played (5 teams falls back to 2 when there are fewer than 10 entrants). */
  teamCount: number
  /** Captain entrant index per team, or -1 when captain mode is off. */
  captains: number[]
  /** Teams already knocked out of the round. */
  teamDead: boolean[]
  /** Teams eliminated during the last step (captain fell or last player gone). */
  teamOut: number[]
  finished: boolean
  winningTeam: number
  order: number[]
  out: { i: number; side: -1 | 1 }[]
  entered: number[]
  shielded: number[]
  hits: SVHit[]
  finalNow: boolean
}

/** How many players stand on the pitch for `n` entrants (crowds play in a bigger, faster arena). */
export function svFieldSize(n: number, teams: number) {
  const f = Math.min(n, n <= 20 ? 10 : Math.min(20, 10 + Math.ceil((n - 20) / 4)))
  return teams ? f - (f % teams) : f
}

/** Five teams need at least two players each; smaller lobbies play gold vs blue instead. */
export function svTeamCount(n: number, teams: number) {
  return teams === 5 && n < 10 ? 2 : teams
}

/** Teams still in the round. */
export function svTeamsLeft(s: SVState) {
  const left: number[] = []
  for (let t = 0; t < s.teamCount; t++) if (!s.teamDead[t] && svAlive(s, t) > 0) left.push(t)
  return left
}

export function svAlive(s: SVState, team = -1) {
  let k = 0
  for (const b of s.balls) if (b.state !== 2 && (team < 0 || b.team === team)) k++
  return k
}

export function svGoals(s: SVState): SVGoal[] {
  let waiting = 0
  for (const q of s.queue) waiting += q.length
  const crowd = Math.min(1, waiting / Math.max(1, s.field))
  const grow = s.final ? 0.6 + Math.min(2, (s.time - s.finalAt) * 0.05) : 0
  const h = Math.min(SV_HH * 0.62, GOAL_BASE * (1 + crowd * 0.7 + grow))
  const span = SV_HH - h - 0.05
  return [
    { side: -1, cy: dsin(s.phase) * span, h },
    { side: 1, cy: dsin(s.phase * 1.17 + 2.2) * span, h },
  ]
}

function free(s: SVState, x: number, y: number) {
  const min = 2.1 * s.r
  for (const b of s.balls) if (b.state === 1 && (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y) < min * min) return false
  return true
}

function place(s: SVState, rand: () => number, b: SVBall, centre: boolean) {
  const sx = centre ? 0.28 : SV_HW - s.r - 0.08
  const sy = centre ? 0.3 : SV_HH - s.r - 0.08
  for (let t = 0; t < 200; t++) {
    b.x = (rand() * 2 - 1) * sx
    b.y = (rand() * 2 - 1) * sy
    if (free(s, b.x, b.y)) break
  }
  const a = rand() * 2 * PI
  b.vx = dsin(a + PI / 2) * 0.8
  b.vy = dsin(a) * 0.8
}

export function createSV(opts: SVOptions): SVState {
  const rand = mulberry(opts.seed)
  const n = opts.n
  const teams = svTeamCount(n, opts.teams)
  const field = svFieldSize(n, teams)
  const r = Math.min(0.085, Math.sqrt(0.13 / Math.max(1, field)))
  const balls: SVBall[] = []
  // Round-robin teams keeps the split fair whatever the entry order is.
  for (let i = 0; i < n; i++) balls.push({ x: 0, y: 0, vx: 0, vy: 0, state: 0, team: teams ? i % teams : 0, enterAt: 0, shieldUntil: 0 })
  const queue: number[][] = Array.from({ length: teams || 1 }, () => [])
  const s: SVState = {
    opts: { ...opts, teams: teams as 0 | 2 | 5, captain: !!teams && !!opts.captain, winners: Math.max(1, opts.winners) },
    contenders: [],
    teamCount: teams,
    // Entrant t is the first member of team t, so every captain starts on the pitch.
    captains: Array.from({ length: teams }, (_, t) => (opts.captain && t < n ? t : -1)),
    teamDead: Array.from({ length: teams }, () => false),
    teamOut: [],
    n,
    r,
    field,
    balls,
    queue,
    time: 0,
    clock: 0,
    step: 0,
    phase: rand() * 2 * PI,
    final: false,
    finalAt: 0,
    suddenDeath: false,
    finished: false,
    winningTeam: -1,
    order: [],
    out: [],
    entered: [],
    shielded: [],
    hits: [],
    finalNow: false,
  }
  const perTeam = teams ? field / teams : field
  const placed = Array.from({ length: teams || 1 }, () => 0)
  for (let i = 0; i < n; i++) {
    const t = balls[i].team
    if (placed[t] < perTeam) {
      placed[t]++
      balls[i].state = 1
      place(s, rand, balls[i], false)
    } else queue[t].push(i)
  }
  ;(s as SVState & { rand: () => number }).rand = rand
  if (!teams && n <= s.opts.winners) s.finished = true
  if (teams) {
    const left = svTeamsLeft(s)
    if (left.length <= 1) {
      s.finished = true
      s.winningTeam = left[0] ?? 0
    }
  }
  return s
}

function eliminateTeam(s: SVState, team: number) {
  if (s.teamDead[team]) return
  s.teamDead[team] = true
  s.teamOut.push(team)
  s.queue[team] = []
  for (let i = 0; i < s.n; i++) {
    const b = s.balls[i]
    if (b.team !== team || b.state === 2) continue
    if (b.state === 1) s.out.push({ i, side: b.x < 0 ? -1 : 1 })
    b.state = 2
    s.order.push(i)
  }
}

function settleTeams(s: SVState, lost: number) {
  if (s.suddenDeath) {
    s.contenders = s.contenders.filter((t) => t !== lost && !s.teamDead[t])
    if (s.contenders.length === 1) {
      s.finished = true
      s.winningTeam = s.contenders[0]
      return
    }
  }
  const left = svTeamsLeft(s)
  if (left.length <= 1) {
    s.finished = true
    s.winningTeam = left[0] ?? s.contenders[0] ?? lost
  }
}

function rng(s: SVState) {
  return (s as SVState & { rand: () => number }).rand
}

function knockOut(s: SVState, i: number, side: -1 | 1) {
  const b = s.balls[i]
  b.state = 2
  s.order.push(i)
  s.out.push({ i, side })
  const team = b.team
  if (s.teamCount && s.captains[team] === i) {
    eliminateTeam(s, team)
    settleTeams(s, team)
    return
  }
  const q = s.queue[s.teamCount ? team : 0]
  const next = q.shift()
  if (next !== undefined) {
    const nb = s.balls[next]
    nb.state = 1
    nb.enterAt = s.time
    place(s, rng(s), nb, true)
    s.entered.push(next)
  }

  if (!s.teamCount) {
    if (svAlive(s) <= s.opts.winners) s.finished = true
    return
  }
  if (svAlive(s, team) === 0 && !s.teamDead[team]) {
    s.teamDead[team] = true
    s.teamOut.push(team)
  }
  settleTeams(s, team)
}

export function stepSV(s: SVState) {
  s.out = []
  s.entered = []
  s.shielded = []
  s.hits = []
  s.finalNow = false
  s.teamOut = []
  if (s.finished) return
  s.step++
  s.time = s.step * SV_STEP
  let waiting = 0
  for (const q of s.queue) waiting += q.length
  if (waiting === 0 || s.time > QUEUE_CAP) s.clock += SV_STEP

  if (!s.final && s.clock >= s.opts.duration) {
    s.final = true
    s.finalAt = s.time
    s.finalNow = true
    if (s.teamCount) {
      if (s.opts.rule === 'most') {
        const left = svTeamsLeft(s)
        let top = 0
        for (const t of left) top = Math.max(top, svAlive(s, t))
        const leaders = left.filter((t) => svAlive(s, t) === top)
        if (leaders.length <= 1) {
          s.finished = true
          s.winningTeam = leaders[0] ?? 0
          return
        }
        s.suddenDeath = true
        s.contenders = leaders
      }
    } else if (svAlive(s) <= s.opts.winners) {
      s.finished = true
      return
    }
  }

  const { balls, r, n } = s
  if (s.final && s.time - s.finalAt > FINAL_CAP) {
    // Safety net: whoever sits nearest a goal mouth drops first.
    let best = -1
    let bestD = 1e9
    for (let i = 0; i < n; i++) {
      if (balls[i].state !== 1) continue
      const d = SV_HW - Math.abs(balls[i].x)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    if (best >= 0) knockOut(s, best, balls[best].x < 0 ? -1 : 1)
    return
  }

  const speedUp = s.final ? 1.25 + Math.min(0.6, (s.time - s.finalAt) * 0.02) : 1
  s.phase += (0.62 + (waiting ? 0.25 : 0)) * speedUp * SV_STEP
  const goals = svGoals(s)
  const target = 0.78 * speedUp
  const maxSp = 1.5 * speedUp

  for (let i = 0; i < n; i++) {
    const b = balls[i]
    if (b.state !== 1) continue
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1e-6
    // Ease every ball towards a lively cruising speed so nobody parks in a corner.
    const want = sp < target ? sp + (target - sp) * 0.02 : sp > maxSp ? maxSp : sp
    b.vx *= want / sp
    b.vy *= want / sp
    b.x += b.vx * SV_STEP
    b.y += b.vy * SV_STEP

    if (b.y + r > SV_HH) {
      b.y = SV_HH - r
      if (b.vy > 0) b.vy = -b.vy
    } else if (b.y - r < -SV_HH) {
      b.y = -SV_HH + r
      if (b.vy < 0) b.vy = -b.vy
    }

    for (const g of goals) {
      const toward = g.side > 0 ? b.x + r > SV_HW : b.x - r < -SV_HW
      if (!toward) continue
      const inMouth = Math.abs(b.y - g.cy) < g.h - r * 0.35
      const safe = s.time - b.enterAt < SV_ENTER_GRACE || b.shieldUntil > s.time
      if (inMouth && !safe) {
        if (g.side * b.x > SV_HW + r * 0.15) {
          knockOut(s, i, g.side)
          if (s.finished) return
        }
      } else {
        b.x = g.side * (SV_HW - r)
        if (b.vx * g.side > 0) b.vx = -b.vx
        if (inMouth && safe) s.hits.push({ x: b.x + g.side * r, y: b.y, s: 0.6 })
      }
      for (const py of [g.cy - g.h, g.cy + g.h]) {
        const dx = b.x - g.side * SV_HW
        const dy = b.y - py
        const d = Math.sqrt(dx * dx + dy * dy) || 1e-6
        if (d < r + POST_R) {
          const nx = dx / d
          const ny = dy / d
          b.x = g.side * SV_HW + nx * (r + POST_R)
          b.y = py + ny * (r + POST_R)
          const vn = b.vx * nx + b.vy * ny
          if (vn < 0) {
            b.vx -= 2 * vn * nx
            b.vy -= 2 * vn * ny
            s.hits.push({ x: g.side * SV_HW, y: py, s: -vn })
          }
        }
      }
    }
  }

  const min = 2 * r
  const shieldOn = s.opts.teams && s.opts.shield
  for (let i = 0; i < n; i++) {
    const a = balls[i]
    if (a.state !== 1) continue
    for (let j = i + 1; j < n; j++) {
      const b = balls[j]
      if (b.state !== 1) continue
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
        // A touch more than elastic keeps the pitch chaotic.
        const k = rel * 1.04
        a.vx -= k * nx
        a.vy -= k * ny
        b.vx += k * nx
        b.vy += k * ny
        if (rel > 0.7) s.hits.push({ x: a.x + nx * r, y: a.y + ny * r, s: rel })
        if (shieldOn && a.team === b.team && a.shieldUntil < s.time && b.shieldUntil < s.time) {
          a.shieldUntil = s.time + SHIELD_SECONDS
          b.shieldUntil = s.time + SHIELD_SECONDS
          s.shielded.push(i, j)
        }
      }
    }
  }
}

/** Every entrant index that takes a prize: solo survivors, or the whole winning team (knocked out or not). */
export function svWinners(s: SVState) {
  if (s.opts.teams) return s.balls.flatMap((b, i) => (b.team === s.winningTeam ? [i] : []))
  return s.balls.flatMap((b, i) => (b.state !== 2 ? [i] : []))
}

/** Plays the whole round headless. */
export function runSV(opts: SVOptions) {
  const s = createSV(opts)
  while (!s.finished) stepSV(s)
  return { winners: svWinners(s), steps: s.step, order: s.order, winningTeam: s.winningTeam }
}
