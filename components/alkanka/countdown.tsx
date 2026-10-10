'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

function useRemaining(hoursLeft: number) {
  const [clock, setClock] = useState<{ start: number; now: number } | null>(null)
  useEffect(() => {
    const start = Date.now()
    setClock({ start, now: start })
    const t = setInterval(() => setClock({ start, now: Date.now() }), 1000)
    return () => clearInterval(t)
  }, [])
  const total = hoursLeft * 3600
  return clock ? Math.max(0, total - Math.floor((clock.now - clock.start) / 1000)) : total
}

export function Countdown({ hoursLeft, size = 'sm' }: { hoursLeft: number; size?: 'sm' | 'lg' }) {
  const total = useRemaining(hoursLeft)
  const parts = [
    { v: Math.floor(total / 86400), l: 'Gün' },
    { v: Math.floor((total % 86400) / 3600), l: 'Saat' },
    { v: Math.floor((total % 3600) / 60), l: 'Dk' },
    { v: Math.floor(total % 60), l: 'Sn' },
  ]
  return (
    <div className="grid grid-cols-4 gap-1.5" role="timer" aria-label="Kalan süre">
      {parts.map((p) => (
        <div
          key={p.l}
          className={cn('flex flex-col items-center rounded-md bg-background', size === 'lg' ? 'py-2.5' : 'py-1.5')}
        >
          <span
            className={cn(
              'font-display font-bold text-foreground tabular-nums',
              size === 'lg' ? 'text-2xl' : 'text-base',
            )}
          >
            {String(p.v).padStart(2, '0')}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.l}</span>
        </div>
      ))}
    </div>
  )
}
