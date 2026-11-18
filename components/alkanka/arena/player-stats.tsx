import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bracket } from '@/lib/bracket'
import { knockoutStats } from '@/lib/tournament-stats'
import { roundName } from '@/lib/tournaments-shared'

/** Every entrant of a knockout with the matches played, won and lost, and where the player stands now. */
export function PlayerStats({
  bracket,
  names,
  order,
  closed,
}: {
  bracket: Bracket
  names: Record<string, string>
  order: string[]
  /** The tournament is over: whoever is still in it was there when the end time came. */
  closed: boolean
}) {
  const stats = knockoutStats(bracket, order)
  const shared = (bracket.seats ?? 2) > 2
  const total = bracket.rounds.length
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[420px] text-sm">
        <caption className="sr-only">Oyuncu durumu</caption>
        <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" className="w-10 px-3 py-2.5 text-left">#</th>
            <th scope="col" className="px-3 py-2.5 text-left">Oyuncu</th>
            <th scope="col" className="px-2 py-2.5 text-center" title={shared ? 'Oynanan masa' : 'Oynanan maç'}>O</th>
            <th scope="col" className="px-2 py-2.5 text-center" title={shared ? 'Tur atladığı masa' : 'Galibiyet'}>G</th>
            <th scope="col" className="px-2 py-2.5 text-center" title={shared ? 'Elendiği masa' : 'Mağlubiyet'}>M</th>
            <th scope="col" className="px-3 py-2.5 text-right">Durum</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {stats.map((s, i) => {
            const round = roundName(false, s.reached, total)
            const absent = s.state === 'out' && s.noShow > 0 && s.played === 0
            return (
              <tr key={s.key} className={cn(s.state === 'champion' && 'bg-primary/10')}>
                <td className="px-3 py-2.5 font-bold text-muted-foreground">{i + 1}</td>
                <td className={cn('px-3 py-2.5 font-semibold', s.state === 'out' ? 'text-muted-foreground' : 'text-foreground')}>
                  <span className="flex items-center gap-1.5">
                    {s.state === 'champion' && <Crown className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                    <span className="truncate">{names[s.key] ?? s.key}</span>
                  </span>
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">{s.played}</td>
                <td className="px-2 py-2.5 text-center tabular-nums text-foreground">{s.wins}</td>
                <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">{s.losses}</td>
                <td className={cn('px-3 py-2.5 text-right text-xs font-semibold', s.state === 'champion' ? 'text-primary' : s.state === 'in' ? 'text-foreground' : 'text-muted-foreground')}>
                  {s.state === 'champion'
                    ? 'Şampiyon'
                    : s.state === 'in'
                      ? closed
                        ? `${round} · süre doldu`
                        : `Turnuvada · ${round}`
                      : `Elendi · ${round}${absent ? ' (gelmedi)' : ''}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
