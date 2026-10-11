'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SLIDES, type Slide } from './data'

const INTERVAL = 6000

export function BannerCarousel({ slides = SLIDES }: { slides?: Slide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const go = useCallback((dir: 1 | -1) => setIndex((i) => (i + dir + slides.length) % slides.length), [])

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => go(1), INTERVAL)
    return () => clearInterval(t)
  }, [paused, go, index])

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Öne çıkanlar"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="flex flex-col gap-3"
    >
      <div className="panel-gold relative aspect-[16/10] overflow-hidden rounded-2xl sm:aspect-[21/8]">
        {slides.map((slide, i) => {
          const active = i === index
          const external = slide.href.startsWith('http')
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${slides.length}: ${slide.title}`}
              aria-hidden={!active}
              className={cn('absolute inset-0 transition-opacity duration-700', active ? 'opacity-100' : 'pointer-events-none opacity-0')}
            >
              <div className="absolute inset-0 sm:left-1/4">
                <Image
                  src={slide.image}
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
              <div className="relative flex h-full max-w-xl flex-col justify-end gap-3 p-5 sm:justify-center sm:py-10 sm:pr-10 sm:pl-20">
                <span className="w-fit rounded-md bg-primary px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
                  {slide.eyebrow}
                </span>
                <h2 className="font-display text-2xl font-bold leading-tight text-foreground text-balance sm:text-4xl">{slide.title}</h2>
                <p className="hidden text-sm leading-relaxed text-muted-foreground sm:block">{slide.description}</p>
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
      </div>

      <div className="flex justify-center gap-1.5">
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
    </section>
  )
}
