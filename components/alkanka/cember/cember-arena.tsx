'use client'

import { useEffect, useRef } from 'react'
import { ARENA, STEP, createSim, mulberry, stepSim, type SimState } from '@/lib/cember-sim'
import type { Participant } from '@/lib/cember-shared'

// Canvas can't read Tailwind tokens; these mirror the pitch + site palette (grass, chalk, gold, ruby, live green).
const C = {
  grassA: '#1f7038',
  grassB: '#238040',
  chalk: 'rgba(255,255,255,0.55)',
  rim: '#ffffff',
  gold: '#f2c14e',
  ruby: '#ef4f5a',
  live: '#3fd286',
  ink: '#0b0f17',
  inkSoft: 'rgba(11,15,23,0.78)',
  net: 'rgba(255,255,255,0.32)',
  grave: 'rgba(255,255,255,0.04)',
}

const JAKO_PP = [
  '02-jako-goz-kirpan',
  '03-jako-coin-isiriyor',
  '04-jako-gunes-gozluklu',
  '05-flat-ikon-jako',
  '06-jako-tac-kral',
  '08-jako-neon',
  '09-jako-telefonda',
  '10-jako-coin-ustunde',
  '11-jako-cizgi-sticker',
  '12-jako-mafya-silueti',
  '14-jako-kulaklikli-dj',
  '15-jako-coin-yagmuru',
  '17-jako-selam-veren',
  '19-jako-oyun-kolu',
  '20-jako-minimal-cizgi',
  '21-jako-turk-bayrakli',
  '22-jako-pop-art',
].map((n) => `/images/cember-pp/${n}.webp`)

const ASPECT = 1.34
const SPRITE = 96

export type ArenaEvent = { type: 'out'; index: number; alive: number } | { type: 'winner'; index: number }

type Props = {
  participants: Participant[]
  seed: number
  /** Wall-clock ms at which simulation step 0 happens (already corrected for server clock offset). */
  startAt: number
  now: () => number
  meId: string | null
  onEvent: (e: ArenaEvent) => void
}

type Faller = { index: number; x: number; y: number; r: number; at: number }
type Popup = { name: string; x: number; y: number; at: number; me: boolean }

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || 'AK'
}

/** Gives every member a Jako avatar; a seeded shuffle keeps neighbours from sharing the same one. */
function avatarFor(participants: Participant[], seed: number) {
  const rand = mulberry(seed ^ 0x5bd1e995)
  const deck = JAKO_PP.slice()
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return participants.map((p, i) => p.image ?? deck[i % deck.length])
}

export function CemberArena({ participants, seed, startAt, now, meId, onEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const eventRef = useRef(onEvent)
  eventRef.current = onEvent
  const nowRef = useRef(now)
  nowRef.current = now

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const total = participants.length
    const sim: SimState = createSim(total, seed)
    const meIndex = meId ? participants.findIndex((p) => p.id === meId) : -1
    const srcs = avatarFor(participants, seed)

    // One circular sprite per distinct avatar keeps 500 balls cheap to draw.
    const sprites = new Map<string, HTMLCanvasElement>()
    for (const src of new Set(srcs)) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = SPRITE
        c.height = SPRITE
        const g = c.getContext('2d')
        if (!g) return
        g.beginPath()
        g.arc(SPRITE / 2, SPRITE / 2, SPRITE / 2, 0, Math.PI * 2)
        g.clip()
        g.drawImage(img, 0, 0, SPRITE, SPRITE)
        sprites.set(src, c)
        graveDirty = true
      }
      img.onerror = () => {
        // External avatars without CORS headers still render; we never read pixels back.
        if (img.crossOrigin) {
          img.crossOrigin = null
          img.src = src
        }
      }
      img.src = src
    }

    let W = 0
    let H = 0
    let dpr = 1
    let R = 0
    let cx = 0
    let cy = 0
    let graveTop = 0
    let graveBottom = 0
    let cell = 0
    let cols = 1
    const grave = document.createElement('canvas')
    const gctx = grave.getContext('2d')
    const landed: number[] = []
    let graveDirty = true

    const layout = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = rect.width
      H = rect.width * ASPECT
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      grave.width = canvas.width
      grave.height = canvas.height
      R = W * 0.4
      cx = W / 2
      cy = W * 0.5
      graveTop = cy + R + W * 0.075
      graveBottom = H - W * 0.02
      const gw = W * 0.92
      const gh = graveBottom - graveTop
      const slots = Math.max(1, total - 1)
      cell = Math.min(W * 0.075, Math.sqrt((gw * gh) / slots) * 0.93)
      cols = Math.max(1, Math.floor(gw / cell))
      graveDirty = true
    }

    const slotPos = (k: number) => {
      const row = Math.floor(k / cols)
      const col = k % cols
      const used = Math.min(cols, total - 1 - row * cols)
      const rowW = used * cell
      const x = cx - rowW / 2 + cell / 2 + col * cell + (row % 2 ? cell * 0.25 : -cell * 0.25)
      const y = Math.max(graveTop + cell / 2, graveBottom - cell / 2 - row * cell * 0.88)
      return { x, y }
    }

    const drawAvatar = (g: CanvasRenderingContext2D, i: number, x: number, y: number, r: number, ring: string, ringW: number) => {
      const sprite = sprites.get(srcs[i])
      if (sprite) {
        g.drawImage(sprite, x - r, y - r, r * 2, r * 2)
      } else {
        g.fillStyle = '#1b2235'
        g.beginPath()
        g.arc(x, y, r, 0, Math.PI * 2)
        g.fill()
        if (r >= 7) {
          g.fillStyle = C.gold
          g.font = `700 ${Math.round(r * 0.8)}px "Space Grotesk", system-ui, sans-serif`
          g.textAlign = 'center'
          g.textBaseline = 'middle'
          g.fillText(initials(participants[i].name), x, y + r * 0.05)
        }
      }
      if (ringW > 0) {
        g.lineWidth = ringW
        g.strokeStyle = ring
        g.beginPath()
        g.arc(x, y, r, 0, Math.PI * 2)
        g.stroke()
      }
    }

    const redrawGrave = () => {
      if (!gctx) return
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      gctx.clearRect(0, 0, W, H)
      const gr = cell * 0.47
      landed.forEach((index, k) => {
        const p = slotPos(k)
        gctx.globalAlpha = index === meIndex ? 1 : 0.82
        drawAvatar(gctx, index, p.x, p.y, gr, index === meIndex ? C.live : 'rgba(255,255,255,0.35)', Math.max(1, gr * 0.12))
      })
      gctx.globalAlpha = 1
      graveDirty = false
    }

    const fallers: Faller[] = []
    const popups: Popup[] = []
    let lastPopup = 0
    let reported = 0
    let winnerSent = false
    let winnerAt = 0
    let winnerFrom = { x: 0, y: 0, r: 0 }

    const flushEvents = (silent: boolean) => {
      while (reported < sim.order.length) {
        const index = sim.order[reported]
        reported++
        const b = sim.balls[index]
        if (silent) {
          landed.push(index)
          graveDirty = true
          continue
        }
        const x = cx + b.x * (R / ARENA)
        const y = cy + b.y * (R / ARENA)
        fallers.push({ index, x, y, r: sim.radius * (R / ARENA), at: performance.now() })
        const t = performance.now()
        if (index === meIndex || total <= 80 || t - lastPopup > 450) {
          lastPopup = t
          popups.push({ name: index === meIndex ? 'Sen' : participants[index].name, x, y, at: t, me: index === meIndex })
          if (popups.length > 4) popups.shift()
        }
        eventRef.current({ type: 'out', index, alive: total - reported })
      }
      if (sim.winner !== null && !winnerSent) {
        winnerSent = true
        const b = sim.balls[sim.winner]
        winnerFrom = { x: cx + b.x * (R / ARENA), y: cy + b.y * (R / ARENA), r: sim.radius * (R / ARENA) }
        winnerAt = silent ? performance.now() - 5000 : performance.now()
        eventRef.current({ type: 'winner', index: sim.winner })
      }
    }

    layout()
    // Late viewers fast-forward to the shared clock so everyone sees the same moment.
    const behind = Math.floor((nowRef.current() - startAt) / 1000 / STEP)
    while (sim.step < behind && sim.winner === null) stepSim(sim)
    flushEvents(true)

    const ro = new ResizeObserver(layout)
    ro.observe(canvas)

    const drawPitch = (rot: number) => {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.beginPath()
      ctx.arc(0, 0, R, 0, Math.PI * 2)
      ctx.clip()
      ctx.rotate(rot)
      const bands = 12
      const bw = (R * 2) / bands
      for (let k = 0; k < bands; k++) {
        ctx.fillStyle = k % 2 ? C.grassA : C.grassB
        ctx.fillRect(-R + k * bw, -R, bw + 0.5, R * 2)
      }
      ctx.strokeStyle = C.chalk
      ctx.lineWidth = Math.max(1.5, R * 0.011)
      ctx.beginPath()
      ctx.moveTo(0, -R)
      ctx.lineTo(0, R)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, R * 0.24, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = C.chalk
      ctx.beginPath()
      ctx.arc(0, 0, R * 0.018, 0, Math.PI * 2)
      ctx.fill()
      for (const s of [1, -1]) {
        ctx.strokeRect(s > 0 ? R * 0.7 : -R, -R * 0.4, R * 0.3, R * 0.8)
        ctx.strokeRect(s > 0 ? R * 0.88 : -R, -R * 0.18, R * 0.12, R * 0.36)
        ctx.beginPath()
        ctx.arc(s * R * 0.8, 0, R * 0.16, s > 0 ? Math.PI * 0.62 : -Math.PI * 0.38, s > 0 ? Math.PI * 1.38 : Math.PI * 0.38)
        ctx.stroke()
      }
      ctx.rotate(-rot)
      const v = ctx.createRadialGradient(0, -R * 0.2, R * 0.3, 0, 0, R)
      v.addColorStop(0, 'rgba(0,0,0,0)')
      v.addColorStop(1, 'rgba(0,0,0,0.38)')
      ctx.fillStyle = v
      ctx.fillRect(-R, -R, R * 2, R * 2)
      ctx.restore()
    }

    const drawGoals = (rot: number, gap: number) => {
      const depth = R * 0.14
      for (const a of [rot, rot + Math.PI]) {
        const p1 = { x: cx + Math.cos(a - gap) * R, y: cy + Math.sin(a - gap) * R }
        const p2 = { x: cx + Math.cos(a + gap) * R, y: cy + Math.sin(a + gap) * R }
        const ux = Math.cos(a)
        const uy = Math.sin(a)
        const lx = (p2.x - p1.x) * 0.14
        const ly = (p2.y - p1.y) * 0.14
        const b1 = { x: p1.x + ux * depth + lx, y: p1.y + uy * depth + ly }
        const b2 = { x: p2.x + ux * depth - lx, y: p2.y + uy * depth - ly }
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(b1.x, b1.y)
        ctx.lineTo(b2.x, b2.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.closePath()
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fill()
        ctx.clip()
        ctx.strokeStyle = C.net
        ctx.lineWidth = 1
        const span = R * 0.6
        const step = Math.max(4, R * 0.035)
        const mx = (p1.x + p2.x) / 2
        const my = (p1.y + p2.y) / 2
        ctx.beginPath()
        for (let k = -span; k <= span; k += step) {
          ctx.moveTo(mx + k - span, my - span)
          ctx.lineTo(mx + k + span, my + span)
          ctx.moveTo(mx + k + span, my - span)
          ctx.lineTo(mx + k - span, my + span)
        }
        ctx.stroke()
        ctx.restore()
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = Math.max(1.5, R * 0.012)
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(b1.x, b1.y)
        ctx.lineTo(b2.x, b2.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
        for (const p of [p1, p2]) {
          ctx.fillStyle = C.rim
          ctx.beginPath()
          ctx.arc(p.x, p.y, Math.max(3, R * 0.024), 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const drawRim = (rot: number, gap: number) => {
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(3, R * 0.022)
      ctx.strokeStyle = C.rim
      ctx.shadowColor = 'rgba(255,255,255,0.55)'
      ctx.shadowBlur = R * 0.06
      for (const base of [rot, rot + Math.PI]) {
        ctx.beginPath()
        ctx.arc(cx, cy, R, base + gap, base + Math.PI - gap)
        ctx.stroke()
      }
      ctx.restore()
    }

    const drawCounter = (alive: number, fade: number) => {
      ctx.save()
      ctx.globalAlpha = fade
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.font = `800 ${Math.round(R * 0.5)}px "Space Grotesk", system-ui, sans-serif`
      ctx.lineWidth = R * 0.03
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.strokeText(String(alive), cx, cy - R * 0.2)
      ctx.fillStyle = C.gold
      ctx.fillText(String(alive), cx, cy - R * 0.2)
      ctx.font = `700 ${Math.round(R * 0.085)}px "Space Grotesk", system-ui, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.fillText('KANKA KALDI', cx, cy - R * 0.06)
      ctx.restore()
    }

    const label = (text: string, x: number, y: number, color: string, size: number) => {
      ctx.font = `700 ${size}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const w = ctx.measureText(text).width + size * 0.9
      ctx.fillStyle = C.inkSoft
      ctx.beginPath()
      ctx.roundRect(x - w / 2, y - size * 0.75, w, size * 1.5, size * 0.75)
      ctx.fill()
      ctx.fillStyle = color
      ctx.fillText(text, x, y + size * 0.04)
    }

    let raf = 0
    const draw = () => {
      const target = Math.floor((nowRef.current() - startAt) / 1000 / STEP)
      let guard = 0
      while (sim.step < target && sim.winner === null && guard++ < 240) stepSim(sim)
      flushEvents(false)
      if (graveDirty) redrawGrave()

      const t = performance.now()
      const scale = R / ARENA
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // Graveyard tray
      ctx.fillStyle = C.grave
      ctx.beginPath()
      ctx.roundRect(W * 0.03, graveTop - W * 0.02, W * 0.94, graveBottom - graveTop + W * 0.03, W * 0.03)
      ctx.fill()
      ctx.drawImage(grave, 0, 0, W, H)

      const rot = sim.rotation
      const gap = sim.gapHalf
      drawPitch(rot)
      const winFade = winnerAt ? Math.max(0, 1 - (t - winnerAt) / 500) : 1
      drawCounter(sim.alive, winFade)
      drawGoals(rot, gap)

      const r = sim.radius * scale
      const showNames = sim.alive <= 24 && r >= 10
      const balls = sim.balls
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i]
        if (!b.alive || i === sim.winner) continue
        const x = cx + b.x * scale
        const y = cy + b.y * scale
        ctx.globalAlpha = b.out ? 0.8 : 1
        const me = i === meIndex
        drawAvatar(ctx, i, x, y, r, me ? C.live : 'rgba(255,255,255,0.9)', Math.max(1, r * (me ? 0.2 : 0.1)))
        ctx.globalAlpha = 1
        if (me) label('SEN', x, y - r - Math.max(9, r * 0.5), C.live, Math.max(10, Math.min(13, r * 0.55)))
        else if (showNames) label(participants[i].name, x, y + r + Math.max(8, r * 0.45), '#ffffff', Math.max(9, Math.min(12, r * 0.45)))
      }
      drawRim(rot, gap)

      // Eliminated balls arc down into the tray.
      const gr = cell * 0.47
      for (let k = fallers.length - 1; k >= 0; k--) {
        const f = fallers[k]
        const p = Math.min(1, (t - f.at) / 850)
        const slot = slotPos(landed.length + k)
        const e = p * p
        const x = f.x + (slot.x - f.x) * (1 - (1 - p) * (1 - p))
        const y = f.y + (slot.y - f.y) * e - Math.sin(p * Math.PI) * R * 0.08
        const rr = f.r + (gr - f.r) * p
        drawAvatar(ctx, f.index, x, y, rr, f.index === meIndex ? C.live : 'rgba(255,255,255,0.6)', Math.max(1, rr * 0.12))
      }
      while (fallers.length && t - fallers[0].at >= 850) {
        landed.push(fallers.shift()!.index)
        graveDirty = true
      }

      for (let k = popups.length - 1; k >= 0; k--) {
        const pp = popups[k]
        const age = (t - pp.at) / 1300
        if (age >= 1) {
          popups.splice(k, 1)
          continue
        }
        ctx.globalAlpha = age < 0.75 ? 1 : (1 - age) / 0.25
        const y = pp.y - R * 0.12 - age * R * 0.12
        const size = Math.max(11, R * 0.05)
        ctx.font = `800 ${size * 1.25}px "Space Grotesk", system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 4
        ctx.strokeStyle = C.ink
        ctx.strokeText('ELENDİ!', pp.x, y)
        ctx.fillStyle = C.ruby
        ctx.fillText('ELENDİ!', pp.x, y)
        label(pp.me ? 'Sen' : `@${pp.name}`, pp.x, y + size * 1.35, pp.me ? C.live : '#ffffff', size * 0.85)
        ctx.globalAlpha = 1
      }

      // Winner glides to the centre spot and grows.
      if (sim.winner !== null) {
        const w = sim.winner
        const b = balls[w]
        const live = { x: cx + b.x * scale, y: cy + b.y * scale }
        const p = Math.min(1, (t - winnerAt) / 1100)
        const ease = 1 - (1 - p) * (1 - p) * (1 - p)
        const from = winnerAt ? winnerFrom : { x: live.x, y: live.y, r }
        const x = from.x + (cx - from.x) * ease
        const y = from.y + (cy - from.y) * ease
        const rr = from.r + (R * 0.3 - from.r) * ease
        ctx.save()
        ctx.shadowColor = C.gold
        ctx.shadowBlur = R * 0.12 * ease + Math.sin(t / 220) * R * 0.02
        drawAvatar(ctx, w, x, y, rr, C.gold, Math.max(2, rr * 0.08))
        ctx.restore()
        if (p > 0.5) label(w === meIndex ? 'SEN' : participants[w].name, x, y + rr + R * 0.08, C.gold, Math.max(12, R * 0.06))
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [participants, seed, startAt, meId])

  return (
    <canvas
      ref={canvasRef}
      className="aspect-[100/134] w-full"
      role="img"
      aria-label={`${participants.length} oyuncunun yarıştığı Jako Çemberi`}
    />
  )
}
