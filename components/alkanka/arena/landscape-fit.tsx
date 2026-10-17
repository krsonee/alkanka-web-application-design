'use client'

import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'

const PHONE_LANDSCAPE = '(pointer: coarse) and (orientation: landscape) and (max-height: 600px)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia(PHONE_LANDSCAPE)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

export function usePhoneLandscape() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_LANDSCAPE).matches,
    () => false,
  )
}

/**
 * Optional landscape mode for game tables: when a phone is turned sideways the table is scaled
 * down (never up) to fit the short viewport and scrolled into view. Portrait and desktop render
 * the children untouched, so their layouts never shift.
 */
export function LandscapeFit({ children }: { children: ReactNode }) {
  const landscape = usePhoneLandscape()
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    if (!landscape) {
      setScale(1)
      setHeight(undefined)
      return
    }
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const measure = () => {
      const naturalH = i.scrollHeight
      const naturalW = i.scrollWidth
      if (!naturalH || !naturalW) return
      const availH = Math.max(220, window.innerHeight - 12)
      const next = Math.min(1, availH / naturalH, o.clientWidth / naturalW)
      setScale(next)
      setHeight(naturalH * next)
    }
    measure()
    o.scrollIntoView({ block: 'start', behavior: 'smooth' })
    const ro = new ResizeObserver(measure)
    ro.observe(i)
    ro.observe(o)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [landscape])

  if (!landscape) return <>{children}</>

  return (
    <div ref={outer} className="w-full scroll-mt-1 overflow-hidden" style={{ height }}>
      <div
        ref={inner}
        className="origin-top"
        style={{ transform: `scale(${scale})`, width: `${100 / scale}%`, marginLeft: `${(100 - 100 / scale) / 2}%` }}
      >
        {children}
      </div>
    </div>
  )
}
