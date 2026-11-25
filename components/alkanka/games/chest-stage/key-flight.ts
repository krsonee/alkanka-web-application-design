/*
  The vault's key, frame by frame. There is one key: the one in Jako's wing. His clip shows it until he lets go of
  it; from that frame on the key is this picture, which starts exactly where the clip left it (level, tip to the
  left). It flies tip first along a curve that leaves his wing the way he threw it and comes down into the chest's
  keyhole, getting smaller as it goes into the room. In the lock its tip disappears into the keyhole, it turns
  (the picture flattens the way a key seen from the side does when it is turned), and when the lid has given it is
  pulled out and tumbles back to his wing, where the clip takes over again.

  Nothing here re-renders: the picture's transform and clip are written to directly. Every point is in pixels of
  the stage, whose top left corner the picture sits in.
*/

import type { pacedFrames } from '@/lib/paced-frames'

type Frames = ReturnType<typeof pacedFrames>

export type Point = { x: number; y: number }

export type KeyRig = {
  /** The picture: lying level, tip at the left edge, shaft through the middle. Its transform origin is the tip. */
  el: HTMLElement
  /** How long the key is on screen at the size it has in Jako's wing, in pixels. */
  length: number
}

/** Where a key that went into a lock is: its tip at the keyhole, how far it is turned, how big, and which way it went in. */
export type KeyPose = { tip: Point; turn: number; size: number; dive: Point }

/** The key's picture is this many times as long as it is tall. */
export const KEY_SHAPE = 2.553
/** How much of the key's length goes into the lock. */
const SUNK = 0.27
/** How flat the key looks once it is turned in the lock. */
const FLAT = 0.3

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const unit = (x: number, y: number) => {
  const len = Math.hypot(x, y) || 1
  return { x: x / len, y: y / len }
}

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

function put(rig: KeyRig, tip: Point, turn: number, size: number, flat = 1, sunk = 0) {
  const half = rig.length / KEY_SHAPE / 2
  rig.el.style.transform = `translate(${tip.x}px, ${tip.y - half}px) rotate(${turn}deg) scale(${size}, ${size * flat})`
  /* what has gone past the keyhole is inside the chest */
  rig.el.style.clipPath = sunk > 0 ? `inset(-100% -10% -100% ${sunk * 100}%)` : 'none'
}

/** The key as it lies in Jako's wing, at `tip`. */
export function holdKey(rig: KeyRig, tip: Point) {
  rig.el.style.width = `${rig.length}px`
  rig.el.style.opacity = '1'
  put(rig, tip, 0, 1)
}

export function hideKey(el: HTMLElement | null) {
  if (el) el.style.opacity = '0'
}

/**
 * Throws the key from Jako's wing (`from`) into the keyhole at `lock`. `span` is the stage's width, `size` how big
 * the key is at the lock against its size in the wing. `onMove` is called on every frame with where the tip is.
 */
export function throwKey(frames: Frames, rig: KeyRig, from: Point, lock: Point, span: number, size: number, onMove?: (tip: Point) => void) {
  const dist = Math.hypot(lock.x - from.x, lock.y - from.y)
  /* into a lock on his left it goes in leftward; anything above or to his right is thrown up and comes down rightward */
  const dive = { x: lock.x < from.x - span * 0.06 ? -0.8 : 0.8, y: 0.6 }
  const close = clamp(dist * 0.4, span * 0.07, span * 0.18)
  const p2 = { x: lock.x - dive.x * close, y: lock.y - dive.y * close }
  /* out of the wing the way it was thrown (to the left), bent toward where it has to go */
  const toward = unit(p2.x - from.x, p2.y - from.y)
  const out = unit(-0.6 + toward.x * 0.6, -0.18 + toward.y * 0.6)
  const lead = clamp(dist * 0.45, span * 0.05, span * 0.3)
  const p1 = { x: from.x + out.x * lead, y: from.y + out.y * lead }
  const ms = clamp(380 + (dist / span) * 500, 420, 640)

  /* the key points the way it flies; headings are kept continuous so it never snaps round */
  let heading = (Math.atan2(out.y, out.x) * 180) / Math.PI + 180
  heading = ((heading + 180) % 360) - 180
  return play(frames, ms, (u) => {
    /* hard out of the wing, easing into the lock */
    const e = 1 - (1 - u) ** 1.7
    const k = 1 - e
    const tip = {
      x: k * k * k * from.x + 3 * k * k * e * p1.x + 3 * k * e * e * p2.x + e * e * e * lock.x,
      y: k * k * k * from.y + 3 * k * k * e * p1.y + 3 * k * e * e * p2.y + e * e * e * lock.y,
    }
    const dx = 3 * k * k * (p1.x - from.x) + 6 * k * e * (p2.x - p1.x) + 3 * e * e * (lock.x - p2.x)
    const dy = 3 * k * k * (p1.y - from.y) + 6 * k * e * (p2.y - p1.y) + 3 * e * e * (lock.y - p2.y)
    if (dx || dy) {
      const now = (Math.atan2(dy, dx) * 180) / Math.PI + 180
      heading += ((((now - heading) % 360) + 540) % 360) - 180
    }
    /* it leaves the wing lying level and swings onto its course in the first moments */
    const turn = heading * clamp(u / 0.2, 0, 1) ** 0.7
    put(rig, tip, turn, 1 + (size - 1) * e)
    onMove?.(tip)
  }).then((): KeyPose => {
    put(rig, lock, heading, size)
    return { tip: lock, turn: heading, size, dive }
  })
}

const sunkTip = (rig: KeyRig, pose: KeyPose, sunk: number): Point => ({
  x: pose.tip.x + pose.dive.x * rig.length * pose.size * sunk,
  y: pose.tip.y + pose.dive.y * rig.length * pose.size * sunk,
})

/** The key at the keyhole is pushed home: its tip goes into the lock. */
export function sinkKey(frames: Frames, rig: KeyRig, pose: KeyPose, ms = 130) {
  return play(frames, ms, (u) => {
    const sunk = SUNK * (1 - (1 - u) ** 2)
    put(rig, sunkTip(rig, pose, sunk), pose.turn, pose.size, 1, sunk)
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
    put(rig, tip, pose.turn + strain, pose.size, 1 - (1 - FLAT) * round, SUNK)
  })
}

/**
 * The key is pulled out of the lock and tumbles back to Jako's wing (`to`), where it lies level again. `span` is
 * the stage's width.
 */
export function catchKey(frames: Frames, rig: KeyRig, pose: KeyPose, to: Point, span: number, ms: number) {
  /* at least half a turn on the way, ending level with the tip to the left */
  const level = Math.ceil((pose.turn + 120) / 360) * 360
  const pulled = { x: pose.tip.x - pose.dive.x * rig.length * pose.size * 0.12, y: pose.tip.y - pose.dive.y * rig.length * pose.size * 0.12 }
  const over = { x: (pulled.x + to.x) / 2, y: Math.min(pulled.y, to.y) - span * 0.1 }
  const OUT = 0.24
  return play(frames, ms, (u) => {
    if (u < OUT) {
      const e = u / OUT
      const sunk = SUNK * (1 - e)
      const tip = sunkTip(rig, pose, sunk)
      put(rig, { x: tip.x + (pulled.x - pose.tip.x) * e, y: tip.y + (pulled.y - pose.tip.y) * e }, pose.turn, pose.size, FLAT + (1 - FLAT) * e, sunk)
      return
    }
    const v = (u - OUT) / (1 - OUT)
    const e = v * v * (3 - 2 * v)
    const k = 1 - e
    put(
      rig,
      { x: k * k * pulled.x + 2 * k * e * over.x + e * e * to.x, y: k * k * pulled.y + 2 * k * e * over.y + e * e * to.y },
      pose.turn + (level - pose.turn) * e,
      pose.size + (1 - pose.size) * e,
    )
  }).then(() => put(rig, to, 0, 1))
}
