'use client'

/*
  The wind on the wheel terrace: drifting mist strips and one canvas of ground dust, motes and the odd grey feather.
  All matte, nothing glows. Mist strips slide by exactly one tile, so the loop has no seam. Everything pauses while
  the stage is off-screen or the tab is hidden, and stays still under reduced motion.
  Layering (stage.tsx): scene, SkyMist, Jako, phone balustrade, FloorMist, WindDust, then the wheel UI.
*/

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useInView, usePageHidden, usePrefersReducedMotion } from '@/lib/use-motion'
import { pacedFrames } from '@/lib/paced-frames'
import { cn } from '@/lib/utils'

/** A full-stage box for mist strips: pauses them while the stage is off-screen or the tab is hidden. */
function MistLayer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, 0.05)
  const hidden = usePageHidden()
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ '--mist-play': inView && !hidden ? 'running' : 'paused' } as CSSProperties}
    >
      {children}
    </div>
  )
}

function MistBand({ className, dur }: { className: string; dur: string }) {
  return (
    <div className={cn('absolute overflow-hidden', className)}>
      <div className="dw-mist absolute inset-y-0 left-0" style={{ '--dur': dur } as CSSProperties} />
    </div>
  )
}

const SKY_MASK =
  '[mask-image:linear-gradient(to_right,transparent,black_24%,black_76%,transparent)] @min-[600px]:[mask-image:linear-gradient(to_right,transparent,black_12%,black_19%,transparent_25%,transparent_50%,black_56%,black_88%,transparent)]'

/** Behind Jako: haze along the cloud line between the columns. */
export function SkyMist() {
  return (
    <MistLayer>
      <MistBand
        dur="48s"
        className={cn(
          'top-[1%] right-[7%] left-[7.5%] h-[25%] opacity-20 [--tile:177.8cqw]',
          '@min-[600px]:top-[17%] @min-[600px]:right-[6.5%] @min-[600px]:left-[8.5%] @min-[600px]:h-[46%] @min-[600px]:opacity-[0.24] @min-[600px]:[--tile:92cqw]',
          SKY_MASK,
        )}
      />
      <MistBand
        dur="28s"
        className={cn(
          'top-[9%] right-[7%] left-[7.5%] h-[15%] opacity-[0.14] [--tile:106.7cqw]',
          '@min-[600px]:top-[33%] @min-[600px]:right-[6.5%] @min-[600px]:left-[8.5%] @min-[600px]:h-[28%] @min-[600px]:opacity-[0.16] @min-[600px]:[--tile:56cqw]',
          SKY_MASK,
        )}
      />
    </MistLayer>
  )
}

/** In front of Jako's feet: low haze over the floor (the stage edges end the strips; no mask needed). */
export function FloorMist() {
  return (
    <MistLayer>
      <MistBand
        dur="34s"
        className="inset-x-0 top-[76%] h-[26%] opacity-[0.22] [--tile:184.9cqw] @min-[600px]:top-[70%] @min-[600px]:h-[38%] @min-[600px]:opacity-[0.18] @min-[600px]:[--tile:76cqw]"
      />
      <MistBand
        dur="19s"
        className="inset-x-0 top-[85%] h-[20%] opacity-[0.14] [--tile:142.2cqw] @min-[600px]:top-[78%] @min-[600px]:h-[34%] @min-[600px]:opacity-[0.13] @min-[600px]:[--tile:68cqw]"
      />
    </MistLayer>
  )
}

type Mote = { x: number; y: number; z: number; ph: number; fy: number }
type Ribbon = { x: number; y: number; h: number; len: number; v: number; d: number; age: number; kind: number }
type Leaf = {
  x: number
  y: number
  s: number
  v: number
  ph: number
  rot: number
  vr: number
  flip: number
  vf: number
  bob: number
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const TAU = Math.PI * 2
/* gust strength 0..1: a gust every few seconds (incommensurate sines, so it never visibly repeats) */
const gustAt = (t: number) =>
  clamp((Math.sin(t * 0.41) + 0.7 * Math.sin(t * 0.89 + 1.3) + 0.5 * Math.sin(t * 1.63 + 2.1) + 0.8) / 2.4, 0, 1)
const windOf = (g: number) => 0.55 + 1.5 * g * g

function canvas2d(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

/** soft round dot (dust motes) */
function dotSprite() {
  const [c, g] = canvas2d(32, 32)
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  r.addColorStop(0, 'rgba(228,222,208,1)')
  r.addColorStop(0.45, 'rgba(228,222,208,0.55)')
  r.addColorStop(1, 'rgba(228,222,208,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 32, 32)
  return c
}

/** soft opaque ellipse, used with destination-out to clear the dust behind the action note */
function holeSprite() {
  const [c, g] = canvas2d(64, 64)
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(0,0,0,1)')
  r.addColorStop(0.55, 'rgba(0,0,0,1)')
  r.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  return c
}

/** four ground-dust ribbons, 512 x 96: flat clumps hugging the bottom, a few lifted wisps, faded at both ends */
function ribbonSprites() {
  return [0, 1, 2, 3].map(() => {
    const [c, g] = canvas2d(512, 96)
    const clump = (cx: number, cy: number, rx: number, ry: number, a: number) => {
      g.save()
      g.translate(cx, cy)
      g.scale(rx, ry)
      const r = g.createRadialGradient(0, 0, 0, 0, 0, 1)
      r.addColorStop(0, `rgba(224,216,198,${a})`)
      r.addColorStop(0.55, `rgba(224,216,198,${a * 0.5})`)
      r.addColorStop(1, 'rgba(224,216,198,0)')
      g.fillStyle = r
      g.beginPath()
      g.arc(0, 0, 1, 0, TAU)
      g.fill()
      g.restore()
    }
    for (let i = 0; i < 44; i++)
      clump(
        20 + Math.random() * 472,
        96 * (0.85 - 0.33 * Math.random() ** 1.4),
        30 + Math.random() * 60,
        3 + Math.random() * 6,
        0.12 + 0.27 * Math.random(),
      )
    for (let i = 0; i < 8; i++)
      clump(
        20 + Math.random() * 472,
        96 * (0.3 + 0.22 * Math.random()),
        24 + Math.random() * 40,
        2 + Math.random() * 3,
        0.04 + 0.06 * Math.random(),
      )
    g.globalCompositeOperation = 'destination-in'
    const ends = g.createLinearGradient(0, 0, 512, 0)
    ends.addColorStop(0, 'rgba(0,0,0,0)')
    ends.addColorStop(0.22, 'rgba(0,0,0,1)')
    ends.addColorStop(0.72, 'rgba(0,0,0,1)')
    ends.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = ends
    g.fillRect(0, 0, 512, 96)
    return c
  })
}

/** In front of everything but the wheel UI: dust on the wind, and the odd feather. */
export function WindDust() {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()
  const hidden = usePageHidden()
  const inView = useInView(ref, 0.1)
  const run = !reduced && !hidden && inView

  useEffect(() => {
    if (!run) return
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dot = dotSprite()
    const hole = holeSprite()
    const ribbonArt = ribbonSprites()
    const motes: Mote[] = []
    const ribbons: Ribbon[] = []
    const leaves: Leaf[] = []
    let W = 0
    let H = 0
    let k = 1
    let desktop = true
    const t0 = Math.random() * 100 // a different gust pattern on every visit
    let t = t0 + performance.now() / 1000
    let g = gustAt(t)

    const mote = (anywhere: boolean): Mote => ({
      x: anywhere ? Math.random() * W : -12 - Math.random() * 60,
      y: H * (0.3 + 0.7 * Math.random() ** 0.6), // mostly low, near the floor
      z: Math.random() ** 1.7, // mostly far and small
      ph: Math.random() * TAU,
      fy: 0.4 + Math.random() * 0.9,
    })
    const ribbon = (anywhere: boolean): Ribbon => {
      const d = Math.random() // depth: 0 far (higher, thinner, slower) .. 1 near
      const h = (desktop ? 18 + 36 * d : 12 + 20 * d) * k
      const len = h * (6 + 5 * Math.random())
      return {
        x: anywhere ? Math.random() * W - len / 2 : -len,
        y: H * (desktop ? 0.7 + 0.25 * d : 0.8 + 0.08 * d),
        h,
        len,
        v: W * (0.075 + 0.055 * d) * (0.85 + 0.3 * Math.random()),
        d,
        age: anywhere ? 1.2 : 0,
        kind: Math.floor(Math.random() * ribbonArt.length),
      }
    }

    const render = () => {
      ctx.clearRect(0, 0, W, H)
      const wind = windOf(g)

      for (const r of ribbons) {
        ctx.globalAlpha = Math.min(1, (0.66 + 0.42 * r.d) * clamp(r.age / 1.2, 0, 1) * (0.75 + 0.5 * g))
        ctx.drawImage(ribbonArt[r.kind], r.x, r.y - r.h / 2, r.len, r.h)
      }

      for (const m of motes) {
        const speed = W * (0.018 + 0.045 * m.z) * wind
        const r = (0.6 + 2.2 * m.z * m.z) * k * 1.4
        const st = m.z > 0.35 ? 1 + Math.min(3, speed / 45) * (0.3 + 0.7 * g) : 1
        const hh = (2 * r) / Math.sqrt(st) // streaks get thinner, not fatter
        ctx.globalAlpha = (0.1 + 0.42 * m.z) * clamp(m.x / 40, 0, 1)
        ctx.drawImage(dot, m.x - r * st, m.y - hh / 2, 2 * r * st, hh)
      }

      ctx.globalAlpha = 1
      for (const l of leaves) {
        const face = Math.cos(l.flip)
        const w = l.s * 0.26
        ctx.save()
        ctx.translate(l.x, l.y)
        ctx.rotate(l.rot)
        ctx.scale(1, Math.sign(face || 1) * Math.max(Math.abs(face), 0.12))
        ctx.beginPath()
        ctx.moveTo(-l.s / 2, 0)
        ctx.quadraticCurveTo(0, -w, l.s / 2, 0)
        ctx.quadraticCurveTo(0, w, -l.s / 2, 0)
        ctx.fillStyle = face > 0 ? '#7d8592' : '#c9cdd5'
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(-l.s / 2 - l.s * 0.1, 0)
        ctx.lineTo(l.s / 2, 0)
        ctx.lineWidth = 0.7
        ctx.strokeStyle = face > 0 ? '#585e69' : '#9fa4af'
        ctx.stroke()
        ctx.restore()
      }

      /* keep the small note under the action button legible: clear the dust right behind it */
      ctx.globalCompositeOperation = 'destination-out'
      ctx.globalAlpha = 0.85
      if (desktop) ctx.drawImage(hole, W * 0.275, H * 0.87, W * 0.26, H * 0.1)
      else ctx.drawImage(hole, W * 0.06, H * 0.905, W * 0.88, H * 0.08)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }

    const fit = () => {
      const box = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const bw = Math.max(1, Math.round(box.width * dpr))
      const bh = Math.max(1, Math.round(box.height * dpr))
      if (W && bw === canvas.width && bh === canvas.height) return
      const pw = W
      const ph = H
      W = box.width
      H = box.height
      k = clamp(W / 1160, 0.6, 1.2)
      desktop = W >= 600
      canvas.width = bw
      canvas.height = bh
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (pw && ph) {
        for (const m of motes) {
          m.x *= W / pw
          m.y *= H / ph
        }
      }
      /* ground dust and leaves live in layout-specific lanes: start those afresh */
      ribbons.length = 0
      leaves.length = 0
      for (let i = 0; i < (desktop ? 5 : 2); i++) ribbons.push(ribbon(true))
      const want = clamp(Math.round((W * H) / 9000), 16, 90)
      while (motes.length < want) motes.push(mote(true))
      motes.length = Math.min(motes.length, want)
      render() // resizing the canvas cleared it: no blank frame
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)

    const step = (dt: number) => {
      const wind = windOf(g)

      if (ribbons.length < (desktop ? 11 : 5) && Math.random() < dt * (desktop ? 0.65 : 0.38) * (0.55 + 1.6 * g))
        ribbons.push(ribbon(false))
      for (let i = ribbons.length - 1; i >= 0; i--) {
        const r = ribbons[i]
        r.age += dt
        r.x += r.v * (0.75 + 0.35 * wind) * dt
        r.y -= 2.5 * k * wind * dt
        if (r.x > W) ribbons.splice(i, 1)
      }

      for (const m of motes) {
        m.x += W * (0.018 + 0.045 * m.z) * wind * dt
        m.y += (Math.sin(t * m.fy + m.ph) * (4 + 10 * m.z) - 3 * (wind - 1) * m.z) * k * dt
        if (m.x > W + 16 || m.y < -16 || m.y > H + 16) Object.assign(m, mote(false))
      }

      if (leaves.length < (desktop ? 3 : 1) && Math.random() < dt * (desktop ? 0.18 : 0.08) * (0.4 + 1.4 * g)) {
        leaves.push({
          x: -20,
          y: H * (desktop ? 0.86 + 0.09 * Math.random() : 0.06 + 0.14 * Math.random()),
          s: (18 + 8 * Math.random()) * Math.max(k, 0.8),
          v: W * (0.09 + 0.05 * Math.random()),
          ph: Math.random() * TAU,
          rot: Math.random() * TAU,
          vr: (1.2 + 2 * Math.random()) * (Math.random() < 0.5 ? -1 : 1),
          flip: Math.random() * TAU,
          vf: 2.5 + 3.5 * Math.random(),
          bob: desktop ? 12 : 18,
        })
      }
      for (let i = leaves.length - 1; i >= 0; i--) {
        const l = leaves[i]
        l.x += l.v * (0.7 + 0.4 * wind) * dt
        l.y += Math.sin(t * 2.1 + l.ph) * l.bob * dt
        l.rot += l.vr * dt
        l.flip += l.vf * dt
        if (l.x > W + 30) leaves.splice(i, 1)
      }
    }

    const frames = pacedFrames(30)
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t = t0 + now / 1000
      g = gustAt(t)
      step(dt)
      render()
      frames.request(frame)
    }
    frames.request(frame)
    return () => {
      frames.cancel()
      ro.disconnect()
      ctx.clearRect(0, 0, W, H)
    }
  }, [run])

  return <canvas ref={ref} aria-hidden hidden={reduced} className="pointer-events-none absolute inset-0 size-full" />
}
