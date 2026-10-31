'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Crown, Layers, Loader2, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PENALTY, type HandResult, type Meld101, type Okey101View } from '@/lib/games/okey101'
import { MockTile } from './okey-rack'
import type { Okey as OkeyValue } from './okey-engine'

const HOW_LABEL: Record<string, string> = {
  normal: 'Seriden bitirdi',
  okey: 'Okey atarak bitirdi',
  elden: 'Elden bitirdi',
  cift: 'Çiftten bitirdi',
  'cift-okey': 'Okeyle çiftten bitirdi',
  deste: 'Ortada taş kalmadı',
}

/** End-of-hand table state, only available while the hand has not been re-dealt yet (the last hand). */
export type HandDetail = { opened: Okey101View['opened']; penalties: number[] }

const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0')

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
  handsTotal,
  detail,
  face,
  melds,
  okey,
  onClose,
  onScores,
  onReplay,
}: {
  melds: Meld101[] | null
  okey: OkeyValue
  result: HandResult
  nameOf: (seat: number) => string
  mySeat: number
  totals: number[]
  final: boolean
  handsTotal: number
  detail: HandDetail | null
  face: (seat: number) => ReactNode
  onClose: () => void
  onScores: () => void
  onReplay?: () => Promise<void>
}) {
  const [mounted, setMounted] = useState(false)
  const [replaying, setReplaying] = useState(false)
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
  const singleHand = handsTotal <= 1
  const order = totals.map((_, i) => i).sort((a, b) => totals[a] - totals[b])
  const rankOf = (seat: number) => 1 + totals.filter((t) => t < totals[seat]).length
  const leader = order[0]
  const title = final
    ? leader === mySeat
      ? 'Oyunu sen kazandın!'
      : `${nameOf(leader)} kazandı`
    : f == null
      ? 'Deste bitti, el kapandı'
      : mine
        ? 'Tebrikler, eli sen bitirdin!'
        : `${nameOf(f)} eli bitirdi`

  const winnerMelds = f == null ? [] : (melds ?? []).filter((m) => m.owner === f)
  const multTxt = mult > 1 ? ` ×${mult}` : ''
  const breakdown = (seat: number) => {
    const score = result.scores[seat]
    if (seat === f) {
      const pen = detail?.penalties[seat] ?? 0
      return `Bitirdi −${PENALTY}${multTxt}${pen ? ` · Ceza +${pen}` : ''}`
    }
    if (!detail) return null
    const pen = detail.penalties[seat] ?? 0
    const parts = [] as string[]
    const open = detail.opened[seat]
    if (!open) parts.push(`Açmadı 202${multTxt}`)
    else parts.push(`Elde kalan ${score - pen}${open === 'cift' ? ' (çift, 2 kat)' : ''}`)
    if (pen) parts.push(`Geri verme cezası +${pen}`)
    return parts.join(' · ')
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="o101-res-title"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-[rgb(8_8_10/0.7)] p-3 backdrop-blur-md phone-ls:p-2"
    >
      <div className="okw-card relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl phone-ls:max-h-[calc(100dvh-1rem)] phone-ls:max-w-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="absolute right-2.5 top-2.5 z-20 grid size-9 place-items-center rounded-full bg-[rgb(255_255_255/0.1)] text-[var(--okt-porcelain)] ring-1 ring-inset ring-[rgb(255_255_255/0.15)] hover:bg-[rgb(255_255_255/0.18)] phone-ls:size-8"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 pt-6 phone-ls:gap-2 phone-ls:px-4 phone-ls:pb-2 phone-ls:pt-3">
          <div className="flex items-center gap-3 pr-10 phone-ls:flex-wrap phone-ls:gap-x-3 phone-ls:gap-y-1">
            <span className={cn('okw-medal relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full phone-ls:size-9', !(final ? leader === mySeat : mine) && 'muted')}>
              {f == null && !final ? <Layers className="size-6 phone-ls:size-4" aria-hidden="true" /> : final ? <Crown className="size-6 phone-ls:size-4" aria-hidden="true" /> : face(f!)}
            </span>
            <div className="flex min-w-0 flex-col gap-1 phone-ls:gap-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--okt-brass)]">
                {final ? 'Oyun sonucu' : `${result.hand}. el bitti`}
              </span>
              <h2 id="o101-res-title" className="text-balance text-xl font-bold text-[var(--okt-porcelain)] phone-ls:text-base">
                {title}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 phone-ls:ml-auto">
              <span className="rounded-full bg-[rgb(255_255_255/0.06)] px-3 py-1 text-xs font-semibold text-[var(--okt-mist)] ring-1 ring-inset ring-[rgb(255_255_255/0.1)]">
                {f == null ? HOW_LABEL.deste : `${nameOf(f)}: ${HOW_LABEL[how]}`}
              </span>
              {mult > 1 && <span className="rounded-full bg-[var(--okt-brass)] px-3 py-1 text-xs font-bold text-[var(--okt-ink)]">Cezalar {mult} kat</span>}
            </div>
          </div>

          {winnerMelds.length > 0 && (
            <section aria-label={`${nameOf(f!)} açtığı perler`} className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--okt-mist)]">
                {mine ? 'Bitirdiğin el' : `${nameOf(f!)} bitirdiği el`}
              </span>
              <ul className="okw-rack flex flex-wrap justify-center gap-x-3 gap-y-2 rounded-xl p-2 sm:p-3">
                {winnerMelds.map((m) => (
                  <li key={m.id} className="flex gap-0.5">
                    {m.tiles.map((t) => (
                      <span key={t.id} className="okt-box h-10 w-7 phone-ls:h-8 phone-ls:w-6 sm:h-12 sm:w-8">
                        <MockTile tile={t} okey={okey} />
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ol className="flex flex-col text-sm tabular-nums text-[var(--okt-porcelain)]" aria-label="Sıralama">
            <li className="flex items-center gap-3 px-1 pb-1 text-xs font-semibold text-[var(--okt-mist)]">
              <span className="w-5 text-center">#</span>
              <span className="flex-1">Oyuncu</span>
              {!singleHand && <span className="w-12 text-right">Bu el</span>}
              <span className="w-14 text-right">{singleHand ? 'Puan' : 'Toplam'}</span>
            </li>
            {order.map((i) => {
              const r = rankOf(i)
              const info = breakdown(i)
              return (
                <li
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-1 py-1.5 phone-ls:py-1',
                    r === 1 && 'bg-[rgb(217_164_65/0.12)]',
                    i === mySeat && 'ring-1 ring-inset ring-[rgb(217_164_65/0.45)]',
                  )}
                >
                  <span className={cn('w-5 text-center text-xs font-bold', r === 1 ? 'text-[var(--okt-brass)]' : 'text-[var(--okt-mist)]')}>{r}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[rgb(255_255_255/0.08)] text-[10px] font-bold phone-ls:size-7" aria-hidden="true">
                      {face(i)}
                    </span>
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className={cn('truncate font-semibold', i === mySeat && 'text-[var(--okt-brass)]')}>
                        {nameOf(i)}
                        {r === 1 && final && <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-[var(--okt-brass)]">Kazandı</span>}
                      </span>
                      {info && <span className="truncate text-xs text-[var(--okt-mist)]">{info}</span>}
                    </span>
                  </span>
                  {!singleHand && <span className="w-12 text-right text-[var(--okt-mist)]">{signed(result.scores[i])}</span>}
                  <span className={cn('w-14 text-right text-base font-bold phone-ls:text-sm', r === 1 ? 'text-[var(--okt-brass)]' : 'text-[var(--okt-porcelain)]')}>
                    {singleHand ? signed(totals[i]) : totals[i]}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="text-xs leading-relaxed text-[var(--okt-mist)]">
            {final ? 'En az puanı toplayan kazanır.' : 'Az puan önde. Sonraki el birkaç saniye içinde başlar.'}
          </p>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-[rgb(255_255_255/0.06)] px-5 py-3 phone-ls:px-4 phone-ls:py-2">
          <button
            type="button"
            onClick={onScores}
            className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--okt-porcelain)] ring-1 ring-inset ring-[rgb(255_255_255/0.15)] hover:bg-[rgb(255_255_255/0.06)] phone-ls:py-2"
          >
            Puan tablosu
          </button>
          {final && onReplay ? (
            <button
              type="button"
              disabled={replaying}
              onClick={async () => {
                setReplaying(true)
                try {
                  await onReplay()
                } finally {
                  setReplaying(false)
                }
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--okt-brass)] px-4 py-2.5 text-sm font-bold text-[var(--okt-ink)] hover:brightness-110 disabled:opacity-60 phone-ls:py-2"
            >
              {replaying ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
              Tekrar oyna
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full bg-[var(--okt-brass)] px-4 py-2.5 text-sm font-bold text-[var(--okt-ink)] hover:brightness-110 phone-ls:py-2"
            >
              {final ? 'Masaya dön' : 'Sonraki el'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
