'use client'

import { useEffect, useRef } from 'react'

const COLORS = ['#e3b649', '#e0474f', '#3fd286', '#f4f1e8']

export function CemberConfetti() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const pieces = Array.from({ length: 140 }, () => ({
      x: rect.width / 2,
      y: rect.height / 2,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 9 - 3,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: 4 + Math.random() * 5,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))
    let raf = 0
    const start = performance.now()
    const frame = () => {
      const t = performance.now() - start
      ctx.clearRect(0, 0, rect.width, rect.height)
      ctx.globalAlpha = Math.max(0, 1 - t / 4500)
      for (const p of pieces) {
        p.vy += 0.22
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.r += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.r)
        ctx.fillStyle = p.c
        ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2)
        ctx.restore()
      }
      if (t < 4500) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 size-full" aria-hidden />
}
