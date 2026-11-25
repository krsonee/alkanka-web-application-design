/*
  What Zar At and Gizemli Sandık share, and nothing of the wheel's terrace: the speech bubble Jako talks through,
  the game's name set straight on the scene, and the result line. Each game brings its own room (the dice table,
  the vault) and its own Jako (the croupier with his cup, the keeper with his key) and places these itself.
*/

import { useEffect, useState, type ReactNode } from 'react'
import { pacedFrames } from '@/lib/paced-frames'
import { usePrefersReducedMotion } from '@/lib/use-motion'
import { cn } from '@/lib/utils'

/** A number that runs up from zero to `to` and stops on it; under reduced motion it is `to` from the start. */
function useCountUp(to: number, ms = 800) {
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState(reduced ? to : 0)
  useEffect(() => {
    if (reduced) {
      setShown(to)
      return
    }
    const frames = pacedFrames(30)
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      const u = Math.min(1, (now - start) / ms)
      setShown(Math.round(to * (1 - (1 - u) ** 3)))
      if (u < 1) frames.request(tick)
    }
    frames.request(tick)
    return frames.cancel
  }, [to, ms, reduced])
  return shown
}

const TAILS = {
  left: '-left-[5.5px] bottom-3 border-b border-l',
  right: '-right-[5.5px] bottom-3 border-t border-r',
  down: '-bottom-[5.5px] right-7 border-r border-b',
}

/** What Jako says: the hint, what is happening, or what went wrong. The tail points at where he stands. */
export function CallerBubble({
  children,
  tail,
  tone = 'plain',
  className,
}: {
  children: ReactNode
  tail: keyof typeof TAILS
  tone?: 'plain' | 'error'
  className?: string
}) {
  return (
    <p
      className={cn(
        'relative rounded-2xl border bg-card px-3 py-2 text-[clamp(12px,3.3cqw,14px)] leading-snug font-semibold text-pretty @min-[600px]:text-[clamp(11px,1.3cqw,14px)]',
        tone === 'error' ? 'border-destructive/60 text-destructive' : 'border-gold/35 text-foreground',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute size-2.5 rotate-45 bg-card',
          tone === 'error' ? 'border-destructive/60' : 'border-gold/35',
          TAILS[tail],
        )}
      />
      {children}
    </p>
  )
}

/** The game's name and one line under it, top left of the scene. Decorative: the section has its own heading. */
export function StageTitle({ title, sub }: { title: string; sub: ReactNode }) {
  return (
    <div className="absolute top-[4.5%] left-[5%] @min-[600px]:top-[7%] @min-[600px]:left-[3.5%]">
      <p
        aria-hidden="true"
        className="font-display text-[clamp(22px,7.4cqw,32px)] leading-none font-extrabold tracking-tight text-foreground [text-shadow:0_2px_0_rgb(0_0_0/0.6)] @min-[600px]:text-[clamp(20px,3.5cqw,38px)]"
      >
        {title}
      </p>
      <p className="mt-[0.5em] text-[clamp(11px,3.1cqw,13px)] leading-none font-semibold text-foreground/75 tabular-nums [text-shadow:0_1px_0_rgb(0_0_0/0.7)] @min-[600px]:text-[clamp(10px,1.3cqw,14px)]">
        {sub}
      </p>
    </div>
  )
}

/**
 * The outcome over the scene: what happened in small type, the Kanka Coin won in gold under it. The amount lands
 * with a bounce and counts up to what was won. Decorative: the game announces the result in its own live region.
 */
export function StageResult({ label, points, className }: { label: ReactNode; points: number; className?: string }) {
  const shown = useCountUp(points)
  return (
    <div aria-hidden="true" className={cn('absolute left-1/2 flex w-[90%] -translate-x-1/2 flex-col items-center text-center', className)}>
      <p className="wheel-rise text-[clamp(13px,3.6cqw,16px)] font-bold text-foreground tabular-nums [text-shadow:0_1px_0_rgb(0_0_0/0.8)] @min-[600px]:text-[clamp(11px,1.5cqw,16px)]">
        {label}
      </p>
      <p className="stage-prize flex items-baseline gap-[0.18em] font-display text-[clamp(36px,12cqw,52px)] leading-[1.05] font-extrabold tracking-tight text-gold tabular-nums [text-shadow:0_2px_0_rgb(0_0_0/0.7)] @min-[600px]:text-[clamp(28px,5cqw,54px)]">
        +{shown.toLocaleString('tr-TR')}
        <span className="text-[0.4em] font-bold tracking-normal">KC</span>
      </p>
    </div>
  )
}

/** Dark gradients at the head and foot of a scene, so the title, the result and the controls read on any art. */
export function StageShade() {
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[36%] bg-linear-to-b from-background/90 via-background/45 to-transparent" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[30%] bg-linear-to-t from-background/95 via-background/55 to-transparent" />
    </>
  )
}
