'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A table laid out once at a fixed design size and scaled as a whole to the space it gets, so phones,
 * tablets and desktops all see the exact same composition instead of per-breakpoint rearrangements.
 * The outer box keeps the design aspect ratio in CSS, so LandscapeFit can measure it synchronously.
 */
export function FixedStage({
  width,
  height,
  className,
  children,
}: {
  width: number
  height: number
  className?: string
  children: ReactNode
}) {
  const outer = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      if (w) setScale(w / width)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])

  return (
    <div ref={outer} className={cn('relative mx-auto w-full', className)} style={{ aspectRatio: `${width} / ${height}` }}>
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width, height, transform: `scale(${scale || 1})`, visibility: scale ? 'visible' : 'hidden' }}
      >
        {children}
      </div>
    </div>
  )
}
