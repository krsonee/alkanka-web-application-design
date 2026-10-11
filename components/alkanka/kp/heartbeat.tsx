'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { usePoints } from '@/components/alkanka/points-context'
import { LevelEmblem } from './emblem'

type Ping = { ok: boolean; kp: number; level: number; levelName: string; badge: string }

const INTERVAL_MS = 60_000

/** Credits active minutes on the site and celebrates level-ups. */
export function KpHeartbeat() {
  const { member } = usePoints()
  const lastLevel = useRef<number | null>(null)
  const [levelUp, setLevelUp] = useState<Ping | null>(null)

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
      } catch {
        // Offline or navigating away; the next tick retries.
      }
    }
    ping()
    const id = window.setInterval(ping, INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [member])

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
