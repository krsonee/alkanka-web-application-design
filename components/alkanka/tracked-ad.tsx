'use client'

import { useEffect, useRef } from 'react'
import { trackPromo } from '@/lib/promo-client'

export function TrackedAd({ refId, href, className, children }: { refId: string; href?: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          trackPromo('ad', refId, 'view')
          io.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [refId])

  if (!href) {
    return (
      <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
        {children}
      </div>
    )
  }
  return (
    <a
      ref={ref as React.RefObject<HTMLAnchorElement>}
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => trackPromo('ad', refId, 'click')}
      className={className}
    >
      {children}
    </a>
  )
}
