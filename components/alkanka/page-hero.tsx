import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { jakoSrc, type JakoPose } from './jako'

export type HeroStat = { label: string; value: string }

export function PageHero({
  eyebrow,
  title,
  description,
  pose,
  speech,
  stats,
  tone = 'gold',
  children,
}: {
  eyebrow: string
  title: string
  description: string
  pose: JakoPose
  speech?: string
  stats?: HeroStat[]
  tone?: 'gold' | 'accent' | 'live'
  children?: ReactNode
}) {
  const toneText = { gold: 'text-primary', accent: 'text-accent', live: 'text-live' }[tone]
  const toneRing = { gold: 'border-primary/30', accent: 'border-accent/30', live: 'border-live/30' }[tone]

  return (
    <header className={cn('relative overflow-hidden rounded-2xl border bg-card', toneRing)}>
      <div className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-end">
        <div className="flex flex-1 flex-col gap-4">
          <nav aria-label="Konum" className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Ana sayfa
            </Link>
            <ChevronRight className="size-3" aria-hidden="true" />
            <span className={cn('font-semibold', toneText)}>{eyebrow}</span>
          </nav>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-foreground text-balance sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">{description}</p>
          </div>
          {stats && (
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</dt>
                  <dd className={cn('font-display text-xl font-bold tabular-nums', toneText)}>{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {children}
        </div>

        <div className="flex items-end gap-3 md:w-80 md:flex-col md:items-end">
          {speech && (
            <p className="relative max-w-60 rounded-xl rounded-br-sm border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground">
              {speech}
            </p>
          )}
          <div className="relative size-28 shrink-0 sm:size-36">
            <Image src={jakoSrc(pose) || '/placeholder.svg'} alt="Maskot Jako" fill sizes="144px" className="object-contain" priority />
          </div>
        </div>
      </div>
    </header>
  )
}
