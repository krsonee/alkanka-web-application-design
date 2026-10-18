'use client'

import { useEffect, useRef } from 'react'
import { ARENA, STEP, createSim, dcos, dsin, stepSim, type SimState } from '@/lib/cember-sim'
import type { Participant } from '@/lib/cember-shared'

// Canvas can't read Tailwind tokens, so these mirror the site palette (navy, gold, ruby, live green, ivory).
const C = {
  felt: '#141a2b',
  feltEdge: '#0c101b',
  gold: '#e3b649',
  goldDim: 'rgba(227,182,73,0.25)',
  ruby: '#e0474f',
  live: '#3fd286',
  ivory: '#f4f1e8',
  shadow: 'rgba(0,0,0,0.45)',
}

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

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || 'AK'
}

export function CemberArena({ participants, seed, startAt, now, meId, onEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const eventRef = useRef(onEvent)
  eventRef.current = onEvent

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sim: SimState = createSim(participants.length, seed)
    const meIndex = meId ? participants.findIndex((p) => p.id === meId) : -1
    const images = participants.map((p) => {
      if (!p.image) return null
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onerror = () => {
        // Avatars without CORS headers still render fine; we never read pixels back.
        if (img.crossOrigin) {
          img.crossOrigin = null
          img.src = p.image as string
        }
      }
      img.src = p.image
      return img
    })

    let reported = 0
    let winnerSent = false
    const flushEvents = (silent: boolean) => {
      while (reported < sim.order.length) {
        const index = sim.order[reported]
        reported++
        if (!silent) eventRef.current({ type: 'out', index, alive: participants.length - reported })
      }
      if (sim.winner !== null && !winnerSent) {
        winnerSent = true
        eventRef.current({ type: 'winner', index: sim.winner })
      }
    }

    // Late viewers fast-forward to the shared clock so everyone sees the same moment.
    const behind = Math.floor((now() - startAt) / 1000 / STEP)
    while (sim.step < behind && sim.winner === null) stepSim(sim)
    flushEvents(true)

    let size = 0
    let dpr = 1
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      size = rect.width
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.width * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let raf = 0
    let winnerAt = 0
    const draw = () => {
      const target = Math.floor((now() - startAt) / 1000 / STEP)
      let guard = 0
      while (sim.step < target && sim.winner === null && guard++ < 240) stepSim(sim)
      flushEvents(false)
      if (sim.winner !== null && !winnerAt) winnerAt = performance.now()

      const scale = (size / 2) / (ARENA * 1.16)
      const cx = size / 2
      const cy = size / 2
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)

      // Felt
      const g = ctx.createRadialGradient(cx, cy - size * 0.1, size * 0.05, cx, cy, ARENA * scale)
      g.addColorStop(0, C.felt)
      g.addColorStop(1, C.feltEdge)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, ARENA * scale, 0, Math.PI * 2)
      ctx.fill()

      // Brand watermark in the middle of the felt.
      ctx.save()
      ctx.globalAlpha = 0.07
      ctx.fillStyle = C.gold
      ctx.font = `700 ${Math.round(size * 0.09)}px "Space Grotesk", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('ALKANKA', cx, cy)
      ctx.restore()

      // Ring with two breathing goals opposite each other.
      const rot = sim.rotation
      const gap = sim.gapHalf
      const ringW = Math.max(6, size * 0.022)
      ctx.lineCap = 'round'
      ctx.lineWidth = ringW
      ctx.strokeStyle = C.gold
      ctx.shadowColor = C.goldDim
      ctx.shadowBlur = 18
      for (const base of [rot, rot + Math.PI]) {
        ctx.beginPath()
        ctx.arc(cx, cy, ARENA * scale + ringW / 2, base + gap, base + Math.PI - gap)
        ctx.stroke()
      }
      ctx.shadowBlur = 0
      // Goal posts glow red so the eye finds them.
      for (const base of [rot, rot + Math.PI]) {
        for (const edge of [base - gap, base + gap]) {
          const px = cx + dcos(edge) * (ARENA * scale + ringW / 2)
          const py = cy + dsin(edge) * (ARENA * scale + ringW / 2)
          ctx.fillStyle = C.ruby
          ctx.beginPath()
          ctx.arc(px, py, ringW * 0.85, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.strokeStyle = 'rgba(224,71,79,0.35)'
        ctx.lineWidth = ringW * 0.5
        ctx.setLineDash([ringW * 0.6, ringW * 0.6])
        ctx.beginPath()
        ctx.arc(cx, cy, ARENA * scale + ringW / 2, base - gap, base + gap)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.lineWidth = ringW
      }

      const r = sim.radius * scale
      const showNames = sim.alive <= 40 && r >= 9
      const balls = sim.balls
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i]
        if (!b.alive) continue
        const x = cx + b.x * scale
        const y = cy + b.y * scale
        const isWinner = sim.winner === i
        const pulse = isWinner ? 1 + Math.min(1.6, (performance.now() - winnerAt) / 600) : 1
        const rr = r * pulse
        ctx.globalAlpha = b.out ? 0.55 : 1

        ctx.fillStyle = C.shadow
        ctx.beginPath()
        ctx.arc(x + rr * 0.12, y + rr * 0.18, rr, 0, Math.PI * 2)
        ctx.fill()

        const img = images[i]
        ctx.save()
        ctx.beginPath()
        ctx.arc(x, y, rr, 0, Math.PI * 2)
        ctx.clip()
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, x - rr, y - rr, rr * 2, rr * 2)
        } else {
          ctx.fillStyle = '#1f2840'
          ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2)
          if (rr >= 6) {
            ctx.fillStyle = C.gold
            ctx.font = `700 ${Math.round(rr * 0.85)}px "Space Grotesk", system-ui, sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(initials(participants[i].name), x, y + rr * 0.04)
          }
        }
        ctx.restore()

        // Jako-style jersey ring: gold for everyone, green for you.
        ctx.lineWidth = Math.max(1.2, rr * 0.16)
        ctx.strokeStyle = i === meIndex ? C.live : C.gold
        ctx.beginPath()
        ctx.arc(x, y, rr, 0, Math.PI * 2)
        ctx.stroke()

        if (showNames || i === meIndex || isWinner) {
          const label = i === meIndex ? 'Sen' : participants[i].name
          const fs = Math.max(10, Math.min(14, rr * 0.6))
          ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          const w = ctx.measureText(label).width + 8
          ctx.fillStyle = 'rgba(12,16,27,0.82)'
          ctx.beginPath()
          ctx.roundRect(x - w / 2, y + rr + 3, w, fs + 5, 4)
          ctx.fill()
          ctx.fillStyle = i === meIndex ? C.live : C.ivory
          ctx.fillText(label, x, y + rr + 5)
        }
        ctx.globalAlpha = 1
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [participants, seed, startAt, now, meId])

  return (
    <canvas
      ref={canvasRef}
      className="aspect-square w-full"
      role="img"
      aria-label={`${participants.length} oyuncunun yarıştığı Jako Çemberi`}
    />
  )
}
