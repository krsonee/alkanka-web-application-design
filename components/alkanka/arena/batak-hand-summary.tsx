"use client"

import { cn } from "@/lib/utils"
import { SUIT_SYMBOLS, teamOf, ZERO_BONUS, type BatakResult, type BatakView } from "@/lib/games/batak"
import { suitColor } from "./batak-card"

export function HandSummary({
  result,
  variant,
  seats,
  target,
  ikiKat,
  nameOf,
  teamLabel,
  onClose,
}: {
  result: BatakResult
  variant: BatakView['variant']
  seats: number
  target: number
  ikiKat: boolean
  nameOf: (seat: number) => string
  teamLabel: (seat: number) => string
  onClose: () => void
}) {
  const isTeam = variant === 'esli'
  const kozMaca = variant === 'koz-maca'
  const totals = result.totals ?? []
  const rows = (isTeam ? [0, 1] : Array.from({ length: seats }, (_, i) => i)).map((seat) => {
    const taken = isTeam ? result.taken.reduce((a, x, i) => a + (teamOf(i) === teamOf(seat) ? x : 0), 0) : result.taken[seat]
    const score = result.scores[seat]
    const isBidder = result.bidder != null && (isTeam ? teamOf(result.bidder) === teamOf(seat) : result.bidder === seat)
    let said = '—'
    let why = 'Aldığı el kadar'
    if (kozMaca) {
      const p = result.predictions?.[seat] ?? 0
      said = String(p)
      why = p === 0 ? (taken === 0 ? `Sıfır tuttu, +${ZERO_BONUS}` : `Sıfır bozuldu, −${ZERO_BONUS}`) : taken >= p ? 'Tahmin tuttu' : 'Tahmin tutmadı'
    } else if (isBidder) {
      said = String(result.bid)
      why = result.made ? (result.noTrump ? 'İhale tuttu · kozsuz 2 kat' : 'İhale tuttu') : ikiKat ? 'İhale battı · 2 kat ceza' : 'İhale battı'
    } else if (score < 0) {
      why = 'Hiç el alamadı, batma cezası'
    }
    return { seat, name: isTeam ? `${teamLabel(seat)} (${nameOf(seat)} & ${nameOf((seat + 2) % 4)})` : nameOf(seat), said, taken, score, why, total: totals[seat] }
  })
  const best = Math.max(...rows.map((r) => r.total ?? 0))

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-background/75 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="batak-summary-title"
        className="w-full max-w-md rounded-3xl border-2 border-gold/50 bg-card p-4 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{result.hand}. el bitti</p>
            <h2 id="batak-summary-title" className="text-balance font-display text-lg font-black text-foreground">
              {kozMaca
                ? 'Tahmin sonuçları'
                : result.bidder != null
                  ? `${isTeam ? teamLabel(result.bidder) : nameOf(result.bidder)} ${result.bid} dedi, ${result.made ? 'tutturdu' : 'battı'}`
                  : 'El sonucu'}
            </h2>
          </div>
          {!kozMaca && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-foreground">
              Koz{' '}
              {result.noTrump ? 'Kozsuz' : result.trump != null ? <span className={suitColor(result.trump)}>{SUIT_SYMBOLS[result.trump]}</span> : '?'}
            </span>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-muted-foreground">
              <th className="pb-1 font-semibold">Oyuncu</th>
              <th className="pb-1 text-center font-semibold">{kozMaca ? 'Tahmin' : 'Dedi'}</th>
              <th className="pb-1 text-center font-semibold">Aldı</th>
              <th className="pb-1 text-right font-semibold">Puan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.seat} className="border-t border-border align-top">
                <td className="py-1.5 pr-2">
                  <span className="block text-xs font-bold leading-snug text-foreground">{r.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{r.why}</span>
                </td>
                <td className="py-1.5 text-center tabular-nums text-foreground">{r.said}</td>
                <td className="py-1.5 text-center tabular-nums text-foreground">{r.taken}</td>
                <td className={cn('py-1.5 text-right font-black tabular-nums', r.score < 0 ? 'text-destructive' : 'text-primary')}>{r.score > 0 ? `+${r.score}` : r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {totals.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5 rounded-2xl bg-secondary/60 p-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Toplam</span>
            {rows
              .slice()
              .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
              .map((r) => (
                <div key={r.seat} className="flex items-center justify-between gap-2 text-sm">
                  <span className={cn('min-w-0 break-words font-semibold', r.total === best ? 'text-foreground' : 'text-muted-foreground')}>{r.name}</span>
                  <span className="shrink-0 tabular-nums font-bold text-foreground">
                    {r.total}
                    {target > 0 && <span className="ml-1 text-[11px] font-normal text-muted-foreground">({Math.max(0, target - (r.total ?? 0))} kaldı)</span>}
                  </span>
                </div>
              ))}
          </div>
        )}

        <button type="button" onClick={onClose} className="mt-4 h-11 w-full rounded-2xl bg-gold text-sm font-black text-gold-foreground">
          Devam
        </button>
      </div>
    </div>
  )
}
