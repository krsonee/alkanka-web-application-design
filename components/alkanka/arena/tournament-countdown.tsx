'use client'

import { useEffect, useState } from 'react'

/**
 * Whole seconds left until `until`, counted every `everyMs`. Null without a deadline and before the
 * first tick, so what the server rendered and what the browser first draws are the same.
 */
export function useSecondsLeft(until: string | null | undefined, everyMs = 1000) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    if (!until) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [until, everyMs])
  if (!until || now === null) return null
  return Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000))
}

export const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** How far away a moment is, in the two largest units that matter: "3 gün 4 sa", "2 sa 10 dk", "8 dk". */
export function spanText(seconds: number) {
  const minutes = Math.max(1, Math.floor(seconds / 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days >= 7) return `${days} gün`
  if (days >= 1) return hours % 24 ? `${days} gün ${hours % 24} sa` : `${days} gün`
  if (hours >= 1) return minutes % 60 ? `${hours} sa ${minutes % 60} dk` : `${hours} sa`
  return `${minutes} dk`
}

/** `role="timer"` keeps the ticking digits out of the live region around them. */
export function Countdown({ seconds, label, className }: { seconds: number; label: string; className?: string }) {
  return (
    <span role="timer" aria-label={label} className={className ?? 'font-mono font-bold tabular-nums text-primary'}>
      {clockText(seconds)}
    </span>
  )
}
