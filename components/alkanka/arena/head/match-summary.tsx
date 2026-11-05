'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { MatchStats, Sport } from './engine'

const AUTO_CONTINUE_MS = 20000

type Row = { label: string; a: number; b: number; suffix?: string }

/** Broadcast-style full-time card: result, score and a two-sided stat comparison from the seat's point of view. */
export function MatchSummary({
  sport,
  seat,
  score,
  stats,
  names,
  onContinue,
}: {
  sport: Sport
  seat: 0 | 1
  score: [number, number]
  stats: MatchStats
  names: [string, string]
  onContinue: () => void
}) {
  const done = useRef(onContinue)
  done.current = onContinue
  useEffect(() => {
    const t = setTimeout(() => done.current(), AUTO_CONTINUE_MS)
    return () => clearTimeout(t)
  }, [])

  const mine = score[seat]
  const theirs = score[seat === 0 ? 1 : 0]
  const result = mine > theirs ? 'KAZANDIN' : mine < theirs ? 'KAYBETTİN' : 'BERABERE'
  const possTotal = stats.poss[0] + stats.poss[1] || 1
  const rows: Row[] = [
    { label: 'Topa sahip olma', a: Math.round((stats.poss[0] / possTotal) * 100), b: Math.round((stats.poss[1] / possTotal) * 100), suffix: '%' },
    { label: sport === 'futbol' ? 'Şut' : 'Atış', a: stats.shots[0], b: stats.shots[1] },
    { label: 'Kafa vuruşu', a: stats.headers[0], b: stats.headers[1] },
    { label: 'Süper güç', a: stats.powers[0], b: stats.powers[1] },
  ]

  return (
    <div role="dialog" aria-label="Maç sonucu" className="absolute inset-0 z-40 flex items-center justify-center bg-background/85 p-3 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl border border-primary/40 bg-card p-4 text-card-foreground shadow-2xl">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">Maç sonu</p>
        <p
          className={cn(
            'text-balance text-center font-display text-3xl font-black uppercase tracking-tight',
            mine > theirs ? 'text-primary' : mine < theirs ? 'text-destructive' : 'text-foreground',
          )}
        >
          {result}
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{names[0]}</span>
          <span className="rounded-lg bg-foreground px-3 py-1 font-display text-2xl font-black tabular-nums text-background">
            {score[0]} - {score[1]}
          </span>
          <span className="min-w-0 flex-1 truncate text-right text-sm font-bold">{names[1]}</span>
        </div>
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => {
            const total = r.a + r.b || 1
            return (
              <li key={r.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="tabular-nums">
                    {r.a}
                    {r.suffix}
                  </span>
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="tabular-nums">
                    {r.b}
                    {r.suffix}
                  </span>
                </div>
                <div className="flex h-2 gap-1 overflow-hidden rounded-full bg-muted">
                  <span className="rounded-full bg-primary" style={{ width: `${(r.a / total) * 100}%` }} />
                  <span className="ml-auto rounded-full bg-chart-2" style={{ width: `${(r.b / total) * 100}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          onClick={() => done.current()}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md transition-transform active:scale-95"
        >
          Devam
        </button>
      </div>
    </div>
  )
}
