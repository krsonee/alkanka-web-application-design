/*
  A throw, frame by frame, on a table that has depth. The table picture is seen from the shooter's end, so a die is
  placed on the felt in table units (across the table and down its length, both in die widths) and drawn where the
  picture's own perspective puts that spot: smaller the farther down the table it is.

  There is one pair of dice: the ones on the felt. They are swept into Jako's cup, and the same two come out of its
  mouth. A die leaves the cup small, flies down the table, hits the padded wall at the far end, comes back off it,
  lands on the felt twice with less height each time, then rolls over its own edges for the last one or two quarter
  turns and stops flat. Along the felt it slows down the whole way from the wall, with no jump in speed.

  The value it shows is decided before it is thrown. The turning is worked out backwards from the resting pose: the
  last quarter turns are undone first, then the tumble in the air, so the die always ends on the server's value. In
  the air it may meet the felt on a corner: it is lifted by however far its lowest corner reaches, so it never sinks
  into the table. While it rolls the same lift raises it over each edge.

  Nothing here re-renders: the elements of a die (the mover, the cube, the shade on each face, its shadow) are
  written to directly.
*/

import type { pacedFrames } from '@/lib/paced-frames'

/**
 * How a table picture is seen. A spot `gx` die widths right of the middle and `gz` die widths down the table is at
 * depth d = 1 + ed * gz, and is drawn at (vpx + s0 * gx / d) % of the stage's width and (vpy + k / d) % of its
 * height; a die there is s0 / d % of the stage's width.
 */
export type Table = {
  /** The point the table's long edges run toward, in % of the stage. */
  vpx: number
  vpy: number
  /** How far below that point the near end of the felt (d = 1) is, in % of the stage's height. */
  k: number
  /** A die's width at the near end, in % of the stage's width. */
  s0: number
  /** How much depth one die width down the table adds. */
  ed: number
  /** The depth at which a die meets the padded wall at the far end. */
  wall: number
  /** The depth the cup is held at. */
  cup: number
}

/*
  Measured on the wide table picture. Phones show the same table: the tall picture is the middle half of the wide
  one, set 14% down a 9 : 16 stage (so it is 56.25% of the stage's height) with the felt carried on below it. Its
  numbers follow from the wide one's: twice as wide, 0.5625 times as tall.

  `s0` and `ed` both go with how wide a die is against the table: 17.5 and 0.417 for a die as wide as one sixth of
  the felt's near end, times WIDE_DIE on the wide stage and TALL_DIE on phones.
*/
const WIDE_DIE = 0.88
const TALL_DIE = 0.63
const WIDE: Table = { vpx: 50.1, vpy: 27, k: 73, s0: 17.5 * WIDE_DIE, ed: 0.417 * WIDE_DIE, wall: 4.7, cup: 1.5 }
const TALL_TOP = 14
const TALL_PART = 0.5625

export const TABLES: { wide: Table; tall: Table } = {
  wide: WIDE,
  tall: {
    vpx: 50,
    vpy: TALL_TOP + WIDE.vpy * TALL_PART,
    k: WIDE.k * TALL_PART,
    s0: 17.5 * 2 * TALL_DIE,
    ed: 0.417 * TALL_DIE,
    wall: WIDE.wall,
    /* the cup is held nearer than the near end of the picture's felt */
    cup: 0.8,
  },
}

/**
 * The camera looks down on the dice by this much: steep enough for a die's top face, the one that counts, to be
 * the face seen best.
 */
const PITCH = 52
/** How much of a height shows on screen at that angle. */
const LIFT = Math.cos((PITCH * Math.PI) / 180)
/** How far above its spot on the felt a resting die's middle is drawn, in die widths. */
export const REST_RISE = 0.5 * LIFT

/** Where a die resting at (gx, gz) touches the felt, in % of the stage, and its width in % of the stage's width. */
export function restSpot(table: Table, gx: number, gz: number) {
  const d = 1 + table.ed * gz
  return { left: table.vpx + (table.s0 * gx) / d, top: table.vpy + table.k / d, size: table.s0 / d }
}

/* ---- turning: 3 x 3 matrices, row by row, in the browser's axes (x right, y down, z toward the viewer) ---- */

type Mat = number[]
type Vec = [number, number, number]

const RAD = Math.PI / 180

function mul(a: Mat, b: Mat): Mat {
  const out = new Array<number>(9)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]
  }
  return out
}

function turn([x, y, z]: Vec, deg: number): Mat {
  const c = Math.cos(deg * RAD)
  const s = Math.sin(deg * RAD)
  const t = 1 - c
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c]
}

const AX: Vec = [1, 0, 0]
const AY: Vec = [0, 1, 0]

/** The cube's own turn (around X, then Y) that brings a value to the front; lying() then tips that face up. */
const FRONT: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  5: [-90, 0],
  2: [90, 0],
}

const VIEW = turn(AX, -PITCH)

/**
 * A die lying on the felt with `value` on top, the way a thrown die is read, turned `lean` degrees about the
 * upright so two of its sides show as well.
 */
const lying = (value: number, lean: number) => mul(turn(AY, lean), mul(turn(AX, 90 + FRONT[value][0]), turn(AY, FRONT[value][1])))

const n4 = (v: number) => (Math.abs(v) < 0.00005 ? '0' : v.toFixed(4))

function css(o: Mat) {
  const m = mul(VIEW, o)
  return `matrix3d(${n4(m[0])},${n4(m[3])},${n4(m[6])},0,${n4(m[1])},${n4(m[4])},${n4(m[7])},0,${n4(m[2])},${n4(m[5])},${n4(m[8])},0,0,0,0,1)`
}

/** The faces' outward directions on the cube, in the order die.tsx draws them: 1, 6, 3, 4, 5, 2. */
const NORMALS: Vec[] = [
  [0, 0, 1],
  [0, 0, -1],
  [1, 0, 0],
  [-1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
]
/**
 * The lamp hangs right over the table, a little toward the viewer and to the left: a die's top face is its
 * brightest, and its sides are in half shade, so the top is what the eye reads.
 */
const LAMP: Vec = [-0.24, -0.93, 0.28]

/** How dark each face is (0 to 1) for a cube turned by `o`: faces turned from the lamp are in shade. */
function shadesOf(o: Mat) {
  return NORMALS.map(([x, y, z]) => {
    const lit = (o[0] * x + o[1] * y + o[2] * z) * LAMP[0] + (o[3] * x + o[4] * y + o[5] * z) * LAMP[1] + (o[6] * x + o[7] * y + o[8] * z) * LAMP[2]
    return lit >= 0 ? 0.62 * (1 - Math.min(1, lit)) ** 1.5 : 0.62 + 0.14 * Math.min(1, -lit)
  })
}

/** The cube's transform at rest, showing `value`. */
export const restPose = (value: number, lean: number) => css(lying(value, lean))
/** How dark each of its faces is at rest. */
export const restShades = (value: number, lean: number) => shadesOf(lying(value, lean)).map((v) => Number(v.toFixed(3)))

/** How far below its middle the cube's lowest corner reaches, in die widths (0.5 when it lies flat). */
const reach = (o: Mat) => 0.5 * (Math.abs(o[3]) + Math.abs(o[4]) + Math.abs(o[5]))

/* ---- the die on the stage ---- */

export type DieRig = {
  /** Carries the die over the stage: position and size. */
  mover: HTMLElement
  /** The cube itself: only turns. */
  cube: HTMLElement
  /** The dark layer over each face, in the order of NORMALS. */
  faces: HTMLElement[]
  /** The shadow on the felt: follows the die along the ground. */
  shade: HTMLElement
  /** How far the resting cube is turned away from the viewer, so two of its sides show. */
  lean: number
  /** Where it rests on the felt, in table units. */
  at: [number, number]
}

/** The stage as it is on screen for one move. */
export type Scene = {
  table: Table
  /** The stage's size, in pixels. */
  width: number
  height: number
  /** The cup's mouth on the stage, in pixels. */
  from: { x: number; y: number }
  /** How wide a die is while it is inside the cup, in pixels. */
  inCup: number
}

type Frames = ReturnType<typeof pacedFrames>

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const arc = (s: number) => 4 * s * (1 - s)

function play(frames: Frames, ms: number, draw: (elapsed: number) => void) {
  return new Promise<void>((done) => {
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const elapsed = Math.min(ms, now - start)
      draw(elapsed)
      if (elapsed < ms) frames.request(tick)
      else done()
    }
    frames.request(tick)
  })
}

/** A spot on the felt, on screen: where it is (pixels), and how wide a die is there. */
function onFelt(scene: Scene, gx: number, gz: number) {
  const { table } = scene
  const d = 1 + table.ed * gz
  return { x: ((table.vpx + (table.s0 * gx) / d) * scene.width) / 100, y: ((table.vpy + table.k / d) * scene.height) / 100, size: ((table.s0 / d) * scene.width) / 100 }
}

function paint(rig: DieRig, o: Mat) {
  rig.cube.style.transform = css(o)
  const shades = shadesOf(o)
  for (let i = 0; i < rig.faces.length; i++) rig.faces[i].style.opacity = shades[i].toFixed(3)
}

/** Puts a die down where it rests, showing `value`: no motion. */
export function settle(rig: DieRig, value: number) {
  rig.mover.style.translate = '0 0'
  rig.mover.style.scale = '1'
  rig.mover.style.opacity = '1'
  paint(rig, lying(value, rig.lean))
  rig.shade.style.translate = '0 0'
  rig.shade.style.scale = '1'
  rig.shade.style.opacity = '1'
}

/** The second die goes into the cup a moment after the first. */
const SCOOP_GAP_MS = 70

/**
 * The dice on the felt jump into Jako's cup (scene.from: its rim) and are gone: the table is clear for the next
 * throw. `onIn` is called as each one drops in.
 */
export function scoop(frames: Frames, rigs: DieRig[], values: number[], scene: Scene, onIn: (die: number) => void, ms = 460) {
  const inside = rigs.map(() => false)
  const starts = rigs.map((rig) => {
    const spot = onFelt(scene, rig.at[0], rig.at[1])
    return { x: spot.x, y: spot.y - REST_RISE * spot.size, size: spot.size, o: lying(values[rigs.indexOf(rig)], rig.lean) }
  })
  return play(frames, ms + SCOOP_GAP_MS * (rigs.length - 1), (elapsed) => {
    rigs.forEach((rig, i) => {
      const start = starts[i]
      const u = clamp01((elapsed - i * SCOOP_GAP_MS) / ms)
      /* slow off the felt, fast into the cup */
      const e = u * u * (3 - 2 * u)
      const lift = Math.sin(Math.PI * u) * (1 - 0.35 * u)
      const dx = (scene.from.x - start.x) * e
      const dy = (scene.from.y - start.y) * e
      rig.mover.style.translate = `${dx.toFixed(1)}px ${(dy - 0.9 * lift * start.size).toFixed(1)}px`
      rig.mover.style.scale = `${mix(1, scene.inCup / start.size, e).toFixed(3)}`
      /* it drops below the rim at the very end */
      rig.mover.style.opacity = `${1 - clamp01((u - 0.86) / 0.14)}`
      paint(rig, mul(turn(AY, (i ? -260 : 260) * e), mul(turn(AX, -270 * e), start.o)))
      rig.shade.style.translate = `${(0.25 * dx).toFixed(1)}px ${(0.25 * dy).toFixed(1)}px`
      rig.shade.style.scale = `${1 + 0.6 * lift}`
      rig.shade.style.opacity = `${Math.max(0, 1 - 2.2 * u)}`
      if (u >= 1 && !inside[i]) {
        inside[i] = true
        onIn(i)
      }
    })
  })
}

/** What a die met: the padded wall, the felt out of the air, or the felt as it rolled over an edge onto a face. */
export type Hit = 'wall' | 'felt' | 'flop'

/*
  How the die slows down along the felt on its way back from the wall: fast off the wall, so it is seen coming up
  the table (the far end is drawn small, and a die that lingers there looks stuck to the wall).
*/
const SLOWING = 2.6
/** Flying down the table to the wall takes this long; the second die leaves the cup a moment after the first. */
const OUT_MS = 430
const STAGGER_MS = 95
/** Over an edge a rolling cube is slowest at the top of it and fastest as it comes down flat. */
const OVER_EDGE = 0.42
/** The last quarter turn is over this many die widths before the die stops. */
const FLAT_EARLY = 0.06
/** The swung cup's mouth points to the right: a die leaves it that way before it heads down the table (die widths). */
const KICK: [number, number] = [0.85, -0.12]

type Plan = {
  /** Where the throw starts, where it meets the wall, where the rolling starts and where it ends (table units). */
  cup: [number, number]
  cupHeight: number
  wall: [number, number]
  wallHeight: number
  roll: [number, number]
  rest: [number, number]
  /** How far it is from the wall to where the rolling starts, and from the wall to its resting place. */
  air: number
  length: number
  /** The way it rolls at the end: the way it faces. */
  facing: [number, number]
  /** How high the arc down the table, the first bounce and the second go, in die widths. */
  peaks: [number, number, number]
  /** When it lands on the felt, as fractions of the way back; the third is where the rolling starts. */
  lands: [number, number, number]
  backMs: number
  /** What the two tumbles in the air turn around, and how fast (degrees a second) on each stretch. */
  outAxis: Vec
  backAxis: Vec
  rollAxis: Vec
  rates: [number, number, number, number]
  /** Its pose as the rolling starts, and at rest. */
  rolling: Mat
  resting: Mat
  /** How far the cup's mouth is from where the table says the throw starts, on screen. */
  slip: { x: number; y: number }
  /** Its resting place on screen. */
  home: { x: number; y: number; ground: number; size: number }
}

const norm = ([x, y, z]: Vec): Vec => {
  const len = Math.hypot(x, y, z) || 1
  return [x / len, y / len, z / len]
}
/** What a die going (dx, dz) along the felt turns around when it tumbles forward (dz: down the table). */
const forward = (dx: number, dz: number, wobble: number): Vec => norm([dz + rand(-wobble, wobble), rand(-wobble, wobble) * 1.3, dx + rand(-wobble, wobble)])

function plan(scene: Scene, rig: DieRig, value: number, index: number): Plan {
  const { table } = scene
  const rest = rig.at
  const lean = rig.lean * RAD
  /* it faces the way it rolled: the last quarter turns bring the face it shows over onto the top */
  const facing: [number, number] = [Math.sin(lean), -Math.cos(lean)]
  const wallZ = (table.wall - 1) / table.ed
  const quarters = wallZ - rest[1] > 4.2 && Math.random() < 0.6 ? 2 : 1
  const roll: [number, number] = [rest[0] - quarters * facing[0], rest[1] - quarters * facing[1]]
  /* the two dice meet the wall apart from each other, each roughly ahead of where it will stop */
  const wall: [number, number] = [mix(roll[0], 0, 0.35) + (index ? 0.5 : -0.5) + rand(-0.35, 0.35), wallZ]
  const air = Math.hypot(wall[0] - roll[0], wall[1] - roll[1])
  const length = air + quarters

  const cupZ = (table.cup - 1) / table.ed
  const mouth = onFelt(scene, 0, cupZ)
  const cup: [number, number] = [((scene.from.x / scene.width) * 100 - table.vpx) * (table.cup / table.s0), cupZ]
  const cupHeight = Math.max(0, (mouth.y - scene.from.y) / (mouth.size * LIFT) - 0.7)
  const start = onFelt(scene, cup[0], cup[1])

  const third = 1 - (quarters / length) ** (1 / SLOWING)
  const home = onFelt(scene, rest[0], rest[1])
  const resting = lying(value, rig.lean)
  const rollAxis: Vec = [facing[1], 0, facing[0]]
  return {
    cup,
    cupHeight,
    wall,
    wallHeight: rand(0.12, 0.42),
    roll,
    rest,
    air,
    length,
    facing,
    peaks: [rand(0.7, 0.95), rand(0.5, 0.64), rand(0.17, 0.24)],
    lands: [third * rand(0.34, 0.38), third * rand(0.72, 0.76), third],
    backMs: 1120 + 130 * quarters + rand(-40, 40),
    outAxis: forward(wall[0] - cup[0], wall[1] - cup[1], 0.3),
    backAxis: forward(roll[0] - wall[0], roll[1] - wall[1], 0.4),
    rollAxis,
    rates: [rand(640, 820), rand(560, 700), rand(430, 520), rand(300, 360)],
    rolling: mul(turn(rollAxis, -90 * quarters), resting),
    resting,
    slip: { x: scene.from.x - start.x, y: scene.from.y - (start.y - start.size * LIFT * (cupHeight + 0.7)) },
    home: { x: home.x, y: home.y - REST_RISE * home.size, ground: home.y, size: home.size },
  }
}

type Marks = { wall: boolean; landed: number; flops: number; flopAt: number }

function pose(scene: Scene, rig: DieRig, p: Plan, ms: number, marks: Marks, hit: (kind: Hit, power: number) => void) {
  if (ms <= 0) {
    rig.mover.style.opacity = '0'
    rig.shade.style.opacity = '0'
    return
  }
  let gx: number
  let gz: number
  let height: number
  let o: Mat
  /* seconds since it last met the felt, for the press of a landing */
  let since = 1
  /* 0 inside the cup, 1 once it is as big as the table makes it */
  let grown = 1
  let slip = 0
  let kick = 0
  let ground = 1

  if (ms < OUT_MS) {
    const u = ms / OUT_MS
    kick = arc(u) * (1 - u) ** 1.5
    /* it is still picking up the swing as it leaves the cup, and is at full speed when it meets the wall */
    const along = u ** 1.3
    gx = mix(p.cup[0], p.wall[0], along)
    gz = mix(p.cup[1], p.wall[1], along)
    height = mix(p.cupHeight, p.wallHeight, u) + p.peaks[0] * arc(u)
    const atWall = mul(turn(p.backAxis, -tumbleLeft(p, 0)), p.rolling)
    o = mul(turn(p.outAxis, (-p.rates[0] * (OUT_MS - ms)) / 1000), atWall)
    grown = clamp01(u / 0.7) ** 1.5
    slip = (1 - u) ** 3
    /* the felt is not under the cup: the shadow appears as the die comes over the table */
    ground = clamp01((u - 0.12) / 0.35)
  } else {
    if (!marks.wall) {
      marks.wall = true
      hit('wall', 1)
    }
    const u = clamp01((ms - OUT_MS) / p.backMs)
    const [t1, t2, t3] = p.lands
    const gone = p.length * (1 - (1 - u) ** SLOWING)
    if (gone <= p.air) {
      gx = mix(p.wall[0], p.roll[0], gone / p.air)
      gz = mix(p.wall[1], p.roll[1], gone / p.air)
    } else {
      gx = p.roll[0] + p.facing[0] * (gone - p.air)
      gz = p.roll[1] + p.facing[1] * (gone - p.air)
    }
    while (marks.landed < 3 && u >= p.lands[marks.landed]) {
      hit('felt', [1, 0.6, 0.34][marks.landed])
      marks.landed += 1
    }
    if (u < t1) {
      const s = u / t1
      /* off the wall it pops up a little before it drops */
      height = p.wallHeight * (1 - s * s) + 0.12 * arc(s)
    } else if (u < t2) {
      height = p.peaks[1] * arc((u - t1) / (t2 - t1))
      since = ((u - t1) * p.backMs) / 1000
    } else if (u < t3) {
      height = p.peaks[2] * arc((u - t2) / (t3 - t2))
      since = ((u - t2) * p.backMs) / 1000
    } else {
      height = 0
      since = ((u - t3) * p.backMs) / 1000
    }
    if (u < t3) {
      o = mul(turn(p.backAxis, -tumbleLeft(p, u)), p.rolling)
    } else {
      /*
        quarter turns still to go: it rolls one die width of felt to each. The last one comes down onto its face
        with some speed left (a knock, not a creep), a moment before the die stops sliding.
      */
      const left = Math.max(0, (p.length * (1 - u) ** SLOWING - FLAT_EARLY) / (1 - FLAT_EARLY))
      const whole = Math.floor(left)
      const part = left - whole
      o = mul(turn(p.rollAxis, -90 * (whole + part + (OVER_EDGE / (2 * Math.PI)) * Math.sin(2 * Math.PI * part))), p.resting)
      const done = Math.round(p.length - p.air) - Math.ceil(left - 0.0001)
      while (marks.flops < done) {
        marks.flops += 1
        marks.flopAt = ms
        hit('flop', marks.flops === done && left === 0 ? 0.45 : 0.3)
      }
      if (marks.flops) since = Math.min(since, (ms - marks.flopAt) / 1000)
    }
  }

  const spot = onFelt(scene, gx, gz)
  const size = mix(scene.inCup, spot.size, grown)
  const x = spot.x + p.slip.x * slip + KICK[0] * kick * p.home.size
  const y = spot.y - spot.size * LIFT * (height + reach(o)) + p.slip.y * slip + KICK[1] * kick * p.home.size
  /* a landing presses the die into the felt for a moment */
  const press = since < 0.055 ? 1 - since / 0.055 : 0
  const scale = size / p.home.size

  rig.mover.style.opacity = `${clamp01(ms / 30)}`
  rig.mover.style.translate = `${(x - p.home.x).toFixed(1)}px ${(y - p.home.y + 0.05 * press * size).toFixed(1)}px`
  rig.mover.style.scale = `${(scale * (1 + 0.05 * press)).toFixed(3)} ${(scale * (1 - 0.1 * press)).toFixed(3)}`
  paint(rig, o)
  rig.shade.style.translate = `${(x - p.home.x).toFixed(1)}px ${(spot.y - p.home.ground + p.slip.y * slip).toFixed(1)}px`
  rig.shade.style.scale = `${(scale * (1 + 0.55 * height)).toFixed(3)}`
  rig.shade.style.opacity = `${(0.95 * ground) / (1 + 2 * height)}`
}

/** How many degrees of tumbling are still to come before the rolling starts, `u` of the way back from the wall. */
function tumbleLeft(p: Plan, u: number) {
  const [t1, t2, t3] = p.lands
  const seconds = p.backMs / 1000
  return (Math.max(0, t1 - u) * p.rates[1] + Math.max(0, t2 - Math.max(u, t1)) * p.rates[2] + Math.max(0, t3 - Math.max(u, t2)) * p.rates[3]) * seconds
}

/**
 * Throws the dice so they come to rest on `values`. `onHit` is called with the die, what it met and how hard
 * (1 to 0) each time it meets the wall or the felt.
 */
export function throwDice(frames: Frames, rigs: DieRig[], values: number[], scene: Scene, onHit: (die: number, kind: Hit, power: number) => void) {
  const plans = rigs.map((rig, i) => plan(scene, rig, values[i], i))
  const marks: Marks[] = rigs.map(() => ({ wall: false, landed: 0, flops: 0, flopAt: 0 }))
  const total = Math.max(...plans.map((p, i) => OUT_MS + p.backMs + i * STAGGER_MS))
  return play(frames, total, (elapsed) => {
    rigs.forEach((rig, i) => {
      const ms = Math.min(elapsed - i * STAGGER_MS, OUT_MS + plans[i].backMs)
      pose(scene, rig, plans[i], ms, marks[i], (kind, power) => onHit(i, kind, power))
    })
  }).then(() => rigs.forEach((rig, i) => settle(rig, values[i])))
}

/** A good throw: the dice jump once where they lie, turn right round and come back down on the same faces. */
export function hop(frames: Frames, rigs: DieRig[], values: number[], onLand: (die: number) => void, ms = 620) {
  const down = rigs.map(() => false)
  return play(frames, ms, (elapsed) => {
    rigs.forEach((rig, i) => {
      const u = clamp01((elapsed - i * 70) / (ms - 70 * (rigs.length - 1)))
      const height = 0.55 * arc(u)
      rig.mover.style.translate = `0 ${(-LIFT * height * rig.mover.offsetWidth).toFixed(1)}px`
      rig.mover.style.scale = `${1 + 0.07 * height}`
      paint(rig, lying(values[i], rig.lean + (i ? -360 : 360) * (1 - (1 - u) ** 2)))
      rig.shade.style.scale = `${1 + 0.55 * height}`
      rig.shade.style.opacity = `${0.95 / (1 + 2 * height)}`
      if (u >= 1 && !down[i]) {
        down[i] = true
        onLand(i)
      }
    })
  }).then(() => rigs.forEach((rig, i) => settle(rig, values[i])))
}
