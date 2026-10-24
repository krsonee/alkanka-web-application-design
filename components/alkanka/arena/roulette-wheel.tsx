'use client'

import { useEffect, useRef } from 'react'
import { RED, WHEEL, rouletteClock, RL_SPIN_MS } from '@/lib/casino'
import { cn } from '@/lib/utils'

const SEG = 360 / WHEEL.length
const C = 200
const R_TRACK_OUT = 190
const R_NUM_OUT = 166
const R_NUM_IN = 132
const R_POCKET_IN = 108
const R_NUM_TEXT = (R_NUM_OUT + R_NUM_IN) / 2
const BALL_TRACK = 178
const BALL_POCKET = (R_NUM_IN + R_POCKET_IN) / 2
const IDLE_SPEED = 0.03
const WHEEL_TRAVEL = 360
const BALL_TRAVEL = 360 * 7
const SPIN_ANIM_MS = RL_SPIN_MS - 1000
const GOLD = 'color-mix(in oklch, var(--primary) 80%, var(--foreground))'

export const pocketColor = (n: number) => (n === 0 ? 'var(--rl-green)' : RED.has(n) ? 'var(--rl-red)' : 'var(--rl-black)')
const pocketDeep = (n: number) => `color-mix(in oklch, ${pocketColor(n)} 62%, var(--rl-black))`

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

export function RouletteWheel({
  clockOffset,
  number,
  highlight,
  compact = false,
}: {
  clockOffset: number
  number: number | null
  highlight: number | null
  /** When the wheel is shrunk on mobile, numbers are unreadable, so only the colored pockets are drawn. */
  compact?: boolean
}) {
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

  const dimmed = (n: number) => highlight !== null && highlight !== n

  return (
    <svg
      viewBox="0 0 400 400"
      className="size-full drop-shadow-2xl"
      role="img"
      aria-label={highlight !== null ? `Rulet çarkı, kazanan sayı ${highlight}` : 'Rulet çarkı'}
    >
      <defs>
        <radialGradient id="rl-wood" cx="50%" cy="35%" r="65%">
          <stop offset="78%" stopColor="color-mix(in oklch, var(--wood) 85%, var(--foreground))" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--wood) 50%, var(--background))" />
        </radialGradient>
        <radialGradient id="rl-track" cx="50%" cy="50%" r="50%">
          <stop offset="86%" stopColor="color-mix(in oklch, var(--wood) 35%, var(--background))" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--wood) 70%, var(--background))" />
        </radialGradient>
        <radialGradient id="rl-cone" cx="42%" cy="36%" r="70%">
          <stop offset="0%" stopColor="color-mix(in oklch, var(--primary) 85%, var(--foreground))" />
          <stop offset="55%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--primary) 45%, var(--wood))" />
        </radialGradient>
        <radialGradient id="rl-ball" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="var(--foreground)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--foreground) 50%, var(--background))" />
        </radialGradient>
        <linearGradient id="rl-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.08} />
          <stop offset="45%" stopColor="var(--foreground)" stopOpacity={0} />
          <stop offset="100%" stopColor="var(--background)" stopOpacity={0.25} />
        </linearGradient>
      </defs>

      <circle cx={C} cy={C} r={199} fill="url(#rl-wood)" />
      <circle cx={C} cy={C} r={R_TRACK_OUT} fill="url(#rl-track)" stroke={GOLD} strokeOpacity={0.55} strokeWidth={1.5} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = i * 45 + 22.5
        const [x, y] = polar(BALL_TRACK + 2, a)
        return (
          <rect
            key={a}
            x={x - 3.5}
            y={y - 6}
            width={7}
            height={12}
            rx={1.5}
            fill={GOLD}
            opacity={0.85}
            transform={`rotate(${a + 45} ${x} ${y})`}
          />
        )
      })}

      <g ref={wheelRef}>
        <circle cx={C} cy={C} r={R_NUM_OUT + 2} fill={GOLD} />
        {WHEEL.map((n, i) => (
          <path key={`n${n}`} d={ring(i, R_NUM_OUT, R_NUM_IN)} fill={pocketColor(n)} />
        ))}
        {WHEEL.map((n, i) => (
          <path key={`p${n}`} d={ring(i, R_NUM_IN, R_POCKET_IN)} fill={pocketDeep(n)} />
        ))}
        {highlight !== null &&
          WHEEL.map((n, i) =>
            dimmed(n) ? <path key={`d${n}`} d={ring(i, R_NUM_OUT, R_POCKET_IN)} fill="var(--rl-black)" opacity={0.45} /> : null,
          )}
        {WHEEL.map((_, i) => {
          const a = i * SEG - SEG / 2
          const [x0, y0] = polar(R_POCKET_IN, a)
          const [x1, y1] = polar(R_NUM_OUT, a)
          return <line key={`f${i}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={GOLD} strokeWidth={1.4} />
        })}
        <circle cx={C} cy={C} r={R_NUM_IN} fill="none" stroke={GOLD} strokeWidth={2} />

        {highlight !== null && WHEEL.includes(highlight) && (
          <path
            d={ring(WHEEL.indexOf(highlight), R_NUM_OUT, R_POCKET_IN)}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
        )}

        <g className={cn(compact && 'max-sm:hidden')} aria-hidden>
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
              letterSpacing={n > 9 ? -0.8 : 0}
              fill="var(--foreground)"
              stroke="var(--rl-black)"
              strokeWidth={2.2}
              strokeOpacity={0.55}
              paintOrder="stroke"
              opacity={dimmed(n) ? 0.7 : 1}
              className="font-sans tabular-nums"
            >
              {n}
            </text>
          ))}
        </g>

        <circle cx={C} cy={C} r={R_POCKET_IN} fill="url(#rl-cone)" stroke={GOLD} strokeWidth={2.5} />
        <circle cx={C} cy={C} r={R_POCKET_IN - 20} fill="none" stroke="var(--wood)" strokeOpacity={0.35} strokeWidth={1.5} />
        {[0, 90, 180, 270].map((a) => {
          const [x, y] = polar(64, a)
          const [kx, ky] = polar(70, a)
          return (
            <g key={a}>
              <line x1={C} y1={C} x2={x} y2={y} stroke={GOLD} strokeWidth={7} strokeLinecap="round" />
              <circle cx={kx} cy={ky} r={6} fill={GOLD} />
            </g>
          )
        })}
        <circle cx={C} cy={C} r={20} fill={GOLD} stroke="var(--wood)" strokeWidth={3} />
        <circle cx={C} cy={C} r={7} fill="var(--foreground)" opacity={0.85} />
      </g>

      <circle cx={C} cy={C} r={R_TRACK_OUT} fill="url(#rl-sheen)" pointerEvents="none" />
      <circle ref={ballRef} r={7} fill="url(#rl-ball)" stroke="var(--rl-black)" strokeOpacity={0.4} strokeWidth={0.8} style={{ opacity: 0 }} />
    </svg>
  )
}
