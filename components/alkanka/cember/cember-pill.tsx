'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Check, Circle, Gift, X } from 'lucide-react'
import { INTRO_SECONDS, type CemberMe, type CemberStatus } from '@/lib/cember-shared'
import { cemberFetch, serverNow } from './cember-clock'
import { cn } from '@/lib/utils'

const COUNTDOWN_MS = 60 * 60_000
const LIVE_MS = (INTRO_SECONDS + 75) * 1000

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

function OrbitIcon({ live }: { live: boolean }) {
  return (
    <span className="relative flex size-[18px] shrink-0 items-center justify-center" aria-hidden="true">
      <span className={cn('absolute inset-0 rounded-full border-2', live ? 'border-live' : 'border-gold')} />
      <span className={cn('absolute inset-0', live ? 'animate-[spin_0.9s_linear_infinite]' : 'animate-[spin_2.4s_linear_infinite]')}>
        <span className={cn('absolute left-1/2 top-[3px] size-[5px] -translate-x-1/2 rounded-full', live ? 'bg-live' : 'bg-gold')} />
      </span>
      <span className="size-[3px] rounded-full bg-foreground/70" />
    </span>
  )
}

/** Topbar entry for Jako Çemberi, styled like the radio button: animated orbit icon, time or countdown, conditions popover. */
export function CemberButton() {
  const { data: status } = useSWR<CemberStatus>('/api/cember', cemberFetch, { refreshInterval: 20_000, revalidateOnFocus: true })
  const { data: me } = useSWR<CemberMe>('/api/cember/me', cemberFetch, { refreshInterval: 180_000, revalidateOnFocus: false })
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => serverNow())
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!status?.enabled || !status.nextSlot) return null
  const left = Date.parse(status.nextSlot) - now
  const live = left <= 0 && left > -LIVE_MS
  const soon = left > 0 && left <= COUNTDOWN_MS
  const eligible = !!me?.eligible
  const label = live ? 'Canlı' : !soon ? clock(status.nextSlot) : left > 5 * 60_000 ? `${Math.ceil(left / 60_000)} dk` : fmt(left)
  const progress = me?.progress.length ? me.progress : status.conditions.map((l) => ({ label: l, done: false, value: 0, target: 0 }))

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${status.title}: ${live ? 'şu an canlı' : `${clock(status.nextSlot)} saatinde`}${eligible ? ', katıldın' : ''}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-foreground transition-colors sm:px-2.5',
          live ? 'border-live/70 bg-live/10' : open || soon ? 'border-gold/60 bg-gold/10' : 'border-border hover:border-gold/50',
        )}
      >
        <OrbitIcon live={live} />
        <span className={cn('hidden font-mono text-xs font-semibold tabular-nums md:inline', live ? 'uppercase text-live' : soon ? 'text-gold' : 'text-foreground')}>
          {label}
        </span>
        {eligible && <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-background bg-live" aria-hidden="true" />}
        {soon && !eligible && <span className="absolute -right-1 -top-1 size-2.5 animate-ping rounded-full bg-gold" aria-hidden="true" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={status.title}
          className="fixed inset-x-3 top-16 z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-background/60 sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-80"
        >
          <div className="flex items-center gap-3 border-b border-border bg-gold/[0.07] px-4 py-3">
            <img src="/images/mascots/jako-duyuru.png" alt="" className="size-10 shrink-0 object-contain" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-display text-sm font-bold text-foreground">{status.title}</span>
              <span className={cn('font-mono text-xs tabular-nums', live ? 'text-live' : 'text-gold')}>
                {live ? 'Şu an oynanıyor' : `${clock(status.nextSlot)} · ${soon ? `${fmt(left)} kaldı` : 'bugün'}`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Kapat"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-3 p-4">
            {status.prizeText && (
              <p className="flex items-center gap-2 text-sm">
                <Gift className="size-4 shrink-0 text-gold" aria-hidden="true" />
                <span>
                  Ödül: <span className="font-semibold text-gold">{status.prizeText}</span>
                </span>
              </p>
            )}
            {progress.length > 0 && (
              <ul className="flex flex-col gap-2 text-sm">
                {progress.map((c) => (
                  <li key={c.label} className="flex items-start gap-2 leading-relaxed">
                    {c.done ? <Check className="mt-0.5 size-4 shrink-0 text-live" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                    <span className={cn(c.done && 'text-muted-foreground line-through')}>
                      {c.label}
                      {!c.done && c.target > 1 ? ` (${c.value}/${c.target})` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className={cn('rounded-lg px-3 py-2 text-xs leading-relaxed', eligible ? 'bg-live/10 text-live' : 'bg-secondary text-muted-foreground')}>
              {!me?.signedIn
                ? 'Katılmak için giriş yapıp şartları tamamla.'
                : eligible
                  ? 'Çemberdesin! Saat gelince pencere kendiliğinden açılır.'
                  : 'Şartları tamamlarsan otomatik olarak çembere eklenirsin.'}
            </p>
            {status.upcoming.length > 1 && (
              <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Sıradaki turlar</span>
                <ul className="flex flex-col gap-1 text-xs">
                  {status.upcoming.slice(1, 5).map((u) => (
                    <li key={u.slot} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        <span className="font-mono tabular-nums text-gold">{clock(u.slot)}</span> {u.title}
                      </span>
                      <span className="shrink-0 text-muted-foreground">{u.prizeText}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {status.last && (
              <p className="text-xs text-muted-foreground">
                Son kazanan: <span className="font-semibold text-foreground">{status.last.winnerName}</span> · {status.last.prizeText}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
