import { Medal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tournament } from '@/lib/tournaments-shared'
import { effectivePrizes, prizePlaces, tournamentPayouts, tournamentPlacements } from '@/lib/tournament-prizes'

/** Prize per finishing place; once the tournament is over, also who finished there. */
export function PrizeList({ t, className }: { t: Tournament; className?: string }) {
  const prizes = effectivePrizes(t)
  if (!prizes.length) return null
  const places = prizePlaces(t.format, t.maxPlayers, t.tableSize)
  const order = t.entries.map((e) => e.userId ?? `misafir:${e.nickname}`)
  const finished = t.status === 'bitti' ? tournamentPlacements(t.format, t.bracket, order) : []
  // Stopped by its end time with no champion: the players still in it split the top prizes, so those places have no single owner.
  const shared = t.status === 'bitti' && t.finishReason === 'sure' ? tournamentPayouts(t, t.bracket, order, true).filter((p) => p.shared) : []
  const rows = prizes
    .flatMap((amount, i) => (amount > 0 && places[i] ? [{ i, amount, place: places[i] }] : []))
    .filter(({ i }) => !shared.length || finished.some((p) => p.place === i))
  if (!rows.length && !shared.length) return null
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Medal className="size-4 shrink-0 text-primary" aria-hidden="true" />
        Sıralama ödülleri
      </h3>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border text-sm">
        {shared.length > 0 && (
          <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="w-10 shrink-0 font-display font-bold text-primary">Ortak</span>
              <span className="min-w-0 text-foreground">{shared.map((p) => t.names[p.key] ?? p.key).join(', ')}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">
              {shared[0].amount.toLocaleString('tr-TR')} KC{shared.length > 1 && <span className="font-normal text-muted-foreground"> kişi başı</span>}
            </span>
          </li>
        )}
        {rows.map(({ i, amount, place }) => {
          const winners = finished.filter((p) => p.place === i).map((p) => t.names[p.key] ?? p.key)
          return (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="min-w-10 shrink-0 font-display font-bold tabular-nums text-primary">{place.label}</span>
                <span className="min-w-0 text-foreground">{winners.length ? winners.join(', ') : <span className="text-muted-foreground">{place.hint.replace(', kişi başı', '')}</span>}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {amount.toLocaleString('tr-TR')} KC{place.count > 1 && <span className="font-normal text-muted-foreground"> kişi başı</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
