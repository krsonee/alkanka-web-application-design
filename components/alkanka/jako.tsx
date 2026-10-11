import Image from 'next/image'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type JakoPose =
  | 'jako'
  | 'merhaba'
  | 'kazandi'
  | 'duyuru'
  | 'sandik'
  | 'dusunen'
  | 'zar'
  | 'market'
  | 'uzgun'
  | 'telegram'

export function jakoSrc(pose: JakoPose) {
  return pose === 'jako' ? '/images/mascots/jako.png' : `/images/mascots/jako-${pose}.png`
}

const SIZES = {
  sm: 'size-16',
  md: 'size-24',
  lg: 'size-32 sm:size-36',
} as const

export function JakoAvatar({
  pose = 'jako',
  size = 'md',
  className,
  alt = '',
}: {
  pose?: JakoPose
  size?: keyof typeof SIZES
  className?: string
  alt?: string
}) {
  return (
    <span className={cn('relative shrink-0 overflow-hidden rounded-2xl bg-surface ring-1 ring-primary/30', SIZES[size], className)}>
      <Image src={jakoSrc(pose) || '/placeholder.svg'} alt={alt} fill sizes="160px" className="object-cover object-top" />
    </span>
  )
}

export function JakoTip({
  pose = 'jako',
  size = 'md',
  title = 'Jako diyor ki',
  children,
  className,
}: {
  pose?: JakoPose
  size?: keyof typeof SIZES
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <aside className={cn('flex items-center gap-3', className)}>
      <JakoAvatar pose={pose} size={size} />
      <div className="relative flex min-w-0 flex-col gap-0.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2">
        <span
          aria-hidden="true"
          className="absolute top-1/2 -left-1.5 size-3 -translate-y-1/2 rotate-45 border-b border-l border-primary/25 bg-card"
        />
        <span className="relative text-[10px] font-bold uppercase tracking-widest text-primary">{title}</span>
        <p className="relative text-sm leading-relaxed text-foreground text-pretty">{children}</p>
      </div>
    </aside>
  )
}

export function JakoEmpty({ pose = 'uzgun', title, children }: { pose?: JakoPose; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <JakoAvatar pose={pose} size="lg" />
      <p className="font-display text-base font-bold text-foreground text-balance">{title}</p>
      {children && <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">{children}</p>}
    </div>
  )
}
