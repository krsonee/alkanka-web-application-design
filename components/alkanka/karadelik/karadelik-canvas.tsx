'use client'

import { useEffect, useRef } from 'react'
import { kdSound } from './kd-sound'

export type KDPlayer = { id: string; name: string; image: string; me: boolean }

export type KDEvent =
  | { type: 'tick'; left: number }
  | { type: 'out'; index: number; alive: number }
  | { type: 'final' }
  | { type: 'done'; winners: number[]; seconds: number }

type Props = {
  players: KDPlayer[]
  /** Seconds before the Final Battle starts. */
  duration: number
  /** How many survivors take a prize. */
  winners: number
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

const WALL = 0.95
const BAR_IN = 0.34
const BAR_OUT = 0.84
const BAR_T = 0.024
const HOLE_R = 0.16
const PULL_REACH = 0.7
const STEP = 1 / 120
const CYCLE = 11
const CLOSED = 5.5
const WARN = 3
const SPRITE = 128

type Ball = { x: number; y: number; vx: number; vy: number; alive: boolean }
type Faller = { i: number; x: number; y: number; at: number }
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
type HoleState = { mode: 'closed' | 'warn' | 'open'; count: number; radius: number }

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

function holeState(time: number, final: boolean, finalAt: number): HoleState {
  if (final) return { mode: 'open', count: 0, radius: HOLE_R + Math.min(0.13, (time - finalAt) * 0.016) }
  const c = (time + 2) % CYCLE
  if (c < CLOSED) return { mode: 'closed', count: 0, radius: HOLE_R }
  if (c < CLOSED + WARN) return { mode: 'warn', count: Math.ceil(CLOSED + WARN - c), radius: HOLE_R }
  return { mode: 'open', count: 0, radius: HOLE_R }
}

export function KaraDelikCanvas({ players, duration, winners, onEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const eventRef = useRef(onEvent)
  eventRef.current = onEvent

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const low = (navigator.hardwareConcurrency ?? 8) <= 4
    const maxParticles = low ? 60 : 220

    const n = players.length
    const r = Math.min(0.1, Math.sqrt(0.28 / n))
    const balls: Ball[] = []
    for (let i = 0; i < n; i++) {
      let x = 0
      let y = 0
      for (let tries = 0; tries < 300; tries++) {
        const a = Math.random() * Math.PI * 2
        const d = 0.32 + Math.random() * (WALL - r - 0.34)
        x = Math.cos(a) * d
        y = Math.sin(a) * d
        if (balls.every((b) => (b.x - x) ** 2 + (b.y - y) ** 2 > (2.05 * r) ** 2)) break
      }
      const va = Math.random() * Math.PI * 2
      balls.push({ x, y, vx: Math.cos(va) * 0.5, vy: Math.sin(va) * 0.5, alive: true })
    }

    const sprites = players.map((p) => makeSprite(p.name, null))
    players.forEach((p, i) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        sprites[i] = makeSprite(p.name, img)
      }
      img.src = p.image
    })
    const meIndex = players.findIndex((p) => p.me)

    let time = 0
    let alive = n
    let barAngle = 0
    let final = false
    let finalAt = 0
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
    }

    const eliminate = (i: number) => {
      const b = balls[i]
      b.alive = false
      alive--
      fallers.push({ i, x: b.x, y: b.y, at: performance.now() })
      burst(b.x, b.y, 14, [C.hole, C.gold, '#ffffff'], 0.9, 0.012)
      if (!reduced) shake = Math.min(1, shake + 0.55)
      kdSound.out()
      eventRef.current({ type: 'out', index: i, alive })
      if (alive <= winners) finish()
    }

    const step = () => {
      time += STEP
      if (!final && time >= duration) {
        if (alive > winners) {
          final = true
          finalAt = time
          kdSound.final()
          eventRef.current({ type: 'final' })
        } else {
          finish()
          return
        }
      }

      const left = final ? 0 : Math.max(0, Math.ceil(duration - time))
      if (left !== lastTick) {
        lastTick = left
        eventRef.current({ type: 'tick', left })
        if (left > 0 && left <= 10) kdSound.beat()
      }

      const hole = holeState(time, final, finalAt)
      if (hole.mode === 'warn' && hole.count !== lastWarnCount) kdSound.warn()
      lastWarnCount = hole.mode === 'warn' ? hole.count : 0
      const omega = final ? 1.7 : 1
      barAngle += omega * STEP
      // In the Final Battle the pull reaches the rim and keeps growing, so the round always ends.
      const sinceFinal = final ? time - finalAt : 0
      const reach = final ? 1.3 : PULL_REACH
      const pull = final ? 1.2 + sinceFinal * 0.3 : 1.4
      const maxSpeed = final ? 1.3 + Math.min(0.8, sinceFinal * 0.04) : 1.3

      for (let i = 0; i < n; i++) {
        const b = balls[i]
        if (!b.alive) continue
        let d = Math.sqrt(b.x * b.x + b.y * b.y) || 1e-6

        if (hole.mode === 'open' && d < reach) {
          const s = pull * (1 - d / reach) + 0.3
          b.vx += (-b.x / d) * s * STEP + (-b.y / d) * 0.4 * STEP
          b.vy += (-b.y / d) * s * STEP + (b.x / d) * 0.4 * STEP
        }

        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1e-6
        const target = sp < 0.35 ? 0.35 : sp > maxSpeed ? maxSpeed : sp
        b.vx *= target / sp
        b.vy *= target / sp
        b.x += b.vx * STEP
        b.y += b.vy * STEP
        d = Math.sqrt(b.x * b.x + b.y * b.y) || 1e-6

        if (d + r > WALL) {
          const nx = b.x / d
          const ny = b.y / d
          b.x = nx * (WALL - r)
          b.y = ny * (WALL - r)
          const vn = b.vx * nx + b.vy * ny
          if (vn > 0) {
            b.vx -= 2 * vn * nx
            b.vy -= 2 * vn * ny
          }
        }

        if (hole.mode === 'open') {
          if (d < hole.radius - r * 0.2) {
            eliminate(i)
            if (finished) return
            continue
          }
        } else if (d < HOLE_R + r) {
          const nx = b.x / d
          const ny = b.y / d
          b.x = nx * (HOLE_R + r)
          b.y = ny * (HOLE_R + r)
          const vn = b.vx * nx + b.vy * ny
          if (vn < 0) {
            b.vx -= 2 * vn * nx
            b.vy -= 2 * vn * ny
          }
        }

        for (let k = 0; k < 2; k++) {
          const a = barAngle + k * Math.PI
          const ux = Math.cos(a)
          const uy = Math.sin(a)
          const proj = Math.min(BAR_OUT, Math.max(BAR_IN, b.x * ux + b.y * uy))
          const px = ux * proj
          const py = uy * proj
          const dx = b.x - px
          const dy = b.y - py
          const dist = Math.sqrt(dx * dx + dy * dy) || 1e-6
          if (dist < r + BAR_T) {
            const nx = dx / dist
            const ny = dy / dist
            b.x = px + nx * (r + BAR_T)
            b.y = py + ny * (r + BAR_T)
            const bvx = -omega * py
            const bvy = omega * px
            const rn = (b.vx - bvx) * nx + (b.vy - bvy) * ny
            if (rn < 0) {
              b.vx -= 1.9 * rn * nx
              b.vy -= 1.9 * rn * ny
              if (-rn > 0.7) {
                burst(px + nx * BAR_T, py + ny * BAR_T, 3, [C.gold, '#ffffff'], 0.6, 0.007)
                kdSound.hit(-rn)
              }
            }
          }
        }
      }

      const min = 2 * r
      for (let i = 0; i < n; i++) {
        const a = balls[i]
        if (!a.alive) continue
        for (let j = i + 1; j < n; j++) {
          const b = balls[j]
          if (!b.alive) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const d2 = dx * dx + dy * dy
          if (d2 >= min * min || d2 < 1e-12) continue
          const d = Math.sqrt(d2)
          const nx = dx / d
          const ny = dy / d
          const overlap = (min - d) / 2
          a.x -= nx * overlap
          a.y -= ny * overlap
          b.x += nx * overlap
          b.y += ny * overlap
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
          if (rel > 0) {
            a.vx -= rel * nx
            a.vy -= rel * ny
            b.vx += rel * nx
            b.vy += rel * ny
            if (rel > 0.95) {
              burst(a.x + nx * r, a.y + ny * r, 2, ['#ffffff', C.gold], 0.4, 0.006)
              kdSound.hit(rel * 0.6)
            }
          }
        }
      }
    }

    let w = 0
    let h = 0
    let R = 0
    let dpr = 1
    let floor: HTMLCanvasElement | null = null

    const buildFloor = () => {
      const f = document.createElement('canvas')
      f.width = Math.round(w * dpr)
      f.height = Math.round(h * dpr)
      const g = f.getContext('2d')!
      g.scale(dpr, dpr)
      g.translate(w / 2, h / 2)
      const bg = g.createRadialGradient(0, 0, R * 0.2, 0, 0, Math.max(w, h) * 0.75)
      bg.addColorStop(0, C.bgIn)
      bg.addColorStop(1, C.bgOut)
      g.fillStyle = bg
      g.fillRect(-w / 2, -h / 2, w, h)

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
        const a = barAngle + k * Math.PI
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

    let raf = 0
    let last = performance.now()
    let acc = 0

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const slow = final && alive === winners + 1 && !finished
      if (!finished) {
        acc += dt * (slow ? 0.45 : 1)
        while (acc >= STEP && !finished) {
          step()
          acc -= STEP
        }
      }

      let tx = 0
      let ty = 0
      let tz = slow ? 1.12 : 1
      if (finished) {
        let k = 0
        for (const b of balls) {
          if (!b.alive) continue
          tx += b.x
          ty += b.y
          k++
        }
        if (k) {
          tx /= k
          ty /= k
        }
        tz = winners === 1 ? 1.6 : winners <= 3 ? 1.35 : 1.15
        if (!doneSent && now - finishedAt > 2300) {
          doneSent = true
          eventRef.current({
            type: 'done',
            winners: balls.flatMap((b, i) => (b.alive ? [i] : [])),
            seconds: Math.round(time),
          })
        }
      }
      const ease = Math.min(1, dt * 3)
      zoom += (tz - zoom) * ease
      camX += (tx - camX) * ease
      camY += (ty - camY) * ease
      shake = Math.max(0, shake - dt * 3.5)

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
      ctx.fillStyle = C.bgOut
      ctx.fillRect(0, 0, w, h)
      const sx = shake ? (Math.random() - 0.5) * 9 * shake : 0
      const sy = shake ? (Math.random() - 0.5) * 9 * shake : 0
      ctx.translate(w / 2 + sx, h / 2 + sy)
      ctx.scale(zoom, zoom)
      ctx.translate(-camX * R, -camY * R)
      if (floor) ctx.drawImage(floor, -w / 2, -h / 2, w, h)

      const hole = holeState(time, final, finalAt)
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

      const showNames = alive <= 12
      for (let i = 0; i < n; i++) {
        const b = balls[i]
        if (!b.alive || i === meIndex) continue
        drawBall(i, b.x * R, b.y * R, r * R, 1, showNames)
      }
      if (meIndex >= 0 && balls[meIndex].alive) drawBall(meIndex, balls[meIndex].x * R, balls[meIndex].y * R, r * R, 1, true)

      if (finished) {
        const t = (now - finishedAt) / 1000
        for (const b of balls) {
          if (!b.alive) continue
          const pr = r * R * (1.25 + 0.15 * Math.sin(t * 6))
          ctx.strokeStyle = `rgba(242,193,78,${0.85 - 0.25 * Math.sin(t * 6)})`
          ctx.lineWidth = Math.max(2, r * R * 0.12)
          ctx.beginPath()
          ctx.arc(b.x * R, b.y * R, pr, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      for (const p of particles) {
        ctx.globalAlpha = p.life / p.max
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x * R, p.y * R, Math.max(1, p.size * R), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [players, duration, winners])

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" role="img" aria-label="Kara Delik Arenası canlı oyun alanı" />
}
