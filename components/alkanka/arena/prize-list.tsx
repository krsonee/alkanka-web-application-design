import { Medal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tournament } from '@/lib/tournaments-shared'
import { effectivePrizes, prizePlaces, tournamentPlacements } from '@/lib/tournament-prizes'

/** Prize per finishing place; once the tournament is over, also who finished there. */
export function PrizeList({ t, className }: { t: Tournament; className?: string }) {
  const prizes = effectivePrizes(t)
  if (!prizes.length) return null
  const places = prizePlaces(t.format, t.maxPlayers)
  const order = t.entries.map((e) => e.userId ?? `misafir:${e.nickname}`)
  const finished = t.status === 'bitti' ? tournamentPlacements(t.format, t.bracket, order) : []
  const rows = prizes.flatMap((amount, i) => (amount > 0 && places[i] ? [{ i, amount, place: places[i] }] : []))
  if (!rows.length) return null
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Medal className="size-4 shrink-0 text-primary" aria-hidden="true" />
        Sıralama ödülleri
      </h3>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border text-sm">
        {rows.map(({ i, amount, place }) => {
          const winners = finished.filter((p) => p.place === i).map((p) => t.names[p.key] ?? p.key)
          return (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="w-10 shrink-0 font-display font-bold text-primary">{place.label}</span>
                <span className="min-w-0 text-foreground">{winners.length ? winners.join(', ') : <span className="text-muted-foreground">{place.hint}</span>}</span>
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
