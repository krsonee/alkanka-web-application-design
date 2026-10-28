'use client'

import { useEffect, useRef } from 'react'
import { kdSound } from './kd-sound'
import {
  KD_BAR_IN as BAR_IN,
  KD_BAR_OUT as BAR_OUT,
  KD_BAR_T as BAR_T,
  KD_PULL_REACH as PULL_REACH,
  KD_STEP as STEP,
  KD_WALL as WALL,
  KD_WARN as WARN,
  createKD,
  kdHole as holeState,
  stepKD,
  type KDHole as HoleState,
} from '@/lib/karadelik-sim'

export type KDPlayer = { id: string; name: string; image: string; me: boolean }

export type KDEvent =
  | { type: 'tick'; left: number }
  | { type: 'out'; index: number; alive: number }
  | { type: 'power'; index: number; kind: 1 | 2 }
  | { type: 'final' }
  | { type: 'done'; winners: number[]; seconds: number }

type Props = {
  players: KDPlayer[]
  /** Seconds before the Final Battle starts. */
  duration: number
  /** How many survivors take a prize. */
  winners: number
  /** Total prize shared between the survivors, shown on the victory formation. */
  prizePool?: number
  /** Same seed + player count + settings gives the same match on every device. */
  seed: number
  /** Live rounds lock the simulation to this wall-clock start; previews run freely with slow motion. */
  startAt?: number
  now?: () => number
  /** Pre-round power per slot (1 kalkan, 2 geri dönüş), exactly as the server simulated it. */
  powers?: number[]
  onEvent: (e: KDEvent) => void
}

// Canvas can't read Tailwind tokens; these mirror the site palette (navy, gold, amethyst vortex, ruby warning).
const C = {
  bgIn: '#141a29',
  bgOut: '#080b12',
  floorIn: '#1a2133',
  floorOut: '#0c1019',
  gold: '#f2c14e',
  goldDeep: '#9c6c17',
  hole: '#b06ef0',
  ruby: '#ef4f5a',
  ink: '#0b0f17',
  lid: '#2a3142',
}

const NEBULAE = [
  { color: 'rgba(123,63,228,0.45)', ax: 0.32, ay: 0.26, speed: 0.11, phase: 0, size: 0.62 },
  { color: 'rgba(31,181,201,0.32)', ax: 0.36, ay: 0.3, speed: 0.08, phase: 2.1, size: 0.55 },
  { color: 'rgba(224,69,139,0.3)', ax: 0.3, ay: 0.34, speed: 0.13, phase: 4.2, size: 0.5 },
  { color: 'rgba(242,193,78,0.16)', ax: 0.22, ay: 0.2, speed: 0.07, phase: 1.3, size: 0.45 },
]
const CONFETTI_COLORS = ['#f2c14e', '#fff4d6', '#b06ef0', '#3fd0e0', '#ef4f5a']

type Spot = { i: number; fx: number; fy: number; tx: number; ty: number; tr: number }
type Confetti = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string }

function easeOutBack(p: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2
}

const SPRITE = 128
/** Live viewers this far behind the clock (page reload, slow device) jump ahead silently instead of replaying every effect. */
const CATCHUP_STEPS = 30

type Faller = { i: number; x: number; y: number; at: number }
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || 'AK'
}

function makeSprite(name: string, img: HTMLImageElement | null) {
  const c = document.createElement('canvas')
  c.width = SPRITE
  c.height = SPRITE
  const g = c.getContext('2d')!
  const h = SPRITE / 2
  g.save()
  g.beginPath()
  g.arc(h, h, h, 0, Math.PI * 2)
  g.clip()
  g.fillStyle = C.lid
  g.fillRect(0, 0, SPRITE, SPRITE)
  if (img && img.naturalWidth) {
    const s = Math.max(SPRITE / img.naturalWidth, SPRITE / img.naturalHeight)
    const w = img.naturalWidth * s
    const hh = img.naturalHeight * s
    g.drawImage(img, h - w / 2, h - hh / 2, w, hh)
  } else {
    g.fillStyle = C.gold
    g.font = `700 ${SPRITE * 0.38}px "Space Grotesk", system-ui, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(initials(name), h, h + 2)
  }
  const gloss = g.createRadialGradient(h * 0.7, h * 0.45, 0, h * 0.7, h * 0.45, h * 1.1)
  gloss.addColorStop(0, 'rgba(255,255,255,0.32)')
  gloss.addColorStop(0.45, 'rgba(255,255,255,0.04)')
  gloss.addColorStop(1, 'rgba(0,0,0,0.28)')
  g.fillStyle = gloss
  g.fillRect(0, 0, SPRITE, SPRITE)
  g.restore()
  return c
}

export function KaraDelikCanvas({ players, duration, winners, prizePool = 0, seed, startAt, now: clock, powers, onEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const eventRef = useRef(onEvent)
  eventRef.current = onEvent
  const clockRef = useRef(clock)
  clockRef.current = clock

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const low = (navigator.hardwareConcurrency ?? 8) <= 4
    const maxParticles = low ? 60 : 220

    const n = players.length
    const sim = createKD(n, seed, duration, winners, powers)
    const { balls, r } = sim

    const sprites = players.map((p) => makeSprite(p.name, null))
    players.forEach((p, i) => {
      if (!p.image) return
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        sprites[i] = makeSprite(p.name, img)
      }
      img.src = p.image
    })
    const meIndex = players.findIndex((p) => p.me)

    let finished = false
    let finishedAt = 0
    let doneSent = false
    let lastTick = -1
    let lastWarnCount = 0
    let shake = 0
    let zoom = 1
    let camX = 0
    let camY = 0
    const fallers: Faller[] = []
    const particles: Particle[] = []
    const confetti: Confetti[] = []
    let spots: Spot[] = []
    let prizeLabel = ''
    const stars = Array.from({ length: low ? 50 : 110 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() < 0.15 ? 1.6 : 0.9,
      twinkle: 0.6 + Math.random() * 2.4,
      phase: Math.random() * Math.PI * 2,
      drift: 0.004 + Math.random() * 0.012,
    }))

    const burst = (x: number, y: number, count: number, colors: string[], speed: number, size: number) => {
      for (let k = 0; k < count && particles.length < maxParticles; k++) {
        const a = Math.random() * Math.PI * 2
        const s = speed * (0.35 + Math.random())
        const max = 0.35 + Math.random() * 0.45
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: max, max, color: colors[k % colors.length], size })
      }
    }

    const finish = () => {
      finished = true
      finishedAt = performance.now()
      kdSound.win()

      const list = balls.flatMap((b, i) => (b.alive ? [i] : []))
      const k = list.length
      prizeLabel = prizePool > 0 && k > 0 ? `+${Math.floor(prizePool / k).toLocaleString('tr-TR')} KC` : ''
      const rows = k > 5 ? 2 : 1
      const perRow = Math.ceil(k / rows)
      const spacing = Math.min(0.6, 1.72 / perRow)
      const tr = Math.min(k === 1 ? 0.26 : 0.19, spacing * 0.34)
      const rowGap = tr * 2 + 0.24
      const top = -0.34 - ((rows - 1) * rowGap) / 2
      spots = list.map((i, idx) => {
        const row = Math.floor(idx / perRow)
        const inRow = row === rows - 1 ? k - perRow * (rows - 1) : perRow
        const col = idx - row * perRow
        return { i, fx: balls[i].x, fy: balls[i].y, tx: (col - (inRow - 1) / 2) * spacing, ty: top + row * rowGap, tr }
      })

      if (!reduced) {
        for (let c = 0; c < (low ? 60 : 160); c++) {
          confetti.push({
            x: (Math.random() - 0.5) * 2.3,
            y: -1.15 - Math.random() * 1.4,
            vx: (Math.random() - 0.5) * 0.3,
            vy: 0.35 + Math.random() * 0.45,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 9,
            size: 0.012 + Math.random() * 0.014,
            color: CONFETTI_COLORS[c % CONFETTI_COLORS.length],
          })
        }
      }
    }

    /** Feeds one simulation step into the visuals; `quiet` skips effects while catching up to the live clock. */
    const advance = (quiet: boolean) => {
      stepKD(sim)
      if (sim.finalNow) {
        if (!quiet) kdSound.final()
        eventRef.current({ type: 'final' })
      }
      for (const i of sim.out) {
        const b = balls[i]
        if (!quiet) {
          fallers.push({ i, x: b.x, y: b.y, at: performance.now() })
          burst(b.x, b.y, 14, [C.hole, C.gold, '#ffffff'], 0.9, 0.012)
          if (!reduced) shake = Math.min(1, shake + 0.55)
          kdSound.fallIn()
        }
        eventRef.current({ type: 'out', index: i, alive: sim.alive + (sim.out.length - 1 - sim.out.indexOf(i)) })
      }
      for (const { i, kind } of sim.powered) {
        if (!quiet) burst(balls[i].x, balls[i].y, 18, kind === 1 ? ['#bfe8ff', '#ffffff'] : ['#3fd0a0', C.gold, '#ffffff'], 0.9, 0.011)
        eventRef.current({ type: 'power', index: i, kind })
      }
      if (!quiet) {
        for (const hit of sim.hits.slice(0, 3)) {
          burst(hit.x, hit.y, 3, [C.gold, '#ffffff'], 0.6, 0.007)
          kdSound.bump(hit.s)
        }
      }

      const left = sim.final ? 0 : Math.max(0, Math.ceil(duration - sim.time))
      if (left !== lastTick) {
        lastTick = left
        eventRef.current({ type: 'tick', left })
        if (!quiet && left > 0 && left <= 10) kdSound.beat()
      }
      const hole = holeState(sim.time, sim.final, sim.finalAt)
      if (!quiet && hole.mode === 'warn' && hole.count !== lastWarnCount) kdSound.pull(hole.count)
      lastWarnCount = hole.mode === 'warn' ? hole.count : 0

      if (sim.finished && !finished) finish()
    }

    let w = 0
    let h = 0
    let R = 0
    let dpr = 1
    let floor: HTMLCanvasElement | null = null

    // Rendered at extra resolution so the slow-motion zoom never shows a blurry, stretched arena.
    const FLOOR_OVERSAMPLE = 1.5
    let floorSize = 0
    const buildFloor = () => {
      floorSize = R * 2.2
      const f = document.createElement('canvas')
      const scale = dpr * FLOOR_OVERSAMPLE
      f.width = Math.round(floorSize * scale)
      f.height = Math.round(floorSize * scale)
      const g = f.getContext('2d')!
      g.scale(scale, scale)
      g.translate(floorSize / 2, floorSize / 2)

      g.save()
      g.beginPath()
      g.arc(0, 0, R * WALL, 0, Math.PI * 2)
      g.clip()
      const fl = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R * WALL)
      fl.addColorStop(0, C.floorIn)
      fl.addColorStop(1, C.floorOut)
      g.fillStyle = fl
      g.fillRect(-R, -R, R * 2, R * 2)
      g.strokeStyle = 'rgba(242,193,78,0.06)'
      g.lineWidth = 1
      for (let k = 1; k <= 7; k++) {
        g.beginPath()
        g.arc(0, 0, R * WALL * (k / 7.5), 0, Math.PI * 2)
        g.stroke()
      }
      g.strokeStyle = 'rgba(255,255,255,0.03)'
      for (let k = 0; k < 32; k++) {
        const a = (k / 32) * Math.PI * 2
        g.beginPath()
        g.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2)
        g.lineTo(Math.cos(a) * R, Math.sin(a) * R)
        g.stroke()
      }
      g.restore()

      const rimR = R * (WALL + 0.025)
      g.save()
      if (!low) {
        g.shadowColor = 'rgba(242,193,78,0.55)'
        g.shadowBlur = 26
      }
      const rim = g.createLinearGradient(-rimR, -rimR, rimR, rimR)
      rim.addColorStop(0, C.gold)
      rim.addColorStop(0.5, C.goldDeep)
      rim.addColorStop(1, C.gold)
      g.strokeStyle = rim
      g.lineWidth = R * 0.05
      g.beginPath()
      g.arc(0, 0, rimR, 0, Math.PI * 2)
      g.stroke()
      g.restore()
      g.strokeStyle = 'rgba(255,255,255,0.35)'
      g.lineWidth = 1
      g.beginPath()
      g.arc(0, 0, R * WALL, 0, Math.PI * 2)
      g.stroke()
      g.fillStyle = C.ink
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2
        g.beginPath()
        g.arc(Math.cos(a) * rimR, Math.sin(a) * rimR, R * 0.008, 0, Math.PI * 2)
        g.fill()
      }
      floor = f
    }

    const layout = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      R = Math.min(w, h) * 0.47
      buildFloor()
    }
    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(canvas)

    const drawBall = (i: number, x: number, y: number, rr: number, alpha: number, showName: boolean) => {
      ctx.globalAlpha = alpha
      ctx.fillStyle = 'rgba(0,0,0,0.38)'
      ctx.beginPath()
      ctx.ellipse(x + rr * 0.12, y + rr * 0.32, rr * 0.95, rr * 0.6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.drawImage(sprites[i], x - rr, y - rr, rr * 2, rr * 2)
      const me = i === meIndex
      ctx.strokeStyle = me ? C.gold : 'rgba(255,255,255,0.78)'
      ctx.lineWidth = Math.max(1.5, rr * (me ? 0.2 : 0.12))
      ctx.beginPath()
      ctx.arc(x, y, rr, 0, Math.PI * 2)
      ctx.stroke()
      if (showName || me) {
        const label = me ? 'SEN' : players[i].name
        const fs = Math.max(10, Math.min(13, rr * 0.55))
        ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`
        const tw = ctx.measureText(label).width
        const ly = y + rr + fs * 0.95
        ctx.fillStyle = me ? C.gold : 'rgba(11,15,23,0.82)'
        ctx.beginPath()
        ctx.roundRect(x - tw / 2 - 6, ly - fs * 0.72, tw + 12, fs * 1.45, fs * 0.72)
        ctx.fill()
        ctx.fillStyle = me ? C.ink : '#f5f1e8'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, x, ly)
      }
      ctx.globalAlpha = 1
    }

    const drawBars = (omegaSign: number) => {
      for (let k = 0; k < 2; k++) {
        const a = sim.barAngle + k * Math.PI
        ctx.fillStyle = 'rgba(242,193,78,0.07)'
        ctx.beginPath()
        ctx.arc(0, 0, BAR_OUT * R, a - 0.38 * omegaSign, a, false)
        ctx.arc(0, 0, BAR_IN * R, a, a - 0.38 * omegaSign, true)
        ctx.closePath()
        ctx.fill()

        const x0 = Math.cos(a) * BAR_IN * R
        const y0 = Math.sin(a) * BAR_IN * R
        const x1 = Math.cos(a) * BAR_OUT * R
        const y1 = Math.sin(a) * BAR_OUT * R
        ctx.save()
        if (!low) {
          ctx.shadowColor = 'rgba(242,193,78,0.6)'
          ctx.shadowBlur = 14
        }
        const grad = ctx.createLinearGradient(x0, y0, x1, y1)
        grad.addColorStop(0, C.goldDeep)
        grad.addColorStop(0.5, C.gold)
        grad.addColorStop(1, C.goldDeep)
        ctx.strokeStyle = grad
        ctx.lineCap = 'round'
        ctx.lineWidth = BAR_T * 2 * R
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
        ctx.restore()
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'
        ctx.lineWidth = Math.max(1, BAR_T * 0.5 * R)
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
      }
    }

    const drawHole = (hole: HoleState, now: number) => {
      const hr = hole.radius * R
      if (hole.mode === 'open') {
        for (let k = 0; k < 3; k++) {
          const p = 1 - ((now / 1100 + k / 3) % 1)
          ctx.strokeStyle = `rgba(176,110,240,${0.16 * (1 - p)})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(0, 0, hr + (PULL_REACH * R - hr) * p, 0, Math.PI * 2)
          ctx.stroke()
        }
        const g = ctx.createRadialGradient(0, 0, hr * 0.15, 0, 0, hr * 1.7)
        g.addColorStop(0, '#000000')
        g.addColorStop(0.52, '#05030a')
        g.addColorStop(0.6, 'rgba(176,110,240,0.95)')
        g.addColorStop(0.72, 'rgba(176,110,240,0.3)')
        g.addColorStop(1, 'rgba(176,110,240,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, hr * 1.7, 0, Math.PI * 2)
        ctx.fill()
        const spin = now * 0.0032
        ctx.strokeStyle = 'rgba(225,200,255,0.4)'
        ctx.lineWidth = Math.max(1, hr * 0.05)
        for (let k = 0; k < 6; k++) {
          ctx.beginPath()
          for (let s = 0; s <= 18; s++) {
            const t = s / 18
            const rad = hr * (1.02 - t * 0.92)
            const ang = (k / 6) * Math.PI * 2 + spin + t * 2.6
            if (s === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad)
            else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad)
          }
          ctx.stroke()
        }
        return
      }

      const lid = ctx.createRadialGradient(-hr * 0.3, -hr * 0.3, hr * 0.1, 0, 0, hr)
      lid.addColorStop(0, '#3a4358')
      lid.addColorStop(1, '#121722')
      ctx.fillStyle = lid
      ctx.beginPath()
      ctx.arc(0, 0, hr, 0, Math.PI * 2)
      ctx.fill()
      const warn = hole.mode === 'warn'
      const pulse = 0.55 + 0.45 * Math.sin(now / 90)
      ctx.strokeStyle = warn ? `rgba(239,79,90,${pulse})` : C.gold
      ctx.lineWidth = Math.max(2, hr * 0.12)
      ctx.beginPath()
      ctx.arc(0, 0, hr * 0.94, 0, Math.PI * 2)
      ctx.stroke()
      if (warn) {
        ctx.save()
        ctx.rotate(now / 600)
        ctx.setLineDash([hr * 0.22, hr * 0.16])
        ctx.strokeStyle = 'rgba(239,79,90,0.55)'
        ctx.lineWidth = Math.max(1.5, hr * 0.06)
        ctx.beginPath()
        ctx.arc(0, 0, hr * 1.25, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
        ctx.fillStyle = C.ruby
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `700 ${hr * 1.05}px "Space Grotesk", system-ui, sans-serif`
        ctx.fillText(hole.count === WARN ? '!' : String(hole.count), 0, hr * 0.06)
      } else {
        ctx.strokeStyle = 'rgba(242,193,78,0.35)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(0, 0, hr * 0.55, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = 'rgba(242,193,78,0.7)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `700 ${hr * 0.5}px "Space Grotesk", system-ui, sans-serif`
        ctx.fillText('A', 0, hr * 0.04)
      }
    }

    const drawSky = (now: number) => {
      const t = reduced ? 0 : now / 1000
      const base = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75)
      base.addColorStop(0, C.bgIn)
      base.addColorStop(1, C.bgOut)
      ctx.fillStyle = base
      ctx.fillRect(0, 0, w, h)

      ctx.globalCompositeOperation = 'lighter'
      const big = Math.max(w, h)
      for (const nb of NEBULAE) {
        const cx = w * (0.5 + nb.ax * Math.sin(t * nb.speed + nb.phase))
        const cy = h * (0.5 + nb.ay * Math.cos(t * nb.speed * 0.8 + nb.phase))
        const rad = big * nb.size
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
        g.addColorStop(0, nb.color)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }
      if (sim.final && !finished) {
        const pulse = 0.18 + 0.12 * Math.sin(now / 260)
        const g = ctx.createRadialGradient(w / 2, h / 2, R * 0.6, w / 2, h / 2, big * 0.75)
        g.addColorStop(0, 'rgba(239,79,90,0)')
        g.addColorStop(1, `rgba(239,79,90,${pulse})`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }
      ctx.globalCompositeOperation = 'source-over'

      for (const s of stars) {
        const x = ((s.x + t * s.drift) % 1) * w
        const y = s.y * h
        ctx.globalAlpha = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.twinkle + s.phase))
        ctx.fillStyle = '#fff4d6'
        ctx.fillRect(x, y, s.size, s.size)
      }
      ctx.globalAlpha = 1
    }

    const drawSwirl = (now: number) => {
      const t = reduced ? 0 : now / 1000
      ctx.save()
      ctx.beginPath()
      ctx.arc(0, 0, R * WALL, 0, Math.PI * 2)
      ctx.clip()
      ctx.globalCompositeOperation = 'lighter'
      const cg = ctx.createConicGradient(t * (sim.final ? 0.9 : 0.35), 0, 0)
      cg.addColorStop(0, 'rgba(123,63,228,0.26)')
      cg.addColorStop(0.25, 'rgba(31,181,201,0.04)')
      cg.addColorStop(0.5, 'rgba(224,69,139,0.2)')
      cg.addColorStop(0.75, 'rgba(31,181,201,0.16)')
      cg.addColorStop(1, 'rgba(123,63,228,0.26)')
      ctx.fillStyle = cg
      ctx.fillRect(-R, -R, R * 2, R * 2)
      const fade = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R * WALL)
      fade.addColorStop(0, 'rgba(0,0,0,0)')
      fade.addColorStop(1, 'rgba(176,110,240,0.12)')
      ctx.fillStyle = fade
      ctx.fillRect(-R, -R, R * 2, R * 2)
      ctx.restore()

      const rimR = R * (WALL + 0.025)
      const a = t * 1.3
      ctx.save()
      if (!low) {
        ctx.shadowColor = sim.final ? 'rgba(239,79,90,0.9)' : 'rgba(255,226,150,0.9)'
        ctx.shadowBlur = 20
      }
      ctx.strokeStyle = sim.final ? 'rgba(255,140,150,0.95)' : 'rgba(255,240,200,0.9)'
      ctx.lineWidth = R * 0.018
      ctx.lineCap = 'round'
      for (let k = 0; k < 2; k++) {
        ctx.beginPath()
        ctx.arc(0, 0, rimR, a + k * Math.PI, a + k * Math.PI + 0.55)
        ctx.stroke()
      }
      ctx.restore()
    }

    const drawWinnerLabel = (x: number, y: number, rr: number, i: number, alpha: number) => {
      const me = i === meIndex
      const name = me ? 'SEN' : players[i].name
      const fs = Math.max(11, Math.min(17, rr * 0.36))
      ctx.globalAlpha = alpha
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`
      const ny = y + rr + fs * 1.1
      ctx.fillStyle = me ? C.gold : '#f5f1e8'
      ctx.fillText(name, x, ny)
      if (prizeLabel) {
        const ps = fs * 0.85
        ctx.font = `700 ${ps}px "Space Grotesk", system-ui, sans-serif`
        const tw = ctx.measureText(prizeLabel).width
        const py = ny + fs * 1.25
        ctx.fillStyle = 'rgba(242,193,78,0.16)'
        ctx.beginPath()
        ctx.roundRect(x - tw / 2 - 8, py - ps * 0.75, tw + 16, ps * 1.5, ps * 0.75)
        ctx.fill()
        ctx.fillStyle = C.gold
        ctx.fillText(prizeLabel, x, py + 1)
      }
      ctx.globalAlpha = 1
    }

    const drawVictory = (now: number) => {
      // rAF timestamps can trail performance.now() by a frame, so clamp to avoid negative radii.
      const t = Math.max(0, (now - finishedAt) / 1000)
      const intro = Math.min(1, t / 0.6)

      ctx.fillStyle = `rgba(5,7,12,${0.7 * intro})`
      ctx.fillRect(-w, -h, w * 2, h * 2)

      if (t < 1.2) {
        const p = t / 1.2
        ctx.strokeStyle = `rgba(255,236,180,${0.8 * (1 - p)})`
        ctx.lineWidth = R * 0.03 * (1 - p) + 1
        ctx.beginPath()
        ctx.arc(0, 0, R * 1.5 * p, 0, Math.PI * 2)
        ctx.stroke()
      }

      const p = Math.min(1, Math.max(0, (t - 0.15) / 1.0))
      const e = reduced ? 1 : easeOutBack(p)
      const cy = spots.length ? spots.reduce((s, sp) => s + sp.ty, 0) / spots.length : 0

      ctx.save()
      ctx.globalAlpha = intro
      ctx.translate(0, cy * R)
      const rays = ctx.createConicGradient(reduced ? 0 : t * 0.25, 0, 0)
      for (let k = 0; k <= 12; k++) rays.addColorStop(k / 12, k % 2 ? 'rgba(242,193,78,0)' : 'rgba(242,193,78,0.14)')
      ctx.fillStyle = rays
      ctx.beginPath()
      ctx.arc(0, 0, R * 1.4, 0, Math.PI * 2)
      ctx.fill()
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.9)
      halo.addColorStop(0, 'rgba(242,193,78,0.28)')
      halo.addColorStop(1, 'rgba(242,193,78,0)')
      ctx.fillStyle = halo
      ctx.fillRect(-R * 1.4, -R * 1.4, R * 2.8, R * 2.8)
      ctx.restore()

      for (const sp of spots) {
        const x = (sp.fx + (sp.tx - sp.fx) * e) * R
        const y = (sp.fy + (sp.ty - sp.fy) * e) * R
        const rr = (r + (sp.tr - r) * e) * R
        const glow = 0.55 + 0.25 * Math.sin(t * 4 + sp.i)
        ctx.save()
        if (!low) {
          ctx.shadowColor = `rgba(242,193,78,${glow})`
          ctx.shadowBlur = rr * 0.9
        }
        ctx.strokeStyle = C.gold
        ctx.lineWidth = Math.max(2.5, rr * 0.1)
        ctx.beginPath()
        ctx.arc(x, y, rr * 1.12, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
        drawBall(sp.i, x, y, rr, 1, false)
        if (p > 0.55) drawWinnerLabel(x, y, rr * 1.12, sp.i, Math.min(1, (p - 0.55) / 0.35))
      }

      for (const c of confetti) {
        ctx.save()
        ctx.translate(c.x * R, c.y * R)
        ctx.rotate(c.rot)
        ctx.fillStyle = c.color
        const s = c.size * R
        ctx.fillRect(-s / 2, -s / 4, s, s / 2)
        ctx.restore()
      }
    }

    let raf = 0
    let last = performance.now()
    let acc = 0

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const slow = sim.final && sim.alive === sim.winners + 1 && !finished
      if (!finished) {
        const liveClock = clockRef.current
        if (startAt !== undefined && liveClock) {
          // Live rounds follow the shared wall clock so every viewer sees the same moment; no slow motion here.
          const target = Math.floor((liveClock() - startAt) / 1000 / STEP)
          const behind = target - sim.step
          while (sim.step < target && !finished) advance(behind > CATCHUP_STEPS && target - sim.step > 2)
        } else {
          acc += dt * (slow ? 0.45 : 1)
          while (acc >= STEP && !finished) {
            advance(false)
            acc -= STEP
          }
        }
      }

      // A gentle push-in only; larger zooms would crop the rim out of frame.
      const tz = slow && !reduced ? 1.06 : 1
      if (finished) {
        if (!doneSent && now - finishedAt > 1700) {
          doneSent = true
          eventRef.current({
            type: 'done',
            winners: balls.flatMap((b, i) => (b.alive ? [i] : [])),
            seconds: Math.round(sim.time),
          })
        }
      }
      const ease = Math.min(1, dt * 3)
      zoom += (tz - zoom) * ease
      camX += (0 - camX) * ease
      camY += (0 - camY) * ease
      shake = Math.max(0, shake - dt * 3.5)

      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i]
        c.x += (c.vx + Math.sin(now / 400 + i) * 0.08) * dt
        c.y += c.vy * dt
        c.rot += c.vr * dt
        if (c.y > 1.3) confetti.splice(i, 1)
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life -= dt
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= 0.93
        p.vy *= 0.93
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawSky(now)
      const sx = shake ? (Math.random() - 0.5) * 9 * shake : 0
      const sy = shake ? (Math.random() - 0.5) * 9 * shake : 0
      ctx.translate(w / 2 + sx, h / 2 + sy)
      ctx.scale(zoom, zoom)
      ctx.translate(-camX * R, -camY * R)
      if (floor) ctx.drawImage(floor, -floorSize / 2, -floorSize / 2, floorSize, floorSize)
      drawSwirl(now)

      const hole = holeState(sim.time, sim.final, sim.finalAt)
      drawHole(hole, now)
      drawBars(1)

      for (let k = fallers.length - 1; k >= 0; k--) {
        const f = fallers[k]
        const p = (now - f.at) / 850
        if (p >= 1) {
          fallers.splice(k, 1)
          continue
        }
        const d0 = Math.sqrt(f.x * f.x + f.y * f.y)
        const a0 = Math.atan2(f.y, f.x)
        const d = d0 * (1 - p) ** 1.6
        const a = a0 + p * Math.PI * 3
        drawBall(f.i, Math.cos(a) * d * R, Math.sin(a) * d * R, r * R * (1 - p * 0.85), 1 - p * 0.5, false)
      }

      if (!finished) {
        const showNames = sim.alive <= 12
        for (let i = 0; i < n; i++) {
          const b = balls[i]
          if (!b.alive || i === meIndex) continue
          drawBall(i, b.x * R, b.y * R, r * R, 1, showNames)
        }
        if (meIndex >= 0 && balls[meIndex].alive) drawBall(meIndex, balls[meIndex].x * R, balls[meIndex].y * R, r * R, 1, true)
      }

      for (const p of particles) {
        ctx.globalAlpha = p.life / p.max
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x * R, p.y * R, Math.max(1, p.size * R), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      if (finished) drawVictory(now)

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    kdSound.music.start('karadelik')
    const groove = setTimeout(() => kdSound.music.setIntensity(1), 5000)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      clearTimeout(groove)
      kdSound.music.stop(0.6)
    }
  }, [players, duration, winners, prizePool])

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" role="img" aria-label="Kara Delik Arenası canlı oyun alanı" />
}
