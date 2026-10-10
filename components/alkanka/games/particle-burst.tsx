import type { CSSProperties } from 'react'

const COLORS = ['var(--primary)', 'var(--accent)', 'var(--gold)']

export function ParticleBurst({ count = 18, distance = 90 }: { count?: number; distance?: number }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (360 / count) * i
        const dist = distance * (0.7 + ((i * 37) % 10) / 20)
        return (
          <span
            key={i}
            className="absolute top-1/2 left-1/2 size-2 rounded-full animate-burst"
            style={
              {
                '--angle': `${angle}deg`,
                '--dist': `-${dist}px`,
                background: COLORS[i % COLORS.length],
                boxShadow: `0 0 10px ${COLORS[i % COLORS.length]}`,
                animationDelay: `${(i % 4) * 30}ms`,
              } as CSSProperties
            }
          />
        )
      })}
    </span>
  )
}
