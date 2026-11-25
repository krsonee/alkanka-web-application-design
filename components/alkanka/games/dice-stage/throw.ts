/*
  A throw, frame by frame. There is one pair of dice: the ones on the felt. They are swept into Jako's cup, and the
  same two come out of its mouth. --from-x / --from-y, set by the stage on the die's resting place, is where the
  cup's mouth is from there: its rim while the cup stands, its opening once it is tipped. A die is small while it
  is inside the cup, grows as it comes out, flies in an arc, lands three times with less height each time and
  slides to a stop while it twists on the felt. The value it shows is decided before it is thrown: the tumbling is
  laid over the resting pose and runs out exactly when the die stops, so it always ends on the server's value,
  lying flat.

  At every landing the cube is turned by a whole number of quarter turns from its resting pose, so it meets the
  felt on a face, never on a corner pushed through the table.

  Nothing here re-renders: the three elements of a die (the mover, the cube, its shadow) are written to directly.
*/

import type { pacedFrames } from '@/lib/paced-frames'

export type DieRig = {
  /** Carries the die over the stage: position, height and size. */
  mover: HTMLElement
  /** The cube itself: only turns. */
  cube: HTMLElement
  /** The shadow on the felt: follows the die along the ground. */
  shade: HTMLElement
  /** How far the resting cube is turned away from the viewer, so two of its sides show. */
  lean: number
}

type Frames = ReturnType<typeof pacedFrames>

/** The cube's own turn (around X, then Y) that brings a value to the front. */
const FRONT: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  5: [-90, 0],
  2: [90, 0],
}

/** The camera looks down on the table a little. */
const TILT = -16
const THROW_MS = 1500
/** The second die leaves the hand a moment after the first. */
const STAGGER_MS = 90

const face = (value: number) => `rotateX(${FRONT[value][0]}deg) rotateY(${FRONT[value][1]}deg)`

/** The cube's transform at rest, showing `value`. */
export const restPose = (value: number, lean: number) => `rotateX(${TILT}deg) rotateY(${lean}deg) ${face(value)}`

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

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

/** Puts a die down where it rests, showing `value`: no motion. */
export function settle(rig: DieRig, value: number) {
  rig.mover.style.translate = '0 0'
  rig.mover.style.scale = '1'
  rig.mover.style.opacity = '1'
  rig.cube.style.transform = restPose(value, rig.lean)
  rig.shade.style.translate = '0 0'
  rig.shade.style.scale = '1'
  rig.shade.style.opacity = '1'
}

/** How big a die is while it is inside the cup, against its size on the felt. */
const IN_CUP = 0.34
/** The second die goes into the cup a moment after the first. */
const SCOOP_GAP_MS = 70

/**
 * The dice on the felt jump into Jako's cup (--from-x / --from-y: its rim) and are gone: the table is clear for
 * the next throw. `onIn` is called as each one drops in.
 */
export function scoop(frames: Frames, rigs: DieRig[], values: number[], onIn: (die: number) => void, ms = 460) {
  const inside = rigs.map(() => false)
  return play(frames, ms + SCOOP_GAP_MS * (rigs.length - 1), (elapsed) => {
    rigs.forEach((rig, i) => {
      const u = clamp01((elapsed - i * SCOOP_GAP_MS) / ms)
      /* slow off the felt, fast into the cup */
      const e = u * u * (3 - 2 * u)
      const lift = Math.sin(Math.PI * u) * (1 - 0.35 * u)
      rig.mover.style.translate = `calc(var(--from-x) * ${e}) calc(var(--from-y) * ${e} - var(--s) * ${0.9 * lift})`
      rig.mover.style.scale = `${1 - (1 - IN_CUP) * e}`
      /* it drops below the rim at the very end */
      rig.mover.style.opacity = `${1 - clamp01((u - 0.86) / 0.14)}`
      rig.cube.style.transform = `rotateX(${TILT}deg) rotateY(${rig.lean + (i ? -260 : 260) * e}deg) rotateX(${-270 * e}deg) ${face(values[i])}`
      rig.shade.style.translate = `calc(var(--from-x) * ${0.25 * e}) calc(var(--from-y) * ${0.25 * e})`
      rig.shade.style.scale = `${1 + 0.6 * lift}`
      rig.shade.style.opacity = `${Math.max(0, 1 - 2.2 * u)}`
      if (u >= 1 && !inside[i]) {
        inside[i] = true
        onIn(i)
      }
    })
  })
}

type Flight = {
  /** When the die lands, as fractions of the throw. */
  lands: [number, number, number]
  /** How high each arc goes, in die widths. */
  peaks: [number, number, number]
  /** The free tumble of the first arc: its axis and how many degrees it covers. */
  axis: [number, number, number]
  spin: number
  /** The twist on the felt that runs out as the die stops. */
  twist: number
}

function flight(): Flight {
  const first = rand(0.37, 0.43)
  const second = first + rand(0.23, 0.27)
  const ax = [1, rand(0.25, 0.8) * (Math.random() < 0.5 ? -1 : 1), rand(0.15, 0.6)]
  const len = Math.hypot(ax[0], ax[1], ax[2])
  return {
    lands: [first, second, second + rand(0.14, 0.17)],
    peaks: [rand(0.75, 1.05), rand(0.4, 0.55), rand(0.13, 0.19)],
    axis: [ax[0] / len, ax[1] / len, ax[2] / len],
    spin: rand(420, 640),
    twist: rand(150, 250) * (Math.random() < 0.5 ? -1 : 1),
  }
}

/** A die is out of the cup, and full size, this far into the throw. */
const OUT_BY = 0.13
const arc = (s: number) => 4 * s * (1 - s)

function pose(rig: DieRig, value: number, plan: Flight, tau: number) {
  if (tau <= 0) {
    rig.mover.style.opacity = '0'
    rig.shade.style.opacity = '0'
    return
  }
  const [t1, t2, t3] = plan.lands
  /* along the felt: fast out of the hand, slowing all the way to its place */
  const along = 1 - (1 - clamp01(tau / 0.92)) ** 2.6
  const left = 1 - along

  let height = 0
  /* the tumble rolls the die away from the viewer, the way it travels; these are what is still to be undone */
  let rollX = 0
  let rollZ = 0
  let free = 0
  let since = 1
  if (tau < t1) {
    const s = tau / t1
    /* the first arc starts in the cup's mouth, not above it */
    height = plan.peaks[0] * arc(s)
    rollX = -270
    rollZ = 90
    free = plan.spin * (1 - s)
  } else if (tau < t2) {
    const s = (tau - t1) / (t2 - t1)
    height = plan.peaks[1] * arc(s)
    rollX = -90 - 180 * (1 - s)
    rollZ = 90 * (1 - s)
    since = tau - t1
  } else if (tau < t3) {
    const s = (tau - t2) / (t3 - t2)
    height = plan.peaks[2] * arc(s)
    rollX = -90 * (1 - s)
    since = tau - t2
  } else {
    since = tau - t3
  }
  const twist = plan.twist * (1 - clamp01(tau)) ** 2.2

  /* a landing presses the die into the felt for a moment */
  const press = since < 0.05 ? 1 - since / 0.05 : 0
  /* small inside the cup, full size once it is out of it */
  const out = clamp01(tau / OUT_BY)
  const size = (IN_CUP + (1 - IN_CUP) * (1 - (1 - out) ** 2)) * (1 + 0.05 * height)
  /* the felt is not under the cup: the shadow appears as the die comes over the table */
  const over = clamp01((along - 0.12) / 0.3)

  rig.mover.style.opacity = `${clamp01(tau / 0.02)}`
  rig.mover.style.translate = `calc(var(--from-x) * ${left}) calc(var(--from-y) * ${left} - var(--s) * ${0.85 * height})`
  rig.mover.style.scale = `${size * (1 + 0.06 * press)} ${size * (1 - 0.11 * press)}`
  rig.cube.style.transform =
    `rotateX(${TILT}deg) rotateY(${rig.lean + twist}deg) rotateZ(${rollZ}deg) rotateX(${rollX}deg) ` +
    `rotate3d(${plan.axis[0]}, ${plan.axis[1]}, ${plan.axis[2]}, ${free}deg) ${face(value)}`
  rig.shade.style.translate = `calc(var(--from-x) * ${left}) calc(var(--from-y) * ${left})`
  rig.shade.style.scale = `${1 + 0.7 * height}`
  rig.shade.style.opacity = `${(0.95 * over) / (1 + 2.4 * height)}`
}

/**
 * Throws the dice so they come to rest on `values`. `onLand` is called at each landing with the die, which landing
 * it was (0 the first and hardest) and how hard it hit (1 to 0).
 */
export function throwDice(frames: Frames, rigs: DieRig[], values: number[], onLand: (die: number, landing: number, power: number) => void) {
  const plans = rigs.map(flight)
  const landed = rigs.map(() => 0)
  const total = THROW_MS + STAGGER_MS * (rigs.length - 1)
  return play(frames, total, (elapsed) => {
    rigs.forEach((rig, i) => {
      const tau = clamp01((elapsed - i * STAGGER_MS) / THROW_MS)
      pose(rig, values[i], plans[i], tau)
      while (landed[i] < 3 && tau >= plans[i].lands[landed[i]]) {
        onLand(i, landed[i], [1, 0.55, 0.25][landed[i]])
        landed[i] += 1
      }
    })
  }).then(() => rigs.forEach((rig, i) => settle(rig, values[i])))
}

/** A good throw: the dice jump once where they lie and come back down on the same faces. */
export function hop(frames: Frames, rigs: DieRig[], values: number[], onLand: (die: number) => void, ms = 620) {
  const down = rigs.map(() => false)
  return play(frames, ms, (elapsed) => {
    rigs.forEach((rig, i) => {
      const u = clamp01((elapsed - i * 70) / (ms - 70 * (rigs.length - 1)))
      const height = 0.55 * arc(u)
      rig.mover.style.translate = `0 calc(var(--s) * ${-0.85 * height})`
      rig.mover.style.scale = `${1 + 0.07 * height}`
      rig.cube.style.transform = `rotateX(${TILT}deg) rotateY(${rig.lean + (i ? -360 : 360) * (1 - (1 - u) ** 2)}deg) ${face(values[i])}`
      rig.shade.style.scale = `${1 + 0.7 * height}`
      rig.shade.style.opacity = `${0.95 / (1 + 2.4 * height)}`
      if (u >= 1 && !down[i]) {
        down[i] = true
        onLand(i)
      }
    })
  }).then(() => rigs.forEach((rig, i) => settle(rig, values[i])))
}
