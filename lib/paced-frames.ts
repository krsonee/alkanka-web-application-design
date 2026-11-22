/** Frames that arrive this much early still count: a 60 Hz screen delivers them anywhere between 15 and 18 ms apart. */
const EARLY_MS = 4

/**
 * A drawing loop that never runs faster than `fps`. requestAnimationFrame follows the screen, so a 120 Hz
 * iPad or phone draws every game twice as often as a 60 Hz one for no visible gain, and that is what heats it.
 * Pass a function to slow the loop further while nothing on screen is moving.
 *
 * Only one callback is pending at a time, exactly like a loop that re-requests itself.
 */
export function pacedFrames(fps: number | (() => number) = 60) {
  let pending = 0
  let last = -Infinity

  const request = (draw: FrameRequestCallback) => {
    const tick = (now: number) => {
      const rate = typeof fps === 'function' ? fps() : fps
      if (now - last < 1000 / rate - EARLY_MS) {
        pending = requestAnimationFrame(tick)
        return
      }
      last = now
      draw(now)
    }
    pending = requestAnimationFrame(tick)
  }

  const cancel = () => cancelAnimationFrame(pending)

  return { request, cancel }
}

/**
 * The sharpest a canvas `width` units wide needs to be drawn. A canvas cannot be shown larger than the screen,
 * so backing pixels beyond the screen's own are filled every frame and never seen.
 */
export function canvasScale(width: number, max = 2) {
  const ratio = window.devicePixelRatio || 1
  const longSide = Math.max(window.screen?.width ?? 0, window.screen?.height ?? 0)
  const visible = longSide > 0 ? (longSide * ratio) / width : max
  return Math.max(1, Math.min(ratio, max, visible))
}
