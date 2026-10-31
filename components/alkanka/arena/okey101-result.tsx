'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Crown, Layers, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HandResult } from '@/lib/games/okey101'

const HOW_LABEL: Record<string, string> = {
  normal: 'Seriden bitirdi',
  okey: 'Okey atarak bitirdi',
  elden: 'Elden bitirdi',
  cift: 'Çiftten bitirdi',
  'cift-okey': 'Okeyle çiftten bitirdi',
  deste: 'Ortada taş kalmadı',
}

/**
 * 101 hand / game result, styled like the Okey finish overlay. Portaled to <body> so the scaled
 * fullscreen table can't clip it and the close button stays reachable on a sideways phone.
 */
export function Okey101Result({
  result,
  nameOf,
  mySeat,
  totals,
  final,
  face,
  onClose,
  onScores,
}: {
  result: HandResult
  nameOf: (seat: number) => string
  mySeat: number
  totals: number[]
  final: boolean
  face: (seat: number) => ReactNode
  onClose: () => void
  onScores: () => void
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (final) return
    const id = setTimeout(onClose, 10000)
    return () => clearTimeout(id)
  }, [final, onClose])
  if (!mounted) return null

  const f = result.finisher
  const mine = f != null && f === mySeat
  const how = result.how ?? (f == null ? 'deste' : 'normal')
  const mult = result.mult ?? (result.double ? 2 : 1)
  const leader = totals.indexOf(Math.min(...totals))
  const title = final
    ? leader === mySeat
      ? 'Oyunu sen kazandın!'
      : `Oyun bitti, ${nameOf(leader)} önde`
    : f == null
      ? 'Deste bitti, el kapandı'
      : mine
        ? 'Tebrikler, eli sen bitirdin!'
        : `${nameOf(f)} eli bitirdi`

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="o101-res-title"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-[rgb(8_8_10/0.7)] p-3 backdrop-blur-md phone-ls:p-2"
    >
      <div className="okw-card relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl phone-ls:max-h-[calc(100dvh-1rem)] phone-ls:max-w-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="absolute right-2.5 top-2.5 z-10 grid size-9 place-items-center rounded-full bg-[rgb(255_255_255/0.06)] text-[var(--okt-porcelain)]/80 hover:bg-[rgb(255_255_255/0.12)] hover:text-[var(--okt-porcelain)]"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 pt-6 phone-ls:gap-2.5 phone-ls:pt-3">
          <div className="flex items-center gap-3 pr-8">
            <span className={cn('okw-medal grid size-12 shrink-0 place-items-center overflow-hidden rounded-full phone-ls:size-9', !mine && 'muted')}>
              {f == null ? <Layers className="size-6 phone-ls:size-4" aria-hidden="true" /> : final ? <Crown className="size-6 phone-ls:size-4" aria-hidden="true" /> : face(f)}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okt-brass)]">
                {final ? 'Oyun sonucu' : `${result.hand}. el bitti`}
              </span>
              <h2 id="o101-res-title" className="text-balance text-xl font-bold text-[var(--okt-porcelain)] phone-ls:text-lg">
                {title}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[rgb(255_255_255/0.06)] px-3 py-1 text-xs font-semibold text-[var(--okt-mist)] ring-1 ring-inset ring-[rgb(255_255_255/0.1)]">
              {f == null ? HOW_LABEL.deste : `${nameOf(f)}: ${HOW_LABEL[how]}`}
            </span>
            {mult > 1 && <span className="rounded-full bg-[var(--okt-brass)] px-3 py-1 text-xs font-bold text-[var(--okt-ink)]">Cezalar {mult} kat</span>}
          </div>

          <table className="w-full text-sm tabular-nums text-[var(--okt-porcelain)]">
            <thead>
              <tr className="text-left text-xs text-[var(--okt-mist)]">
                <th className="py-1 font-semibold">Oyuncu</th>
                <th className="py-1 text-right font-semibold">Bu el</th>
                <th className="py-1 text-right font-semibold">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {result.scores.map((sc, i) => (
                <tr key={i} className={cn('border-t border-[rgb(255_255_255/0.07)]', i === mySeat && 'font-bold text-[var(--okt-brass)]')}>
                  <td className="py-1.5">
                    {nameOf(i)}
                    {i === f && <span className="ml-2 text-xs font-semibold text-[var(--okt-mist)]">bitirdi</span>}
                  </td>
                  <td className="py-1.5 text-right">{sc > 0 ? `+${sc}` : sc}</td>
                  <td className={cn('py-1.5 text-right', final && i === leader && 'text-[var(--okt-brass)]')}>{totals[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs leading-relaxed text-[var(--okt-mist)]">Az puan önde. Yeni el birkaç saniye içinde başlar.</p>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-[rgb(255_255_255/0.06)] px-5 py-3 phone-ls:py-2">
          <button
            type="button"
            onClick={onScores}
            className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--okt-porcelain)] ring-1 ring-inset ring-[rgb(255_255_255/0.15)] hover:bg-[rgb(255_255_255/0.06)] phone-ls:py-2"
          >
            Puan tablosu
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-[var(--okt-brass)] px-4 py-2.5 text-sm font-bold text-[var(--okt-ink)] hover:brightness-110 phone-ls:py-2"
          >
            {final ? 'Sonucu gör' : 'Devam'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
