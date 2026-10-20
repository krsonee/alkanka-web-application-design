'use client'

import { useState } from 'react'
import { RotateCw } from 'lucide-react'
import { WHEEL_SEGMENT_COUNT, wheelBigIndices, type WheelSegment } from '@/lib/rewards-shared'
import { cn } from '@/lib/utils'

const SEG_ANGLE = 360 / WHEEL_SEGMENT_COUNT
const SPIN_MS = 2600
const isGold = (i: number) => i % 2 === 0
const GOLD_FILL = 'var(--gold)'
const DARK_FILL = 'color-mix(in oklch, var(--gold-foreground) 88%, var(--gold))'

/** Same geometry as the site wheel, so admins can see exactly where the pointer stops for each payout. */
export function WheelPreview({ segments, winRate }: { segments: WheelSegment[]; winRate: number }) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [landed, setLanded] = useState<number | null>(null)
  const big = wheelBigIndices(segments)

  const testSpin = () => {
    if (spinning) return
    const index = Math.floor(Math.random() * segments.length)
    const target = (360 - (index * SEG_ANGLE + SEG_ANGLE / 2) + 360) % 360
    const delta = (target - (rotation % 360) + 360) % 360
    setLanded(null)
    setSpinning(true)
    setRotation(rotation + 360 * 4 + delta)
    setTimeout(() => {
      setSpinning(false)
      setLanded(index)
    }, SPIN_MS)
  }

  const background = `conic-gradient(${segments
    .map((_, i) => `${isGold(i) ? GOLD_FILL : DARK_FILL} ${i * SEG_ANGLE}deg ${(i + 1) * SEG_ANGLE}deg`)
    .join(', ')})`

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-background/50 p-4 md:flex-row md:items-start">
      <div className="relative aspect-square w-48 shrink-0">
        <div
          className="size-full rounded-full"
          style={{
            background,
            transform: `rotate(${rotation}deg)`,
            transition: `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.12, 1)`,
            boxShadow: '0 0 0 3px var(--gold)',
          }}
        >
          {segments.map((s, i) => (
            <div key={`p-${i}`} aria-hidden="true" className="absolute inset-0 flex justify-center pt-[7%]" style={{ transform: `rotate(${i * SEG_ANGLE + SEG_ANGLE / 2}deg)` }}>
              <span className={cn('font-display text-xs font-black [writing-mode:vertical-rl]', isGold(i) ? 'text-gold-foreground' : 'text-gold')}>{s.short}</span>
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="absolute -top-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-gold" />
        <button
          type="button"
          onClick={testSpin}
          disabled={spinning}
          className="absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-gold-foreground bg-gold text-[10px] font-black uppercase text-gold-foreground disabled:opacity-80"
        >
          <RotateCw className={cn('size-4', spinning && 'animate-spin')} aria-hidden="true" />
          Test
        </button>
      </div>

      <div className="flex w-full flex-col gap-2 text-sm">
        <p className="font-semibold text-foreground">Sitedeki çarkın canlı önizlemesi</p>
        <p className="leading-relaxed text-muted-foreground">
          Kaydetmeden önce dilimleri burada görürsün. Test çevirme bakiye etkilemez. Üyeler {`%${winRate}`} ihtimalle altın işaretli büyük dilimlerden birini kazanır.
        </p>
        <ul className="grid grid-cols-2 gap-1.5">
          {segments.map((s, i) => (
            <li
              key={`l-${i}`}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs',
                landed === i ? 'border-gold bg-gold/15 text-foreground' : 'border-border text-muted-foreground',
              )}
            >
              <span className="truncate">
                {big.has(i) && <span className="mr-1 font-bold text-gold">★</span>}
                {s.label}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{s.points} KC</span>
            </li>
          ))}
        </ul>
        <p aria-live="polite" className="min-h-5 text-xs text-foreground">
          {landed !== null && `İşaretçi "${segments[landed].label}" diliminde durdu, üyeye ${segments[landed].points} KC yazılır.`}
        </p>
      </div>
    </div>
  )
}
