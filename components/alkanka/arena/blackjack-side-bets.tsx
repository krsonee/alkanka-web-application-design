'use client'

import { Info } from 'lucide-react'
import { BJ_213_TABLE, BJ_PAIRS_TABLE, BJ_SIDE_STAKES, type SideHit } from '@/lib/casino'
import { cn } from '@/lib/utils'
import { formatAC } from '../points-context'

export type SideStakes = { pairs: number; t213: number }

const SIDES = [
  { key: 'pairs' as const, name: 'Mükemmel Çift', hint: 'İlk iki kartın çift gelirse', table: BJ_PAIRS_TABLE },
  { key: 't213' as const, name: '21+3', hint: 'İlk iki kartın + krupiyenin açık kartı', table: BJ_213_TABLE },
]

function PayoutList({ table }: { table: SideHit[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {table.map((h) => (
        <li key={h.key} className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{h.label}</span>
          <span className="font-bold tabular-nums text-primary">{h.x}:1</span>
        </li>
      ))}
    </ul>
  )
}

/** Optional side bets picked together with the main bet. Each side shows its full payout table. */
export function SideBetPicker({ value, onChange }: { value: SideStakes; onChange: (v: SideStakes) => void }) {
  return (
    <div className="flex w-full max-w-md flex-col gap-1.5 rounded-xl border border-primary/20 bg-background/50 p-2">
      {SIDES.map((side) => {
        const stake = value[side.key]
        const best = side.table[0]
        return (
          <fieldset key={side.key} className="flex items-center justify-between gap-2">
            <legend className="sr-only">{side.name} yan bahsi: {side.hint}</legend>
            <div className="flex min-w-0 flex-col leading-tight" title={side.hint}>
              <span className={cn('truncate text-xs font-bold uppercase tracking-wide', stake > 0 ? 'text-primary' : 'text-foreground')}>
                {side.name}
              </span>
              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{best.x}:1&apos;e kadar</span>
            </div>
            <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={`${side.name} tutarı`}>
              {BJ_SIDE_STAKES.map((s) => {
                const active = stake === s
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={s === 0 ? 'Yan bahis yok' : `${s} AC`}
                    onClick={() => onChange({ ...value, [side.key]: s })}
                    className={cn(
                      'grid size-8 place-items-center rounded-full border-2 border-dashed text-[11px] font-bold tabular-nums transition-all',
                      active
                        ? 'scale-105 border-primary-foreground/40 bg-primary text-primary-foreground shadow-sm'
                        : 'border-primary/30 bg-background text-muted-foreground hover:border-primary/70 hover:text-foreground',
                    )}
                  >
                    {s === 0 ? '—' : s}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )
      })}
      <details className="group border-t border-primary/15 pt-1.5">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground">
          <Info className="size-3" aria-hidden="true" />
          Yan bahis oranları
        </summary>
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          {SIDES.map((side) => {
            const stake = value[side.key]
            const best = side.table[0]
            return (
              <div key={side.key} className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-primary">{side.name}</span>
                <span className="text-[10px] text-muted-foreground">{side.hint}</span>
                <PayoutList table={side.table} />
                {stake > 0 && (
                  <p className="text-[10px] text-muted-foreground">En iyi elde {formatAC(stake * (best.x + 1))} geri alırsın.</p>
                )}
              </div>
            )
          })}
        </div>
      </details>
    </div>
  )
}

/** Small tag on a seat showing how its side bets landed. */
export function SideBetTags({ side }: { side: { pairs: number; t213: number; pairsHit: SideHit | null; t213Hit: SideHit | null; settled: boolean } }) {
  if (!side.settled || (side.pairs === 0 && side.t213 === 0)) return null
  const hits = [side.pairsHit, side.t213Hit].filter(Boolean) as SideHit[]
  if (hits.length === 0) return null
  return (
    <div className="flex flex-wrap justify-center gap-0.5">
      {hits.map((h) => (
        <span key={h.key} className="pop-in rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-primary-foreground">
          {h.label} {h.x}:1
        </span>
      ))}
    </div>
  )
}

/** Reference card with every side bet payout, shown in the sidebar. */
export function SidePayoutCard() {
  return (
    <section aria-labelledby="bj-side-payouts" className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-4">
      <h3 id="bj-side-payouts" className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
        Yan bahis oranları
      </h3>
      {SIDES.map((side) => (
        <div key={side.key} className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-primary">{side.name}</span>
          <PayoutList table={side.table} />
        </div>
      ))}
    </section>
  )
}
