'use client'

import { useEffect } from 'react'
import { Trophy, X } from 'lucide-react'
import { MockTile } from './okey-rack'
import type { Okey as OkeyValue, Tile } from './okey-engine'

/**
 * Hand-finish overlay shown to everyone at the table: who closed the hand, how, and the full winning rack,
 * so every player can verify the finish like at a real table.
 */
export function OkeyWinOverlay({
  winner,
  mine,
  detail,
  tiles,
  okey,
  actionLabel = 'Devam',
  onClose,
  autoCloseMs,
}: {
  winner: string
  mine: boolean
  detail: string
  tiles: Tile[]
  okey: OkeyValue
  actionLabel?: string
  onClose: () => void
  autoCloseMs?: number
}) {
  useEffect(() => {
    if (!autoCloseMs) return
    const id = setTimeout(onClose, autoCloseMs)
    return () => clearTimeout(id)
  }, [autoCloseMs, onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="okey-win-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgb(4_14_13/0.72)] p-4 backdrop-blur-sm"
    >
      <div className="relative flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-[rgb(217_164_65/0.5)] bg-[#0e4c47] p-5 text-center text-[var(--okt-porcelain)] shadow-2xl sm:p-7">
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-[var(--okt-porcelain)]/70 hover:bg-[rgb(255_255_255/0.08)] hover:text-[var(--okt-porcelain)]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <span className="grid size-12 place-items-center rounded-full bg-[var(--okt-brass)] text-[var(--okt-ink)]">
          <Trophy className="size-6" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="okey-win-title" className="text-balance text-xl font-bold sm:text-2xl">
            {mine ? 'Tebrikler, eli sen bitirdin!' : `Tebrikler ${winner}!`}
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-[var(--okt-mist)]">
            {mine ? detail : `${winner} eli bitirdi · ${detail}`}
          </p>
        </div>
        <ul aria-label="Biten el" className="flex flex-wrap justify-center gap-1 rounded-xl bg-[#3a2416] p-2 sm:gap-1.5 sm:p-3">
          {tiles.map((t) => (
            <li key={t.id} className="okt-box h-12 w-8 sm:h-14 sm:w-9">
              <MockTile tile={t} okey={okey} />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-[var(--okt-brass)] px-6 py-2 text-sm font-bold text-[var(--okt-ink)] hover:brightness-110"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
