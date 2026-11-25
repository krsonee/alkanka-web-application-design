/*
  What Zar At and Gizemli Sandık share, and nothing of the wheel's terrace: Jako from the chest up at the stage's
  lower edge, the speech bubble he talks through, the game's name set straight on the scene, and the result line.
  Each game brings its own room (the dice table, the vault) and places these itself.
*/

import type { ReactNode } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export type CallerMood = 'idle' | 'busy' | 'win'

/**
 * Jako leaning in from the bottom edge. The box hangs a quarter below the stage, so the stage's own clipping cuts
 * him at the chest. `mirrored` turns him to face the middle when he stands on the right.
 */
export function JakoCaller({ mood, mirrored = false, className }: { mood: CallerMood; mirrored?: boolean; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute bottom-0 aspect-[936/816] translate-y-[24%]', className)}>
      <div className={cn('absolute inset-0', mirrored && '-scale-x-100', mood === 'busy' && 'caller-busy')}>
        <Image
          src="/images/wheel/jako.webp"
          alt=""
          fill
          sizes="(min-width: 640px) 320px, 55vw"
          className={cn('object-contain drop-shadow-[0_0_1.4cqw_rgb(0_0_0/0.7)] transition-opacity duration-150', mood === 'win' && 'opacity-0')}
        />
        {mood === 'win' && (
          <Image
            src="/images/mascots/jako-kazandi-cut.png"
            alt=""
            fill
            sizes="(min-width: 640px) 320px, 55vw"
            className="caller-cheer object-contain drop-shadow-[0_0_1.4cqw_rgb(0_0_0/0.7)]"
          />
        )}
      </div>
    </div>
  )
}

/** What Jako says: the hint, what is happening, or what went wrong. The tail points at the side he stands on. */
export function CallerBubble({
  children,
  tail,
  tone = 'plain',
  className,
}: {
  children: ReactNode
  tail: 'left' | 'right'
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
          'absolute bottom-3 size-2.5 rotate-45 bg-card',
          tone === 'error' ? 'border-destructive/60' : 'border-gold/35',
          tail === 'left' ? '-left-[5.5px] border-b border-l' : '-right-[5.5px] border-t border-r',
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

/** The outcome over the scene: what happened in small type, the Kanka Coin won in gold under it. */
export function StageResult({ label, points, className }: { label: ReactNode; points: number; className?: string }) {
  return (
    <div className={cn('wheel-rise absolute left-1/2 flex w-[90%] -translate-x-1/2 flex-col items-center text-center', className)}>
      <p className="text-[clamp(13px,3.6cqw,16px)] font-bold text-foreground tabular-nums [text-shadow:0_1px_0_rgb(0_0_0/0.8)] @min-[600px]:text-[clamp(11px,1.5cqw,16px)]">
        {label}
      </p>
      <p className="flex items-baseline gap-[0.18em] font-display text-[clamp(36px,12cqw,52px)] leading-[1.05] font-extrabold tracking-tight text-gold tabular-nums [text-shadow:0_2px_0_rgb(0_0_0/0.7)] @min-[600px]:text-[clamp(28px,5cqw,54px)]">
        +{points.toLocaleString('tr-TR')}
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
