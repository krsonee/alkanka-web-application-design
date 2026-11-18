'use client'

import { useState } from 'react'
import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PointRow } from '@/lib/bracket'
import { LEAGUE_DRAW_POINTS, LEAGUE_WIN_POINTS } from '@/lib/league'

/** Lines shown before the rest is folded away: a points league can have hundreds of entrants. */
const FOLD = 10

/** The table of a points league. `me` is the viewer's key; that line is always kept in view. */
export function PointsView({
  rows,
  names,
  me = null,
  maxGames = 0,
  closed = false,
}: {
  rows: PointRow[]
  names: Record<string, string>
  me?: string | null
  maxGames?: number
  /** The league is over: the first line is its champion. */
  closed?: boolean
}) {
  const [all, setAll] = useState(false)
  const ranked = rows.map((row, i) => ({ row, place: i + 1 }))
  const mine = me ? ranked.find((r) => r.row.key === me) : undefined
  const head = all ? ranked : ranked.slice(0, FOLD)
  const shown = mine && !head.includes(mine) ? [...head, mine] : head
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <caption className="sr-only">Puan durumu</caption>
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" className="w-10 px-3 py-2.5 text-left">#</th>
              <th scope="col" className="px-3 py-2.5 text-left">Oyuncu</th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Sayılan oyun">O</th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Galibiyet">G</th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Beraberlik">B</th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Mağlubiyet">M</th>
              <th scope="col" className="px-3 py-2.5 text-right">Puan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map(({ row, place }) => {
              const self = row.key === me
              const champion = closed && place === 1 && row.points > 0
              return (
                <tr key={row.key} className={cn(place === 1 && row.points > 0 && 'bg-primary/10', self && 'bg-secondary')}>
                  <td className="px-3 py-2.5 font-bold tabular-nums text-muted-foreground">{place}</td>
                  <td className="px-3 py-2.5 font-semibold text-foreground">
                    <span className="flex items-center gap-1.5">
                      {champion && <Crown className="size-4 shrink-0 text-primary" aria-label="Şampiyon" />}
                      <span className="truncate">{names[row.key] ?? row.key}</span>
                      {self && <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Sen</span>}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">
                    {row.played}
                    {maxGames > 0 && <span className="text-xs">/{maxGames}</span>}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-foreground">{row.wins}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">{row.draws}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">{row.losses}</td>
                  <td className="px-3 py-2.5 text-right font-display text-base font-bold tabular-nums text-foreground">{row.points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {ranked.length > FOLD && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="w-full border-t border-border px-3 py-2.5 text-center text-xs font-bold text-foreground hover:bg-secondary"
        >
          {all ? `İlk ${FOLD} sırayı göster` : `Bütün sıralamayı göster (${ranked.length} oyuncu)`}
        </button>
      )}
      <p className="border-t border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Galibiyet {LEAGUE_WIN_POINTS}, beraberlik {LEAGUE_DRAW_POINTS} puan. Eşitlikte aynı puanı daha az oyunla toplayan, sonra önce kaydolan üstte.
        {maxGames > 0 && ` Her oyuncunun ilk ${maxGames} oyunu sayılır.`}
      </p>
    </div>
  )
}
