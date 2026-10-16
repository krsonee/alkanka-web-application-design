'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Clock, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRemaining } from './mini-status'
import { ParticleBurst } from './particle-burst'
import { playMini } from '@/app/actions/wallet'
import { usePoints } from '../points-context'

import { useCatalog } from '../catalog-context'
import { WHEEL_SEGMENT_COUNT, type WheelSegment as Segment } from '@/lib/rewards-shared'

const SEG_ANGLE = 360 / WHEEL_SEGMENT_COUNT
const SPIN_MS = 4800

const GOLD_FILL = 'var(--gold)'
const DARK_FILL = 'color-mix(in oklch, var(--gold-foreground) 88%, var(--gold))'
const BULBS = 24

const isGold = (i: number) => i % 2 === 0

const wheelBackground = (segments: Segment[]) =>
  `conic-gradient(${segments
    .map((_, i) => `${isGold(i) ? GOLD_FILL : DARK_FILL} ${i * SEG_ANGLE}deg ${(i + 1) * SEG_ANGLE}deg`)
    .join(', ')})`

const COINS = [
  { top: '6%', left: '8%', size: 'size-9', delay: '0s' },
  { top: '14%', left: '86%', size: 'size-11', delay: '0.6s' },
  { top: '72%', left: '4%', size: 'size-8', delay: '1.1s' },
  { top: '80%', left: '88%', size: 'size-10', delay: '0.3s' },
  { top: '42%', left: '92%', size: 'size-6', delay: '1.5s' },
]

export type MiniGameProps = {
  onWin: (points: number) => void | Promise<void>
  lockedFor: number
  canPlay: () => boolean
  onPlayed: () => void
}

export function LuckyWheel({ lockedFor, canPlay, onPlayed }: MiniGameProps) {
  const { setBalance } = usePoints()
  const { wheel } = useCatalog().rewards
  const SEGMENTS = wheel.segments
  const locked = lockedFor > 0
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<Segment | null>(null)
  const [burstKey, setBurstKey] = useState(0)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function spin() {
    if (spinning || !canPlay()) return
    setSpinning(true)
    const res = await playMini('cark')
    if (!res.ok || res.game !== 'cark') {
      setSpinning(false)
      if (typeof res.balance === 'number') setBalance(res.balance)
      return
    }
    const index = res.index
    const center = index * SEG_ANGLE + SEG_ANGLE / 2
    const jitter = (Math.random() - 0.5) * (SEG_ANGLE * 0.6)
    const target = (360 - center + jitter + 360) % 360
    const delta = (target - (rotation % 360) + 360) % 360
    setResult(null)
    setSpinning(true)
    setRotation(rotation + 360 * 6 + delta)
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(() => {
      const seg = SEGMENTS[index]
      setSpinning(false)
      setResult(seg)
      setBalance(res.balance)
      if (seg.points > 0) setBurstKey((k) => k + 1)
      onPlayed()
    }, SPIN_MS)
  }

  return (
    <article className="panel-gold relative flex flex-col gap-6 overflow-hidden rounded-2xl p-6 lg:row-span-2">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Çarkıfelek</span>
          <h3 className="font-display text-2xl font-bold text-foreground">Şans Çarkı</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">Her {wheel.cooldownHours} saatte 1 ücretsiz çevirme. Boost, promo kod ve VIP geçiş kazan.</p>
        </div>
        <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
          {locked ? formatRemaining(lockedFor) : '1 hak'}
        </span>
      </header>

      <div className="relative -mx-6 overflow-hidden">
        <Image
          src="/images/wheel-stage.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 560px, 100vw"
          className="object-cover"
          priority={false}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gold-foreground/30" />
        {COINS.map((c, i) => (
          <span
            key={`coin-${i}`}
            aria-hidden="true"
            className={cn('wheel-coin absolute z-[1] rounded-full border-2 border-gold-foreground/40', c.size)}
            style={{
              top: c.top,
              left: c.left,
              background: 'radial-gradient(circle at 35% 30%, color-mix(in oklch, var(--gold) 60%, var(--foreground)), var(--gold) 55%, color-mix(in oklch, var(--gold) 60%, var(--gold-foreground)))',
              animation: `wheel-coin-float 3.2s ease-in-out ${c.delay} infinite`,
            }}
          />
        ))}

        <div className="relative z-[2] mx-auto my-8 aspect-square w-[82%] max-w-sm">
          <div
            aria-hidden="true"
            className="absolute -inset-4 rounded-full transition-opacity duration-700"
            style={{
              background: 'radial-gradient(circle, color-mix(in oklch, var(--gold) 55%, transparent) 55%, transparent 72%)',
              filter: 'blur(14px)',
              opacity: spinning ? 1 : 0.55,
            }}
          />
          <div
            className="absolute inset-0 rounded-full p-[7%]"
            style={{
              background: 'linear-gradient(145deg, color-mix(in oklch, var(--gold-foreground) 70%, var(--gold)), var(--gold-foreground) 50%, color-mix(in oklch, var(--gold-foreground) 75%, var(--gold)))',
              boxShadow: 'inset 0 0 0 3px color-mix(in oklch, var(--gold) 70%, transparent), 0 18px 40px -12px var(--gold-foreground)',
            }}
          >
            {Array.from({ length: BULBS }).map((_, i) => (
              <span
                key={`bulb-${i}`}
                aria-hidden="true"
                className="absolute inset-0 flex justify-center"
                style={{ transform: `rotate(${(360 / BULBS) * i}deg)` }}
              >
                <span
                  className="wheel-bulb mt-[2.4%] size-2 rounded-full bg-gold sm:size-2.5"
                  style={{
                    boxShadow: '0 0 8px 2px var(--gold)',
                    animation: spinning ? `wheel-bulb 0.5s ease-in-out ${i % 2 ? '0.25s' : '0s'} infinite` : `wheel-bulb 2.4s ease-in-out ${i % 2 ? '1.2s' : '0s'} infinite`,
                  }}
                />
              </span>
            ))}
            <div
              className="relative size-full rounded-full"
              style={{
                background: wheelBackground(SEGMENTS),
                transform: `rotate(${rotation}deg)`,
                transition: `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.12, 1)`,
                boxShadow: '0 0 0 3px var(--gold), inset 0 0 30px color-mix(in oklch, var(--gold-foreground) 60%, transparent)',
              }}
            >
              {SEGMENTS.map((s, i) => (
                <div
                  key={`seg-${i}`}
                  aria-hidden="true"
                  className="absolute inset-0 flex justify-center pt-[7%]"
                  style={{ transform: `rotate(${i * SEG_ANGLE + SEG_ANGLE / 2}deg)` }}
                >
                  <span
                    className={cn(
                      'font-display text-xs font-black tracking-tight [writing-mode:vertical-rl] sm:text-sm',
                      isGold(i) ? 'text-gold-foreground' : 'text-gold',
                    )}
                  >
                    {s.short}
                  </span>
                </div>
              ))}
              {SEGMENTS.map((_, i) => (
                <div
                  key={`divider-${i}`}
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 h-1/2 w-0.5 origin-bottom -translate-x-1/2 bg-gold/70"
                  style={{ transform: `rotate(${i * SEG_ANGLE}deg)` }}
                />
              ))}
            </div>
          </div>

          <div
            aria-hidden="true"
            className="absolute -top-2 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[26px] border-x-transparent border-t-gold drop-shadow-[0_3px_6px_var(--gold-foreground)]"
          />

        <button
          type="button"
          onClick={spin}
          disabled={spinning || locked}
          className="absolute top-1/2 left-1/2 z-10 flex size-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-gold-foreground text-xs font-black uppercase tracking-wider text-gold-foreground transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-90"
          style={{
            background: 'radial-gradient(circle at 35% 30%, color-mix(in oklch, var(--gold) 55%, var(--foreground)), var(--gold) 50%, color-mix(in oklch, var(--gold) 65%, var(--gold-foreground)))',
            boxShadow: '0 0 0 3px var(--gold), 0 0 24px color-mix(in oklch, var(--gold) 70%, transparent)',
          }}
        >
          {locked ? (
            <>
              <Clock className="mb-0.5 size-4" aria-hidden="true" />
              <span className="sr-only">Sonraki çevirme: </span>
              <span className="text-[10px] tabular-nums">{formatRemaining(lockedFor)}</span>
            </>
          ) : (
            <>
              <RotateCw className={cn('mb-0.5 size-5', spinning && 'animate-spin')} aria-hidden="true" />
              {spinning ? 'Dönüyor' : 'Çevir'}
            </>
          )}
        </button>

        {burstKey > 0 && <ParticleBurst key={burstKey} count={24} distance={170} />}
        </div>
      </div>

      <div aria-live="polite" className="min-h-14 rounded-xl border border-border bg-background/50 px-4 py-3 text-center">
        {result ? (
          <p key={burstKey + result.label} className="animate-pop">
            <span className="block text-xs text-muted-foreground">{result.points > 0 ? 'Kazandın' : 'Az kaldı!'}</span>
            <span className={cn('font-display text-lg font-bold', result.points > 0 ? 'text-gold' : 'text-foreground')}>
              {result.label}
            </span>
          </p>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            {spinning ? 'Bol şans…' : locked ? `Sonraki ücretsiz çevirme ${formatRemaining(lockedFor)} sonra.` : 'Ödülünü görmek için çevir'}
          </p>
        )}
      </div>
    </article>
  )
}
