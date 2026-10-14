'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Horizontal snap rail that auto-advances one card at a time on mobile; pauses while the user touches or hovers it. */
export function AutoRail({ children, className, interval = 3200, label }: { children: ReactNode; className?: string; interval?: number; label?: string }) {
  const ref = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const mobile = window.matchMedia('(max-width: 639px)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let paused = false
    let resume: ReturnType<typeof setTimeout> | undefined
    const pause = () => {
      paused = true
      clearTimeout(resume)
    }
    const release = () => {
      clearTimeout(resume)
      resume = setTimeout(() => (paused = false), 4000)
    }
    const tick = setInterval(() => {
      if (paused || !mobile.matches || reduced.matches || document.hidden) return
      const first = el.firstElementChild as HTMLElement | null
      if (!first) return
      const step = first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0')
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: 'smooth' })
    }, interval)
    el.addEventListener('pointerdown', pause)
    el.addEventListener('pointerup', release)
    el.addEventListener('pointercancel', release)
    el.addEventListener('mouseenter', pause)
    el.addEventListener('mouseleave', release)
    el.addEventListener('focusin', pause)
    el.addEventListener('focusout', release)
    return () => {
      clearInterval(tick)
      clearTimeout(resume)
      el.removeEventListener('pointerdown', pause)
      el.removeEventListener('pointerup', release)
      el.removeEventListener('pointercancel', release)
      el.removeEventListener('mouseenter', pause)
      el.removeEventListener('mouseleave', release)
      el.removeEventListener('focusin', pause)
      el.removeEventListener('focusout', release)
    }
  }, [interval])

  return (
    <ul ref={ref} aria-label={label} className={cn('flex snap-x snap-mandatory overflow-x-auto no-scrollbar', className)}>
      {children}
    </ul>
  )
}
