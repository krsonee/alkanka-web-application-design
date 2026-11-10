'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HOME_GAME_LABEL } from '@/lib/home-v2-shared'

const SLIDE_MS = 6000

type Props = {
  slides: string[]
  eyebrow: string
  title: string
  highlight: string
  text: string
  primary: { label: string; href: string }
  secondary: { label: string; href: string }
}

function Title({ title, highlight }: { title: string; highlight: string }) {
  const [first, ...rest] = title.split(', ')
  const lines = rest.length ? [`${first},`, rest.join(', ')] : [title]
  return (
    <h2 className="text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
      {lines.map((line, i) => {
        const at = highlight ? line.indexOf(highlight) : -1
        return (
          <span key={i} className="block">
            {at < 0 ? (
              line
            ) : (
              <>
                {line.slice(0, at)}
                <span className="text-primary">{highlight}</span>
                {line.slice(at + highlight.length)}
              </>
            )}
          </span>
        )
      })}
    </h2>
  )
}

export function HeroSlider({ slides, eyebrow, title, highlight, text, primary, secondary }: Props) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = slides.length

  useEffect(() => {
    if (paused || count < 2) return
    const id = setTimeout(() => setActive((i) => (i + 1) % count), SLIDE_MS)
    return () => clearTimeout(id)
  }, [active, paused, count])

  return (
    <section
      aria-label="Öne çıkan oyunlar"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative isolate flex min-h-[460px] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card sm:min-h-[480px]"
    >
      {slides.map((key, i) => (
        <Image
          key={key}
          src={`/images/slides/${key}.png`}
          alt=""
          fill
          priority={i === 0}
          sizes="(min-width: 1280px) 1200px, 100vw"
          className={cn('-z-10 object-cover transition-opacity duration-700', i === active ? 'opacity-100' : 'opacity-0')}
        />
      ))}
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/80 to-background/10" />
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-background/90 via-transparent to-transparent" />

      <div className="flex flex-col gap-6 p-6 sm:p-10 lg:p-11">
        <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <span aria-hidden="true" className="h-px w-6 bg-primary" />
          {eyebrow}
        </p>
        <Title title={title} highlight={highlight} />
        <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground">{text}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={primary.href}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform hover:-translate-y-0.5"
          >
            {primary.label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href={secondary.href}
            className="inline-flex h-12 items-center rounded-xl border border-border bg-background/60 px-6 text-sm font-bold text-foreground backdrop-blur transition-colors hover:bg-secondary"
          >
            {secondary.label}
          </Link>
        </div>

        {count > 1 && (
          <div role="tablist" aria-label="Oyun slaytları" className="flex flex-wrap gap-2 pt-4">
            {slides.map((key, i) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={cn(
                  'relative flex h-11 items-center gap-2.5 overflow-hidden rounded-xl border bg-background/70 py-1 pl-1 pr-4 text-sm font-semibold backdrop-blur transition-colors',
                  i === active ? 'border-primary/70 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="relative size-9 shrink-0 overflow-hidden rounded-lg">
                  <Image src={`/images/games/${key}.png`} alt="" fill sizes="36px" className="object-cover" />
                </span>
                {HOME_GAME_LABEL[key] ?? key}
                {i === active && (
                  <span
                    aria-hidden="true"
                    key={`bar-${active}-${paused}`}
                    className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary"
                    style={{ animation: paused ? 'none' : `hero-progress ${SLIDE_MS}ms linear forwards` }}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
