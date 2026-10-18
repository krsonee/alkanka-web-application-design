'use client'

import { useState } from 'react'
import { Check, Circle, X } from 'lucide-react'
import type { CemberMe, CemberStatus } from '@/lib/cember-shared'
import { cn } from '@/lib/utils'

const SHOW_BEFORE_MS = 15 * 60_000

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Small floating countdown shown in the last 15 minutes before a round, with the user's condition progress. */
export function CemberPill({ status, me, now }: { status: CemberStatus; me: CemberMe | null; now: number }) {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState<string | null>(null)
  if (!status.nextSlot) return null
  const left = Date.parse(status.nextSlot) - now
  if (left <= 0 || left > SHOW_BEFORE_MS || hidden === status.nextSlot) return null
  const eligible = !!me?.eligible

  return (
    <div className="fixed bottom-20 left-3 z-[80] flex max-w-[calc(100vw-1.5rem)] flex-col items-start gap-2 lg:bottom-4 lg:left-[17rem]">
      {open && (
        <div className="w-72 rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-display font-bold text-gold">{status.title}</p>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Kapat">
              <X className="size-4" />
            </button>
          </div>
          {status.prizeText && <p className="mt-1 text-sm">Ödül: <span className="font-semibold text-gold">{status.prizeText}</span></p>}
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {(me?.progress.length ? me.progress : status.conditions.map((label) => ({ label, done: false, value: 0, target: 0 }))).map((c) => (
              <li key={c.label} className="flex items-start gap-2 leading-relaxed">
                {c.done ? <Check className="mt-0.5 size-4 shrink-0 text-live" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
                <span className={cn(c.done && 'text-muted-foreground line-through')}>
                  {c.label}
                  {!c.done && c.target > 1 ? ` (${c.value}/${c.target})` : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            {!me?.signedIn
              ? 'Katılmak için giriş yapıp şartları tamamla.'
              : eligible
                ? 'Çemberdesin! Saat gelince pencere kendiliğinden açılır.'
                : 'Şartları tamamlarsan otomatik olarak çembere eklenirsin.'}
          </p>
        </div>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex items-center gap-2 rounded-full border bg-card py-1.5 pl-1.5 pr-3 text-sm shadow-xl transition-colors',
            eligible ? 'border-live/60' : 'border-gold/50',
          )}
          aria-expanded={open}
        >
          <img src="/images/mascots/jako-duyuru.png" alt="" className="size-7 object-contain" />
          <span className="font-semibold">{status.title}</span>
          <span className="font-mono tabular-nums text-gold">{fmt(left)}</span>
          {eligible && <span className="rounded-full bg-live/15 px-2 text-xs font-semibold text-live">Katıldın</span>}
        </button>
        <button
          type="button"
          onClick={() => setHidden(status.nextSlot)}
          className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          aria-label="Geri sayımı gizle"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
