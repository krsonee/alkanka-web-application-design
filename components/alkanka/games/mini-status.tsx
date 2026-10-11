'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Clock } from 'lucide-react'
import { getMiniStatus, type MiniGame, type MiniStatus } from '@/app/actions/wallet'
import { cn } from '@/lib/utils'

export function useMiniStatus() {
  const { data, mutate } = useSWR<MiniStatus>('mini-status', () => getMiniStatus(), { revalidateOnFocus: true })
  return { status: data, refresh: () => mutate() }
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

export function formatRemaining(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
}

/** Remaining ms until the game unlocks; 0 when playable. Re-fetches status once the timer hits zero. */
export function useMiniLock(game: MiniGame) {
  const { status, refresh } = useMiniStatus()
  const nextAt = status?.[game] ?? null
  const now = useNow(nextAt !== null)
  const remaining = nextAt ? Math.max(0, nextAt - now) : 0
  const expired = nextAt !== null && remaining === 0
  useEffect(() => {
    if (expired) refresh()
  }, [expired, refresh])
  return { remaining, locked: remaining > 0, loaded: status !== undefined, refresh }
}

export function MiniCountdown({ game, readyLabel, className }: { game: MiniGame; readyLabel: string; className?: string }) {
  const { remaining, locked } = useMiniLock(game)
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wider tabular-nums',
        locked ? 'bg-background/90 text-muted-foreground' : 'bg-primary text-primary-foreground',
        className,
      )}
    >
      {locked && <Clock className="size-3.5" aria-hidden="true" />}
      {locked ? <span><span className="sr-only">Yeni hak: </span>{formatRemaining(remaining)}</span> : readyLabel}
    </span>
  )
}
