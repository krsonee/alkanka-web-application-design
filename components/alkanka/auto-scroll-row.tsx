'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  children: ReactNode
  className?: string
  interval?: number
  label?: string
}

export function AutoScrollRow({ children, className, interval = 3500, label }: Props) {
  const ref = useRef<HTMLUListElement>(null)
  const paused = useRef(false)

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

  return (
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
  )
}
