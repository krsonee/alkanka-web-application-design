'use client'

import { useState, type ReactNode } from 'react'
import { writeAddress } from '@/components/alkanka/use-address-choice'
import { cn } from '@/lib/utils'

export type TrustView = 'yorum' | 'sikayet' | 'cekim'

/**
 * The three lists of a sponsor's trust page. All of them arrive with the page, so a tab switches at once
 * instead of asking the server for the page again; the address keeps the choice for a copied link.
 */
export function TrustViews({
  initial,
  tabs,
  panels,
}: {
  initial: TrustView
  tabs: { id: TrustView; label: string }[]
  panels: Record<TrustView, ReactNode>
}) {
  const [view, setView] = useState<TrustView>(initial)
  const at = Math.max(
    0,
    tabs.findIndex((t) => t.id === view),
  )

  function choose(next: TrustView) {
    setView(next)
    writeAddress('tab', next === 'yorum' ? null : next)
  }

  return (
    <>
      <div role="tablist" aria-label="İçerik" className="relative grid w-full grid-cols-3 rounded-lg border border-border bg-card p-1 sm:w-fit">
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-md bg-primary shadow-[0_0_18px_-6px_var(--primary)] transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${at * 100}%)` }}
        />
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`guven-sekme-${id}`}
            aria-selected={view === id}
            aria-controls="guven-icerik"
            onClick={() => choose(id)}
            className={cn(
              'relative z-10 flex h-9 items-center justify-center rounded-md px-2 text-[11px] font-bold uppercase tracking-wide transition-colors duration-300 sm:px-4 sm:text-xs',
              view === id ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div key={view} id="guven-icerik" role="tabpanel" aria-labelledby={`guven-sekme-${view}`} className="animate-rise motion-reduce:animate-none">
        {panels[view]}
      </div>
    </>
  )
}
