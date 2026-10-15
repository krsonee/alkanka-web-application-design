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
    <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
      {SIDES.map((side) => {
        const stake = value[side.key]
        const best = side.table[0]
        return (
          <fieldset key={side.key} className={cn('flex flex-col gap-2 rounded-xl border bg-background/60 p-3', stake > 0 ? 'border-primary' : 'border-primary/25')}>
            <legend className="sr-only">{side.name} yan bahsi</legend>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="font-display text-sm font-bold uppercase tracking-wide text-foreground">{side.name}</span>
                <span className="text-pretty text-[11px] leading-snug text-muted-foreground">{side.hint}</span>
              </div>
              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">{best.x}:1&apos;e kadar</span>
            </div>
            <div className="flex gap-1" role="radiogroup" aria-label={`${side.name} tutarı`}>
              {BJ_SIDE_STAKES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={stake === s}
                  onClick={() => onChange({ ...value, [side.key]: s })}
                  className={cn(
                    'flex-1 rounded-lg border px-1 py-1.5 text-xs font-bold tabular-nums transition-colors',
                    stake === s ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/25 text-muted-foreground hover:border-primary/60 hover:text-foreground',
                  )}
                >
                  {s === 0 ? 'Yok' : s}
                </button>
              ))}
            </div>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                <Info className="size-3" aria-hidden="true" />
                Ödeme oranları
              </summary>
              <div className="pt-2">
                <PayoutList table={side.table} />
                {stake > 0 && (
                  <p className="pt-2 text-[11px] text-muted-foreground">
                    En iyi elde {formatAC(stake * (best.x + 1))} geri alırsın.
                  </p>
                )}
              </div>
            </details>
          </fieldset>
        )
      })}
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
