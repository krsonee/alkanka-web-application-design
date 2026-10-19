'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  children: ReactNode
  className?: string
  interval?: number
  label?: string
}

export function AutoScrollRow({ children, className, interval = 5500, label }: Props) {
  const ref = useRef<HTMLUListElement>(null)
  const paused = useRef(false)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const total = Math.max(1, Math.round(el.scrollWidth / el.clientWidth))
      setPages(total)
      const max = el.scrollWidth - el.clientWidth
      setPage(max <= 4 ? 0 : Math.round((el.scrollLeft / max) * (total - 1)))
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const tick = () => {
      if (paused.current || document.hidden) return
      const items = Array.from(el.children) as HTMLElement[]
      if (items.length < 2) return
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
        return
      }
      const base = el.getBoundingClientRect().left
      const next = items.find((item) => item.getBoundingClientRect().left - base > 8)
      if (next) el.scrollBy({ left: next.getBoundingClientRect().left - base - parseFloat(getComputedStyle(el).paddingLeft || '0'), behavior: 'smooth' })
    }

    const id = window.setInterval(tick, interval)
    return () => window.clearInterval(id)
  }, [interval])

  const pause = () => {
    paused.current = true
  }
  const resume = () => {
    paused.current = false
  }

  const goTo = (p: number) => {
    const el = ref.current
    if (!el) return
    pause()
    el.scrollTo({ left: ((el.scrollWidth - el.clientWidth) * p) / Math.max(1, pages - 1), behavior: 'smooth' })
    window.setTimeout(resume, 6000)
  }

  return (
    <div className="flex flex-col gap-3">
      <ul
        ref={ref}
        aria-label={label}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={() => window.setTimeout(resume, 4000)}
        onFocus={pause}
        onBlur={resume}
        className={cn('flex snap-x snap-mandatory overflow-x-auto no-scrollbar', className)}
      >
        {children}
      </ul>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: pages }, (_, p) => (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              aria-label={`${p + 1}. sayfaya git`}
              aria-current={p === page ? 'true' : undefined}
              className="flex h-6 items-center px-0.5"
            >
              <span className={cn('h-1.5 rounded-full transition-all', p === page ? 'w-5 bg-gold' : 'w-1.5 bg-muted-foreground/40')} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
