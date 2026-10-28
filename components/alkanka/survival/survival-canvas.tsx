'use client'

import { useEffect, useRef } from 'react'
import { kdSound } from '../karadelik/kd-sound'
import {
  SV_GOAL_DEPTH as DEPTH,
  SV_HH as HH,
  SV_HW as HW,
  SV_STEP as STEP,
  SV_ENTER_GRACE,
  createSV,
  stepSV,
  svAlive,
  svGoals,
  svWinners,
  type SVRule,
} from '@/lib/survival-sim'

export type SVPlayer = { id: string; name: string; image: string; me: boolean }

export type SVEvent =
  | { type: 'tick'; left: number; waiting: number }
  | { type: 'out'; index: number; alive: number; teamAlive: [number, number] }
  | { type: 'enter'; index: number }
  | { type: 'final'; suddenDeath: boolean }
  | { type: 'done'; winners: number[]; winningTeam: number; seconds: number }

type Props = {
  players: SVPlayer[]
  duration: number
  winners: number
  teams: 0 | 2
  rule: SVRule
  shield: boolean
  prizePool?: number
  seed: number
  /** Live rounds lock the simulation to this wall-clock start; previews run freely. */
  startAt?: number
  now?: () => number
  onEvent: (e: SVEvent) => void
}

// Canvas can't read Tailwind tokens; these mirror the site palette plus the pitch greens and team colours.
const C = {
  night: '#070a10',
  stand: '#0f1420',
  grassA: '#1d7a43',
  grassB: '#23904f',
  line: 'rgba(255,255,255,0.82)',
  gold: '#f2c14e',
  goldDeep: '#9c6c17',
  blue: '#4f8ff7',
  blueDeep: '#1f4fb0',
  ink: '#0b0f17',
  lid: '#2a3142',
}
const TEAM = [
  { ring: C.gold, deep: C.goldDeep, name: 'ALTIN' },
  { ring: C.blue, deep: C.blueDeep, name: 'MAVİ' },
]
const LIGHTS = [
  { color: 'rgba(242,193,78,0.38)', speed: 0.23, phase: 0, side: -1 },
  { color: 'rgba(79,143,247,0.36)', speed: 0.19, phase: 2.4, side: 1 },
  { color: 'rgba(63,208,160,0.26)', speed: 0.31, phase: 4.1, side: -1 },
  { color: 'rgba(239,79,90,0.22)', speed: 0.27, phase: 1.2, side: 1 },
]
const CONFETTI_COLORS = ['#f2c14e', '#fff4d6', '#4f8ff7', '#3fd0a0', '#ef4f5a']
const SPRITE = 128
const CATCHUP_STEPS = 30

type Faller = { i: number; x: number; y: number; side: number; at: number }
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
type Ripple = { side: number; y: number; at: number }
type Spot = { i: number; fx: number; fy: number; tx: number; ty: number; tr: number }
type Confetti = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string }

function easeOutBack(p: number) {
  const c1 = 1.70158
  return 1 + (c1 + 1) * (p - 1) ** 3 + c1 * (p - 1) ** 2
}

function makeSprite(name: string, img: HTMLImageElement | null) {
  const c = document.createElement('canvas')
  c.width = SPRITE
  c.height = SPRITE
  const g = c.getContext('2d')!
  const h = SPRITE / 2
  g.beginPath()
  g.arc(h, h, h, 0, Math.PI * 2)
  g.clip()
  g.fillStyle = C.lid
  g.fillRect(0, 0, SPRITE, SPRITE)
  if (img && img.naturalWidth) {
    const s = Math.max(SPRITE / img.naturalWidth, SPRITE / img.naturalHeight)
    g.drawImage(img, h - (img.naturalWidth * s) / 2, h - (img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s)
  } else {
    g.fillStyle = C.gold
    g.font = `700 ${SPRITE * 0.38}px "Space Grotesk", system-ui, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(name.trim().slice(0, 2).toUpperCase() || 'AK', h, h + 2)
  }
  const gloss = g.createRadialGradient(h * 0.7, h * 0.45, 0, h * 0.7, h * 0.45, h * 1.1)
  gloss.addColorStop(0, 'rgba(255,255,255,0.3)')
  gloss.addColorStop(0.45, 'rgba(255,255,255,0.04)')
  gloss.addColorStop(1, 'rgba(0,0,0,0.3)')
  g.fillStyle = gloss
  g.fillRect(0, 0, SPRITE, SPRITE)
  return c
}

export function SurvivalCanvas({ players, duration, winners, teams, rule, shield, prizePool = 0, seed, startAt, now: clock, onEvent }: Props) {
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
    const maxParticles = low ? 60 : 200

    const sim = createSV({ n: players.length, seed, duration, winners, teams, rule, shield })
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
    let shake = 0
    let finalFlash = 0
    const fallers: Faller[] = []
    const particles: Particle[] = []
    const ripples: Ripple[] = []
    const flashes: { i: number; at: number }[] = []
    const confetti: Confetti[] = []
    let spots: Spot[] = []
    let title = ''
    let prizeLabel = ''

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
      const list = svWinners(sim)
      const real = list.length
      if (teams) title = `${TEAM[sim.winningTeam]?.name ?? ''} TAKIM KAZANDI`
      else title = real === 1 ? 'SAHANIN SON HAKİMİ' : 'SAHADA AYAKTA KALANLAR'
      prizeLabel = prizePool > 0 && real > 0 ? `Kişi başı +${Math.floor(prizePool / real).toLocaleString('tr-TR')} KC` : ''
      const k = list.length
      const rows = k > 5 ? 2 : 1
      const perRow = Math.ceil(k / rows)
      const spacing = Math.min(0.42, 1.12 / perRow)
      const tr = Math.min(k === 1 ? 0.2 : 0.15, spacing * 0.36)
      const rowGap = tr * 2 + 0.22
      const top = -0.12 - ((rows - 1) * rowGap) / 2
      spots = list.map((i, idx) => {
        const row = Math.floor(idx / perRow)
        const inRow = row === rows - 1 ? k - perRow * (rows - 1) : perRow
        const col = idx - row * perRow
        const b = balls[i]
        const from = b.state === 2 ? { x: 0, y: HH + 0.3 } : { x: b.x, y: b.y }
        return { i, fx: from.x, fy: from.y, tx: (col - (inRow - 1) / 2) * spacing, ty: top + row * rowGap, tr }
      })
      if (!reduced) {
        for (let c = 0; c < (low ? 60 : 150); c++) {
          confetti.push({
            x: (Math.random() - 0.5) * 1.6,
            y: -1.2 - Math.random() * 1.2,
            vx: (Math.random() - 0.5) * 0.3,
            vy: 0.35 + Math.random() * 0.45,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 9,
            size: 0.012 + Math.random() * 0.014,
            color: teams ? (c % 3 === 0 ? '#fff4d6' : TEAM[sim.winningTeam]?.ring ?? C.gold) : CONFETTI_COLORS[c % CONFETTI_COLORS.length],
          })
        }
      }
    }

    const advance = (quiet: boolean) => {
      stepSV(sim)
      if (sim.finalNow) {
        if (!quiet) {
          kdSound.final()
          finalFlash = 1
        }
        eventRef.current({ type: 'final', suddenDeath: sim.suddenDeath })
      }
      for (const { i, side } of sim.out) {
        const b = balls[i]
        if (!quiet) {
          fallers.push({ i, x: b.x, y: b.y, side, at: performance.now() })
          ripples.push({ side, y: b.y, at: performance.now() })
          burst(side * HW, b.y, 16, ['#ffffff', teams ? TEAM[b.team].ring : C.gold, '#3fd0a0'], 0.9, 0.012)
          if (!reduced) shake = Math.min(1, shake + 0.5)
          kdSound.out()
        }
        eventRef.current({ type: 'out', index: i, alive: svAlive(sim), teamAlive: [svAlive(sim, 0), svAlive(sim, 1)] })
      }
      for (const i of sim.entered) {
        if (!quiet) {
          flashes.push({ i, at: performance.now() })
          burst(balls[i].x, balls[i].y, 10, ['#ffffff', C.gold], 0.5, 0.008)
        }
        eventRef.current({ type: 'enter', index: i })
      }
      if (!quiet) {
        for (const i of sim.shielded) burst(balls[i].x, balls[i].y, 4, ['#bfe8ff', '#ffffff'], 0.4, 0.007)
        for (const hit of sim.hits.slice(0, 3)) {
          burst(hit.x, hit.y, 3, ['#ffffff', C.gold], 0.5, 0.006)
          kdSound.hit(hit.s)
        }
      }
      let waiting = 0
      for (const q of sim.queue) waiting += q.length
      const left = sim.final ? 0 : Math.max(0, Math.ceil(duration - sim.clock))
      const tickKey = left * 1000 + waiting
      if (tickKey !== lastTick) {
        if (!quiet && left !== Math.floor(lastTick / 1000) && left > 0 && left <= 10) kdSound.beat()
        lastTick = tickKey
        eventRef.current({ type: 'tick', left, waiting })
      }
      if (sim.finished && !finished) finish()
    }

    let w = 0
    let h = 0
    let S = 0
    let dpr = 1
    let pitch: HTMLCanvasElement | null = null

    const buildPitch = () => {
      const pw = (HW + DEPTH + 0.08) * 2 * S
      const ph = (HH + 0.08) * 2 * S
      const f = document.createElement('canvas')
      f.width = Math.round(pw * dpr)
      f.height = Math.round(ph * dpr)
      const g = f.getContext('2d')!
      g.scale(dpr, dpr)
      g.translate(pw / 2, ph / 2)
      const X = HW * S
      const Y = HH * S
      g.save()
      g.shadowColor = 'rgba(0,0,0,0.6)'
      g.shadowBlur = 30
      g.fillStyle = C.grassA
      g.fillRect(-X, -Y, X * 2, Y * 2)
      g.restore()
      const stripes = 10
      for (let k = 0; k < stripes; k++) {
        g.fillStyle = k % 2 ? C.grassB : C.grassA
        g.fillRect(-X, -Y + (k * Y * 2) / stripes, X * 2, (Y * 2) / stripes + 1)
      }
      // Mowing grain and a soft vignette give the turf depth.
      for (let k = 0; k < 900; k++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'
        g.fillRect(-X + Math.random() * X * 2, -Y + Math.random() * Y * 2, 1.5, 3)
      }
      const vig = g.createRadialGradient(0, 0, Y * 0.3, 0, 0, Y * 1.25)
      vig.addColorStop(0, 'rgba(255,255,255,0.06)')
      vig.addColorStop(1, 'rgba(0,0,0,0.38)')
      g.fillStyle = vig
      g.fillRect(-X, -Y, X * 2, Y * 2)

      g.strokeStyle = C.line
      g.lineWidth = Math.max(1.5, S * 0.008)
      g.strokeRect(-X + 1, -Y + 1, X * 2 - 2, Y * 2 - 2)
      g.beginPath()
      g.moveTo(-X, 0)
      g.lineTo(X, 0)
      g.stroke()
      g.beginPath()
      g.arc(0, 0, S * 0.2, 0, Math.PI * 2)
      g.stroke()
      g.fillStyle = C.line
      g.beginPath()
      g.arc(0, 0, S * 0.014, 0, Math.PI * 2)
      g.fill()
      for (const side of [-1, 1]) {
        g.strokeRect(side > 0 ? X - S * 0.22 : -X, -S * 0.45, S * 0.22, S * 0.9)
        g.strokeRect(side > 0 ? X - S * 0.09 : -X, -S * 0.22, S * 0.09, S * 0.44)
        g.beginPath()
        g.arc(side * (X - S * 0.22), 0, S * 0.1, side > 0 ? Math.PI / 2 : -Math.PI / 2, side > 0 ? (Math.PI * 3) / 2 : Math.PI / 2)
        g.stroke()
      }
      for (const [cx, cy] of [[-X, -Y], [X, -Y], [-X, Y], [X, Y]]) {
        g.beginPath()
        g.arc(cx, cy, S * 0.035, 0, Math.PI * 2)
        g.stroke()
      }
      // Alkanka crest painted on the centre spot.
      g.save()
      g.globalAlpha = 0.16
      g.fillStyle = '#ffffff'
      g.font = `800 ${S * 0.07}px "Space Grotesk", system-ui, sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('ALKANKA', 0, -S * 0.33)
      g.fillText('ALKANKA', 0, S * 0.33)
      g.restore()
      pitch = f
    }

    const layout = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      S = Math.min(w / ((HW + DEPTH + 0.14) * 2), h / ((HH + 0.12) * 2))
      buildPitch()
    }
    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(canvas)

    const drawBackdrop = (t: number) => {
      ctx.fillStyle = C.night
      ctx.fillRect(-w, -h, w * 2, h * 2)
      // Floodlight beams sweeping across the stands keep the arena alive and colourful.
      for (const L of LIGHTS) {
        const a = Math.sin(t * L.speed + L.phase)
        const x = L.side * w * 0.45 + a * w * 0.25
        const y = -h * 0.55 + Math.cos(t * L.speed * 0.7 + L.phase) * h * 0.15
        const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.7)
        g.addColorStop(0, L.color)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(-w, -h, w * 2, h * 2)
      }
      // Crowd: rows of flickering phone lights around the pitch.
      const X = (HW + DEPTH + 0.06) * S
      const Y = (HH + 0.06) * S
      for (let k = 0; k < (low ? 60 : 140); k++) {
        const u = (k * 0.618) % 1
        const side = k % 4
        const flick = 0.25 + 0.75 * Math.abs(Math.sin(t * (1.2 + (k % 7) * 0.3) + k))
        ctx.fillStyle = `rgba(255,${200 + (k % 3) * 20},${150 + (k % 5) * 20},${0.12 + flick * 0.25})`
        let x = 0
        let y = 0
        if (side === 0) [x, y] = [-X - 8 - (k % 3) * 7, -Y + u * Y * 2]
        else if (side === 1) [x, y] = [X + 8 + (k % 3) * 7, -Y + u * Y * 2]
        else if (side === 2) [x, y] = [-X + u * X * 2, -Y - 8 - (k % 3) * 6]
        else [x, y] = [-X + u * X * 2, Y + 8 + (k % 3) * 6]
        ctx.fillRect(x, y, 2, 2)
      }
    }

    const drawGoal = (side: number, cy: number, gh: number, now: number) => {
      const x0 = side * HW * S
      const x1 = side * (HW + DEPTH) * S
      const y0 = (cy - gh) * S
      const y1 = (cy + gh) * S
      ctx.fillStyle = 'rgba(5,8,14,0.55)'
      ctx.fillRect(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0)
      // Net mesh that bulges where someone just got knocked in.
      ctx.save()
      ctx.beginPath()
      ctx.rect(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0)
      ctx.clip()
      ctx.strokeStyle = 'rgba(255,255,255,0.32)'
      ctx.lineWidth = 1
      const cell = Math.max(5, S * 0.022)
      const bulge = (y: number) => {
        let off = 0
        for (const rp of ripples) {
          if (rp.side !== side) continue
          const age = (now - rp.at) / 600
          if (age > 1) continue
          const d = (y / S - rp.y) / 0.12
          off += Math.exp(-d * d) * (1 - age) * Math.sin(age * 12) * S * 0.03
        }
        return off
      }
      for (let y = y0; y <= y1; y += cell) {
        ctx.beginPath()
        ctx.moveTo(x0, y)
        ctx.lineTo(x1 + side * bulge(y), y)
        ctx.stroke()
      }
      for (let k = 0; k <= 5; k++) {
        const x = x0 + ((x1 - x0) * k) / 5
        ctx.beginPath()
        for (let y = y0; y <= y1; y += cell / 2) {
          const xx = x + side * bulge(y) * (k / 5)
          if (y === y0) ctx.moveTo(xx, y)
          else ctx.lineTo(xx, y)
        }
        ctx.stroke()
      }
      ctx.restore()
      ctx.save()
      if (!low) {
        ctx.shadowColor = sim.final ? 'rgba(239,79,90,0.8)' : 'rgba(255,255,255,0.6)'
        ctx.shadowBlur = 12
      }
      ctx.strokeStyle = sim.final ? '#ffd7d9' : '#ffffff'
      ctx.lineWidth = Math.max(3, S * 0.018)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y0)
      ctx.lineTo(x1, y1)
      ctx.lineTo(x0, y1)
      ctx.stroke()
      ctx.restore()
    }

    const drawBall = (i: number, x: number, y: number, rr: number, alpha: number, showName: boolean, now: number) => {
      const b = balls[i]
      ctx.globalAlpha = alpha
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.ellipse(x + rr * 0.15, y + rr * 0.35, rr * 0.95, rr * 0.6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.drawImage(sprites[i], x - rr, y - rr, rr * 2, rr * 2)
      const me = i === meIndex
      const ring = teams ? TEAM[b.team].ring : me ? C.gold : 'rgba(255,255,255,0.85)'
      ctx.strokeStyle = ring
      ctx.lineWidth = Math.max(2, rr * (teams || me ? 0.2 : 0.12))
      ctx.beginPath()
      ctx.arc(x, y, rr, 0, Math.PI * 2)
      ctx.stroke()
      if (b.shieldUntil > sim.time && b.state === 1) {
        ctx.strokeStyle = `rgba(191,232,255,${0.5 + 0.4 * Math.sin(now / 80)})`
        ctx.lineWidth = Math.max(2, rr * 0.12)
        ctx.beginPath()
        ctx.arc(x, y, rr * 1.28, 0, Math.PI * 2)
        ctx.stroke()
      }
      if (showName || me) {
        const label = me ? 'SEN' : players[i].name
        const fs = Math.max(10, Math.min(13, rr * 0.5))
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

    const live = startAt !== undefined
    const t0 = performance.now()
    let simClock = 0
    let lastFrame = t0
    let raf = 0

    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (nowMs - lastFrame) / 1000)
      lastFrame = nowMs

      if (!finished) {
        if (live) {
          const wall = (clockRef.current ? clockRef.current() : Date.now()) - (startAt as number)
          const target = Math.floor(Math.max(0, wall) / 1000 / STEP)
          const behind = target - sim.step
          let k = 0
          while (sim.step < target && !sim.finished && k < 2000) {
            advance(behind > CATCHUP_STEPS && target - sim.step > CATCHUP_STEPS)
            k++
          }
        } else {
          // Previews slow down for the deciding knock-out.
          let slow = 1
          if (sim.final) {
            const left = teams ? Math.min(svAlive(sim, 0), svAlive(sim, 1)) : svAlive(sim) - sim.opts.winners
            if (left <= 1 && !reduced) slow = 0.5
          }
          simClock += dt * slow
          while (sim.step * STEP < simClock && !sim.finished) advance(false)
        }
      }
      if (finished && !doneSent && nowMs - finishedAt > 2600) {
        doneSent = true
        eventRef.current({ type: 'done', winners: svWinners(sim), winningTeam: sim.winningTeam, seconds: Math.round(sim.time) })
      }

      const t = (nowMs - t0) / 1000
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.translate(w / 2, h / 2)
      drawBackdrop(t)
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake * 8, (Math.random() - 0.5) * shake * 8)
        shake = Math.max(0, shake - dt * 3)
      }
      if (pitch) {
        const pw = pitch.width / dpr
        const ph = pitch.height / dpr
        ctx.drawImage(pitch, -pw / 2, -ph / 2, pw, ph)
      }
      const goals = svGoals(sim)
      for (const g of goals) drawGoal(g.side, g.cy, g.h, nowMs)
      if (sim.final && !finished) {
        const pulse = 0.12 + 0.08 * Math.sin(t * 6)
        ctx.strokeStyle = `rgba(239,79,90,${pulse * 2})`
        ctx.lineWidth = 4
        ctx.strokeRect(-HW * S - 4, -HH * S - 4, HW * S * 2 + 8, HH * S * 2 + 8)
      }

      const rr = r * S
      const victory = finished ? Math.min(1, (nowMs - finishedAt) / 1300) : 0
      const showNames = sim.field <= 12
      if (!finished || victory < 1) {
        for (let i = 0; i < balls.length; i++) {
          const b = balls[i]
          if (b.state !== 1) continue
          if (finished && spots.some((s) => s.i === i)) continue
          const enter = Math.min(1, (sim.time - b.enterAt) / SV_ENTER_GRACE)
          const a = b.enterAt > 0 ? 0.35 + 0.65 * enter : 1
          drawBall(i, b.x * S, b.y * S, rr * (b.enterAt > 0 ? 0.6 + 0.4 * Math.min(1, enter * 1.4) : 1), a * (1 - victory), showNames, nowMs)
        }
      }
      for (let k = fallers.length - 1; k >= 0; k--) {
        const f = fallers[k]
        const p = (nowMs - f.at) / 700
        if (p >= 1) {
          fallers.splice(k, 1)
          continue
        }
        const x = f.x + (f.side * (HW + DEPTH * 0.6) - f.x) * p
        ctx.save()
        ctx.translate(x * S, f.y * S)
        ctx.rotate(p * 5 * f.side)
        drawBall(f.i, 0, 0, rr * (1 - p * 0.65), 1 - p, false, nowMs)
        ctx.restore()
      }
      for (let k = flashes.length - 1; k >= 0; k--) {
        const f = flashes[k]
        const p = (nowMs - f.at) / 700
        if (p >= 1) {
          flashes.splice(k, 1)
          continue
        }
        const b = balls[f.i]
        ctx.strokeStyle = `rgba(255,244,214,${1 - p})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(b.x * S, b.y * S, rr * (1 + p * 1.6), 0, Math.PI * 2)
        ctx.stroke()
      }
      for (let k = particles.length - 1; k >= 0; k--) {
        const p = particles[k]
        p.life -= dt
        if (p.life <= 0) {
          particles.splice(k, 1)
          continue
        }
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= 0.94
        p.vy *= 0.94
        ctx.globalAlpha = p.life / p.max
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x * S, p.y * S, p.size * S, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      if (finalFlash > 0) {
        ctx.fillStyle = `rgba(239,79,90,${finalFlash * 0.35})`
        ctx.fillRect(-w, -h, w * 2, h * 2)
        finalFlash = Math.max(0, finalFlash - dt * 1.2)
      }

      if (finished) {
        ctx.fillStyle = `rgba(5,7,12,${0.72 * victory})`
        ctx.fillRect(-w, -h, w * 2, h * 2)
        const spot = ctx.createRadialGradient(0, -0.1 * S, 0, 0, -0.1 * S, S * 0.9)
        const tint = teams ? (sim.winningTeam === 1 ? '79,143,247' : '242,193,78') : '242,193,78'
        spot.addColorStop(0, `rgba(${tint},${0.32 * victory})`)
        spot.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = spot
        ctx.fillRect(-w, -h, w * 2, h * 2)
        // Rotating light rays behind the winners.
        ctx.save()
        ctx.translate(0, -0.1 * S)
        ctx.rotate(t * 0.25)
        ctx.fillStyle = `rgba(${tint},${0.06 * victory})`
        for (let k = 0; k < 12; k++) {
          ctx.rotate((Math.PI * 2) / 12)
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(S * 1.6, -S * 0.12)
          ctx.lineTo(S * 1.6, S * 0.12)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()

        spots.forEach((s, idx) => {
          const p = Math.min(1, Math.max(0, (nowMs - finishedAt - idx * 90) / 900))
          const e = easeOutBack(p)
          const x = (s.fx + (s.tx - s.fx) * e) * S
          const y = (s.fy + (s.ty - s.fy) * e) * S
          const rad = (r + (s.tr - r) * e) * S
          if (!low) {
            ctx.save()
            ctx.shadowColor = `rgba(${tint},0.8)`
            ctx.shadowBlur = 22 * p
            ctx.fillStyle = 'rgba(0,0,0,0.01)'
            ctx.beginPath()
            ctx.arc(x, y, rad, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
          drawBall(s.i, x, y, rad, Math.max(0.2, p), true, nowMs)
          if (!teams && spots.length > 1 && p > 0.6) {
            ctx.fillStyle = C.gold
            ctx.font = `800 ${Math.max(11, rad * 0.42)}px "Space Grotesk", system-ui, sans-serif`
            ctx.textAlign = 'center'
            ctx.fillText(`${idx + 1}`, x, y - rad - 8)
          }
        })

        const ta = Math.min(1, Math.max(0, (nowMs - finishedAt - 300) / 600))
        ctx.globalAlpha = ta
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const fs = Math.max(18, Math.min(34, S * 0.085))
        ctx.font = `800 ${fs}px "Space Grotesk", system-ui, sans-serif`
        ctx.fillStyle = teams && sim.winningTeam === 1 ? C.blue : C.gold
        ctx.fillText(title, 0, -0.62 * S + (1 - ta) * 14)
        if (prizeLabel) {
          ctx.font = `700 ${Math.max(13, fs * 0.55)}px Inter, system-ui, sans-serif`
          ctx.fillStyle = '#fff4d6'
          ctx.fillText(prizeLabel, 0, 0.55 * S)
        }
        ctx.globalAlpha = 1

        for (const c of confetti) {
          c.x += c.vx * dt
          c.y += c.vy * dt
          c.rot += c.vr * dt
          if (c.y > 1.3) c.y = -1.3
          ctx.save()
          ctx.translate(c.x * S, c.y * S)
          ctx.rotate(c.rot)
          ctx.fillStyle = c.color
          ctx.fillRect(-c.size * S, -c.size * S * 0.5, c.size * S * 2, c.size * S)
          ctx.restore()
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
    // A new round (seed/players/settings) restarts the whole scene.
  }, [players, duration, winners, teams, rule, shield, prizePool, seed, startAt])

  return <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
}
