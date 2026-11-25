'use client'

/*
  The air of an indoor mini game room (the dice table, the vault), drawn on one canvas over the scene:

  - always: dust hanging in the lamp light, and small glints on whatever the game points at (the waiting chests);
  - on call: a dust puff where a die lands, a ring spreading over the felt, sparks, a flash, a streak of light
    travelling from one point to another, and coins that are thrown up, fall, bounce on the floor and lie there
    before they fade.

  The game calls these through the handle with points measured on its own elements (`spot`). Everything pauses
  while the stage is off-screen or the tab is hidden; under reduced motion the canvas is not drawn at all and every
  call does nothing.
*/

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { canvasScale, pacedFrames } from '@/lib/paced-frames'
import { useInView, usePageHidden, usePrefersReducedMotion } from '@/lib/use-motion'
import { cn } from '@/lib/utils'

export type Spot = { x: number; y: number }
/** Where glints appear: on an element (or a part of it, as fractions of its box), so many per second. */
export type Glint = { el: Element | null; rate: number; box?: [number, number, number, number]; size?: number }
/** A part of the stage, as fractions of its width and height. */
export type Zone = { x: [number, number]; y: [number, number] }

export type RoomFxHandle = {
  /** A point on an element, in the canvas's own pixels. Null while the canvas is not running. */
  spot(el: Element | null, ax?: number, ay?: number): Spot | null
  puff(at: Spot | null, power?: number): void
  ring(at: Spot | null, radius: number, squash?: number): void
  sparks(at: Spot | null, count: number, power?: number): void
  flash(at: Spot | null, radius: number): void
  /** Coins thrown up from a point; they land on `floor` (a canvas y), spread over `depth` pixels of it. */
  coins(at: Spot | null, count: number, opts?: { floor?: number; depth?: number; spread?: number; lift?: number }): void
  /** A streak of light from one point to another, over `ms`. Resolves when it arrives. */
  streak(from: Spot | null, to: Spot | null, ms: number): Promise<void>
  glints(list: Glint[]): void
}

type Particle =
  | { kind: 'puff'; x: number; y: number; vx: number; vy: number; r: number; age: number; life: number }
  | { kind: 'spark'; x: number; y: number; vx: number; vy: number; age: number; life: number; w: number }
  | { kind: 'ring'; x: number; y: number; r: number; squash: number; age: number; life: number }
  | { kind: 'flash'; x: number; y: number; r: number; age: number; life: number }
  | { kind: 'glint'; x: number; y: number; s: number; rot: number; age: number; life: number }
  | {
      kind: 'coin'
      x: number
      y: number
      vx: number
      vy: number
      r: number
      flip: number
      vf: number
      rot: number
      floor: number
      hits: number
      age: number
      life: number
    }

type Mote = { x: number; y: number; z: number; ph: number; f: number }
type Streak = { from: Spot; to: Spot; mid: Spot; age: number; ms: number; done: () => void }

type Engine = RoomFxHandle & { stop(): void }

const TAU = Math.PI * 2
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const GOLD = '#e3b950'
const GOLD_LIGHT = '#fbe9ad'
const GOLD_DARK = '#8b651b'

function sprite(size: number, stops: [number, string][]) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [at, color] of stops) r.addColorStop(at, color)
  g.fillStyle = r
  g.fillRect(0, 0, size, size)
  return c
}

function createEngine(canvas: HTMLCanvasElement, zone: { wide: Zone; tall: Zone }): Engine | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const warm = sprite(64, [
    [0, 'rgba(255,236,186,1)'],
    [0.35, 'rgba(244,206,120,0.55)'],
    [1, 'rgba(227,185,80,0)'],
  ])
  const dust = sprite(64, [
    [0, 'rgba(214,220,240,0.9)'],
    [0.5, 'rgba(196,204,230,0.4)'],
    [1, 'rgba(190,198,226,0)'],
  ])

  const parts: Particle[] = []
  const motes: Mote[] = []
  const streaks: Streak[] = []
  let glintList: Glint[] = []
  let W = 0
  let H = 0
  let k = 1
  let area: Zone = zone.wide
  let t = 0

  const mote = (): Mote => ({ x: Math.random(), y: Math.random(), z: Math.random() ** 1.6, ph: Math.random() * TAU, f: rand(0.25, 0.8) })

  const fit = () => {
    const box = canvas.getBoundingClientRect()
    if (!box.width || !box.height) return
    const scale = canvasScale(box.width, 2)
    const bw = Math.round(box.width * scale)
    const bh = Math.round(box.height * scale)
    if (W && bw === canvas.width && bh === canvas.height) return
    W = box.width
    H = box.height
    k = clamp(W / 900, 0.55, 1.25)
    area = W >= 600 ? zone.wide : zone.tall
    canvas.width = bw
    canvas.height = bh
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    const want = clamp(Math.round((W * H) / 14000), 14, 46)
    while (motes.length < want) motes.push(mote())
    motes.length = want
  }
  fit()
  const ro = new ResizeObserver(fit)
  ro.observe(canvas)

  const ellipse = (x: number, y: number, rx: number, ry: number) => {
    ctx.beginPath()
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU)
  }

  const step = (dt: number) => {
    for (const m of motes) {
      m.x += (0.006 + 0.012 * m.z) * dt
      m.y -= (0.004 + 0.01 * m.z) * dt * (0.6 + 0.4 * Math.sin(t * m.f + m.ph))
      if (m.x > 1 || m.y < 0) Object.assign(m, mote(), Math.random() < 0.5 ? { x: 0 } : { y: 1 })
    }

    for (const g of glintList) {
      if (!g.el || Math.random() > g.rate * dt) continue
      const box = g.el.getBoundingClientRect()
      const own = canvas.getBoundingClientRect()
      const [x0, y0, x1, y1] = g.box ?? [0.1, 0.1, 0.9, 0.9]
      parts.push({
        kind: 'glint',
        x: box.left - own.left + box.width * rand(x0, x1),
        y: box.top - own.top + box.height * rand(y0, y1),
        s: (g.size ?? 1) * rand(5, 11) * k,
        rot: rand(-0.3, 0.3),
        age: 0,
        life: rand(0.45, 0.85),
      })
    }

    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i]
      s.age += dt * 1000
      const u = clamp(s.age / s.ms, 0, 1)
      const e = u * u * (3 - 2 * u)
      const x = (1 - e) ** 2 * s.from.x + 2 * (1 - e) * e * s.mid.x + e ** 2 * s.to.x
      const y = (1 - e) ** 2 * s.from.y + 2 * (1 - e) * e * s.mid.y + e ** 2 * s.to.y
      for (let n = 0; n < 3; n++)
        parts.push({ kind: 'spark', x, y, vx: rand(-60, 60) * k, vy: rand(-70, 30) * k, age: 0, life: rand(0.25, 0.55), w: rand(0.8, 1.8) })
      parts.push({ kind: 'flash', x, y, r: 16 * k, age: 0, life: 0.12 })
      if (u >= 1) {
        streaks.splice(i, 1)
        s.done()
      }
    }

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      p.age += dt
      if (p.age >= p.life) {
        parts.splice(i, 1)
        continue
      }
      if (p.kind === 'puff') {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= 1 - 2.6 * dt
        p.vy *= 1 - 2.6 * dt
      } else if (p.kind === 'spark') {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 520 * k * dt
        p.vx *= 1 - 1.4 * dt
      } else if (p.kind === 'coin') {
        if (p.hits < 4) {
          p.vy += 2300 * k * dt
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.flip += p.vf * dt
          p.rot += p.vf * 0.12 * dt
          if (p.y >= p.floor && p.vy > 0) {
            p.y = p.floor
            p.hits += 1
            p.vy *= -0.42
            p.vx *= 0.62
            p.vf *= 0.6
            if (Math.abs(p.vy) < 90 * k) p.hits = 4
          }
        }
      }
    }
  }

  const render = () => {
    ctx.clearRect(0, 0, W, H)

    /* dust in the light: brightest in the middle of its zone, gone at the zone's edges */
    ctx.globalCompositeOperation = 'lighter'
    const zx = area.x[0] * W
    const zw = (area.x[1] - area.x[0]) * W
    const zy = area.y[0] * H
    const zh = (area.y[1] - area.y[0]) * H
    for (const m of motes) {
      const edge = Math.sin(Math.PI * m.x) * Math.sin(Math.PI * m.y)
      const r = (1.2 + 3.4 * m.z) * k
      ctx.globalAlpha = (0.1 + 0.34 * m.z) * edge * (0.55 + 0.45 * Math.sin(t * (1 + m.f) + m.ph))
      ctx.drawImage(warm, zx + m.x * zw - r, zy + m.y * zh - r, 2 * r, 2 * r)
    }

    for (const p of parts) {
      const u = p.age / p.life
      if (p.kind === 'puff') {
        ctx.globalCompositeOperation = 'source-over'
        const r = p.r * (1 + 2.2 * u)
        ctx.globalAlpha = 0.34 * (1 - u) ** 1.4
        ctx.drawImage(dust, p.x - r, p.y - r * 0.55, 2 * r, 1.1 * r)
      } else if (p.kind === 'spark') {
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = (1 - u) ** 0.8
        ctx.strokeStyle = u < 0.3 ? '#fff6d8' : GOLD
        ctx.lineWidth = p.w * k * (1 - 0.5 * u)
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04)
        ctx.stroke()
      } else if (p.kind === 'ring') {
        ctx.globalCompositeOperation = 'lighter'
        const e = 1 - (1 - u) ** 3
        ctx.globalAlpha = 0.85 * (1 - u) ** 1.5
        ctx.strokeStyle = GOLD
        ctx.lineWidth = (5 * (1 - u) + 0.6) * k
        ellipse(p.x, p.y, p.r * (0.15 + 0.85 * e), p.r * (0.15 + 0.85 * e) * p.squash)
        ctx.stroke()
      } else if (p.kind === 'flash') {
        ctx.globalCompositeOperation = 'lighter'
        const r = p.r * (0.35 + 0.95 * (1 - (1 - u) ** 2))
        ctx.globalAlpha = (1 - u) ** 1.6
        ctx.drawImage(warm, p.x - r, p.y - r, 2 * r, 2 * r)
      } else if (p.kind === 'glint') {
        ctx.globalCompositeOperation = 'lighter'
        const a = Math.sin(Math.PI * u)
        const s = p.s * a
        ctx.globalAlpha = a
        ctx.fillStyle = '#fff3cf'
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot + u * 0.9)
        ctx.beginPath()
        for (let n = 0; n < 4; n++) {
          const ang = (n * TAU) / 4
          ctx.lineTo(Math.cos(ang) * s, Math.sin(ang) * s)
          ctx.lineTo(Math.cos(ang + TAU / 8) * s * 0.16, Math.sin(ang + TAU / 8) * s * 0.16)
        }
        ctx.closePath()
        ctx.fill()
        ctx.restore()
        ctx.globalAlpha = a * 0.5
        ctx.drawImage(warm, p.x - s, p.y - s, 2 * s, 2 * s)
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = clamp((p.life - p.age) / 0.45, 0, 1)
        const lying = p.hits >= 4
        ctx.save()
        ctx.translate(p.x, p.y - (lying ? p.r * 0.3 : 0))
        if (!lying) ctx.rotate(p.rot)
        /* on the floor a coin is seen from above at the room's angle; in the air it shows whatever side its spin gives */
        const rx = lying ? p.r : Math.max(p.r * 0.14, Math.abs(Math.cos(p.flip)) * p.r)
        const ry = lying ? p.r * 0.36 : p.r
        ctx.fillStyle = GOLD_DARK
        ellipse(lying ? 0 : p.r * 0.1, lying ? p.r * 0.13 : 0, rx, ry)
        ctx.fill()
        ctx.fillStyle = GOLD
        ellipse(0, 0, rx, ry)
        ctx.fill()
        ctx.strokeStyle = GOLD_DARK
        ctx.lineWidth = Math.max(0.6, p.r * 0.1)
        ellipse(0, 0, rx * 0.66, ry * 0.66)
        ctx.stroke()
        ctx.fillStyle = GOLD_LIGHT
        ctx.globalAlpha *= 0.7
        ellipse(-rx * 0.25, -ry * 0.3, rx * 0.36, ry * 0.3)
        ctx.fill()
        ctx.restore()
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  /* 30 frames a second is plenty for hanging dust; anything thrown gets the full 60 */
  const frames = pacedFrames(() => (parts.some((p) => p.kind !== 'glint') || streaks.length ? 60 : 30))
  let last = performance.now()
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    if (W) {
      step(dt)
      render()
    }
    frames.request(frame)
  }
  frames.request(frame)

  return {
    stop() {
      frames.cancel()
      ro.disconnect()
      for (const s of streaks) s.done()
      ctx.clearRect(0, 0, W, H)
    },
    spot(el, ax = 0.5, ay = 0.5) {
      if (!el) return null
      const box = el.getBoundingClientRect()
      const own = canvas.getBoundingClientRect()
      return { x: box.left - own.left + box.width * ax, y: box.top - own.top + box.height * ay }
    },
    puff(at, power = 1) {
      if (!at) return
      const count = Math.round(5 + 6 * power)
      for (let i = 0; i < count; i++) {
        const dir = (i / count) * TAU + rand(-0.3, 0.3)
        const speed = rand(60, 150) * k * (0.5 + 0.7 * power)
        parts.push({
          kind: 'puff',
          x: at.x,
          y: at.y,
          vx: Math.cos(dir) * speed,
          vy: Math.sin(dir) * speed * 0.32 - 12 * k,
          r: rand(8, 16) * k * (0.6 + 0.6 * power),
          age: 0,
          life: rand(0.45, 0.8),
        })
      }
    },
    ring(at, radius, squash = 1) {
      if (at) parts.push({ kind: 'ring', x: at.x, y: at.y, r: radius, squash, age: 0, life: 0.7 })
    },
    sparks(at, count, power = 1) {
      if (!at) return
      for (let i = 0; i < count; i++) {
        const dir = rand(0, TAU)
        const speed = rand(140, 520) * k * power
        parts.push({
          kind: 'spark',
          x: at.x,
          y: at.y,
          vx: Math.cos(dir) * speed,
          vy: Math.sin(dir) * speed - 120 * k * power,
          age: 0,
          life: rand(0.35, 0.8),
          w: rand(1, 2.4),
        })
      }
    },
    flash(at, radius) {
      if (at) parts.push({ kind: 'flash', x: at.x, y: at.y, r: radius, age: 0, life: 0.42 })
    },
    coins(at, count, opts = {}) {
      if (!at) return
      const { floor = at.y + 60 * k, depth = 26 * k, spread = 1, lift = 1 } = opts
      for (let i = 0; i < count; i++) {
        parts.push({
          kind: 'coin',
          x: at.x + rand(-10, 10) * k,
          y: at.y,
          vx: rand(-330, 330) * k * spread,
          vy: -rand(520, 1080) * k * lift,
          r: rand(5.5, 9.5) * k,
          flip: rand(0, TAU),
          vf: rand(9, 22) * (Math.random() < 0.5 ? -1 : 1),
          rot: rand(-0.5, 0.5),
          floor: floor + rand(-depth, depth),
          hits: 0,
          age: 0,
          life: rand(2.3, 3.2),
        })
      }
    },
    streak(from, to, ms) {
      if (!from || !to) return Promise.resolve()
      return new Promise((done) => {
        const span = Math.hypot(to.x - from.x, to.y - from.y)
        streaks.push({ from, to, mid: { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - span * 0.32 }, age: 0, ms, done })
      })
    },
    glints(list) {
      glintList = list
    },
  }
}

/** `zone` is where dust hangs in the light, for the wide (2 : 1) and the tall (9 : 16) stage. It must be a constant. */
export const RoomFx = forwardRef<RoomFxHandle, { zone: { wide: Zone; tall: Zone }; className?: string }>(function RoomFx(
  { zone, className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engine = useRef<Engine | null>(null)
  const wanted = useRef<Glint[]>([])
  const reduced = usePrefersReducedMotion()
  const hidden = usePageHidden()
  const inView = useInView(canvasRef, 0.05)
  const run = !reduced && !hidden && inView

  useEffect(() => {
    if (!run || !canvasRef.current) return
    const made = createEngine(canvasRef.current, zone)
    made?.glints(wanted.current)
    engine.current = made
    return () => {
      made?.stop()
      engine.current = null
    }
  }, [run, zone])

  useImperativeHandle(
    ref,
    () => ({
      spot: (el, ax, ay) => engine.current?.spot(el, ax, ay) ?? null,
      puff: (at, power) => engine.current?.puff(at, power),
      ring: (at, radius, squash) => engine.current?.ring(at, radius, squash),
      sparks: (at, count, power) => engine.current?.sparks(at, count, power),
      flash: (at, radius) => engine.current?.flash(at, radius),
      coins: (at, count, opts) => engine.current?.coins(at, count, opts),
      streak: (from, to, ms) => engine.current?.streak(from, to, ms) ?? Promise.resolve(),
      glints: (list) => {
        wanted.current = list
        engine.current?.glints(list)
      },
    }),
    [],
  )

  return <canvas ref={canvasRef} aria-hidden="true" hidden={reduced} className={cn('pointer-events-none absolute inset-0 size-full', className)} />
})
