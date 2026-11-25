/*
  Jako crossing the vault. His picture stands at his post, at the foot of the stage; to open a chest he walks over
  to it, so that the key in his outstretched wing ends up exactly on the chest's keyhole, and walks back afterwards.

  The picture is moved as a whole around his hips: carried across the stage, made a little smaller the deeper into
  the room he goes, leaned toward the chest, and turned round when the chest is on his other side. He walks in
  short hops, rocking from side to side. Away from his post the foot of the picture (which the edge of the stage
  hides while he is there) fades out into the dark of the room.

  Nothing here re-renders: the picture's transform and the fade are written to directly.
*/

import type { pacedFrames } from '@/lib/paced-frames'

type Frames = ReturnType<typeof pacedFrames>

export type Point = { x: number; y: number }

/** Where Jako is, against his post: moved by (x, y) pixels, leaned `lean` degrees, `size` times as big, facing `flip`. */
export type Stand = { x: number; y: number; lean: number; size: number; flip: number; fade: number }

export const POST: Stand = { x: 0, y: 0, lean: 0, size: 1, flip: 1, fade: 0 }

/** His hips on his picture, as fractions of it: what he leans and turns around. */
export const HIPS = { x: 0.57, y: 1 }
/** How much of the picture's height fades out at its foot while he is away from his post. */
const FADE = 0.3
/** He leans this many degrees toward the chest he is opening. */
const LEAN = 2.5
/** How far he rocks to each side as he walks, in degrees. */
const ROCK = 3.2

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (u: number) => u * u * (3 - 2 * u)

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

/** Puts the picture where `at` says. */
export function stand(el: HTMLElement, at: Stand) {
  el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) rotate(${at.lean.toFixed(2)}deg) scale(${(at.size * at.flip).toFixed(3)}, ${at.size.toFixed(3)})`
  el.style.setProperty('--fade', `${(at.fade * 100).toFixed(1)}%`)
}

/**
 * Where Jako has to stand for the key's tip (`tip`, a point of his picture as fractions of it, at the frame his
 * wing is stretched out) to be on `lock`. `el` is his picture, `span` the stage's width; all points are pixels of
 * the stage. `size` is how big he is drawn over there.
 */
export function standAt(el: HTMLElement, tip: { x: number; y: number }, lock: Point, span: number, size: number): Stand {
  const width = el.offsetWidth
  const height = el.offsetHeight
  const hips = { x: el.offsetLeft + HIPS.x * width, y: el.offsetTop + HIPS.y * height }
  /* from his hips to the key's tip, as he stands at his post: the tip is on his left */
  const reach = { x: (tip.x - HIPS.x) * width, y: (tip.y - HIPS.y) * height }
  /* a chest too far right for him to stand beyond it is opened from its other side */
  const flip = lock.x - size * reach.x > span * 0.99 ? -1 : 1
  const lean = -flip * LEAN
  const cos = Math.cos((lean * Math.PI) / 180)
  const sin = Math.sin((lean * Math.PI) / 180)
  const x = flip * reach.x
  return {
    x: lock.x - hips.x - size * (x * cos - reach.y * sin),
    y: lock.y - hips.y - size * (x * sin + reach.y * cos),
    lean,
    size,
    flip,
    fade: FADE,
  }
}

/** Which way the key in his wing points when he stands at `at`: from its bow to its tip, as a unit vector. */
export function aimOf(at: Stand): Point {
  const lean = (at.lean * Math.PI) / 180
  return { x: -at.flip * Math.cos(lean), y: -at.flip * Math.sin(lean) }
}

/**
 * Walks from `from` to `to` in hops, `hop` pixels high. `onStep` is called each time he comes down. The foot of
 * the picture fades out as he leaves his post and comes back as he reaches it.
 */
export function walk(frames: Frames, el: HTMLElement, from: Stand, to: Stand, ms: number, hop: number, onStep?: () => void) {
  const hops = Math.max(2, Math.round(ms / 230))
  const leaving = to.fade >= from.fade
  const turning = from.flip !== to.flip
  let landed = 0
  return play(frames, ms, (u) => {
    const e = smooth(u)
    /* the hops are highest in the middle of the way, and he is on the ground at both ends */
    const swing = Math.sin(Math.PI * u) ** 0.6
    const beat = Math.abs(Math.sin(Math.PI * hops * u))
    const steps = Math.floor(hops * u)
    if (steps > landed && steps < hops) {
      landed = steps
      onStep?.()
    }
    stand(el, {
      x: mix(from.x, to.x, e),
      y: mix(from.y, to.y, e) - hop * beat * swing,
      lean: mix(from.lean, to.lean, e) + ROCK * Math.sin(Math.PI * hops * u) * swing,
      size: mix(from.size, to.size, e),
      /* he turns round on his first hop: the picture closes like a door and opens the other way */
      flip: turning ? from.flip * Math.cos(Math.PI * smooth(clamp01((u - 0.04) / 0.22))) || 0.001 : to.flip,
      fade: mix(from.fade, to.fade, leaving ? clamp01(u / 0.3) : clamp01((u - 0.7) / 0.3)),
    })
  }).then(() => stand(el, to))
}

/** Moves him straight from `from` to `to`, with no hops: the push that drives the key home, and the pull back. */
export function shift(frames: Frames, el: HTMLElement, from: Stand, to: Stand, ms: number, ease: (u: number) => number = smooth) {
  return play(frames, ms, (u) => {
    const e = ease(u)
    stand(el, { ...to, x: mix(from.x, to.x, e), y: mix(from.y, to.y, e), lean: mix(from.lean, to.lean, e) })
  }).then(() => stand(el, to))
}
