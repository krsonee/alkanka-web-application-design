'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackPromo } from '@/lib/promo-client'
import { PlainBanner, SlidePicture } from '@/components/alkanka/slide-picture'

const SLIDE_MS = 6500
const SIZES = '(min-width: 1024px) 900px, 100vw'

type Shared = { id: string; label: string; thumb: string; image: string; mobileImage?: string }

export type MemberSlide = Shared &
  (
    | {
        /** A banner that carries its own words: the picture alone, whole, and the whole of it is the link. */
        kind: 'banner'
        href: string
        name: string
      }
    | {
        kind: 'text'
        eyebrow: string
        title: string
        description?: string
        pills: string[]
        primary: { label: string; href: string; play?: boolean }
        secondary?: { label: string; href: string }
        /** Slides added from the panel count their views and clicks; the game slides do not. */
        tracked?: boolean
      }
  )

const outside = (href: string) => (href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})

export function MemberHeroSlider({ slides }: { slides: MemberSlide[] }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const tabs = useRef<HTMLDivElement>(null)
  const count = slides.length
  const index = count ? Math.min(active, count - 1) : 0
  const current = slides[index]
  const trackedId = current && (current.kind === 'banner' || current.tracked) ? current.id : null

  useEffect(() => {
    if (paused || count < 2) return
    const id = setTimeout(() => setActive((i) => (i + 1) % count), SLIDE_MS)
    return () => clearTimeout(id)
  }, [active, paused, count])

  useEffect(() => {
    if (trackedId) trackPromo('slide', trackedId, 'view')
  }, [trackedId])

  // The row of slide buttons scrolls sideways; keep the one that is up in sight without moving the page.
  useEffect(() => {
    const list = tabs.current
    const tab = list?.children[index] as HTMLElement | undefined
    if (!list || !tab) return
    list.scrollTo({ left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2, behavior: 'smooth' })
  }, [index])

  if (!current) return null
  const go = (d: number) => setActive((i) => (i + d + count) % count)

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Öne çıkanlar"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative isolate flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card sm:min-h-[24rem]"
    >
      {slides.map((s, i) =>
        s.kind === 'banner' ? (
          <Link
            key={s.id}
            href={s.href}
            aria-label={s.name}
            aria-hidden={i === index ? undefined : true}
            tabIndex={i === index ? 0 : -1}
            draggable={false}
            onClick={() => trackPromo('slide', s.id, 'click')}
            {...outside(s.href)}
            className={cn('absolute inset-0 overflow-hidden transition-opacity duration-700', i === index ? 'opacity-100' : 'pointer-events-none opacity-0')}
          >
            <PlainBanner image={s.image} mobileImage={s.mobileImage} priority={i === 0} sizes={SIZES} />
          </Link>
        ) : (
          <SlidePicture
            key={s.id}
            image={s.image}
            mobileImage={s.mobileImage}
            priority={i === 0}
            sizes={SIZES}
            className={cn('-z-10 object-cover transition-[opacity,transform] duration-1000', i === index ? 'scale-100 opacity-100' : 'scale-105 opacity-0')}
          />
        ),
      )}
      {current.kind === 'text' && (
        <>
          <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/75 to-transparent" />
          <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-background/95 via-transparent to-transparent" />
        </>
      )}

      {count > 1 && (
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <span className="rounded-full bg-background/70 px-2.5 py-1 font-mono text-xs font-semibold text-foreground backdrop-blur">
            {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Önceki slayt"
            className="flex size-9 items-center justify-center rounded-full border border-border bg-background/70 text-foreground backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Sonraki slayt"
            className="flex size-9 items-center justify-center rounded-full border border-border bg-background/70 text-foreground backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {slides.map((s, i) =>
        s.kind === 'text' ? (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}: ${s.label}`}
            hidden={i !== index}
            className="relative flex flex-col gap-4 p-6 pb-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 sm:p-8 sm:pb-5"
          >
            {s.eyebrow && (
              <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                <span aria-hidden="true" className="h-px w-6 bg-primary" />
                {s.eyebrow}
              </p>
            )}
            {s.title && <h2 className="max-w-lg text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{s.title}</h2>}
            {s.description && <p className="line-clamp-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">{s.description}</p>}
            {s.pills.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {s.pills.map((p) => (
                  <li key={p} className="rounded-md border border-border bg-background/70 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">
                    {p}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href={s.primary.href}
                onClick={s.tracked ? () => trackPromo('slide', s.id, 'click') : undefined}
                {...outside(s.primary.href)}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform hover:-translate-y-0.5"
              >
                {s.primary.play && <Play className="size-4" aria-hidden="true" />}
                {s.primary.label}
              </Link>
              {s.secondary && (
                <Link
                  href={s.secondary.href}
                  className="inline-flex h-12 items-center rounded-xl border border-border bg-background/60 px-6 text-sm font-bold text-foreground backdrop-blur transition-colors hover:bg-secondary"
                >
                  {s.secondary.label}
                </Link>
              )}
            </div>
          </div>
        ) : null,
      )}

      {count > 1 && (
        <div ref={tabs} role="tablist" aria-label="Slaytlar" className="relative flex gap-2 overflow-x-auto px-6 pb-6 [scrollbar-width:none] sm:px-8 sm:pb-7">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={s.label}
              onClick={() => setActive(i)}
              className={cn(
                'relative flex h-10 shrink-0 items-center gap-2 overflow-hidden rounded-xl border bg-background/70 py-1 pl-1 pr-3 text-xs font-semibold backdrop-blur transition-colors',
                i === index ? 'border-primary/70 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="relative size-8 shrink-0 overflow-hidden rounded-lg">
                <Image src={s.thumb || '/placeholder.svg'} alt="" fill sizes="32px" className="object-cover" />
              </span>
              <span className="max-w-32 truncate">{s.label}</span>
              {i === index && (
                <span
                  aria-hidden="true"
                  key={`bar-${index}-${paused}`}
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary"
                  style={{ animation: paused ? 'none' : `hero-progress ${SLIDE_MS}ms linear forwards` }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
