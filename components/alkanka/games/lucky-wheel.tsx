'use client'

import { useRef, useState } from 'react'
import { Clock, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRemaining } from './mini-status'
import { ParticleBurst } from './particle-burst'

type Segment = { short: string; label: string; points: number; tone: 'cyan' | 'purple' | 'gold' | 'muted' }

const SEGMENTS: Segment[] = [
  { short: '50', label: '50 Kanka Coin', points: 50, tone: 'gold' },
  { short: '2x', label: '2x Boost', points: 120, tone: 'muted' },
  { short: 'VIP', label: 'VIP Geçiş', points: 300, tone: 'purple' },
  { short: '10', label: 'Teselli: 10 Kanka Coin', points: 10, tone: 'muted' },
  { short: '100', label: '100 Kanka Coin', points: 100, tone: 'gold' },
  { short: 'Kod', label: 'Ücretsiz Promo Kod', points: 150, tone: 'muted' },
  { short: '250', label: '250 Kanka Coin', points: 250, tone: 'gold' },
  { short: 'Kutu', label: 'Gizemli Kutu', points: 200, tone: 'muted' },
]

const SEG_ANGLE = 360 / SEGMENTS.length
const SPIN_MS = 4800

const TONE_FILL: Record<Segment['tone'], string> = {
  cyan: 'color-mix(in oklch, var(--primary) 30%, var(--card))',
  purple: 'color-mix(in oklch, var(--accent) 38%, var(--card))',
  gold: 'color-mix(in oklch, var(--gold) 48%, var(--card))',
  muted: 'var(--background)',
}

const WHEEL_BG = `conic-gradient(${SEGMENTS.map(
  (s, i) => `${TONE_FILL[s.tone]} ${i * SEG_ANGLE}deg ${(i + 1) * SEG_ANGLE}deg`,
).join(', ')})`

export type MiniGameProps = {
  onWin: (points: number) => void | Promise<void>
  lockedFor: number
  canPlay: () => boolean
  onPlayed: () => void
}

export function LuckyWheel({ onWin, lockedFor, canPlay, onPlayed }: MiniGameProps) {
  const locked = lockedFor > 0
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<Segment | null>(null)
  const [burstKey, setBurstKey] = useState(0)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function spin() {
    if (spinning || !canPlay()) return
    const index = Math.floor(Math.random() * SEGMENTS.length)
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
      if (seg.points > 0) {
        setBurstKey((k) => k + 1)
        onWin(seg.points)
      }
      onPlayed()
    }, SPIN_MS)
  }

  return (
    <article className="panel-gold relative flex flex-col gap-6 overflow-hidden rounded-2xl p-6 lg:row-span-2">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Çarkıfelek</span>
          <h3 className="font-display text-2xl font-bold text-foreground">Şans Çarkı</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">Her 6 saatte 1 ücretsiz çevirme. Boost, promo kod ve VIP geçiş kazan.</p>
        </div>
        <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
          {locked ? formatRemaining(lockedFor) : '1 hak'}
        </span>
      </header>

      <div className="relative mx-auto aspect-square w-full max-w-sm">
        <div
          aria-hidden="true"
          className={cn(
            'absolute -inset-3 rounded-full transition-opacity duration-700',
            spinning ? 'opacity-100 animate-glow' : 'opacity-40',
          )}
          style={{
            background: 'conic-gradient(var(--primary), var(--accent), var(--gold), var(--primary))',
            filter: 'blur(18px)',
          }}
        />
        <div className="absolute inset-0 rounded-full border-4 border-background bg-background p-2">
          <div
            className="relative size-full rounded-full border border-border"
            style={{
              background: WHEEL_BG,
              transform: `rotate(${rotation}deg)`,
              transition: `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.12, 1)`,
            }}
          >
            {SEGMENTS.map((s, i) => (
              <div
                key={s.label}
                aria-hidden="true"
                className="absolute inset-0 flex justify-center pt-[9%]"
                style={{ transform: `rotate(${i * SEG_ANGLE + SEG_ANGLE / 2}deg)` }}
              >
                <span className="font-display text-sm font-bold text-foreground sm:text-base">{s.short}</span>
              </div>
            ))}
            {SEGMENTS.map((_, i) => (
              <div
                key={`divider-${i}`}
                aria-hidden="true"
                className="absolute top-0 left-1/2 h-1/2 w-px origin-bottom bg-background/60"
                style={{ transform: `rotate(${i * SEG_ANGLE}deg)` }}
              />
            ))}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute -top-1 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent border-t-gold drop-shadow-[0_0_10px_var(--gold)]"
        />

        <button
          type="button"
          onClick={spin}
          disabled={spinning || locked}
          className="absolute top-1/2 left-1/2 z-10 flex size-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-background bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-80 glow-cyan"
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
