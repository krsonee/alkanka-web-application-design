'use client'

import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import type { ActiveBoost } from '@/lib/boosts-shared'

const pad = (n: number) => String(n).padStart(2, '0')

function left(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const hms = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
  return d > 0 ? `${d}g ${hms}` : hms
}

/** Live campaign strip shown above every page while at least one boost is running. */
export function BoostStrip({ boosts }: { boosts: ActiveBoost[] }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const live = now === null ? boosts : boosts.filter((b) => Date.parse(b.endsAt) > now)
  if (!live.length) return null

  return (
    <section aria-label="Aktif kampanyalar" className="panel-gold flex flex-wrap items-stretch gap-2 rounded-2xl p-2">
      {live.map((b) => (
        <div key={b.id} className="flex min-w-0 flex-1 basis-64 items-center gap-3 rounded-xl bg-background/60 px-3 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Flame className="size-4" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-display text-sm font-bold text-foreground">{b.label}</span>
            <span className="truncate text-xs leading-relaxed text-muted-foreground">{b.detail}</span>
          </span>
          {now !== null && (
            <span className="font-mono text-sm font-bold tabular-nums text-primary" aria-label={`${b.label} bitimine kalan süre`}>
              {left(Date.parse(b.endsAt) - now)}
            </span>
          )}
        </div>
      ))}
    </section>
  )
}
