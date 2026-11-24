'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HOME_GAME_LABEL } from '@/lib/home-v2-shared'

const SLIDE_MS = 6000
const SWIPE_PX = 48

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

const ctaClass = 'inline-flex h-12 items-center rounded-xl px-6 text-sm font-bold max-sm:flex-1 max-sm:justify-center max-sm:whitespace-nowrap max-sm:px-4'

/**
 * Guest hero. From tablets up the picture sits behind the copy inside a framed card; on phones the picture runs
 * edge to edge on top, the copy sits under it on the page itself and the game chips become thin progress bars.
 */
export function HeroSlider({ slides, eyebrow, title, highlight, text, primary, secondary }: Props) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  const count = slides.length

  useEffect(() => {
    if (paused || count < 2) return
    const id = setTimeout(() => setActive((i) => (i + 1) % count), SLIDE_MS)
    return () => clearTimeout(id)
  }, [active, paused, count])

  const swipe = (dx: number) => {
    if (count < 2 || Math.abs(dx) < SWIPE_PX) return
    setActive((i) => (i + (dx < 0 ? 1 : count - 1)) % count)
  }

  return (
    <section
      aria-label="Öne çıkan oyunlar"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        if (touchX.current !== null) swipe(e.changedTouches[0].clientX - touchX.current)
        touchX.current = null
        setPaused(false)
      }}
      className="relative isolate flex min-h-[460px] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card max-sm:-mx-4 max-sm:min-h-0 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent sm:min-h-[480px]"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10 max-sm:bottom-auto max-sm:h-80">
        {slides.map((key, i) => (
          <Image
            key={key}
            src={`/images/slides/${key}.png`}
            alt=""
            fill
            priority={i === 0}
            sizes="(min-width: 1280px) 1200px, 100vw"
            className={cn('object-cover transition-opacity duration-700 max-sm:object-[72%_50%]', i === active ? 'opacity-100' : 'opacity-0')}
          />
        ))}
        <span className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/10 max-sm:hidden" />
        <span className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent max-sm:hidden" />
        <span className="absolute inset-0 bg-gradient-to-b from-background/70 via-transparent via-35% to-background sm:hidden" />
      </div>

      <div className="flex flex-col gap-6 p-6 max-sm:gap-4 max-sm:px-4 max-sm:pb-0 max-sm:pt-52 sm:p-10 lg:p-11">
        <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <span aria-hidden="true" className="h-px w-6 bg-primary" />
          {eyebrow}
        </p>
        <Title title={title} highlight={highlight} />
        <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground">{text}</p>
        <div className="flex flex-wrap gap-3 max-sm:gap-2.5">
          <Link
            href={primary.href}
            className={cn(ctaClass, 'gap-2 bg-primary text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform hover:-translate-y-0.5 active:scale-[0.97]')}
          >
            {primary.label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href={secondary.href}
            className={cn(ctaClass, 'border border-border bg-background/60 text-foreground backdrop-blur transition-colors hover:bg-secondary')}
          >
            {secondary.label}
          </Link>
        </div>

        {count > 1 && (
          <div
            role="tablist"
            aria-label="Oyun slaytları"
            className="flex flex-wrap gap-2 pt-4 max-sm:absolute max-sm:inset-x-4 max-sm:top-0 max-sm:flex-nowrap max-sm:gap-1 max-sm:pt-0"
          >
            {slides.map((key, i) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={cn(
                  'relative flex h-11 items-center gap-2.5 overflow-hidden rounded-xl border bg-background/70 py-1 pl-1 pr-4 text-sm font-semibold backdrop-blur transition-colors max-sm:flex-1 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:backdrop-blur-none',
                  i === active ? 'border-primary/70 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="relative size-9 shrink-0 overflow-hidden rounded-lg max-sm:hidden">
                  <Image src={`/images/games/${key}.png`} alt="" fill sizes="36px" className="object-cover" />
                </span>
                <span className="max-sm:sr-only">{HOME_GAME_LABEL[key] ?? key}</span>
                <span aria-hidden="true" className="h-[3px] w-full rounded-full bg-foreground/30 sm:hidden" />
                {i === active && (
                  <span
                    aria-hidden="true"
                    key={`bar-${active}-${paused}`}
                    className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary max-sm:bottom-auto max-sm:top-1/2 max-sm:h-[3px] max-sm:-translate-y-1/2 max-sm:rounded-full max-sm:bg-foreground"
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
