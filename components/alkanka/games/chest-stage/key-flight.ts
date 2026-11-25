/*
  The vault's key, frame by frame. There is one key: the one in Jako's wing, and it never leaves it. Jako walks to
  the chest and stretches his wing out, which puts the key's tip on the keyhole (chest-stage/keeper-walk.ts). His
  clip shows the key until that frame; from there on the key is this picture, which starts exactly where the clip
  left it, lying along his wing with its tip on the keyhole. He pushes it home (its tip disappears into the lock),
  turns it (the picture flattens the way a key seen from the side does when it is turned), and when the lid has
  given he turns it back and pulls it out, where the clip takes over again. Jako's picture is moved by the same
  amounts at the same moments, so the key stays under his wing the whole time.

  Nothing here re-renders: the picture's transform and clip are written to directly. Every point is in pixels of
  the stage, whose top left corner the picture sits in.
*/

import type { pacedFrames } from '@/lib/paced-frames'

type Frames = ReturnType<typeof pacedFrames>

export type Point = { x: number; y: number }

export type KeyRig = {
  /** The picture: lying level, tip at the left edge, shaft through the middle. Its transform origin is the tip. */
  el: HTMLElement
  /** How long the key is on screen in Jako's wing right now, in pixels. */
  length: number
  /** -1 when Jako faces the other way: the key is then drawn mirrored, tip to the right. */
  flip: number
}

/** A key at a lock: its tip on the keyhole, how far it is turned, and which way it goes in (a unit vector). */
export type KeyPose = { tip: Point; turn: number; dive: Point }

/** The key's picture is this many times as long as it is tall. */
export const KEY_SHAPE = 2.553
/** How much of the key's length goes into the lock. */
export const SUNK = 0.27
/** How flat the key looks once it is turned in the lock. */
const FLAT = 0.4
/** Pushing the key home, and pulling it out again, take this long. */
export const SINK_MS = 150
export const PULL_MS = 240

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function play(frames: Frames, ms: number, draw: (u: number) => void) {
  return new Promise<void>((done) => {
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const u = Math.min(1, (now - start) / ms)
      draw(u)
      if (u < 1) frames.request(tick)
      else done()
    }
    frames.request(tick)
  })
}

function put(rig: KeyRig, tip: Point, turn: number, flat = 1, sunk = 0) {
  const half = rig.length / KEY_SHAPE / 2
  rig.el.style.transform = `translate(${tip.x.toFixed(1)}px, ${(tip.y - half).toFixed(1)}px) rotate(${turn.toFixed(2)}deg) scale(${rig.flip}, ${flat.toFixed(3)})`
  /* what has gone past the keyhole is inside the chest */
  rig.el.style.clipPath = sunk > 0 ? `inset(-100% -10% -100% ${(sunk * 100).toFixed(1)}%)` : 'none'
}

/** The key as it lies in Jako's wing, its tip at `tip`, turned `turn` degrees with him. */
export function holdKey(rig: KeyRig, tip: Point, turn: number) {
  rig.el.style.width = `${rig.length}px`
  rig.el.style.opacity = '1'
  put(rig, tip, turn)
}

export function hideKey(el: HTMLElement | null) {
  if (el) el.style.opacity = '0'
}

/** How far the tip has gone in when `sunk` of the key's length is past the keyhole. */
export const driven = (rig: KeyRig, pose: KeyPose, sunk: number): Point => ({
  x: pose.dive.x * rig.length * sunk,
  y: pose.dive.y * rig.length * sunk,
})

const sunkTip = (rig: KeyRig, pose: KeyPose, sunk: number): Point => {
  const by = driven(rig, pose, sunk)
  return { x: pose.tip.x + by.x, y: pose.tip.y + by.y }
}

/** How the push goes: quick at first, easing as the key meets the back of the lock. */
export const sinkEase = (u: number) => 1 - (1 - u) ** 2

/** The key at the keyhole is pushed home: its tip goes into the lock. */
export function sinkKey(frames: Frames, rig: KeyRig, pose: KeyPose, ms = SINK_MS) {
  return play(frames, ms, (u) => {
    const sunk = SUNK * sinkEase(u)
    put(rig, sunkTip(rig, pose, sunk), pose.turn, 1, sunk)
  })
}

/** The key in the lock is turned: it shakes once against the lock, then goes round. */
export function twistKey(frames: Frames, rig: KeyRig, pose: KeyPose, ms = 420) {
  const tip = sunkTip(rig, pose, SUNK)
  return play(frames, ms, (u) => {
    /* the first third is the lock resisting, the rest the turn, which overshoots a little and settles */
    const t = clamp((u - 0.3) / 0.7, 0, 1)
    const round = 1 - (1 - t) ** 3 + 0.12 * Math.sin(Math.PI * t)
    const strain = u < 0.3 ? Math.sin((u / 0.3) * Math.PI * 3) * 4 : 0
    put(rig, tip, pose.turn + strain, 1 - (1 - FLAT) * round, SUNK)
  })
}

/** How the pull goes: the key is turned back first, then comes out. */
export const pullEase = (u: number) => {
  const t = clamp((u - 0.3) / 0.7, 0, 1)
  return t * t * (3 - 2 * t)
}

/** The key is turned back and pulled out of the lock, to where it was before it was pushed in. */
export function pullKey(frames: Frames, rig: KeyRig, pose: KeyPose, ms = PULL_MS) {
  return play(frames, ms, (u) => {
    const sunk = SUNK * (1 - pullEase(u))
    put(rig, sunkTip(rig, pose, sunk), pose.turn, FLAT + (1 - FLAT) * clamp(u / 0.45, 0, 1), sunk)
  }).then(() => put(rig, pose.tip, pose.turn))
}
