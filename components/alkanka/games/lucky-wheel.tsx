'use client'

/*
  Şans Çarkı: a framed night terrace with Jako on the left, the wheel on the right over its dais, and between them
  the title plaque, the wheel's rewards and the spin button.

  The stage is a container. From 600 wide it is 2 : 1 with the rewards as a list in the middle column; below that
  (phones) it is 9 : 16 with Jako behind the balustrade, the wheel over the dais, the button at the foot and the
  rewards as chips under the stage.

  The draw, the cooldown and the payout all happen on the server (playMini); this component only shows them. Jako
  cheers while the wheel turns, celebrates a paying slice and winces at an empty one.
*/

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Clock } from 'lucide-react'
import { playMini } from '@/app/actions/wallet'
import type { WheelSegment as Segment } from '@/lib/rewards-shared'
import { playSound } from '@/lib/sound'
import { usePrefersReducedMotion } from '@/lib/use-motion'
import { TableBrand } from '../arena/table-brand'
import { useCatalog } from '../catalog-context'
import { usePoints } from '../points-context'
import { formatRemaining } from './mini-status'
import { burst } from './wheel-stage/burst'
import type { ActorState } from './wheel-stage/jako-actor'
import { ActionButton, ActionNote, ResultCard, RewardChips, RewardList } from './wheel-stage/parts'
import { StageBackdrop } from './wheel-stage/stage'
import { WheelDisc, type WheelController } from './wheel-stage/wheel-disc'

export type MiniGameProps = {
  onWin: (points: number) => void | Promise<void>
  lockedFor: number
  /** Plays the member still has right now (bought extras included); null for guests or while loading. */
  playsLeft?: number | null
  canPlay: () => boolean
  onPlayed: () => void
}

type Result = { index: number; segment: Segment }

export type WheelDraw = () => Promise<
  { ok: true; index: number; points: number; balance: number; segments: Segment[] } | { ok: false; balance?: number }
>

const serverDraw: WheelDraw = async () => {
  const res = await playMini('cark')
  if (res.ok && res.game === 'cark') return { ok: true, index: res.index, points: res.points, balance: res.balance, segments: res.segments }
  return { ok: false, balance: res.balance }
}

/** `draw` is where a spin's outcome comes from: the server, unless a preview passes its own. */
export function LuckyWheel({ lockedFor, playsLeft, canPlay, onPlayed, draw = serverDraw }: MiniGameProps & { draw?: WheelDraw }) {
  const { setBalance } = usePoints()
  const { wheel } = useCatalog().rewards
  const reduced = usePrefersReducedMotion()
  const [serverSegments, setServerSegments] = useState<Segment[] | null>(null)
  const segments = serverSegments ?? wheel.segments
  const locked = lockedFor > 0
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [cardOpen, setCardOpen] = useState(false)
  const [actor, setActor] = useState<ActorState>('idle')
  const wheelRef = useRef<WheelController>(null)
  const hubRef = useRef<HTMLDivElement>(null)

  async function spin() {
    if (spinning || !canPlay()) return
    setSpinning(true)
    setCardOpen(false)
    const res = await draw()
    if (!res.ok) {
      setSpinning(false)
      if (typeof res.balance === 'number') setBalance(res.balance)
      return
    }
    // Draw with the exact segments the server paid out from, so the pointer always lands on what was credited.
    const paid = res.segments[res.index] ?? segments[res.index]
    setServerSegments(res.segments)
    setResult(null)
    setActor('spin')
    await wheelRef.current?.spinTo(res.index, reduced)

    const segment = { ...paid, points: res.points }
    const won = segment.points > 0
    setSpinning(false)
    setResult({ index: res.index, segment })
    setCardOpen(true)
    setBalance(res.balance)
    setActor(won ? 'win' : 'lose')
    playSound(won ? 'win' : 'lose')
    if (won) {
      const hub = hubRef.current?.getBoundingClientRect()
      if (hub) burst(hub.left + hub.width / 2, hub.top + hub.height / 2)
    }
    onPlayed()
  }

  const landing = result && !spinning ? { index: result.index, won: result.segment.points > 0 } : null
  const plays = Math.max(1, playsLeft ?? 1)

  return (
    <article className="flex min-w-0 flex-col gap-3 lg:row-span-2">
      <section aria-labelledby="sans-carki-baslik" className="@container min-w-0">
        <h3 id="sans-carki-baslik" className="sr-only">
          Şans Çarkı
        </h3>
        <div className="relative isolate aspect-[9/16] w-full overflow-hidden rounded-2xl border border-gold/25 bg-background @min-[600px]:aspect-[2/1] @min-[600px]:max-h-[600px]">
          <StageBackdrop state={actor} armed={!locked && !spinning} />
          <TableBrand center={false} corners={false} jako={false} plaque="top" />

          <div className="absolute top-[3%] right-[3%] w-[40%] @min-[600px]:top-[6%] @min-[600px]:right-auto @min-[600px]:left-[31.5%] @min-[600px]:w-[19.5%]">
            <div className="relative aspect-[900/387]">
              <Image src="/images/wheel/plaque.webp" alt="" fill sizes="(min-width: 640px) 240px, 46vw" className="object-contain" />
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center pb-[2%] font-display text-[clamp(14px,4.4cqw,28px)] font-extrabold tracking-tight text-foreground @min-[600px]:text-[clamp(12px,2.2cqw,26px)]"
              >
                Şans Çarkı
              </span>
            </div>
          </div>

          <div className="absolute top-[23.5%] left-[31.5%] hidden w-[19.5%] @min-[600px]:block">
            <RewardList segments={segments} landing={landing} />
          </div>

          <div className="absolute inset-x-[6%] bottom-[4%] flex flex-col items-stretch gap-1.5 @min-[600px]:inset-x-auto @min-[600px]:bottom-[6%] @min-[600px]:left-[31.5%] @min-[600px]:w-[19.5%]">
            <ActionButton onClick={spin} disabled={spinning || locked}>
              {locked ? (
                <>
                  <Clock className="size-4" aria-hidden="true" />
                  <span className="sr-only">Sonraki çevirme: </span>
                  {formatRemaining(lockedFor)}
                </>
              ) : spinning ? (
                'Çark dönüyor…'
              ) : (
                'Çarkı çevir'
              )}
            </ActionButton>
            <ActionNote>
              {locked
                ? 'Yeni hakkın sayaç bitince açılır.'
                : playsLeft == null
                  ? `Her ${wheel.cooldownHours} saatte 1 ücretsiz çevirme.`
                  : `${plays} çevirme hakkın var.`}
            </ActionNote>
          </div>

          <div className="absolute top-[33%] left-1/2 w-[84%] -translate-x-1/2 @min-[600px]:top-[5%] @min-[600px]:left-[69.5%] @min-[600px]:aspect-square @min-[600px]:h-[74%] @min-[600px]:w-auto">
            <WheelDisc
              controller={wheelRef}
              segments={segments}
              landed={landing?.index ?? null}
              won={landing?.won ?? false}
              spinning={spinning}
              className="size-full"
            />
            <div ref={hubRef} aria-hidden="true" className="absolute top-1/2 left-1/2 size-px" />
          </div>

          {cardOpen && result && (
            <ResultCard
              won={result.segment.points > 0}
              title={result.segment.points > 0 ? 'Kazandın!' : 'Bu sefer olmadı'}
              points={result.segment.points}
              label={result.segment.label}
              note={result.segment.points > 0 ? 'Ödül bakiyene eklendi.' : 'Bir sonraki çevirmede şansın açık olsun.'}
              action={locked ? 'Tamam' : 'Tekrar çevir'}
              onAction={() => {
                setCardOpen(false)
                if (!locked) void spin()
              }}
              onClose={() => setCardOpen(false)}
            />
          )}
        </div>
      </section>

      <div className="@container">
        <div className="@min-[600px]:hidden">
          <RewardChips segments={segments} landing={landing} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Her {wheel.cooldownHours} saatte 1 ücretsiz çevirme. Boost, promo kod ve VIP geçiş kazan.
        </p>
        <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
          {locked ? formatRemaining(lockedFor) : `${plays} hak`}
        </span>
      </div>

      <p aria-live="polite" className="sr-only">
        {result && !spinning ? `${result.segment.points > 0 ? 'Kazandın' : 'Bu sefer olmadı'}: ${result.segment.label}` : ''}
      </p>
    </article>
  )
}
