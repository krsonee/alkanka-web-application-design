'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Crown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MockTile } from './okey-rack'
import type { Okey as OkeyValue, Tile } from './okey-engine'

/**
 * Hand-finish overlay shown to everyone at the table: who closed the hand, how, and the full winning rack,
 * so every player can verify the finish like at a real table. Portaled to <body> so a scaled landscape
 * table can't clip it, and capped to the screen height so the close button is always reachable.
 */
export function OkeyWinOverlay({
  winner,
  mine,
  detail,
  bonus,
  tiles,
  okey,
  actionLabel = 'Devam',
  onClose,
  autoCloseMs,
}: {
  winner: string
  mine: boolean
  detail: string
  /** Payout badge such as "2 kat"; omitted for a plain finish. */
  bonus?: string
  tiles: Tile[]
  okey: OkeyValue
  actionLabel?: string
  onClose: () => void
  autoCloseMs?: number
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!autoCloseMs) return
    const id = setTimeout(onClose, autoCloseMs)
    return () => clearTimeout(id)
  }, [autoCloseMs, onClose])

  if (!mounted) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="okey-win-title"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-[rgb(8_8_10/0.7)] p-3 backdrop-blur-md phone-ls:p-2"
    >
      <div className="okw-card relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl phone-ls:max-h-[calc(100dvh-1rem)] phone-ls:max-w-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="absolute right-2.5 top-2.5 z-10 grid size-9 place-items-center rounded-full bg-[rgb(255_255_255/0.06)] text-[var(--okt-porcelain)]/80 hover:bg-[rgb(255_255_255/0.12)] hover:text-[var(--okt-porcelain)]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-5 pb-4 pt-6 text-center phone-ls:gap-2.5 phone-ls:pt-3 sm:px-7 sm:pt-7">
          <div className="flex flex-col items-center gap-2 phone-ls:flex-row phone-ls:gap-3">
            <span className={cn('okw-medal grid size-12 shrink-0 place-items-center rounded-full phone-ls:size-9', !mine && 'muted')}>
              <Crown className="size-6 phone-ls:size-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1 phone-ls:items-start phone-ls:text-left">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okt-brass)]">
                {mine ? 'El senin' : 'El bitti'}
              </span>
              <h2 id="okey-win-title" className="text-balance text-xl font-bold text-[var(--okt-porcelain)] phone-ls:text-lg sm:text-2xl">
                {mine ? 'Tebrikler, eli sen bitirdin!' : `${winner} elini açtı`}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-[rgb(255_255_255/0.06)] px-3 py-1 text-xs font-semibold text-[var(--okt-mist)] ring-1 ring-inset ring-[rgb(255_255_255/0.1)]">
              {detail}
            </span>
            {bonus && (
              <span className="rounded-full bg-[var(--okt-brass)] px-3 py-1 text-xs font-bold text-[var(--okt-ink)]">{bonus}</span>
            )}
          </div>

          <ul aria-label="Biten el" className="okw-rack flex flex-wrap justify-center gap-1 rounded-xl p-2 sm:gap-1.5 sm:p-3">
            {tiles.map((t) => (
              <li key={t.id} className="okt-box h-12 w-8 phone-ls:h-10 phone-ls:w-7 sm:h-14 sm:w-9">
                <MockTile tile={t} okey={okey} />
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 justify-center border-t border-[rgb(255_255_255/0.06)] px-5 py-3 phone-ls:py-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full max-w-xs rounded-full bg-[var(--okt-brass)] px-6 py-2.5 text-sm font-bold text-[var(--okt-ink)] hover:brightness-110 phone-ls:py-2"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
