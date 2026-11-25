'use client'

import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react'

const REDUCED = '(prefers-reduced-motion: reduce)'

function watchReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** true when the visitor asked the system for less motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    watchReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  )
}

function watchHidden(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

/** true while the tab is in the background. */
export function usePageHidden(): boolean {
  return useSyncExternalStore(
    watchHidden,
    () => document.hidden,
    () => false,
  )
}

/** true while at least `ratio` of the element is in the viewport. */
export function useInView(ref: RefObject<Element | null>, ratio = 0.5): boolean {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio >= ratio - 0.001),
      { threshold: [0, ratio, 1] },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, ratio])
  return inView
}
