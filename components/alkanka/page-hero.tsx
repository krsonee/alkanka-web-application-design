import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JakoPose } from './jako'

export type HeroStat = { label: string; value: string }

const TONES = {
  gold: { text: 'text-primary', ring: 'border-primary/30', chip: 'border-primary/25 bg-primary/10 text-primary', glow: 'oklch(0.8 0.135 86 / 0.22)', bar: 'bg-primary' },
  accent: { text: 'text-accent', ring: 'border-accent/30', chip: 'border-accent/25 bg-accent/10 text-accent', glow: 'oklch(0.74 0.13 232 / 0.22)', bar: 'bg-accent' },
  live: { text: 'text-live', ring: 'border-live/30', chip: 'border-live/25 bg-live/10 text-live', glow: 'oklch(0.78 0.18 150 / 0.2)', bar: 'bg-live' },
} as const

export function PageHero({
  eyebrow,
  title,
  description,
  stats,
  highlights,
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
  highlights?: string[]
  image?: string
  tone?: keyof typeof TONES
  children?: ReactNode
}) {
  const t = TONES[tone]

  return (
    <header className={cn('relative isolate overflow-hidden rounded-2xl border bg-card', t.ring)}>
      {image && (
        <Image
          src={image || '/placeholder.svg'}
          alt=""
          aria-hidden="true"
          fill
          sizes="320px"
          className="-z-20 scale-125 object-cover object-right opacity-40 blur-3xl saturate-150"
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `radial-gradient(ellipse 60% 90% at 0% 100%, ${t.glow}, transparent 70%), radial-gradient(circle at 1px 1px, oklch(1 0 0 / 0.06) 1px, transparent 0)`,
          backgroundSize: '100% 100%, 18px 18px',
        }}
      />
      <div aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-px opacity-60', t.bar)} />

      {image && (
        <div
          className="relative -z-10 aspect-[1584/672] w-full sm:absolute sm:inset-y-0 sm:right-0 sm:h-full sm:w-auto sm:max-w-[68%]"
          style={{ maskImage: 'linear-gradient(to right, transparent, #000 32%)', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 32%)' }}
        >
          <Image src={image || '/placeholder.svg'} alt="" fill priority sizes="(min-width: 1024px) 900px, 100vw" className="object-cover object-right" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent sm:hidden" />
        </div>
      )}

      <div className={cn('relative flex flex-col justify-center gap-6 p-4 sm:min-h-72 sm:p-8', image && '-mt-6 pt-0 sm:mt-0 sm:pt-8')}>
        <div className="flex flex-col gap-4 sm:max-w-[52%]">
          <nav aria-label="Konum" className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Ana sayfa
            </Link>
            <ChevronRight className="size-3" aria-hidden="true" />
            <span className={cn('font-semibold', t.text)}>{eyebrow}</span>
          </nav>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-foreground text-balance sm:text-4xl">
              {title}
            </h1>
            <span aria-hidden="true" className={cn('h-1 w-14 rounded-full', t.bar)} />
            <p className="max-w-xl pt-1 text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">{description}</p>
          </div>
          {highlights && highlights.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {highlights.map((h) => (
                <li key={h} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold', t.chip)}>
                  <Sparkles className="size-3" aria-hidden="true" />
                  {h}
                </li>
              ))}
            </ul>
          )}
          {stats && (
            <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border/60 bg-background/60 px-4 py-3 backdrop-blur sm:flex sm:w-fit sm:flex-wrap sm:gap-x-8">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</dt>
                  <dd className={cn('font-display text-xl font-bold tabular-nums', t.text)}>{s.value}</dd>
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
