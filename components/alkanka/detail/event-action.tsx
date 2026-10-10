'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Coins, Minus, Plus, Ticket, Users } from 'lucide-react'
import type { EventItem } from '../data'
import { Countdown } from '../countdown'
import { formatAC } from '../points-context'
import { useEventEntry } from '../use-entries'

export function EventAction({ event }: { event: EventItem }) {
  const { detail, owned, remaining, joined, join, error, points } = useEventEntry(event)
  const [qty, setQty] = useState(1)
  const safeQty = Math.max(1, Math.min(qty, remaining || 1))
  const cost = event.entry * safeQty

  function submit() {
    if (join(detail.ticketed ? safeQty : 1)) setQty(1)
  }

  return (
    <div className="panel-gold flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kalan süre</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-live" aria-hidden="true" />
          Aktif
        </span>
      </div>
      <Countdown hoursLeft={event.hoursLeft} size="lg" />

      <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2.5 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="size-4" aria-hidden="true" />
          Katılımcı
        </span>
        <span className="font-semibold text-foreground tabular-nums">{formatAC(event.participants + (joined ? 1 : 0))}</span>
      </div>

      {detail.ticketed ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Biletlerin</span>
            <span className="font-semibold text-foreground tabular-nums">
              {owned} / {detail.maxPerUser}
            </span>
          </div>
          {remaining > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span id="qty-label" className="text-sm text-muted-foreground">
                Adet
              </span>
              <div role="group" aria-labelledby="qty-label" className="flex items-center rounded-lg border border-border bg-background">
                <button
                  type="button"
                  onClick={() => setQty(safeQty - 1)}
                  disabled={safeQty <= 1}
                  aria-label="Bir azalt"
                  className="flex size-9 items-center justify-center text-foreground disabled:text-muted-foreground"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <output aria-live="polite" className="w-10 text-center font-display font-bold text-foreground tabular-nums">
                  {safeQty}
                </output>
                <button
                  type="button"
                  onClick={() => setQty(safeQty + 1)}
                  disabled={safeQty >= remaining}
                  aria-label="Bir arttır"
                  className="flex size-9 items-center justify-center text-foreground disabled:text-muted-foreground"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={remaining === 0}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-primary/15 disabled:text-primary"
      >
        {remaining === 0 ? (
          <>
            <Check className="size-4" aria-hidden="true" />
            {detail.ticketed ? 'Bilet limitine ulaştın' : 'Katıldın'}
          </>
        ) : detail.ticketed ? (
          <>
            <Ticket className="size-4" aria-hidden="true" />
            {safeQty} bilet al · {formatAC(cost)} AC
          </>
        ) : event.entry === 0 ? (
          'Ücretsiz katıl'
        ) : (
          <>
            <Coins className="size-4" aria-hidden="true" />
            {formatAC(event.entry)} AC ile katıl
          </>
        )}
      </button>

      <p aria-live="polite" className="min-h-4 text-center text-xs">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : joined ? (
          <span className="text-live">
            {detail.ticketed ? `${owned} biletin çekilişe tanımlandı.` : 'Kaydın alındı. Başarılar kanka!'}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Bakiyen: <span className="font-semibold text-foreground">{formatAC(points)} AC</span>
          </span>
        )}
      </p>

      {joined && !detail.ticketed && (
        <Link
          href="/#oyunlar"
          className="flex h-10 items-center justify-center rounded-lg border border-primary/40 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
        >
          Oyuna git
        </Link>
      )}

      <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        Katılarak etkinlik kurallarını kabul etmiş olursun. AlkaCoin nakde çevrilemez. 18+
      </p>
    </div>
  )
}
