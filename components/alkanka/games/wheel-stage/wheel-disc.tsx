'use client'

/*
  The Şans Çarkı wheel: gold hardware (rim with its bulbs, hub carrying the Alkanka fists, teardrop pointer) around an
  SVG disc of the panel's reward slices that turns under them.
  - Slices alternate gold enamel and navy lacquer and carry the slice's short label. The disc tucks under the rim.
  - spinTo turns the disc with a CSS transition and stops a random distance inside the slice the server paid out.
    While it turns, each slice boundary passing the pointer flicks the pointer and plays the tick.
  - The rim catches a moving light, slow at rest and fast while spinning.
  - After a landing the landed slice lights up and the others dim.
*/

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { pacedFrames } from '@/lib/paced-frames'
import type { WheelSegment } from '@/lib/rewards-shared'
import { playSound } from '@/lib/sound'
import { cn } from '@/lib/utils'

export type WheelController = {
  spinTo: (slice: number, reduced: boolean) => Promise<void>
}

export const SPIN_MS = 6400
const REDUCED_SPIN_MS = 700
const R = 430
const HUB_R = 118

const point = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180
  return [(500 + r * Math.sin(a)).toFixed(2), (500 - r * Math.cos(a)).toFixed(2)] as const
}

const isGold = (i: number) => i % 2 === 0
const labelSize = (text: string) => (text.length <= 2 ? 78 : text.length === 3 ? 66 : text.length === 4 ? 54 : 44)

export function WheelDisc({
  segments,
  landed,
  won,
  spinning,
  controller,
  className,
}: {
  segments: WheelSegment[]
  /** The slice the last spin stopped on; null before the first spin and while one is running. */
  landed: number | null
  /** Whether the landed slice paid anything. */
  won: boolean
  spinning: boolean
  controller: Ref<WheelController>
  className?: string
}) {
  const discRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<HTMLImageElement>(null)
  const count = segments.length
  const angle = 360 / count
  const rotation = useRef(360 - angle / 2)

  useEffect(() => {
    if (discRef.current) discRef.current.style.transform = `rotate(${rotation.current}deg)`
  }, [])

  useImperativeHandle(controller, () => ({
    spinTo: (slice, reduced) =>
      new Promise<void>((resolve) => {
        const disc = discRef.current
        if (!disc) return resolve()
        const centre = (slice + 0.5) * angle
        const jitter = (Math.random() - 0.5) * angle * 0.64
        const current = rotation.current
        const rest = (((360 - centre + jitter) % 360) + 360) % 360
        const delta = (((rest - (((current % 360) + 360) % 360)) % 360) + 360) % 360
        const target = current + (reduced ? 1 : 7) * 360 + delta
        const duration = reduced ? REDUCED_SPIN_MS : SPIN_MS
        disc.style.transition = 'none'
        disc.style.transform = `rotate(${current}deg)`
        void disc.offsetWidth
        disc.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.7, 0.1, 1)`
        disc.style.transform = `rotate(${target}deg)`
        rotation.current = target

        const frames = pacedFrames(60)
        let last = -1
        let finished = false
        const watch = () => {
          const matrix = getComputedStyle(disc).transform
          if (matrix && matrix !== 'none') {
            const [a, b] = matrix.slice(matrix.indexOf('(') + 1, -1).split(',').map(Number)
            const turned = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
            const index = Math.floor(turned / angle)
            if (index !== last) {
              if (last !== -1) {
                playSound('tick')
                pointerRef.current?.animate([{ rotate: '-16deg' }, { rotate: '0deg' }], { duration: 140, easing: 'ease-out' })
              }
              last = index
            }
          }
          if (!finished) frames.request(watch)
        }
        if (!reduced) frames.request(watch)
        const done = () => {
          if (finished) return
          finished = true
          frames.cancel()
          disc.removeEventListener('transitionend', turned)
          resolve()
        }
        /*
          Only the disc's own turn ends the spin. The slices inside it fade when a new spin starts, and the end of
          that fade reaches the disc too: it must not be taken for the wheel having stopped.
        */
        function turned(event: TransitionEvent) {
          if (event.target === disc && event.propertyName === 'transform') done()
        }
        disc.addEventListener('transitionend', turned)
        window.setTimeout(done, duration + 400)
      }),
  }))

  return (
    <div className={cn('relative aspect-square select-none', className)}>
      <div ref={discRef} className="absolute inset-0 will-change-transform">
        <svg viewBox="0 0 1000 1000" className="size-full" aria-hidden="true">
          <defs>
            <radialGradient id="wheel-gold" cx="500" cy="500" r={R} gradientUnits="userSpaceOnUse">
              <stop offset="0.24" style={{ stopColor: 'color-mix(in oklch, var(--gold) 52%, var(--gold-foreground))' }} />
              <stop offset="0.66" style={{ stopColor: 'var(--gold)' }} />
              <stop offset="1" style={{ stopColor: 'color-mix(in oklch, var(--gold) 80%, var(--foreground))' }} />
            </radialGradient>
            <radialGradient id="wheel-navy" cx="500" cy="500" r={R} gradientUnits="userSpaceOnUse">
              <stop offset="0.24" style={{ stopColor: 'var(--background)' }} />
              <stop offset="1" style={{ stopColor: 'color-mix(in oklch, var(--secondary) 90%, var(--accent))' }} />
            </radialGradient>
          </defs>
          {segments.map((segment, i) => {
            const [x1, y1] = point(i * angle, R)
            const [x2, y2] = point((i + 1) * angle, R)
            const path = `M500 500 L${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}Z`
            const isLanded = landed === i
            return (
              <g key={i} className={cn('transition-opacity duration-300', landed !== null && !isLanded && 'opacity-50')}>
                <path d={path} fill={isGold(i) ? 'url(#wheel-gold)' : 'url(#wheel-navy)'} />
                {isLanded && <path d={path} className={won ? 'fill-foreground/25' : 'fill-destructive/35'} />}
                <text
                  x="500"
                  y="222"
                  textAnchor="middle"
                  transform={`rotate(${(i + 0.5) * angle} 500 500)`}
                  className={cn('font-display', isGold(i) ? 'fill-gold-foreground' : 'fill-gold')}
                  style={{ fontSize: labelSize(segment.short), fontWeight: 800, letterSpacing: '-1px' }}
                >
                  {segment.short}
                </text>
              </g>
            )
          })}
          {segments.map((_, i) => {
            const [x1, y1] = point(i * angle, HUB_R)
            const [x2, y2] = point(i * angle, R)
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-gold/70" strokeWidth="5" />
          })}
          <circle cx="500" cy="500" r={HUB_R} className="fill-background stroke-gold/70" strokeWidth="5" />
        </svg>
      </div>

      <img src="/images/wheel/rim.webp" alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mix-blend-soft-light"
        style={{
          maskImage: 'url(/images/wheel/rim.webp)',
          maskSize: '100% 100%',
          WebkitMaskImage: 'url(/images/wheel/rim.webp)',
          WebkitMaskSize: '100% 100%',
        }}
      >
        <div
          className={cn('wheel-sheen absolute inset-0 rounded-full', spinning && 'wheel-sheen-fast')}
          style={{ background: 'conic-gradient(from 0deg, transparent 0deg 300deg, rgb(255 255 255 / 0.9) 330deg, transparent 352deg)' }}
        />
      </div>
      <img
        src="/images/wheel/hub.webp"
        alt=""
        draggable={false}
        className="pointer-events-none absolute top-1/2 left-1/2 w-[23%] -translate-x-1/2 -translate-y-1/2"
      />
      <img
        ref={pointerRef}
        src="/images/wheel/pointer.webp"
        alt=""
        draggable={false}
        className="pointer-events-none absolute top-[-3%] left-1/2 w-[8.5%] origin-[50%_14%] -translate-x-1/2"
      />
    </div>
  )
}
