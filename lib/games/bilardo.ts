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
/** Distance from the corner along each rail to the pocket jaw: a ~1.7 ball wide diagonal opening. */
export const CORNER_MOUTH = 29
/** Half width of a side pocket opening (~1.8 balls wide). */
export const SIDE_MOUTH = 22
export const MAX_SPEED = 42
const SUB = 8
// ~0.986 per frame, split across the substeps, so a hard break settles in a few seconds instead of gliding like ice.
const FRICTION = Math.pow(0.986, 1 / SUB)
/** Head string: on the break the cue ball may be placed anywhere behind (left of) this line. */
export const HEAD_X = W * 0.25
const FOLLOW_GAIN = 0.62
const ENGLISH_GAIN = 0.42
const RAIL_BOUNCE = 0.88
const JAW_BOUNCE = 0.6
const MAX_FRAMES = 6000
const BREAK_RAIL_BALLS = 4
export const MAX_FOULS = 3

export const FALLBACK_SEED = 'alkanka-bilardo'

/** Pocket centres, used for called pockets and for the drop animation. */
export const POCKETS = [
  [-4, -4],
  [W / 2, -6],
  [W + 4, -4],
  [-4, H + 4],
  [W / 2, H + 6],
  [W + 4, H + 4],
] as const
/** Drawn hole radius per pocket: reaches the jaws but stays inside the wooden rail. */
export const POCKET_HOLE = [33, 23, 33, 33, 23, 33] as const

/** Rounded jaw tips of every pocket. Balls bounce off them, so a ball that clips a jaw rattles out. */
const JAWS: readonly (readonly [number, number])[] = [
  [CORNER_MOUTH, 0], [0, CORNER_MOUTH],
  [W - CORNER_MOUTH, 0], [W, CORNER_MOUTH],
  [0, H - CORNER_MOUTH], [CORNER_MOUTH, H],
  [W - CORNER_MOUTH, H], [W, H - CORNER_MOUTH],
  [W / 2 - SIDE_MOUTH, 0], [W / 2 + SIDE_MOUTH, 0],
  [W / 2 - SIDE_MOUTH, H], [W / 2 + SIDE_MOUTH, H],
]

export type Ball = { id: number; x: number; y: number; vx: number; vy: number; in: boolean }
export type BallState = { id: number; x: number; y: number; vx: number; vy: number; inPocket: boolean }
export type Group = 'solid' | 'stripe'
export type Groups = [Group | null, Group | null]
export type Fouls = [number, number]
/** Cue-ball spin. `side` > 0 is right english, `follow` > 0 is top spin, < 0 is draw. */
export type Spin = { side: number; follow: number; applied: boolean }
/** Direction is sent as a vector (not an angle) so no client's Math.cos/sin can make replays diverge. */
export type ShotInput = { dx: number; dy: number; pow: number; spinX: number; spinY: number }
export type ShotEvents = { first: number | null; potted: number[]; pocketOf: Record<number, number>; rail: boolean; railBalls: number[] }
export type StepHooks = {
  hit?: (a: Ball, b: Ball, rel: number) => void
  rail?: (b: Ball, speed: number) => void
  pot?: (b: Ball, pocket: number) => void
}

export const groupOf = (id: number): Group | 'eight' | 'cue' => (id === 0 ? 'cue' : id === 8 ? 'eight' : id < 8 ? 'solid' : 'stripe')
export const groupName = (g: Group) => (g === 'solid' ? 'Düz' : 'Çizgili')

export const toState = (b: Ball): BallState => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, inPocket: b.in })
export const fromState = (b: BallState): Ball => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, in: !!b.inPocket })
export const newEvents = (): ShotEvents => ({ first: null, potted: [], pocketOf: {}, rail: false, railBalls: [] })
const clone = (balls: Ball[]) => balls.map((b) => ({ ...b }))

export function seeded(seedText: string) {
  let h = 2166136261
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/** Standard 8-ball rack: black in the middle of the third row, one solid and one stripe in the back corners. */
export function rack(rand: () => number = Math.random): Ball[] {
  const balls: Ball[] = [{ id: 0, x: W * 0.25, y: H / 2, vx: 0, vy: 0, in: false }]
  const shuffled = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]
    .map((id) => ({ id, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.id)
  const solid = shuffled.find((id) => id < 8)!
  const stripe = shuffled.find((id) => id > 8)!
  const corners = rand() < 0.5 ? [solid, stripe] : [stripe, solid]
  const rest = shuffled.filter((id) => id !== solid && id !== stripe)
  const apexX = W * 0.7
  let k = 0
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      const id = row === 2 && i === 1 ? 8 : row === 4 && i === 0 ? corners[0] : row === 4 && i === 4 ? corners[1] : rest[k++]
      balls.push({ id, x: apexX + row * R * 1.75, y: H / 2 + (i - row / 2) * R * 2.02, vx: 0, vy: 0, in: false })
    }
  }
  return balls
}

const dist = (dx: number, dy: number) => Math.sqrt(dx * dx + dy * dy)
const inHorizontalMouth = (x: number) => x < CORNER_MOUTH || x > W - CORNER_MOUTH || Math.abs(x - W / 2) < SIDE_MOUTH
const inVerticalMouth = (y: number) => y < CORNER_MOUTH || y > H - CORNER_MOUTH

function nearestPocket(x: number, y: number) {
  let best = 0
  let bd = Infinity
  for (let p = 0; p < POCKETS.length; p++) {
    const d = (x - POCKETS[p][0]) * (x - POCKETS[p][0]) + (y - POCKETS[p][1]) * (y - POCKETS[p][1])
    if (d < bd) ((bd = d), (best = p))
  }
  return best
}

function cushion(b: Ball, axis: 'x' | 'y', spin: Spin) {
  if (b.id === 0 && Math.abs(spin.side) > 0.01) {
    const sp = dist(b.vx, b.vy) || 1
    // English pushes the rebound toward the shooter's side of the spin, along the rail.
    const rx = -b.vy / sp
    const ry = b.vx / sp
    if (axis === 'y') {
      b.vy = -b.vy * RAIL_BOUNCE
      b.vx += rx * spin.side * ENGLISH_GAIN * sp
    } else {
      b.vx = -b.vx * RAIL_BOUNCE
      b.vy += ry * spin.side * ENGLISH_GAIN * sp
    }
    spin.side *= 0.6
    return
  }
  if (axis === 'y') b.vy = -b.vy * RAIL_BOUNCE
  else b.vx = -b.vx * RAIL_BOUNCE
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
      // Only pocket mouths have no cushion, so leaving the playing surface means the ball dropped.
      if (b.x < -1 || b.x > W + 1 || b.y < -1 || b.y > H + 1) {
        const p = nearestPocket(b.x, b.y)
        b.in = true
        b.vx = b.vy = 0
        ev.potted.push(b.id)
        ev.pocketOf[b.id] = p
        hooks?.pot?.(b, p)
        continue
      }
      const mouthX = inHorizontalMouth(b.x)
      const mouthY = inVerticalMouth(b.y)
      let railed = false
      if (b.x < R && !mouthY && b.vx < 0) ((b.x = R), cushion(b, 'x', spin), (railed = true))
      if (b.x > W - R && !mouthY && b.vx > 0) ((b.x = W - R), cushion(b, 'x', spin), (railed = true))
      if (b.y < R && !mouthX && b.vy < 0) ((b.y = R), cushion(b, 'y', spin), (railed = true))
      if (b.y > H - R && !mouthX && b.vy > 0) ((b.y = H - R), cushion(b, 'y', spin), (railed = true))
      if (mouthX || mouthY) {
        for (let j = 0; j < JAWS.length; j++) {
          const jx = b.x - JAWS[j][0]
          const jy = b.y - JAWS[j][1]
          const d2 = jx * jx + jy * jy
          if (d2 >= R * R || d2 === 0) continue
          const d = Math.sqrt(d2)
          const nx = jx / d
          const ny = jy / d
          b.x = JAWS[j][0] + nx * R
          b.y = JAWS[j][1] + ny * R
          const vn = b.vx * nx + b.vy * ny
          if (vn < 0) {
            b.vx -= (1 + JAW_BOUNCE) * vn * nx
            b.vy -= (1 + JAW_BOUNCE) * vn * ny
            railed = true
          }
        }
      }
      if (railed) {
        hooks?.rail?.(b, Math.hypot(b.vx, b.vy))
        if (ev.first !== null) ev.rail = true
        if (b.id !== 0 && !ev.railBalls.includes(b.id)) ev.railBalls.push(b.id)
      }
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]
      if (a.in) continue
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]
        if (b.in) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        if (dx > R * 2 || dx < -R * 2 || dy > R * 2 || dy < -R * 2) continue
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
        const imp = rel * 0.98
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

export function canPlaceCue(balls: Ball[], x: number, y: number, kitchen = false) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  if (kitchen && x > HEAD_X) return false
  if (x < R * 1.5 || x > W - R * 1.5 || y < R * 1.5 || y > H - R * 1.5) return false
  if (POCKETS.some(([px, py], i) => dist(px - x, py - y) < POCKET_HOLE[i] + R)) return false
  return balls.every((b) => b.id === 0 || b.in || dist(b.x - x, b.y - y) >= R * 2.1)
}

/** True when the seat's group is cleared and the next shot is on the black, which needs a called pocket. */
export function needsCall(balls: Ball[], groups: Groups, seat: number) {
  const g = groups[seat]
  return g !== null && balls.every((b) => groupOf(b.id) !== g || b.in)
}

/** Puts the cue ball back on the head spot (or the nearest free point on the head string). */
export function respotCue(balls: Ball[]) {
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
  fouls: Fouls
  keep: boolean
  foul: boolean
  /** The next player may place the cue ball anywhere. */
  ballInHand: boolean
  /** Illegal (weak or missed) break: the incoming player picks re-rack or accept the table. */
  illegalBreak: boolean
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
 * the first legal pot afterwards assigns groups (if both groups drop, the first ball down decides);
 * the black must be hit first and land in the called pocket; three fouls in a row lose the frame.
 */
export function resolveShot(
  balls: Ball[],
  ev: ShotEvents,
  o: { shooter: number; groups: Groups; broken: boolean; call: number | null; fouls?: Fouls },
): Resolution {
  const { shooter } = o
  const other = shooter === 0 ? 1 : 0
  const groups: Groups = [o.groups[0], o.groups[1]]
  const fouls: Fouls = [o.fouls?.[0] ?? 0, o.fouls?.[1] ?? 0]
  const mine = groups[shooter]
  const scratch = balls[0].in
  const objPotted = ev.potted.filter((id) => id !== 0 && id !== 8)
  const cleared = mine !== null && balls.every((b) => groupOf(b.id) !== mine || (b.in && !ev.potted.includes(b.id)))
  const base = { groups, assigned: null, winner: null, illegalBreak: false, fouls }
  const end = (winner: number, note: string): Resolution => ({ ...base, keep: false, foul: false, ballInHand: false, winner, note })
  const foul = (note: string, counts = true): Resolution => {
    if (scratch) respotCue(balls)
    if (counts) {
      fouls[shooter] += 1
      if (fouls[shooter] >= MAX_FOULS) return end(other, `${note} Üst üste ${MAX_FOULS}. faul, masa kaybedildi.`)
      if (fouls[shooter] === MAX_FOULS - 1) note += ` Üst üste ${MAX_FOULS - 1}. faul, bir faul daha masayı kaybettirir.`
    }
    return { ...base, keep: false, foul: true, ballInHand: true, note }
  }

  if (!o.broken) {
    const eight = ev.potted.includes(8)
    if (eight) respotEight(balls)
    const spotted = eight ? ' Siyah yerine kondu.' : ''
    if (scratch) return foul(`Açılışta beyaz düştü, faul.${spotted}`, false)
    if (ev.first === null || (objPotted.length === 0 && !eight && ev.railBalls.length < BREAK_RAIL_BALLS)) {
      const why = ev.first === null ? 'Açılışta hiçbir topa değmedi' : 'Zayıf açılış: en az 4 top banda gitmeli'
      return { ...base, keep: false, foul: true, ballInHand: false, illegalBreak: true, note: `${why}, faul.${spotted}` }
    }
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

  fouls[shooter] = 0
  let assigned: Group | null = null
  if (!mine && objPotted.length) {
    assigned = groupOf(objPotted[0]) as Group
    groups[shooter] = assigned
    groups[other] = assigned === 'solid' ? 'stripe' : 'solid'
  }
  const keep = objPotted.some((id) => groupOf(id) === groups[shooter])
  const note = assigned ? `${groupName(assigned)} toplar seçildi.` : keep ? 'Top düştü.' : 'Top düşmedi.'
  return { ...base, groups, fouls, assigned, keep, foul: false, ballInHand: false, note }
}

// ---------------------------------------------------------------------------------------------
// Bot

export type BotLevel = 'kolay' | 'orta' | 'zor'
export const BOT_LEVELS: { id: BotLevel; label: string }[] = [
  { id: 'kolay', label: 'Kolay' },
  { id: 'orta', label: 'Orta' },
  { id: 'zor', label: 'Zor' },
]
const AIM_NOISE: Record<BotLevel, number> = { kolay: 0.03, orta: 0.011, zor: 0.003 }
const SIM_BUDGET: Record<BotLevel, number> = { kolay: 8, orta: 36, zor: 90 }

/** True when the segment is free of balls (other than `skip`) for a ball of radius R travelling along it. */
export function clearPath(balls: Ball[], x1: number, y1: number, x2: number, y2: number, skip: number[]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy || 1
  for (const b of balls) {
    if (b.in || skip.includes(b.id)) continue
    const t = Math.max(0, Math.min(1, ((b.x - x1) * dx + (b.y - y1) * dy) / len2))
    if (Math.hypot(x1 + dx * t - b.x, y1 + dy * t - b.y) < R * 2.05) return false
  }
  return true
}

type Option = { target: number; pocket: number; angle: number; cut: number; dist: number }

/** Pocket aim point just inside the mouth, so corner shots aim between the jaws. */
function pocketAim(p: number): [number, number] {
  const [px, py] = POCKETS[p]
  return [Math.min(W - 4, Math.max(4, px)), Math.min(H - 4, Math.max(4, py))]
}

/** Every direct (no bank) pot available from the cue ball's position. */
function directOptions(balls: Ball[], cx: number, cy: number, legal: (b: Ball) => boolean): Option[] {
  const out: Option[] = []
  for (const t of balls) {
    if (!legal(t)) continue
    for (let p = 0; p < POCKETS.length; p++) {
      const [px, py] = pocketAim(p)
      const tx = px - t.x
      const ty = py - t.y
      const td = Math.hypot(tx, ty) || 1
      // Side pockets refuse steep approaches along the rail.
      if (p === 1 || p === 4) {
        if (Math.abs(ty) / td < 0.45) continue
      }
      const gx = t.x - (tx / td) * R * 2
      const gy = t.y - (ty / td) * R * 2
      const ax = gx - cx
      const ay = gy - cy
      const ad = Math.hypot(ax, ay) || 1
      const cut = (ax * tx + ay * ty) / (ad * td)
      if (cut < 0.3) continue
      if (!clearPath(balls, cx, cy, gx, gy, [0, t.id])) continue
      if (!clearPath(balls, t.x, t.y, px, py, [t.id])) continue
      out.push({ target: t.id, pocket: p, angle: Math.atan2(ay, ax), cut, dist: ad + td })
    }
  }
  return out
}

export const legalFor = (balls: Ball[], groups: Groups, seat: number) => {
  const mine = groups[seat]
  const onBlack = needsCall(balls, groups, seat)
  return (b: Ball) => !b.in && b.id !== 0 && (onBlack ? b.id === 8 : mine === null ? b.id !== 8 : groupOf(b.id) === mine)
}

export type BotPlan = { input: ShotInput; cue: { x: number; y: number } | null; call: number | null }

/**
 * Picks a shot by simulating candidates with the real engine. Stronger levels try more shots,
 * plan the cue ball for the next pot, play safeties when nothing is on and aim more precisely.
 */
export function planShot(
  start: Ball[],
  o: { seat: number; groups: Groups; broken: boolean; ballInHand: boolean; fouls?: Fouls; level: BotLevel; rand?: () => number },
): BotPlan {
  const rand = o.rand ?? Math.random
  const level = o.level
  const other = o.seat === 0 ? 1 : 0
  const cue0 = start[0]

  if (!o.broken) {
    const apex = start.filter((b) => b.id !== 0 && !b.in).sort((a, b) => a.x - b.x)[0]
    const off = (rand() - 0.5) * (level === 'kolay' ? 10 : 4)
    const ang = Math.atan2(apex.y - cue0.y + off, apex.x - cue0.x)
    return { input: { dx: Math.cos(ang), dy: Math.sin(ang), pow: level === 'kolay' ? 0.85 : 1, spinX: 0, spinY: 0 }, cue: null, call: null }
  }

  const onBlack = needsCall(start, o.groups, o.seat)
  const legal = legalFor(start, o.groups, o.seat)

  const cueSpots: { x: number; y: number }[] = [{ x: cue0.x, y: cue0.y }]
  if (o.ballInHand) {
    for (const t of start.filter(legal)) {
      for (let p = 0; p < POCKETS.length; p++) {
        const [px, py] = pocketAim(p)
        const d = Math.hypot(px - t.x, py - t.y) || 1
        for (const k of [5, 9]) {
          const x = t.x - ((px - t.x) / d) * R * k
          const y = t.y - ((py - t.y) / d) * R * k
          if (canPlaceCue(start, x, y)) cueSpots.push({ x, y })
        }
      }
    }
  }

  type Cand = { input: ShotInput; cue: { x: number; y: number } | null; call: number | null; pre: number }
  const cands: Cand[] = []
  const powers = level === 'kolay' ? [0] : level === 'orta' ? [0, 0.15] : [-0.1, 0, 0.18]
  const spins = level === 'zor' ? [0, -0.45, 0.4] : level === 'orta' ? [0, -0.3] : [0]
  for (const spot of cueSpots) {
    const placed = spot === cueSpots[0] ? null : spot
    for (const op of directOptions(start, spot.x, spot.y, legal)) {
      const basePow = Math.min(0.92, 0.22 + op.dist / 1700 + (1 - op.cut) * 0.25)
      for (const dp of powers) {
        for (const sy of spins) {
          cands.push({
            input: { dx: Math.cos(op.angle), dy: Math.sin(op.angle), pow: Math.max(0.12, Math.min(1, basePow + dp)), spinX: 0, spinY: sy },
            cue: placed,
            call: onBlack ? op.pocket : null,
            pre: op.cut * 2 - op.dist / 900 - Math.abs(dp) - Math.abs(sy) * 0.2,
          })
        }
      }
    }
  }
  cands.sort((a, b) => b.pre - a.pre)

  const evaluate = (c: Cand) => {
    const balls = clone(start)
    if (c.cue) ((balls[0].x = c.cue.x), (balls[0].y = c.cue.y))
    const ev = simulate(balls, c.input)
    let call = c.call
    if (onBlack && call === null && ev.pocketOf[8] !== undefined) call = ev.pocketOf[8]
    const r = resolveShot(balls, ev, { shooter: o.seat, groups: o.groups, broken: true, call, fouls: o.fouls })
    if (r.winner === o.seat) return { score: 1000, call }
    if (r.winner === other) return { score: -1000, call }
    if (r.foul) return { score: -300, call }
    if (r.keep) {
      const next = directOptions(balls, balls[0].x, balls[0].y, legalFor(balls, r.groups, o.seat))
      const bestCut = next.reduce((m, n) => Math.max(m, n.cut), 0)
      return { score: 200 + next.length * (level === 'kolay' ? 0 : 12) + bestCut * 40, call }
    }
    // Missed but legal: prefer leaving the rival as little as possible.
    const opp = directOptions(balls, balls[0].x, balls[0].y, legalFor(balls, r.groups, other))
    return { score: -40 - opp.length * 15 - opp.reduce((m, n) => Math.max(m, n.cut), 0) * 30, call }
  }

  let best: { c: Cand; score: number; call: number | null } | null = null
  const budget = SIM_BUDGET[level]
  for (const c of cands.slice(0, budget)) {
    const e = evaluate(c)
    if (!best || e.score > best.score) best = { c, score: e.score, call: e.call }
    if (level !== 'zor' && e.score >= 200) break
  }

  // Nothing pots: try banks and safeties by sweeping around the table.
  if (!best || best.score < 200) {
    const sweep = level === 'kolay' ? 10 : level === 'orta' ? 28 : 56
    const spot = best?.c.cue ?? (o.ballInHand ? cueSpots[cueSpots.length > 1 ? 1 : 0] : null)
    for (let i = 0; i < sweep; i++) {
      const ang = (i / sweep) * Math.PI * 2 + rand() * 0.05
      for (const pow of level === 'zor' ? [0.3, 0.55] : [0.45]) {
        const c: Cand = { input: { dx: Math.cos(ang), dy: Math.sin(ang), pow, spinX: 0, spinY: 0 }, cue: spot && spot !== cueSpots[0] ? spot : null, call: null, pre: 0 }
        const e = evaluate(c)
        if (!best || e.score > best.score) best = { c, score: e.score, call: e.call }
      }
    }
  }

  if (!best) {
    const ang = rand() * Math.PI * 2
    return { input: { dx: Math.cos(ang), dy: Math.sin(ang), pow: 0.5, spinX: 0, spinY: 0 }, cue: null, call: onBlack ? 0 : null }
  }
  const noise = (rand() - 0.5) * 2 * AIM_NOISE[level]
  const ang = Math.atan2(best.c.input.dy, best.c.input.dx) + noise
  const pow = Math.max(0.1, Math.min(1, best.c.input.pow * (level === 'kolay' ? 0.85 + rand() * 0.3 : 1)))
  let call = best.call
  if (onBlack && call === null) {
    const eight = start.find((b) => b.id === 8)!
    call = nearestPocket(eight.x, eight.y)
  }
  return { input: { ...best.c.input, dx: Math.cos(ang), dy: Math.sin(ang), pow }, cue: best.c.cue, call }
}
