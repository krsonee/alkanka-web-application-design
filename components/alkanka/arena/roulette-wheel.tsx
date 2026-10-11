'use client'

import { useEffect, useRef } from 'react'
import { RED, WHEEL, rouletteClock, RL_SPIN_MS } from '@/lib/casino'

const SEG = 360 / WHEEL.length
const C = 200
const R_OUT = 160
const R_IN = 108
const BALL_TRACK = 178
const BALL_POCKET = 118
const IDLE_SPEED = 0.03
const WHEEL_TRAVEL = 360
const BALL_TRAVEL = 360 * 7
const SPIN_ANIM_MS = RL_SPIN_MS - 1000

export const pocketColor = (n: number) => (n === 0 ? 'var(--rl-green)' : RED.has(n) ? 'var(--rl-red)' : 'var(--rl-black)')

function polar(r: number, deg: number) {
  const a = (deg * Math.PI) / 180
  return [C + r * Math.sin(a), C - r * Math.cos(a)] as const
}

function wedge(i: number) {
  const a0 = i * SEG - SEG / 2
  const a1 = a0 + SEG
  const [x0, y0] = polar(R_OUT, a0)
  const [x1, y1] = polar(R_OUT, a1)
  const [x2, y2] = polar(R_IN, a1)
  const [x3, y3] = polar(R_IN, a0)
  return `M${x0} ${y0} A${R_OUT} ${R_OUT} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${R_IN} ${R_IN} 0 0 0 ${x3} ${y3}Z`
}

const easeOutQuad = (p: number) => 1 - (1 - p) ** 2
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3

/** Wheel and ball positions are derived from the shared server clock, so every viewer sees the same spin. */
function pose(now: number, number: number | null) {
  const c = rouletteClock(now)
  const base = (c.spinStartsAt * IDLE_SPEED) % 360
  if (c.phase === 'bet') return { wheel: (now * IDLE_SPEED) % 360, ball: null }
  const p = Math.min(1, (now - c.spinStartsAt) / SPIN_ANIM_MS)
  const wheelEnd = base + WHEEL_TRAVEL
  const wheel = p < 1 ? base + WHEEL_TRAVEL * easeOutQuad(p) : wheelEnd + (now - c.spinStartsAt - SPIN_ANIM_MS) * IDLE_SPEED * 0.5
  const idx = Math.max(0, WHEEL.indexOf(number ?? 0))
  if (p >= 1) return { wheel, ball: { angle: wheel + idx * SEG, r: BALL_POCKET } }
  const angle = wheelEnd + idx * SEG + BALL_TRAVEL * (1 - easeOutCubic(p))
  let r = BALL_TRACK
  if (p > 0.55 && p <= 0.8) {
    const q = (p - 0.55) / 0.25
    r = BALL_TRACK - (BALL_TRACK - BALL_POCKET) * q + Math.abs(Math.sin(q * Math.PI * 3)) * 14 * (1 - q)
  } else if (p > 0.8) {
    r = BALL_POCKET + Math.abs(Math.sin(((p - 0.8) / 0.2) * Math.PI * 2)) * 4 * (1 - p) * 5
  }
  return { wheel, ball: { angle, r } }
}

export function RouletteWheel({ clockOffset, number, highlight }: { clockOffset: number; number: number | null; highlight: number | null }) {
  const wheelRef = useRef<SVGGElement>(null)
  const ballRef = useRef<SVGCircleElement>(null)
  const numberRef = useRef(number)
  numberRef.current = number

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const { wheel, ball } = pose(Date.now() + clockOffset, numberRef.current)
      wheelRef.current?.setAttribute('transform', `rotate(${wheel} ${C} ${C})`)
      const b = ballRef.current
      if (b) {
        if (ball) {
          const [x, y] = polar(ball.r, ball.angle)
          b.setAttribute('cx', String(x))
          b.setAttribute('cy', String(y))
          b.style.opacity = '1'
        } else b.style.opacity = '0'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [clockOffset])

  return (
    <svg viewBox="0 0 400 400" className="size-full drop-shadow-2xl" role="img" aria-label={highlight !== null ? `Rulet çarkı, kazanan sayı ${highlight}` : 'Rulet çarkı'}>
      <defs>
        <radialGradient id="rl-wood" cx="50%" cy="40%" r="60%">
          <stop offset="70%" stopColor="var(--wood)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--wood) 55%, var(--background))" />
        </radialGradient>
        <radialGradient id="rl-cone" cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="70%" stopColor="color-mix(in oklch, var(--primary) 55%, var(--wood))" />
          <stop offset="100%" stopColor="var(--wood)" />
        </radialGradient>
        <radialGradient id="rl-ball" cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="var(--foreground)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--foreground) 55%, var(--background))" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={199} fill="url(#rl-wood)" />
      <circle cx={C} cy={C} r={190} fill="color-mix(in oklch, var(--background) 85%, var(--wood))" stroke="color-mix(in oklch, var(--primary) 40%, transparent)" strokeWidth={1.5} />
      <circle cx={C} cy={C} r={166} fill="none" stroke="color-mix(in oklch, var(--primary) 50%, transparent)" strokeWidth={2} />

      <g ref={wheelRef}>
        {WHEEL.map((n, i) => (
          <path
            key={n}
            d={wedge(i)}
            fill={pocketColor(n)}
            stroke="color-mix(in oklch, var(--primary) 70%, var(--background))"
            strokeWidth={highlight === n ? 3 : 0.8}
            opacity={highlight !== null && highlight !== n ? 0.75 : 1}
          />
        ))}
        {WHEEL.map((n, i) => (
          <text
            key={n}
            x={C}
            y={C - R_OUT + 17}
            transform={`rotate(${i * SEG} ${C} ${C})`}
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            fill="var(--foreground)"
            className="font-sans"
          >
            {n}
          </text>
        ))}
        <circle cx={C} cy={C} r={R_IN} fill="url(#rl-cone)" stroke="var(--primary)" strokeWidth={2} />
        <circle cx={C} cy={C} r={R_IN - 18} fill="none" stroke="color-mix(in oklch, var(--background) 40%, transparent)" strokeWidth={1} />
        {[0, 90, 180, 270].map((a) => {
          const [x, y] = polar(62, a)
          return <line key={a} x1={C} y1={C} x2={x} y2={y} stroke="var(--primary)" strokeWidth={7} strokeLinecap="round" />
        })}
        <circle cx={C} cy={C} r={20} fill="var(--primary)" stroke="var(--wood)" strokeWidth={3} />
        <circle cx={C} cy={C} r={7} fill="var(--foreground)" opacity={0.8} />
      </g>

      <circle ref={ballRef} r={7.5} fill="url(#rl-ball)" style={{ opacity: 0 }} />
    </svg>
  )
}
