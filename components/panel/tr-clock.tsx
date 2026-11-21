'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { TR_TZ } from '@/lib/tr-time'

const clock = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TR_TZ })

/**
 * The clock every date in the panel is shown and typed in. Staff working from another time zone
 * sees here that the panel does not follow their device.
 */
export function TrClock() {
  // Empty until the page is in the browser: the server's minute and the browser's may differ.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 20_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-xs text-muted-foreground" title="Paneldeki bütün tarih ve saatler Türkiye saatiyle gösterilir ve girilir.">
      <Clock className="size-3.5 shrink-0" aria-hidden="true" />
      <span>
        Türkiye saati (GMT+3): <time className="font-semibold tabular-nums text-foreground">{now ? clock.format(now) : '...'}</time>
      </span>
    </p>
  )
}
