'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SLIDES, type Slide } from './data'

const INTERVAL = 6000
const SWIPE_RATIO = 0.15
const WHEEL_MIN = 30

export function BannerCarousel({ slides = SLIDES }: { slides?: Slide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number; id: number; locked: boolean | null } | null>(null)
  const moved = useRef(false)
  const wheelLock = useRef(0)
  const count = slides.length

  const goTo = useCallback((i: number) => setIndex(((i % count) + count) % count), [count])
  const go = useCallback((dir: 1 | -1) => setIndex((i) => (i + dir + count) % count), [count])

  useEffect(() => {
    if (paused || dragging || count < 2) return
    const t = setTimeout(() => go(1), INTERVAL)
    return () => clearTimeout(t)
  }, [paused, dragging, go, index, count])

  useEffect(() => {
    const el = viewport.current
    if (!el || count < 2) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < WHEEL_MIN) return
      e.preventDefault()
      const now = Date.now()
      if (now - wheelLock.current < 600) return
      wheelLock.current = now
      go(e.deltaX > 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [go, count])

  if (count === 0) return null

  const endDrag = () => {
    const width = viewport.current?.offsetWidth ?? 1
    if (Math.abs(drag) > width * SWIPE_RATIO) go(drag < 0 ? 1 : -1)
    setDrag(0)
    setDragging(false)
    start.current = null
  }

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
        ref={viewport}
        className={cn(
          'panel-gold relative h-72 touch-pan-y select-none overflow-hidden rounded-2xl sm:h-76',
          count > 1 && (dragging ? 'cursor-grabbing' : 'cursor-grab'),
        )}
        onPointerDown={(e) => {
          if (count < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, locked: null }
          moved.current = false
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s || s.id !== e.pointerId) return
          const dx = e.clientX - s.x
          const dy = e.clientY - s.y
          if (s.locked === null) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
            s.locked = Math.abs(dx) > Math.abs(dy)
            if (!s.locked) {
              start.current = null
              return
            }
            e.currentTarget.setPointerCapture(e.pointerId)
            setDragging(true)
          }
          moved.current = true
          setDrag(dx)
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (moved.current) {
            e.preventDefault()
            e.stopPropagation()
            moved.current = false
          }
        }}
      >
        <div
          className={cn('flex h-full', !dragging && 'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]')}
          style={{ transform: `translate3d(calc(${-index * 100}% + ${drag}px), 0, 0)` }}
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
                className="relative h-full w-full shrink-0 overflow-hidden"
              >
                <div className="absolute inset-0 sm:left-1/4">
                  <Image
                    src={slide.image || '/placeholder.svg'}
                    alt=""
                    fill
                    draggable={false}
                    priority={i === 0}
                    sizes="(min-width: 1280px) 1100px, 100vw"
                    className="pointer-events-none object-cover object-center"
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent sm:bg-gradient-to-r sm:from-background sm:from-25% sm:via-background/70 sm:via-45% sm:to-transparent sm:to-75%"
                />
                <div
                  className={cn(
                    'relative flex h-full max-w-xl flex-col justify-end gap-2.5 p-5 pb-9 transition-all duration-700 sm:justify-center sm:gap-2.5 sm:py-6 sm:pr-10 sm:pl-20',
                    active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
                  )}
                >
                  <span className="w-fit rounded-md bg-primary px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
                    {slide.eyebrow}
                  </span>
                  <h2 className="font-display text-2xl font-bold leading-tight text-foreground text-balance sm:text-3xl">{slide.title}</h2>
                  <p className="hidden text-sm leading-relaxed text-muted-foreground text-pretty sm:line-clamp-2">{slide.description}</p>
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
                    draggable={false}
                    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="mt-1 w-fit rounded-lg bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    {slide.cta}
                  </a>
                </div>
              </div>
            )
          })}
        </div>

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
            <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5 sm:bottom-4">
              {slides.map((s, i) => {
                const active = i === index
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`${i + 1}. slayt: ${s.eyebrow || s.title}`}
                    aria-current={active}
                    className={cn(
                      'relative h-1.5 overflow-hidden rounded-full transition-all duration-300',
                      active ? 'w-8 bg-primary/30' : 'w-1.5 bg-foreground/40 hover:bg-foreground/70',
                    )}
                  >
                    {active && (
                      <span
                        key={`${index}-${paused}-${dragging}`}
                        aria-hidden="true"
                        className="absolute inset-0 origin-left bg-primary"
                        style={{
                          animation: paused || dragging ? 'none' : `carousel-progress ${INTERVAL}ms linear forwards`,
                          transform: paused || dragging ? 'scaleX(1)' : undefined,
                        }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
