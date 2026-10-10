import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JakoPose } from './jako'

export type HeroStat = { label: string; value: string }

export function PageHero({
  eyebrow,
  title,
  description,
  stats,
  image,
  tone = 'gold',
  children,
}: {
  eyebrow: string
  title: string
  description: string
  pose?: JakoPose
  speech?: string
  stats?: HeroStat[]
  image?: string
  tone?: 'gold' | 'accent' | 'live'
  children?: ReactNode
}) {
  const toneText = { gold: 'text-primary', accent: 'text-accent', live: 'text-live' }[tone]
  const toneRing = { gold: 'border-primary/30', accent: 'border-accent/30', live: 'border-live/30' }[tone]

  return (
    <header className={cn('relative isolate overflow-hidden rounded-2xl border bg-card', toneRing)}>
      {image && (
        <>
          <div className="absolute inset-x-0 top-0 -z-20 h-60 sm:inset-0 sm:h-auto">
            <Image src={image || '/placeholder.svg'} alt="" fill priority sizes="(min-width: 1024px) 1100px, 100vw" className="object-cover object-[72%_center] sm:object-right" />
          </div>
          <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-60 bg-gradient-to-t from-card to-transparent to-50% sm:inset-0 sm:h-auto sm:bg-gradient-to-r sm:from-card sm:via-card/70 sm:to-transparent sm:to-100%" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-card/80 to-transparent" />
        </>
      )}
      <div className="flex min-h-80 flex-col justify-end gap-6 p-4 pt-48 sm:min-h-72 sm:p-7 sm:pt-7 md:flex-row md:items-end">
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
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">{description}</p>
          </div>
          {stats && (
            <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:w-fit sm:flex-wrap sm:gap-x-8 rounded-xl border border-border/60 bg-background/60 px-4 py-3 backdrop-blur">
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
      </div>
    </header>
  )
}
