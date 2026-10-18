'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SLIDES, type Slide } from './data'

const INTERVAL = 6000
const SWIPE_MIN = 40

export function BannerCarousel({ slides = SLIDES }: { slides?: Slide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  const count = slides.length

  const go = useCallback((dir: 1 | -1) => setIndex((i) => (i + dir + count) % count), [count])

  useEffect(() => {
    if (paused || count < 2) return
    const t = setTimeout(() => go(1), INTERVAL)
    return () => clearTimeout(t)
  }, [paused, go, index, count])

  if (count === 0) return null

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Öne çıkanlar"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="flex min-w-0 flex-col gap-3"
    >
      <div
        className="panel-gold relative aspect-[16/11] touch-pan-y overflow-hidden rounded-2xl sm:aspect-[21/8]"
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) >= SWIPE_MIN) go(dx < 0 ? 1 : -1)
        }}
      >
        {slides.map((slide, i) => {
          const active = i === index
          const external = slide.href.startsWith('http')
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}: ${slide.title}`}
              aria-hidden={!active}
              className={cn('absolute inset-0 transition-opacity duration-700', active ? 'opacity-100' : 'pointer-events-none opacity-0')}
            >
              <div className="absolute inset-0 sm:left-1/4">
                <Image
                  src={slide.image || '/placeholder.svg'}
                  alt=""
                  fill
                  priority={i === 0}
                  sizes="(min-width: 1280px) 1100px, 100vw"
                  className={cn(
                    'object-cover object-center transition-transform duration-[6000ms] ease-out',
                    active ? 'scale-105' : 'scale-100',
                  )}
                />
              </div>
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent sm:bg-gradient-to-r sm:from-background sm:from-25% sm:via-background/70 sm:via-45% sm:to-transparent sm:to-75%" />
              <div
                className={cn(
                  'relative flex h-full max-w-xl flex-col justify-end gap-2.5 p-5 transition-all duration-700 sm:justify-center sm:gap-3 sm:py-10 sm:pr-10 sm:pl-20',
                  active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
                )}
              >
                <span className="w-fit rounded-md bg-primary px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
                  {slide.eyebrow}
                </span>
                <h2 className="font-display text-2xl font-bold leading-tight text-foreground text-balance sm:text-4xl">{slide.title}</h2>
                <p className="hidden text-sm leading-relaxed text-muted-foreground text-pretty sm:block">{slide.description}</p>
                {slide.chips && slide.chips.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Oyun özellikleri">
                    {slide.chips.map((chip) => (
                      <li
                        key={chip}
                        className="rounded-full border border-primary/40 bg-background/60 px-2.5 py-0.5 text-[11px] font-semibold text-foreground backdrop-blur"
                      >
                        {chip}
                      </li>
                    ))}
                  </ul>
                )}
                <a
                  href={slide.href}
                  tabIndex={active ? 0 : -1}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="mt-1 w-fit rounded-lg bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {slide.cta}
                </a>
              </div>
            </div>
          )
        })}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Önceki"
              className="absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-primary/40 bg-background/60 text-foreground backdrop-blur transition-colors hover:border-primary sm:flex"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Sonraki"
              className="absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-primary/40 bg-background/60 text-foreground backdrop-blur transition-colors hover:border-primary sm:flex"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <>
          <div className="hidden min-w-0 gap-2 md:flex">
            {slides.map((s, i) => {
              const active = i === index
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`${i + 1}. slayt: ${s.eyebrow || s.title}`}
                  aria-current={active}
                  className={cn(
                    'group relative flex h-12 min-w-0 flex-1 items-end overflow-hidden rounded-lg border text-left transition-all',
                    active ? 'border-primary' : 'border-border opacity-60 hover:opacity-100',
                  )}
                >
                  <Image src={s.image || '/placeholder.svg'} alt="" fill sizes="120px" className="object-cover" />
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                  <span className="relative truncate px-2 pb-1.5 text-[11px] font-bold text-foreground">{s.eyebrow || s.title}</span>
                  {active && (
                    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/30">
                      <span
                        key={`${index}-${paused}`}
                        className="block h-full origin-left bg-primary"
                        style={{ animation: paused ? 'none' : `carousel-progress ${INTERVAL}ms linear forwards` }}
                      />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex justify-center gap-1.5 md:hidden">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}. slayt`}
                aria-current={i === index}
                className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground')}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
