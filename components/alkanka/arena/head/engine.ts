import type { SoundName } from '@/lib/sound'

/* ------------------------------------------------------------------ */
/*  Head ball engine: fixed 60 Hz step, pure data, no DOM.             */
/*  The host (or solo client) is the only one that runs stepWorld.     */
/* ------------------------------------------------------------------ */

export type Sport = 'futbol' | 'basket'
export type BotLevel = 'easy' | 'mid' | 'hard'
export type PowerId = 'fire' | 'ice' | 'giant' | 'shrink' | 'ghost' | 'shield'
export type Stats = { speed: number; jump: number; shot: number; head: number; power: number }
export type Character = {
  id: string
  name: string
  title: string
  img: string
  stats: Stats
  power: PowerId
  /** Trophies needed to pick this character. Every roster spends the same 15 stat points, so unlocks add variety, not an edge. */
  unlock: number
  /** The portrait art looks to the left; it is mirrored when the player faces right. */
  facesLeft: boolean
}

export const W = 960
export const H = 540
export const GROUND = 482
export const STEP_MS = 1000 / 60
/** At 40 a head was nearly as tall as the goal mouth (108); 35 keeps the cartoon look with saner proportions. */
export const HEAD_R = 35
/** Distance from the head centre (normal size) to the sole. */
export const FOOT = HEAD_R + 30
export const BALL_R = 17
export const MATCH_SECONDS = 90
export const OVERTIME_SECONDS = 30
export const CAMP_LIMIT = 180
export const SHOT_CLOCK_STEPS = 720
export const CHARGE_MAX = 30
export const COUNTDOWN_STEPS = 135
/** A goal mouth just over one player tall: a standing keeper covers most of it, so goals need a real chance. */
export const GOAL_TOP = GROUND - 108
/** Invisible roof: the ball never flies up into the stands. */
export const CEIL = 150
export const GOAL_DEPTH = 74
export const RIM_Y = 236
export const RIM_W = 84
export const NET_H = 52
export const BOARD_X = 40
export const THREE_DIST = 330
export const METER_MAX = 100

export const rimOf = (side: 0 | 1) =>
  side === 0 ? { a: BOARD_X + 8, b: BOARD_X + 8 + RIM_W } : { a: W - BOARD_X - 8 - RIM_W, b: W - BOARD_X - 8 }

export const POWERS: Record<PowerId, { name: string; desc: string; kind: 'shot' | 'instant'; color: string }> = {
  fire: { name: 'Ateş Şutu', desc: 'Sonraki şutun alev topuna döner, önüne çıkanı savurur.', kind: 'shot', color: '#ff7a1a' },
  ice: { name: 'Buz Kalıbı', desc: 'Rakibini 2 saniye buz kalıbına hapseder.', kind: 'instant', color: '#7fd3ff' },
  giant: { name: 'Dev Kafa', desc: '5 saniye boyunca kafan devleşir, kaleyi kapatır.', kind: 'instant', color: '#e5b93e' },
  shrink: { name: 'Küçült', desc: 'Rakibinin kafası 5 saniye minicik olur.', kind: 'instant', color: '#c4a1ff' },
  ghost: { name: 'Hayalet Top', desc: 'Sonraki şutun rakibine neredeyse görünmez gider.', kind: 'shot', color: '#d6ecff' },
  shield: { name: 'Kale Duvarı', desc: 'Kalen 4,5 saniye taş duvarla kapanır.', kind: 'instant', color: '#b7c0ca' },
}

export const CHARACTERS: Character[] = [
  { id: 'jako', name: 'Jako', title: 'Kaptan', img: '/images/sprites/head-jako.png', stats: { speed: 4, jump: 4, shot: 3, head: 3, power: 1 }, power: 'fire', unlock: 0, facesLeft: false },
  { id: 'kurt', name: 'Kurt', title: 'Golcü', img: '/images/sprites/head-rival.png', stats: { speed: 4, jump: 2, shot: 4, head: 2, power: 3 }, power: 'ice', unlock: 0, facesLeft: true },
  { id: 'aslan', name: 'Aslan', title: 'Kral', img: '/images/sprites/head-aslan.png', stats: { speed: 2, jump: 3, shot: 5, head: 3, power: 2 }, power: 'giant', unlock: 120, facesLeft: true },
  { id: 'boga', name: 'Boğa', title: 'Tank', img: '/images/sprites/head-boga.png', stats: { speed: 2, jump: 2, shot: 4, head: 5, power: 2 }, power: 'shield', unlock: 300, facesLeft: true },
  { id: 'kartal', name: 'Kartal', title: 'Hava Hakimi', img: '/images/sprites/head-kartal.png', stats: { speed: 3, jump: 5, shot: 2, head: 4, power: 1 }, power: 'shrink', unlock: 600, facesLeft: true },
  { id: 'panter', name: 'Panter', title: 'Hayalet', img: '/images/sprites/head-panter.png', stats: { speed: 5, jump: 3, shot: 3, head: 2, power: 2 }, power: 'ghost', unlock: 1000, facesLeft: true },
]

export const charAt = (i: number) => CHARACTERS[i] ?? CHARACTERS[0]

export const TEAM = {
  home: { jersey: '#e5b93e', trim: '#1a1a1a', shorts: '#16181d', boot: '#e5b93e' },
  away: { jersey: '#2f6fd1', trim: '#ffffff', shorts: '#0f2a56', boot: '#ffffff' },
}

export type Keys = { left: boolean; right: boolean; jump: boolean; kick: boolean; power: boolean }
export const noKeys = (): Keys => ({ left: false, right: false, jump: false, kick: false, power: false })

export type Player = {
  x: number
  y: number
  vx: number
  vy: number
  face: 1 | -1
  kick: number
  run: number
  charge: number
  power: number
  camp: number
  ch: number
  meter: number
  /** A shot-type power is loaded and fires with the next kick. */
  armed: number
  frozen: number
  stun: number
  grow: number
  shrink: number
  shield: number
  /** Kickoff hold: the side that just scored waits while the other side takes the ball. */
  hold: number
}

/** fx: 0 normal, 1 fireball, 2 ghost. owner: seat of the last toucher. */
export type Ball = { x: number; y: number; vx: number; vy: number; rot: number; fx: number; fxT: number; owner: number }

export const FX = { dust: 1, confetti: 2, ice: 3, fire: 4, spark: 5, grass: 6, smoke: 7, kickHit: 8, headHit: 9 } as const
export type MatchStats = { shots: [number, number]; headers: [number, number]; poss: [number, number]; powers: [number, number] }
export const newStats = (): MatchStats => ({ shots: [0, 0], headers: [0, 0], poss: [0, 0], powers: [0, 0] })
export type EventName = SoundName | 'h0' | 'h1' | 'hb' | 'shake' | 'fx'
/** [name, value, x, y]. `fx` carries an FX code in value; `shake` carries the strength. */
export type NetEvent = [EventName, number, number?, number?]

export type World = {
  sport: Sport
  p: [Player, Player]
  ball: Ball
  sc: [number, number]
  elapsed: number
  overtime: boolean
  countdown: number
  pause: number
  slow: number
  flash: string
  flashT: number
  /** Seat that caused the flash (the scorer), -1 for neutral messages. */
  flashSeat: number
  stats: MatchStats
  banner: string
  bannerSeat: number
  bannerT: number
  resets: number
  shot: { seat: 0 | 1; x: number } | null
  clockSeat: number
  clockSteps: number
  celebrate: { scorer: 0 | 1; t: number } | null
  /** Last contact type, used to decide whether a goal earns the slow-motion replay. */
  touch: 'kick' | 'head' | 'body'
  netShake: [number, number]
  anchor: { x: number; y: number }
  stuck: number
  corner: number
  /** Steps the ball has stayed inside a small area, wherever it is: catches a ball pinned on the ground between a player and a wall. */
  stall: number
  stallAt: { x: number; y: number }
  events: NetEvent[]
}

export const clamp = (v: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v) || 0))
export const statsOf = (p: Player) => charAt(p.ch).stats
export const onGround = (p: Player) => p.y >= GROUND - FOOT - 0.5
export const headR = (p: Player) => HEAD_R * (p.grow > 0 ? 1.42 : 1) * (p.shrink > 0 ? 0.62 : 1)
/** The head sits on the neck, so a bigger head grows upward and a smaller one shrinks down onto the body. */
export const headY = (p: Player) => p.y + HEAD_R - headR(p)

export function newPlayer(face: 1 | -1, ch: number): Player {
  return { x: 0, y: 0, vx: 0, vy: 0, face, kick: 0, run: 0, charge: 0, power: 1, camp: 0, ch, meter: 0, armed: 0, frozen: 0, stun: 0, grow: 0, shrink: 0, shield: 0, hold: 0 }
}

export function newWorld(sport: Sport, ch0: number, ch1: number): World {
  const w: World = {
    sport,
    p: [newPlayer(1, ch0), newPlayer(-1, ch1)],
    ball: { x: 0, y: 0, vx: 0, vy: 0, rot: 0, fx: 0, fxT: 0, owner: -1 },
    sc: [0, 0],
    elapsed: 0,
    overtime: false,
    countdown: COUNTDOWN_STEPS,
    pause: 0,
    slow: 0,
    flash: '',
    flashT: 0,
    flashSeat: -1,
    stats: newStats(),
    banner: '',
    bannerSeat: 0,
    bannerT: 0,
    resets: 0,
    shot: null,
    clockSeat: -1,
    clockSteps: 0,
    celebrate: null,
    touch: 'body',
    netShake: [0, 0],
    anchor: { x: 0, y: 0 },
    stuck: 0,
    corner: 0,
    stall: 0,
    stallAt: { x: 0, y: 0 },
    events: [],
  }
  resetPositions(w, 0)
  return w
}

const emit = (w: World, name: EventName, v = 1, x?: number, y?: number) => {
  w.events.push(x === undefined ? [name, v] : [name, v, x, y])
}

export function resetPositions(w: World, serveTo: 0 | 1) {
  const [a, b] = w.p
  const base = { y: GROUND - FOOT, vx: 0, vy: 0, kick: 0, charge: 0, power: 1, camp: 0, frozen: 0, stun: 0, hold: 0 }
  Object.assign(a, base, { x: 230, face: 1 })
  Object.assign(b, base, { x: W - 230, face: -1 })
  // Kickoff: the ball rests on the centre spot instead of dropping from the sky straight onto someone's boot.
  Object.assign(w.ball, { x: W / 2, y: GROUND - BALL_R, vx: 0, vy: 0, fx: 0, fxT: 0, owner: -1 })
  w.touch = 'body'
  void serveTo
  w.anchor = { x: w.ball.x, y: w.ball.y }
  w.stuck = 0
  w.corner = 0
  w.stall = 0
  w.stallAt = { x: w.ball.x, y: w.ball.y }
  w.shot = null
  w.clockSeat = -1
  w.clockSteps = 0
}

export const timeLeft = (w: World) => Math.max(0, MATCH_SECONDS + (w.overtime ? OVERTIME_SECONDS : 0) - Math.floor(w.elapsed / 60))

/* ------------------------------ players ------------------------------ */

export function stepPlayer(p: Player, input: Keys, sport: Sport) {
  const st = statsOf(p)
  if (p.frozen > 0) p.frozen--
  if (p.stun > 0) p.stun--
  if (p.grow > 0) p.grow--
  if (p.shrink > 0) p.shrink--
  if (p.shield > 0) p.shield--
  if (p.hold > 0) p.hold--
  const locked = p.frozen > 0 || p.stun > 0 || p.hold > 0
  const k = locked ? noKeys() : input
  const grounded = onGround(p)
  const top = 5.1 + 0.38 * st.speed
  const target = (k.right ? top : 0) - (k.left ? top : 0)
  if (p.stun > 0) p.vx *= 0.95
  else p.vx += (target - p.vx) * (p.frozen > 0 ? 0.3 : grounded ? 0.4 : 0.22)
  if (Math.abs(p.vx) < 0.05) p.vx = 0
  if (target) p.face = target > 0 ? 1 : -1
  // About 35% lower than before: a jump clears a head, it never reaches the stands.
  if (k.jump && grounded) p.vy = -(9.8 + 0.34 * st.jump)
  // Hold to charge, release to shoot: a tap is a normal shot, a half-second hold hits up to 35% harder.
  if (k.kick) p.charge = Math.min(CHARGE_MAX, p.charge + 1)
  else if (p.charge > 0) {
    if (p.kick <= 0) {
      p.kick = 16
      p.power = 1 + 0.35 * (p.charge / CHARGE_MAX)
    }
    p.charge = 0
  }
  if (locked) p.charge = 0
  if (p.kick > 0) p.kick--
  // Falling a bit faster than rising gives jumps a snappy, weighty arc.
  p.vy += p.vy > 0 ? 0.72 : 0.6
  p.x += p.vx
  p.y += p.vy
  if (p.y < CEIL + HEAD_R) {
    p.y = CEIL + HEAD_R
    p.vy = Math.max(0, p.vy)
  }
  if (p.y > GROUND - FOOT) {
    p.y = GROUND - FOOT
    p.vy = 0
  }
  if (onGround(p) && p.vx) p.run += Math.abs(p.vx) * 0.12
  const margin = sport === 'futbol' ? GOAL_DEPTH * 0.55 : 24
  p.x = Math.max(HEAD_R + margin, Math.min(W - HEAD_R - margin, p.x))
}

/** Anti camping: 3 s inside your own goal (or under your own hoop) and the referee walks you back out. */
export function campRule(p: Player, side: 0 | 1, sport: Sport, onWhistle: () => void) {
  const out = side === 0 ? 1 : -1
  const zone = sport === 'futbol' ? GOAL_DEPTH + HEAD_R * 0.6 : BOARD_X + 8 + RIM_W + 20
  if (p.camp >= CAMP_LIMIT) {
    p.x += out * 7
    p.vx = 0
    if (side === 0 ? p.x > zone + 150 : p.x < W - zone - 150) p.camp = 0
    return
  }
  const inGoal = side === 0 ? p.x < zone : p.x > W - zone
  if (inGoal) {
    p.camp++
    if (p.camp === CAMP_LIMIT) onWhistle()
  } else p.camp = Math.max(0, p.camp - 2)
}

/**
 * Solid body-to-body contact. Players are tall capsules (head to boot), so a jumper can never sit inside or on top of
 * the rival: landing on a head slides you off to the side, and a running bump transfers momentum like a shoulder charge.
 */
export function separatePlayers(a: Player, b: Player, sport: Sport = 'futbol') {
  let dx = b.x - a.x
  const dy = b.y - a.y
  // Matches the drawn width of head plus shoulders, so the two sprites never visibly overlap.
  const minX = Math.max(headR(a), HEAD_R) + Math.max(headR(b), HEAD_R) + 8
  if (Math.abs(dx) >= minX || Math.abs(dy) >= HEAD_R + FOOT + 10) return
  if (Math.abs(dx) < 0.5) dx = a.face === 1 ? 0.5 : -0.5
  const s = dx > 0 ? 1 : -1
  const top = dy < -HEAD_R ? b : dy > HEAD_R ? a : null
  if (top && top.vy > -1) {
    const under = top === a ? b : a
    const away = top.x >= under.x ? 1 : -1
    top.vy = -6.5
    top.vx = away * 5.5
    top.y = Math.min(top.y, under.y - HEAD_R * 1.7)
  }
  const push = (minX - Math.abs(dx)) / 2
  a.x -= push * s
  b.x += push * s
  const closing = (a.vx - b.vx) * s
  if (closing > 0) {
    const mid = (a.vx + b.vx) / 2
    a.vx = mid - s * 1.4
    b.vx = mid + s * 1.4
  }
  // A player pinned against the wall passes the overlap on to the rival instead of both staying stacked.
  const margin = sport === 'futbol' ? GOAL_DEPTH * 0.55 : 24
  const lo = HEAD_R + margin
  const hi = W - HEAD_R - margin
  for (const [p, q] of [
    [a, b],
    [b, a],
  ] as const) {
    if (p.x < lo) {
      q.x += lo - p.x
      p.x = lo
    } else if (p.x > hi) {
      q.x -= p.x - hi
      p.x = hi
    }
  }
}

/* ------------------------------ ball ------------------------------ */

function collideCircle(b: Ball, cx: number, cy: number, r: number, pvx: number, pvy: number, e: number) {
  const dx = b.x - cx
  const dy = b.y - cy
  const dist = Math.hypot(dx, dy) || 0.001
  const min = r + BALL_R
  if (dist >= min) return null
  const nx = dx / dist
  const ny = dy / dist
  b.x = cx + nx * min
  b.y = cy + ny * min
  const rvx = b.vx - pvx
  const rvy = b.vy - pvy
  const dot = rvx * nx + rvy * ny
  if (dot < 0) {
    b.vx -= (1 + e) * dot * nx
    b.vy -= (1 + e) * dot * ny
  }
  b.vx += pvx * 0.3
  b.vy += Math.min(0, pvy) * 0.3
  return { nx, ny, rel: Math.hypot(rvx, rvy) }
}

/** Capsule collider (a segment with thickness r). Returns the impact speed, 0 when there was no hit. */
function hitSegment(b: Ball, ax: number, ay: number, bx: number, by: number, r: number, e: number) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((b.x - ax) * dx + (b.y - ay) * dy) / len2))
  const cx = ax + dx * t
  const cy = ay + dy * t
  let nx = b.x - cx
  let ny = b.y - cy
  const d = Math.hypot(nx, ny)
  const min = r + BALL_R
  if (d >= min) return 0
  if (d < 1e-4) {
    nx = 0
    ny = -1
  } else {
    nx /= d
    ny /= d
  }
  b.x = cx + nx * min
  b.y = cy + ny * min
  const vn = b.vx * nx + b.vy * ny
  if (vn >= 0) return 0
  b.vx -= (1 + e) * vn * nx
  b.vy -= (1 + e) * vn * ny
  return -vn
}

function endFire(w: World) {
  const b = w.ball
  if (b.fx !== 1) return
  b.fx = 0
  b.fxT = 0
  emit(w, 'fx', FX.smoke, b.x, b.y)
}

function collideWorld(w: World) {
  const b = w.ball
  const basket = w.sport === 'basket'
  if (b.y > GROUND - BALL_R) {
    const impact = b.vy
    b.y = GROUND - BALL_R
    b.vy *= basket ? -0.78 : -0.58
    b.vx *= 0.95
    if (Math.abs(b.vy) < 1.4) b.vy = 0
    if (impact > 2.5) {
      emit(w, basket ? 'dribble' : 'bounce', impact / 14)
      if (impact > 9 && !basket) emit(w, 'fx', FX.grass, b.x, GROUND)
    }
  }
  if (b.y < CEIL + BALL_R) {
    b.y = CEIL + BALL_R
    b.vy = Math.abs(b.vy) * 0.6
  }
  if (b.x < BALL_R || b.x > W - BALL_R) {
    if (Math.abs(b.vx) > 3) emit(w, 'bounce', Math.abs(b.vx) / 16)
    const side = b.x < BALL_R ? 1 : -1
    b.x = side === 1 ? BALL_R : W - BALL_R
    b.vx = side * Math.max(2, Math.abs(b.vx) * 0.75)
    endFire(w)
  }
  if (!basket) {
    for (const side of [0, 1] as const) {
      const postX = side === 0 ? GOAL_DEPTH : W - GOAL_DEPTH
      const back = side === 0 ? 0 : W
      const bar = hitSegment(b, back, GOAL_TOP, postX, GOAL_TOP, 5, 0.55)
      if (bar > 2.5) {
        emit(w, 'post', bar / 14)
        endFire(w)
      }
      // A ball resting on the crossbar rolls back into play instead of balancing there forever.
      if (Math.abs(b.y - (GOAL_TOP - 5 - BALL_R)) < 2 && (side === 0 ? b.x < postX : b.x > postX)) b.vx += side === 0 ? 0.18 : -0.18
      if (w.p[side].shield > 0) {
        const s = hitSegment(b, postX, GOAL_TOP + 4, postX, GROUND, 9, 0.75)
        if (s > 2) {
          emit(w, 'board', s / 12)
          emit(w, 'fx', FX.spark, b.x, b.y)
          endFire(w)
        }
      }
    }
    return
  }
  for (const side of [0, 1] as const) {
    const bx = side === 0 ? BOARD_X : W - BOARD_X
    // The gap between backboard and wall is narrower than the ball, so treat it as solid instead of letting the ball wedge in.
    const behindBoard = side === 0 ? b.x < bx + BALL_R + 5 : b.x > bx - BALL_R - 5
    if (b.y > RIM_Y - 112 && b.y < RIM_Y + 18 && behindBoard) {
      b.x = side === 0 ? bx + BALL_R + 5 : bx - BALL_R - 5
      b.vx = (side === 0 ? 1 : -1) * Math.max(1.5, Math.abs(b.vx) * 0.7)
      emit(w, 'board', Math.hypot(b.vx, b.vy) / 14)
      endFire(w)
    }
    const rim = rimOf(side)
    const r1 = hitSegment(b, rim.a, RIM_Y, rim.a, RIM_Y, 4, 0.55)
    const r2 = hitSegment(b, rim.b, RIM_Y, rim.b, RIM_Y, 4, 0.55)
    if (r1 + r2 > 2) emit(w, 'rim', (r1 + r2) / 14)
    // A ball rising into the net from below is turned back down, so it can never drop through the hoop afterwards.
    if (b.vy < 0 && b.x > rim.a && b.x < rim.b && b.y > RIM_Y && b.y - BALL_R < RIM_Y + NET_H) {
      b.y = RIM_Y + NET_H + BALL_R
      b.vy = Math.abs(b.vy) * 0.35
    }
    if (w.p[side].shield > 0) {
      const s = hitSegment(b, rim.a - 6, RIM_Y - 8, rim.b + 6, RIM_Y - 8, 7, 0.7)
      if (s > 2) {
        emit(w, 'board', s / 12)
        emit(w, 'fx', FX.spark, b.x, b.y)
        endFire(w)
      }
    }
  }
}

function stepBall(w: World) {
  const b = w.ball
  if (b.fxT > 0 && --b.fxT === 0) {
    if (b.fx === 1) emit(w, 'fx', FX.smoke, b.x, b.y)
    b.fx = 0
  }
  const g = b.fx === 1 ? 0.07 : w.sport === 'basket' ? 0.42 : 0.45
  // Two substeps keep a 27 px/step rocket from tunnelling through the 5 px posts.
  for (let i = 0; i < 2; i++) {
    b.vy += g / 2
    b.x += b.vx / 2
    b.y += b.vy / 2
    collideWorld(w)
  }
  if (b.fx !== 1) b.vx *= 0.996
  if (b.vy === 0 && b.y >= GROUND - BALL_R - 0.5) b.vx *= w.sport === 'futbol' ? 0.985 : 0.99
  const cap = b.fx === 1 ? 26 : 18
  const sp = Math.hypot(b.vx, b.vy)
  if (sp > cap) {
    b.vx *= cap / sp
    b.vy *= cap / sp
  }
  b.rot += b.vx / BALL_R
}

/** Returns true when the player touched the ball this step. */
function hitBall(w: World, seat: 0 | 1): boolean {
  const p = w.p[seat]
  const b = w.ball
  const st = statsOf(p)
  const r = headR(p)
  const hy = headY(p)
  const basket = w.sport === 'basket'

  // A rival's fireball goes straight through and knocks the player flying.
  if (b.fx === 1 && b.owner !== seat) {
    const hitHead = Math.hypot(b.x - p.x, b.y - hy) < r + BALL_R
    const hitBody = Math.abs(b.x - p.x) < 22 + BALL_R && b.y > hy && b.y < p.y + FOOT + BALL_R
    if (hitHead || hitBody) {
      if (p.stun <= 0) {
        p.stun = 48
        p.vx = Math.sign(b.vx || 1) * 10
        p.vy = -7.5
        w.resets++
        emit(w, 'fx', FX.fire, p.x, hy)
        emit(w, 'shake', 9)
        emit(w, 'pocket', 1)
        emit(w, seat === 0 ? 'h0' : 'h1', 60)
      }
      return false
    }
  }

  const footX = p.x + p.face * 28
  const footY = p.y + FOOT - 12
  if (p.kick > 5 && Math.hypot(b.x - footX, b.y - footY) < BALL_R + 32) {
    // Softer than before so a keeper can actually react to a shot from midfield.
    const base = basket ? 10.5 + 0.35 * st.shot : 8.6 + 0.55 * st.shot
    const pw = base * p.power
    const above = footY - b.y
    const airborne = !onGround(p)
    if (basket) {
      b.vx = p.face * pw
      b.vy = -15 * (1 + (p.power - 1) * 0.6)
    } else if (airborne && above > 22) {
      // Volley: flat, fast and hard to read.
      b.vx = p.face * pw * 1.12
      b.vy = -2.2 - (p.power - 1) * 7
    } else if (above > 44) {
      b.vx = p.face * pw * 0.92
      b.vy = -7.2
    } else {
      b.vx = p.face * pw
      b.vy = -8 - (p.power - 1) * 9
    }
    b.vx += p.vx * 0.35
    b.x = footX + p.face * (BALL_R + 4)
    b.owner = seat
    w.touch = 'kick'
    let rocket = false
    if (p.armed) {
      const id = charAt(p.ch).power
      p.armed = 0
      if (id === 'fire') {
        b.fx = 1
        b.fxT = 60
        b.vx = p.face * 24
        b.vy = basket ? -9 : -1.2
        rocket = true
        emit(w, 'pocket', 1)
        emit(w, 'shake', 7)
        emit(w, 'fx', FX.fire, b.x, b.y)
      } else if (id === 'ghost') {
        b.fx = 2
        b.fxT = 80
        b.vx *= 1.1
        emit(w, 'sent', 1)
      }
    }
    p.kick = 4
    p.meter = Math.min(METER_MAX, p.meter + 3.5 * (0.8 + 0.1 * st.power))
    w.stats.shots[seat]++
    emit(w, 'kick', 0.55 + (p.power - 1) * 1.3)
    emit(w, seat === 0 ? 'h0' : 'h1', p.power > 1.2 || rocket ? 35 : 18)
    emit(w, 'fx', FX.dust, footX, footY + 8)
    emit(w, 'fx', FX.kickHit, b.x, b.y)
    if (p.power > 1.25 && !rocket) emit(w, 'shake', 3)
    p.power = 1
    return true
  }

  const head = collideCircle(b, p.x, hy, r, p.vx, p.vy, 0.7 + 0.03 * st.head)
  if (head) {
    const airborne = !onGround(p)
    // Headers aim forward: a ball dropping onto the head is steered toward the rival goal, harder when jumping into it.
    if (head.ny < -0.45) {
      b.vx += p.face * (0.7 + 0.25 * st.head) * (airborne ? 1.2 : 0.7)
      if (airborne && p.vy < 0) b.vy += p.vy * 0.22 - 0.35 * st.head
    }
    if (head.ny < -0.85 && Math.abs(b.vx) < 1.2) b.vx += p.face * 2.2
    b.owner = seat
    if (head.rel > 4) w.touch = 'head'
    if (b.fx === 1) endFire(w)
    p.meter = Math.min(METER_MAX, p.meter + 2 * (0.8 + 0.1 * st.power))
    if (head.rel > 3) {
      emit(w, 'header', head.rel / 16)
      if (head.rel > 6) {
        // Only a real header counts: the player went for it and sent the ball forward, not a bounce off a standing head.
        if ((airborne || Math.abs(p.vx) > 2) && b.vx * p.face > 1.5) w.stats.headers[seat]++
        emit(w, 'fx', FX.headHit, p.x + head.nx * r, hy + head.ny * r)
      }
    }
    return true
  }
  const body = collideCircle(b, p.x, p.y + FOOT - 34, 15, p.vx, p.vy, 0.45)
  const foot = collideCircle(b, p.x, p.y + FOOT - 8, 12, p.vx, p.vy, 0.35)
  if (body || foot) {
    b.owner = seat
    w.touch = 'body'
    return true
  }
  return false
}

/* ------------------------------ powers ------------------------------ */

export function activatePower(w: World, seat: 0 | 1) {
  const p = w.p[seat]
  const o = w.p[seat === 0 ? 1 : 0]
  if (p.meter < METER_MAX || p.frozen > 0 || p.stun > 0 || p.armed) return false
  const id = charAt(p.ch).power
  p.meter = 0
  w.stats.powers[seat]++
  if (id === 'fire' || id === 'ghost') p.armed = 1
  else if (id === 'ice') {
    o.frozen = 120
    o.charge = 0
    emit(w, 'fx', FX.ice, o.x, headY(o))
    emit(w, 'post', 0.7)
    emit(w, seat === 0 ? 'h1' : 'h0', 90)
  } else if (id === 'giant') {
    p.grow = 300
    emit(w, 'start', 0.8)
  } else if (id === 'shrink') {
    o.shrink = 300
    emit(w, 'fx', FX.spark, o.x, headY(o))
  } else if (id === 'shield') {
    p.shield = 270
    emit(w, 'board', 1)
    emit(w, 'shake', 4)
  }
  w.banner = POWERS[id].name
  w.bannerSeat = seat
  w.bannerT = 90
  emit(w, 'spin', 0.8)
  emit(w, 'fx', FX.spark, p.x, headY(p))
  return true
}

/* ------------------------------ scoring ------------------------------ */

function score(w: World, scorer: 0 | 1, pts: number, label: string, goalX: number, goalY: number) {
  w.sc[scorer] += pts
  emit(w, w.sport === 'futbol' ? 'net' : 'swish')
  emit(w, 'whistle')
  emit(w, 'cheer')
  emit(w, 'hb', 80)
  emit(w, 'shake', 10)
  emit(w, 'fx', FX.confetti, goalX, goalY)
  w.flash = w.overtime ? (w.sport === 'futbol' ? 'ALTIN GOL!' : 'ALTIN BASKET!') : label
  w.flashT = 0
  w.flashSeat = scorer
  w.netShake[goalX < W / 2 ? 0 : 1] = 40
  // A small boost for the conceding side; big enough to matter, too small to hand back a lead on its own.
  const loser = w.p[scorer === 0 ? 1 : 0]
  loser.meter = Math.min(METER_MAX, loser.meter + 5)
  // Only special goals get the slow-motion replay: a header, a long-range strike, or a goal in the final seconds.
  const longShot = w.shot?.seat === scorer && Math.abs(w.shot.x - goalX) > W * 0.5
  const late = w.overtime || timeLeft(w) <= 5
  const nice = w.sport === 'futbol' && (w.touch === 'head' || longShot || late)
  w.celebrate = { scorer, t: nice ? 75 : 55 }
  w.slow = nice ? 55 : 0
  w.shot = null
}

function basket(w: World, scorer: 0 | 1, hoop: 0 | 1) {
  const rim = rimOf(hoop)
  const cx = (rim.a + rim.b) / 2
  const shooter = w.p[scorer]
  const three = w.shot?.seat === scorer && Math.abs(w.shot.x - cx) > THREE_DIST
  const dunk = !three && Math.hypot(shooter.x - cx, shooter.y - RIM_Y) < 120
  if (dunk) {
    emit(w, 'board', 0.9)
    emit(w, 'rim', 0.8)
  }
  score(w, scorer, three ? 3 : 2, three ? 'ÜÇLÜK!' : dunk ? 'SMAÇ!' : 'BASKET!', cx, RIM_Y)
}

/* ------------------------------ world step ------------------------------ */

/** Players stand still during stoppages; the scorer's celebration is drawn (arms up), never a physics jump. */
function idle(w: World) {
  for (const s of [0, 1] as const) stepPlayer(w.p[s], noKeys(), w.sport)
}

/**
 * Advances the match one 60 Hz step. Power flags are edge triggered (true only on the press step).
 * Remote players are written into w.p[1] by the caller before this runs.
 */
export function stepWorld(w: World, k0: Keys, k1: Keys, power0: boolean, power1: boolean) {
  if (w.flash) {
    w.flashT++
    if (w.flashT > 80 && !w.celebrate) w.flash = ''
  }
  if (w.bannerT > 0) w.bannerT--
  if (w.slow > 0) w.slow--
  if (w.netShake[0] > 0) w.netShake[0]--
  if (w.netShake[1] > 0) w.netShake[1]--

  if (w.countdown > 0) {
    w.countdown--
    if (w.countdown > 0 && w.countdown % 45 === 0) emit(w, 'tick', 1)
    if (w.countdown === 0) {
      w.flash = 'BAŞLA!'
      w.flashT = 0
      emit(w, 'whistle')
    }
    idle(w)
    return
  }
  if (w.pause > 0) {
    w.pause--
    idle(w)
    return
  }
  if (w.celebrate) {
    const c = w.celebrate
    c.t--
    idle(w)
    stepBall(w)
    if (c.t <= 0) {
      w.celebrate = null
      w.flash = ''
      w.flashSeat = -1
      resetPositions(w, c.scorer === 0 ? 1 : 0)
      w.pause = 45
      w.resets++
    }
    return
  }

  w.elapsed++
  if (power0) activatePower(w, 0)
  if (power1) activatePower(w, 1)
  for (const s of [0, 1] as const) {
    const p = w.p[s]
    // About 50 s to fill from passive time alone; touches make it roughly a twice-per-half moment.
    p.meter = Math.min(METER_MAX, p.meter + 0.028 * (0.8 + 0.1 * statsOf(p).power))
  }
  const [a, b] = w.p
  stepPlayer(a, k0, w.sport)
  stepPlayer(b, k1, w.sport)
  campRule(a, 0, w.sport, () => emit(w, 'whistle', 0.7))
  campRule(b, 1, w.sport, () => emit(w, 'whistle', 0.7))
  separatePlayers(a, b, w.sport)
  separatePlayers(a, b, w.sport)
  const prevY = w.ball.y
  stepBall(w)
  const t0 = hitBall(w, 0)
  if (t0) w.shot = { seat: 0, x: a.x }
  const t1 = hitBall(w, 1)
  if (t1) w.shot = { seat: 1, x: b.x }
  const ball = w.ball
  // A ball squeezed between two players pops up into open air instead of being shoved through one of them.
  if (t0 && t1 && Math.abs(a.x - b.x) < HEAD_R * 3.2) {
    ball.x = (a.x + b.x) / 2
    ball.y = Math.min(ball.y, Math.min(headY(a), headY(b)) - HEAD_R - BALL_R - 6)
    ball.vx *= 0.25
    ball.vy = -8
    w.touch = 'body'
    w.shot = null
  }
  // Possession goes to whoever is closest to a live ball, not to whoever it last bounced off.
  const d0 = Math.hypot(ball.x - a.x, ball.y - a.y)
  const d1 = Math.hypot(ball.x - b.x, ball.y - b.y)
  if (Math.min(d0, d1) < 170 && Math.abs(d0 - d1) > 12) w.stats.poss[d0 < d1 ? 0 : 1]++
  if (ball.y > GROUND - BALL_R) ball.y = GROUND - BALL_R

  // Shot clock: whoever last touched the ball has 12 s to score, otherwise possession flips.
  if (w.sport === 'basket') {
    const holder = w.shot?.seat ?? -1
    if (holder !== w.clockSeat) {
      w.clockSeat = holder
      w.clockSteps = 0
    } else if (holder !== -1 && ++w.clockSteps >= SHOT_CLOCK_STEPS) {
      emit(w, 'whistle', 0.9)
      w.flash = 'ATIŞ SÜRESİ!'
      w.flashT = 0
      w.pause = 60
      resetPositions(w, holder === 0 ? 1 : 0)
      w.resets++
      return
    }
  }

  // Unjam: a ball that barely moves while airborne (head rest, crossbar, wedged at a wall) is dropped back in.
  if (Math.hypot(ball.x - w.anchor.x, ball.y - w.anchor.y) > 8) {
    w.anchor = { x: ball.x, y: ball.y }
    w.stuck = 0
  } else if (ball.y < GROUND - BALL_R - 4 || ball.x < BALL_R + 30 || ball.x > W - BALL_R - 30) {
    if (++w.stuck > 100) dropBall(w)
  }
  // Any ball that stays in one small patch for 3 s (pinned on the ground, two players leaning on it) restarts from the centre.
  if (Math.hypot(ball.x - w.stallAt.x, ball.y - w.stallAt.y) > 70) {
    w.stallAt = { x: ball.x, y: ball.y }
    w.stall = 0
  } else if (++w.stall > 180) {
    emit(w, 'whistle', 0.7)
    w.flash = 'HAKEM TOPU ATTI'
    w.flashT = 0
    w.flashSeat = -1
    dropBall(w)
    return
  }
  if (w.sport === 'basket' && (ball.x < 110 || ball.x > W - 110) && ball.y > GROUND - 160) {
    if (++w.corner > 180) dropBall(w)
  } else w.corner = 0

  if (w.sport === 'futbol') {
    // The whole ball has to cross the line, like the real rule.
    if (ball.x < GOAL_DEPTH - BALL_R && ball.y > GOAL_TOP + 8) score(w, 1, 1, 'GOL!', GOAL_DEPTH / 2, GOAL_TOP + 60)
    else if (ball.x > W - GOAL_DEPTH + BALL_R && ball.y > GOAL_TOP + 8) score(w, 0, 1, 'GOL!', W - GOAL_DEPTH / 2, GOAL_TOP + 60)
  } else if (prevY < RIM_Y && ball.y >= RIM_Y && ball.vy > 0) {
    const L = rimOf(0)
    const R = rimOf(1)
    if (ball.x > L.a + 3 && ball.x < L.b - 3) basket(w, 1, 0)
    else if (ball.x > R.a + 3 && ball.x < R.b - 3) basket(w, 0, 1)
  }
}

/** Tap or key press during a goal: jump straight to the kickoff. */
export function skipCelebration(w: World) {
  if (!w.celebrate || w.celebrate.t <= 1) return
  w.celebrate.t = 1
  w.slow = 0
}

function dropBall(w: World) {
  Object.assign(w.ball, { x: W / 2, y: CEIL + 40, vx: (Math.random() - 0.5) * 3, vy: 0, fx: 0, fxT: 0 })
  w.anchor = { x: w.ball.x, y: w.ball.y }
  w.stuck = 0
  w.corner = 0
  w.stall = 0
  w.stallAt = { x: w.ball.x, y: w.ball.y }
  w.shot = null
}

/**
 * Runs the referee after a frame's steps. Returns true when the final whistle blows.
 * A level match gets golden-goal extra time once; still level after that is a draw.
 */
export function refereeCheck(w: World) {
  if (w.celebrate || w.countdown > 0) return false
  if (w.overtime && w.sc[0] !== w.sc[1]) return true
  if (timeLeft(w) > 0) return false
  if (w.sc[0] === w.sc[1] && !w.overtime) {
    w.overtime = true
    w.elapsed = MATCH_SECONDS * 60
    w.countdown = COUNTDOWN_STEPS
    w.banner = w.sport === 'futbol' ? 'UZATMA · ALTIN GOL' : 'UZATMA · ALTIN BASKET'
    w.bannerSeat = -1
    w.bannerT = 140
    resetPositions(w, Math.random() < 0.5 ? 0 : 1)
    w.resets++
    emit(w, 'whistle')
    return false
  }
  return true
}

/* ------------------------------ prediction (bot) ------------------------------ */

/** Cheap ballistic forecast ignoring players: positions for the next `steps` steps. */
export function predictBall(b: Ball, sport: Sport, steps: number) {
  const out: { x: number; y: number }[] = []
  let { x, y, vx, vy } = b
  const g = b.fx === 1 ? 0.07 : sport === 'basket' ? 0.42 : 0.45
  for (let i = 0; i < steps; i++) {
    vy += g
    x += vx
    y += vy
    if (b.fx !== 1) vx *= 0.996
    if (y < CEIL + BALL_R) {
      y = CEIL + BALL_R
      vy = Math.abs(vy) * 0.6
    }
    if (y > GROUND - BALL_R) {
      y = GROUND - BALL_R
      vy *= sport === 'basket' ? -0.78 : -0.58
      vx *= 0.95
      if (Math.abs(vy) < 1.4) vy = 0
    }
    if (x < BALL_R) {
      x = BALL_R
      vx = Math.max(2, Math.abs(vx) * 0.75)
    } else if (x > W - BALL_R) {
      x = W - BALL_R
      vx = -Math.max(2, Math.abs(vx) * 0.75)
    }
    out.push({ x, y })
  }
  return out
}
