'use client'

import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { SPRINT_MULTIPLIER, sprintState } from '@/lib/sprint'

const pad = (n: number) => String(n).padStart(2, '0')

function left(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/** Shows the weekly closing sprint while it runs, and a countdown to it during the rest of the week. */
export function SprintBanner() {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (now === null) return null
  const s = sprintState(now)
  const mult = String(SPRINT_MULTIPLIER).replace('.', ',')

  if (s.active) {
    return (
      <div role="status" className="panel-gold flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Zap className="size-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-base font-bold text-foreground">Kapanış sprinti başladı: KP x{mult}</span>
          <span className="text-sm leading-relaxed text-muted-foreground">Haftanın son 24 saati. Bugün kazandığın her KP haftalık ligde x{mult} sayılır.</span>
        </span>
        <span className="font-mono text-lg font-bold tabular-nums text-primary" aria-label="Sprintin bitmesine kalan süre">{left(s.endsAt - now)}</span>
      </div>
    )
  }

  return (
    <p className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground">
      <Zap className="size-4 text-primary" aria-hidden />
      <span>
        Pazar günü kapanış sprinti: son 24 saatte KP <strong className="text-foreground">x{mult}</strong> sayılır. Başlamasına
      </span>
      <span className="font-mono font-semibold tabular-nums text-foreground">{left(s.startsAt - now)}</span>
    </p>
  )
}
