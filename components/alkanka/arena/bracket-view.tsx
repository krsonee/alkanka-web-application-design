import type { ReactNode } from 'react'
import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { roundLabel, type Bracket, type Match } from '@/lib/bracket'

export function BracketView({
  bracket,
  renderPick,
}: {
  bracket: Bracket
  renderPick?: (round: number, match: number, m: Match) => ReactNode
}) {
  const total = bracket.rounds.length
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <ol className="flex min-w-max gap-4">
        {bracket.rounds.map((round, ri) => (
          <li key={ri} className="flex w-56 flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{roundLabel(ri, total)}</span>
            <ol className="flex flex-1 flex-col justify-around gap-3">
              {round.map((m, mi) => {
                const empty = m.players.every((p) => !p)
                return (
                  <li key={mi} className={cn('flex flex-col overflow-hidden rounded-xl border bg-background/60', m.winner ? 'border-primary/60' : 'border-border', empty && 'opacity-40')}>
                    {m.players.map((p, pi) => (
                      <div
                        key={pi}
                        className={cn(
                          'flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0',
                          p && m.winner === p ? 'bg-primary/15 font-bold text-foreground' : p ? 'text-foreground' : 'text-muted-foreground',
                          m.winner && p && m.winner !== p && 'line-through decoration-muted-foreground/60',
                        )}
                      >
                        <span className="truncate">{p ?? (ri === 0 ? 'Bay' : 'Bekleniyor')}</span>
                        {p && m.winner === p && <Crown className="size-3.5 shrink-0 text-primary" aria-label="Kazanan" />}
                      </div>
                    ))}
                    {renderPick && !empty && <div className="border-t border-border bg-card p-2">{renderPick(ri, mi, m)}</div>}
                  </li>
                )
              })}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  )
}
