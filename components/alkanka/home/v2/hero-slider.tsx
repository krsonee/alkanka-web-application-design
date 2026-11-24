'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackPromo } from '@/lib/promo-client'
import { PlainBanner, SlidePicture } from '@/components/alkanka/slide-picture'
import type { HeroSlide } from './hero-slides'

const SLIDE_MS = 6000
const SWIPE_PX = 48
const SIZES = '(min-width: 1280px) 1200px, 100vw'

type Props = {
  slides: HeroSlide[]
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

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
      <span aria-hidden="true" className="h-px w-6 bg-primary" />
      {children}
    </p>
  )
}

const ctaClass = 'inline-flex h-12 items-center rounded-xl px-6 text-sm font-bold max-sm:flex-1 max-sm:justify-center max-sm:whitespace-nowrap max-sm:px-4'
const primaryClass = 'gap-2 bg-primary text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform hover:-translate-y-0.5 active:scale-[0.97]'
const copyClass = 'col-start-1 row-start-1 flex flex-col gap-6 max-sm:gap-4'
const outside = (href: string) => (href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})

/**
 * Guest hero. From tablets up the picture sits behind the copy inside a framed card; on phones the picture runs
 * edge to edge on top, the copy sits under it on the page itself and the slide buttons become thin progress bars.
 *
 * Slides come from the panel's slider list. A game slide shows the page's own cover copy, a slide with its own
 * words shows those, and a banner that carries its words in the picture is shown clean: no copy, no shading.
 * Every copy sits in the same grid cell, so the box keeps one height whichever slide is up.
 */
export function HeroSlider({ slides, eyebrow, title, highlight, text, primary, secondary }: Props) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)
  const count = slides.length
  const index = count ? Math.min(active, count - 1) : 0
  const current = slides[index]
  const look = current?.look ?? 'cover'
  const currentId = current && current.look !== 'cover' ? current.id : null

  useEffect(() => {
    if (paused || count < 2) return
    const id = setTimeout(() => setActive((i) => (i + 1) % count), SLIDE_MS)
    return () => clearTimeout(id)
  }, [active, paused, count])

  useEffect(() => {
    if (currentId) trackPromo('slide', currentId, 'view')
  }, [currentId])

  const swipe = (dx: number) => {
    if (count < 2 || Math.abs(dx) < SWIPE_PX) return
    setActive((i) => (i + (dx < 0 ? 1 : count - 1)) % count)
  }

  return (
    <section
      aria-label="Öne çıkanlar"
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
        {slides.map((slide, i) =>
          slide.look === 'plain' ? null : (
            <SlidePicture
              key={slide.id}
              image={slide.image}
              mobileImage={slide.mobileImage}
              priority={i === 0}
              sizes={SIZES}
              className={cn(
                'object-cover transition-opacity duration-700',
                slide.game && !slide.mobileImage && 'max-sm:object-[72%_50%]',
                i === index ? 'opacity-100' : 'opacity-0',
              )}
            />
          ),
        )}
        {look !== 'plain' && (
          <>
            <span className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/10 max-sm:hidden" />
            <span className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent max-sm:hidden" />
            <span className="absolute inset-0 bg-gradient-to-b from-background/70 via-transparent via-35% to-background sm:hidden" />
          </>
        )}
      </div>

      {slides.map((slide, i) =>
        slide.look === 'plain' ? (
          <Link
            key={slide.id}
            href={slide.href}
            aria-label={slide.name}
            aria-hidden={i === index ? undefined : true}
            tabIndex={i === index ? 0 : -1}
            draggable={false}
            onClick={() => trackPromo('slide', slide.id, 'click')}
            {...outside(slide.href)}
            className={cn(
              'absolute inset-0 overflow-hidden transition-opacity duration-700 max-sm:bottom-auto',
              // A wide banner is short on a phone: it sits above the page's own heading. One drawn for the phone fills the picture area.
              slide.mobileImage ? 'max-sm:h-80' : 'max-sm:h-48',
              i === index ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            <PlainBanner image={slide.image} mobileImage={slide.mobileImage} priority={i === 0} sizes={SIZES} />
          </Link>
        ) : null,
      )}

      {/* The copy sits over the banner link; only its own links and buttons take clicks. */}
      <div className="pointer-events-none relative flex flex-col gap-6 p-6 max-sm:gap-4 max-sm:px-4 max-sm:pb-0 max-sm:pt-52 sm:p-10 lg:p-11 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        <div className="grid items-end">
          {/* Under a banner the phone keeps the page's own copy below the picture; wider screens show the banner alone. */}
          <div className={cn(copyClass, look === 'text' && 'invisible', look === 'plain' && 'sm:invisible')}>
            <div className={cn('flex flex-col gap-6 max-sm:gap-4', look === 'plain' && current?.mobileImage && 'max-sm:invisible')}>
              <Eyebrow>{eyebrow}</Eyebrow>
              <Title title={title} highlight={highlight} />
            </div>
            <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground">{text}</p>
            <div className="flex flex-wrap gap-3 max-sm:gap-2.5">
              <Link href={primary.href} className={cn(ctaClass, primaryClass)}>
                {primary.label}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href={secondary.href} className={cn(ctaClass, 'border border-border bg-background/60 text-foreground backdrop-blur transition-colors hover:bg-secondary')}>
                {secondary.label}
              </Link>
            </div>
          </div>
          {slides.map((slide, i) =>
            slide.look === 'text' ? (
              <div key={slide.id} className={cn(copyClass, i !== index && 'invisible')}>
                {slide.eyebrow && <Eyebrow>{slide.eyebrow}</Eyebrow>}
                <Title title={slide.title} highlight="" />
                {slide.description && <p className="max-w-md text-pretty text-base leading-relaxed text-muted-foreground">{slide.description}</p>}
                <div className="flex flex-wrap gap-3 max-sm:gap-2.5">
                  <Link href={slide.href} onClick={() => trackPromo('slide', slide.id, 'click')} {...outside(slide.href)} className={cn(ctaClass, primaryClass)}>
                    {slide.cta}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ) : null,
          )}
        </div>

        {count > 1 && (
          <div
            role="tablist"
            aria-label="Slaytlar"
            className="flex flex-wrap gap-2 pt-4 max-sm:absolute max-sm:inset-x-4 max-sm:top-0 max-sm:flex-nowrap max-sm:gap-1 max-sm:pt-0"
          >
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                onClick={() => setActive(i)}
                className={cn(
                  'relative flex h-11 items-center gap-2.5 overflow-hidden rounded-xl border bg-background/70 py-1 pl-1 pr-4 text-sm font-semibold backdrop-blur transition-colors max-sm:flex-1 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:backdrop-blur-none',
                  i === index ? 'border-primary/70 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="relative size-9 shrink-0 overflow-hidden rounded-lg max-sm:hidden">
                  <Image src={slide.thumb || '/placeholder.svg'} alt="" fill sizes="36px" className="object-cover" />
                </span>
                <span className="max-sm:sr-only sm:max-w-36 sm:truncate">{slide.label}</span>
                <span aria-hidden="true" className="h-[3px] w-full rounded-full bg-foreground/30 sm:hidden" />
                {i === index && (
                  <span
                    aria-hidden="true"
                    key={`bar-${index}-${paused}`}
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
