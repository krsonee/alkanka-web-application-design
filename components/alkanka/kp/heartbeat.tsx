'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSWRConfig } from 'swr'
import { Timer, X } from 'lucide-react'
import { usePoints } from '@/components/alkanka/points-context'
import { nextReward, type OnlineGrant, type OnlineStatus } from '@/lib/online-rewards-shared'
import { LevelEmblem } from './emblem'
import { RewardChips } from './reward-chips'

type Ping = { ok: boolean; kp: number; level: number; levelName: string; badge: string; online: OnlineStatus | null }

const INTERVAL_MS = 60_000

/** Credits active minutes, pays uninterrupted-online hour rewards and celebrates level-ups. */
export function KpHeartbeat() {
  const { member, refresh } = usePoints()
  const { mutate } = useSWRConfig()
  const lastLevel = useRef<number | null>(null)
  const [levelUp, setLevelUp] = useState<Ping | null>(null)
  const [grant, setGrant] = useState<{ tier: OnlineGrant; status: OnlineStatus } | null>(null)

  useEffect(() => {
    if (!member) return
    lastLevel.current = null
    let cancelled = false
    async function ping() {
      if (document.visibilityState !== 'visible') return
      try {
        const r = await fetch('/api/kp/ping', { method: 'POST', cache: 'no-store' })
        if (!r.ok || cancelled) return
        const data = (await r.json()) as Ping
        if (lastLevel.current !== null && data.level > lastLevel.current) setLevelUp(data)
        lastLevel.current = data.level
        if (data.online) {
          mutate('/api/kp/online', data.online, { revalidate: false })
          const last = data.online.granted.at(-1)
          if (last) {
            setGrant({ tier: last, status: data.online })
            refresh()
            mutate('/api/kp/feed')
          }
        }
      } catch {
        // Offline or navigating away; the next tick retries.
      }
    }
    ping()
    const id = window.setInterval(ping, INTERVAL_MS)
    const onVisible = () => document.visibilityState === 'visible' && ping()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [member, mutate, refresh])

  useEffect(() => {
    if (!grant) return
    const id = window.setTimeout(() => setGrant(null), 9000)
    return () => window.clearTimeout(id)
  }, [grant])

  if (grant) {
    const upcoming = nextReward({ enabled: true, graceMinutes: grant.status.graceMinutes, tiers: grant.status.tiers, extra: grant.status.extra }, grant.status.minutes)
    return (
      <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm animate-pop flex-col gap-3 overflow-hidden rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl lg:bottom-6">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="font-display text-lg font-bold leading-none tabular-nums">{grant.tier.hour}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider">saat</span>
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Kesintisiz online ödülü</span>
            <span className="font-display text-base font-bold leading-tight text-foreground">{grant.tier.label}</span>
            <RewardChips coin={grant.tier.coin} kp={grant.tier.kp} />
          </div>
          <button onClick={() => setGrant(null)} aria-label="Kapat" className="self-start rounded-md p-1 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        {upcoming && (
          <Link href="/gorevler#online-odul" onClick={() => setGrant(null)} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            <Timer className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">
              Sıradaki: <span className="font-semibold text-foreground">{upcoming.tier.hour}. saat</span>, kopmadan devam et
            </span>
            <RewardChips coin={upcoming.tier.coin} kp={upcoming.tier.kp} size="xs" className="shrink-0 flex-nowrap" />
          </Link>
        )}
      </div>
    )
  }

  if (!levelUp) return null
  return (
    <div role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm animate-pop items-center gap-4 rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl lg:bottom-6">
      <LevelEmblem level={levelUp.level} size="md" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Seviye atladın</span>
        <span className="font-display text-lg font-bold text-foreground">{levelUp.levelName}</span>
        <Link href="/rozetler" onClick={() => setLevelUp(null)} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          Yeni rozet: {levelUp.badge}
        </Link>
      </div>
      <button onClick={() => setLevelUp(null)} aria-label="Kapat" className="rounded-md p-1 text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  )
}
