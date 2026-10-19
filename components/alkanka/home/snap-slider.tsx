'use client'

import { Children, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SnapSlider({
  children,
  label,
  itemClassName,
  autoplay = 0,
  className,
}: {
  children: React.ReactNode
  label: string
  itemClassName: string
  autoplay?: number
  className?: string
}) {
  const track = useRef<HTMLUListElement>(null)
  const paused = useRef(false)
  const items = Children.toArray(children)
  const [active, setActive] = useState(0)
  const [edges, setEdges] = useState({ start: true, end: false })

  const sync = useCallback(() => {
    const el = track.current
    if (!el) return
    const kids = Array.from(el.children) as HTMLElement[]
    const left = el.scrollLeft
    let idx = 0
    kids.forEach((k, i) => {
      if (Math.abs(k.offsetLeft - el.offsetLeft - left) < Math.abs(kids[idx].offsetLeft - el.offsetLeft - left)) idx = i
    })
    setActive(idx)
    setEdges({ start: left <= 4, end: left + el.clientWidth >= el.scrollWidth - 4 })
  }, [])

  const go = useCallback((i: number) => {
    const el = track.current
    const kid = el?.children[i] as HTMLElement | undefined
    if (!el || !kid) return
    el.scrollTo({ left: kid.offsetLeft - el.offsetLeft, behavior: 'smooth' })
  }, [])

  const step = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  useEffect(() => {
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [sync])

  useEffect(() => {
    if (!autoplay || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      const el = track.current
      if (!el || paused.current || el.scrollWidth <= el.clientWidth + 4) return
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      if (atEnd) go(0)
      else step(1)
    }, autoplay)
    return () => window.clearInterval(id)
  }, [autoplay, go])

  const scrollable = !(edges.start && edges.end)

  return (
    <div
      className={cn('group/slider relative flex flex-col gap-2.5', className)}
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
      onFocusCapture={() => (paused.current = true)}
      onBlurCapture={() => (paused.current = false)}
    >
      <ul
        ref={track}
        aria-label={label}
        onScroll={sync}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth no-scrollbar"
      >
        {items.map((child, i) => (
          <li key={i} className={cn('shrink-0 snap-start', itemClassName)}>
            {child}
          </li>
        ))}
      </ul>

      {scrollable && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={edges.start}
            aria-label="Önceki"
            className="slider-nav left-0 -translate-x-1/2"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={edges.end}
            aria-label="Sonraki"
            className="slider-nav right-0 translate-x-1/2"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
          <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label={`${label} sayfaları`}>
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={active === i}
                aria-label={`${i + 1}. öğe`}
                onClick={() => go(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  active === i ? 'w-5 bg-primary shadow-[0_0_10px_-2px_var(--primary)]' : 'w-1.5 bg-foreground/20 hover:bg-foreground/40',
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
