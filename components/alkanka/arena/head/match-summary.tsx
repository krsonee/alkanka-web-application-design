'use client'

import { useEffect, useRef } from 'react'
import { LogOut, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MatchStats, Sport } from './engine'

const AUTO_CONTINUE_MS = 25000

type Row = { label: string; a: number; b: number; suffix?: string }

/**
 * Full-screen full-time card: result, score and a two-sided stat comparison from the seat's point of view.
 * It covers the whole viewport (landscape phones included) so it never shrinks into a corner of the page.
 */
export function MatchSummary({
  sport,
  seat,
  score,
  stats,
  names,
  onContinue,
  onRematch,
}: {
  sport: Sport
  seat: 0 | 1
  score: [number, number]
  stats: MatchStats
  names: [string, string]
  onContinue: () => void
  onRematch?: () => void
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
  ]

  return (
    <div
      role="dialog"
      aria-label="Maç sonucu"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-background/90 p-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-md"
    >
      <div className="flex max-h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-3xl border border-primary/40 bg-card p-5 text-card-foreground shadow-2xl landscape:flex-row landscape:items-stretch landscape:gap-6 md:p-8">
        <div className="flex flex-col items-center justify-center gap-3 landscape:w-2/5">
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Maç sonu</p>
          <p
            className={cn(
              'text-balance text-center font-display text-4xl font-black uppercase tracking-tight md:text-6xl',
              mine > theirs ? 'text-primary' : mine < theirs ? 'text-destructive' : 'text-foreground',
            )}
          >
            {result}
          </p>
          <span className="rounded-2xl bg-foreground px-5 py-2 font-display text-4xl font-black tabular-nums text-background md:text-5xl">
            {score[0]} - {score[1]}
          </span>
          <div className="flex w-full items-center justify-between gap-3 text-base font-bold">
            <span className="min-w-0 flex-1 truncate">{names[0]}</span>
            <span className="min-w-0 flex-1 truncate text-right">{names[1]}</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-4">
          <ul className="flex flex-col gap-3">
            {rows.map((r) => {
              const total = r.a + r.b || 1
              return (
                <li key={r.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-base font-bold">
                    <span className="tabular-nums">
                      {r.a}
                      {r.suffix}
                    </span>
                    <span className="text-sm text-muted-foreground">{r.label}</span>
                    <span className="tabular-nums">
                      {r.b}
                      {r.suffix}
                    </span>
                  </div>
                  <div className="flex h-3 gap-1 overflow-hidden rounded-full bg-muted">
                    <span className="rounded-full bg-primary" style={{ width: `${(r.a / total) * 100}%` }} />
                    <span className="ml-auto rounded-full bg-chart-2" style={{ width: `${(r.b / total) * 100}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="flex gap-3">
            {onRematch && (
              <button
                type="button"
                onClick={onRematch}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-base font-black text-primary-foreground shadow-md transition-transform active:scale-95"
              >
                <RotateCcw className="size-5" aria-hidden="true" />
                Rövanş
              </button>
            )}
            <button
              type="button"
              onClick={() => done.current()}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base font-black shadow-md transition-transform active:scale-95',
                onRematch ? 'border border-border bg-muted text-foreground' : 'bg-primary text-primary-foreground',
              )}
            >
              <LogOut className="size-5" aria-hidden="true" />
              {onRematch ? 'Çık' : 'Devam'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
