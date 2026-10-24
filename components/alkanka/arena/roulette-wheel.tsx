'use client'

import { useEffect, useRef } from 'react'
import { RED, WHEEL, rouletteClock, RL_SPIN_MS } from '@/lib/casino'

const SEG = 360 / WHEEL.length
const C = 200
const R_TRACK_OUT = 190
const R_TRACK_IN = 168
const R_NUM_OUT = 166
const R_NUM_IN = 134
const R_NUM_TEXT = 150
const R_POCKET_IN = 104
const BALL_TRACK = 179
const BALL_POCKET = 119
const IDLE_SPEED = 0.03
const WHEEL_TRAVEL = 360
const BALL_TRAVEL = 360 * 7
const SPIN_ANIM_MS = RL_SPIN_MS - 1000

const GOLD = 'var(--primary)'
const IVORY = 'var(--checker-light)'

export const pocketColor = (n: number) => (n === 0 ? 'var(--rl-green)' : RED.has(n) ? 'var(--rl-red)' : 'var(--rl-black)')
const pocketDepth = (n: number) => `color-mix(in oklch, ${pocketColor(n)} 62%, var(--rl-black))`

function polar(r: number, deg: number) {
  const a = (deg * Math.PI) / 180
  return [C + r * Math.sin(a), C - r * Math.cos(a)] as const
}

function ring(i: number, rOut: number, rIn: number) {
  const a0 = i * SEG - SEG / 2
  const a1 = a0 + SEG
  const [x0, y0] = polar(rOut, a0)
  const [x1, y1] = polar(rOut, a1)
  const [x2, y2] = polar(rIn, a1)
  const [x3, y3] = polar(rIn, a0)
  return `M${x0} ${y0} A${rOut} ${rOut} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${rIn} ${rIn} 0 0 0 ${x3} ${y3}Z`
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
  const ballRef = useRef<SVGGElement>(null)
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
          b.setAttribute('transform', `translate(${x} ${y})`)
          b.style.opacity = '1'
        } else b.style.opacity = '0'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [clockOffset])

  const dimmed = (n: number) => highlight !== null && highlight !== n

  return (
    <svg viewBox="0 0 400 400" className="size-full drop-shadow-2xl" role="img" aria-label={highlight !== null ? `Rulet çarkı, kazanan sayı ${highlight}` : 'Rulet çarkı'}>
      <defs>
        <radialGradient id="rl-wood" cx="50%" cy="35%" r="65%">
          <stop offset="78%" stopColor="color-mix(in oklch, var(--wood) 80%, var(--primary))" />
          <stop offset="92%" stopColor="var(--wood)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--wood) 50%, var(--background))" />
        </radialGradient>
        <radialGradient id="rl-track" cx="50%" cy="50%" r="50%">
          <stop offset="84%" stopColor="color-mix(in oklch, var(--wood) 30%, var(--background))" />
          <stop offset="95%" stopColor="color-mix(in oklch, var(--wood) 55%, var(--background))" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--wood) 25%, var(--background))" />
        </radialGradient>
        <radialGradient id="rl-cone" cx="42%" cy="36%" r="70%">
          <stop offset="0%" stopColor="color-mix(in oklch, var(--primary) 80%, var(--checker-light))" />
          <stop offset="55%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--primary) 45%, var(--wood))" />
        </radialGradient>
        <radialGradient id="rl-ball" cx="35%" cy="32%" r="70%">
          <stop offset="0%" stopColor="var(--checker-light)" />
          <stop offset="65%" stopColor="color-mix(in oklch, var(--checker-light) 80%, var(--rl-black))" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--checker-light) 45%, var(--rl-black))" />
        </radialGradient>
        <linearGradient id="rl-pocket-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--rl-black)" stopOpacity={0.45} />
          <stop offset="100%" stopColor="var(--rl-black)" stopOpacity={0} />
        </linearGradient>
      </defs>

      <circle cx={C} cy={C} r={199} fill="url(#rl-wood)" />
      <circle cx={C} cy={C} r={R_TRACK_OUT + 1} fill="none" stroke={GOLD} strokeOpacity={0.55} strokeWidth={1.5} />
      <circle cx={C} cy={C} r={R_TRACK_OUT} fill="url(#rl-track)" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const [x, y] = polar(R_TRACK_IN + 4, a + 22.5)
        return <path key={a} d={`M${x} ${y} l0 -3 l3 3 l-3 3Z`} transform={`rotate(${a + 22.5} ${x} ${y})`} fill={GOLD} opacity={0.7} />
      })}

      <g ref={wheelRef}>
        <circle cx={C} cy={C} r={R_NUM_OUT + 1.5} fill={GOLD} />

        {WHEEL.map((n, i) => (
          <path key={`n${n}`} d={ring(i, R_NUM_OUT, R_NUM_IN)} fill={pocketColor(n)} opacity={dimmed(n) ? 0.55 : 1} />
        ))}

        {WHEEL.map((n, i) => (
          <text
            key={`t${n}`}
            x={C}
            y={C - R_NUM_TEXT}
            transform={`rotate(${i * SEG} ${C} ${C})`}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={n > 9 ? 17 : 19}
            fontWeight={800}
            letterSpacing={n > 9 ? -0.6 : 0}
            fill={IVORY}
            opacity={dimmed(n) ? 0.5 : 1}
            className="font-sans tabular-nums"
          >
            {n}
          </text>
        ))}

        <circle cx={C} cy={C} r={R_NUM_IN} fill="none" stroke={GOLD} strokeWidth={2.5} />

        {WHEEL.map((n, i) => (
          <path key={`p${n}`} d={ring(i, R_NUM_IN - 1.25, R_POCKET_IN)} fill={pocketDepth(n)} opacity={dimmed(n) ? 0.55 : 1} />
        ))}
        <circle cx={C} cy={C} r={(R_NUM_IN + R_POCKET_IN) / 2} fill="none" stroke="url(#rl-pocket-shade)" strokeWidth={R_NUM_IN - R_POCKET_IN} opacity={0.6} />

        {WHEEL.map((_, i) => {
          const a = i * SEG - SEG / 2
          const [x0, y0] = polar(R_POCKET_IN, a)
          const [x1, y1] = polar(R_NUM_OUT, a)
          return <line key={`f${i}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={GOLD} strokeWidth={1.4} strokeOpacity={0.9} />
        })}

        {highlight !== null && WHEEL.includes(highlight) && (
          <path d={ring(WHEEL.indexOf(highlight), R_NUM_OUT, R_POCKET_IN)} fill="none" stroke={GOLD} strokeWidth={3.5} strokeLinejoin="round" />
        )}

        <circle cx={C} cy={C} r={R_POCKET_IN} fill="none" stroke={GOLD} strokeWidth={2.5} />
        <circle cx={C} cy={C} r={R_POCKET_IN - 2} fill="url(#rl-cone)" />
        <circle cx={C} cy={C} r={R_POCKET_IN - 22} fill="none" stroke="var(--wood)" strokeOpacity={0.35} strokeWidth={1} />
        <circle cx={C} cy={C} r={46} fill="none" stroke="var(--wood)" strokeOpacity={0.25} strokeWidth={1} />

        {[0, 90, 180, 270].map((a) => {
          const [x, y] = polar(64, a)
          const [kx, ky] = polar(70, a)
          return (
            <g key={a}>
              <line x1={C} y1={C} x2={x} y2={y} stroke="color-mix(in oklch, var(--primary) 55%, var(--wood))" strokeWidth={8} strokeLinecap="round" />
              <line x1={C} y1={C} x2={x} y2={y} stroke="color-mix(in oklch, var(--primary) 70%, var(--checker-light))" strokeWidth={3} strokeLinecap="round" />
              <circle cx={kx} cy={ky} r={6} fill="url(#rl-cone)" stroke="color-mix(in oklch, var(--primary) 50%, var(--wood))" strokeWidth={1.5} />
            </g>
          )
        })}
        <circle cx={C} cy={C} r={22} fill="url(#rl-cone)" stroke="color-mix(in oklch, var(--primary) 50%, var(--wood))" strokeWidth={2.5} />
        <circle cx={C} cy={C} r={9} fill="color-mix(in oklch, var(--primary) 70%, var(--checker-light))" />
      </g>

      <g ref={ballRef} style={{ opacity: 0 }}>
        <circle cx={1.5} cy={2} r={8} fill="var(--rl-black)" opacity={0.35} />
        <circle r={8} fill="url(#rl-ball)" />
      </g>
    </svg>
  )
}
