'use client'

import { useState, type ReactNode } from 'react'
import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bracket, Match } from '@/lib/bracket'
import { LEAGUE_WIN_POINTS, leagueChampion, leagueStandings } from '@/lib/league'

type RenderPick = (round: number, match: number, m: Match) => ReactNode

const cleanName = (raw: string) => (raw.startsWith('misafir:') ? raw.slice(8) : raw)

export function LeagueView({
  bracket,
  names = {},
  order = [],
  renderPick,
}: {
  bracket: Bracket
  names?: Record<string, string>
  order?: string[]
  renderPick?: RenderPick
}) {
  const nameOf = (key: string) => cleanName(names[key] ?? key)
  const standings = leagueStandings(bracket, order)
  const champion = leagueChampion(bracket, order)
  const firstOpen = bracket.rounds.findIndex((r) => r.some((m) => !m.winner))
  const [round, setRound] = useState(firstOpen < 0 ? bracket.rounds.length - 1 : firstOpen)
  const matches = bracket.rounds[round] ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[420px] text-sm">
          <caption className="sr-only">Puan durumu</caption>
          <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" className="w-10 px-3 py-2.5 text-left">#</th>
              <th scope="col" className="px-3 py-2.5 text-left">Oyuncu</th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Oynanan">O</th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Galibiyet">G</th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Mağlubiyet">M</th>
              <th scope="col" className="px-2 py-2.5 text-center" title="Kalan maç">K</th>
              <th scope="col" className="px-3 py-2.5 text-right">Puan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {standings.map((s, i) => {
              const isChampion = champion === s.key
              return (
                <tr key={s.key} className={cn(i === 0 && 'bg-primary/10')}>
                  <td className="px-3 py-2.5 font-bold text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2.5 font-semibold text-foreground">
                    <span className="flex items-center gap-1.5">
                      {isChampion && <Crown className="size-4 text-primary" aria-label="Şampiyon" />}
                      {nameOf(s.key)}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-center text-muted-foreground">{s.played}</td>
                  <td className="px-2 py-2.5 text-center text-foreground">{s.wins}</td>
                  <td className="px-2 py-2.5 text-center text-muted-foreground">{s.losses}</td>
                  <td className="px-2 py-2.5 text-center text-muted-foreground">{s.remaining}</td>
                  <td className="px-3 py-2.5 text-right font-display text-base font-bold text-foreground">{s.points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Galibiyet {LEAGUE_WIN_POINTS} puan. Eşitlikte önce aralarındaki maçlar, sonra kayıt sırası belirler.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Haftalar">
          {bracket.rounds.map((r, i) => {
            const done = r.every((m) => m.winner)
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={round === i}
                onClick={() => setRound(i)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-bold transition-colors',
                  round === i ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary',
                  done && round !== i && 'text-muted-foreground',
                )}
              >
                {i + 1}. hafta
              </button>
            )
          })}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {matches.map((m, mi) => {
            const [a, b] = m.players as string[]
            return (
              <li key={mi} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className={cn('truncate font-semibold', m.winner === a ? 'text-primary' : m.winner ? 'text-muted-foreground' : 'text-foreground')}>
                    {nameOf(a)}
                  </span>
                  <span className="shrink-0 text-xs font-bold text-muted-foreground">{m.winner ? (m.winner === a ? '1 - 0' : '0 - 1') : 'vs'}</span>
                  <span className={cn('truncate text-right font-semibold', m.winner === b ? 'text-primary' : m.winner ? 'text-muted-foreground' : 'text-foreground')}>
                    {nameOf(b)}
                  </span>
                </div>
                {renderPick?.(round, mi, m)}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
