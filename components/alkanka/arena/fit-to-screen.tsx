'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Scales its content down (never up) so the whole board fits in the visible viewport. */
export function FitToScreen({ children, offset = 160 }: { children: ReactNode; offset?: number }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const measure = () => {
      const naturalH = i.scrollHeight
      const naturalW = i.scrollWidth
      const availH = Math.max(320, window.innerHeight - offset)
      const availW = o.clientWidth
      const next = Math.min(1, availH / naturalH, availW / naturalW)
      setScale(next)
      setHeight(naturalH * next)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(i)
    ro.observe(o)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [offset])

  return (
    <div ref={outer} className="w-full overflow-hidden" style={{ height }}>
      <div ref={inner} className="origin-top" style={{ transform: `scale(${scale})`, width: `${100 / scale}%`, marginLeft: `${(100 - 100 / scale) / 2}%` }}>
        {children}
      </div>
    </div>
  )
}
