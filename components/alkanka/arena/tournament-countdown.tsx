'use client'

import { useEffect, useState } from 'react'

/**
 * Whole seconds left until `until`, counted once a second. Null without a deadline and before the
 * first tick, so what the server rendered and what the browser first draws are the same.
 */
export function useSecondsLeft(until: string | null | undefined) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    if (!until) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [until])
  if (!until || now === null) return null
  return Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000))
}

export const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** `role="timer"` keeps the ticking digits out of the live region around them. */
export function Countdown({ seconds, label, className }: { seconds: number; label: string; className?: string }) {
  return (
    <span role="timer" aria-label={label} className={className ?? 'font-mono font-bold tabular-nums text-primary'}>
      {clockText(seconds)}
    </span>
  )
}
