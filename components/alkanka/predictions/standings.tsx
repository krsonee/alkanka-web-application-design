'use client'

import { useState } from 'react'
import { Crown, Gift } from 'lucide-react'
import type { LeagueRow, LeagueScope, PaidPeriod } from '@/lib/predictions'
import { prizeText, type PeriodKind, type Prize } from '@/lib/predictions-shared'
import { cn } from '@/lib/utils'
import { MemberRank } from '../kp/member-rank'

export type PeriodView = { on: boolean; places: Prize[]; label: string }

const SCOPES: { id: LeagueScope; label: string }[] = [
  { id: 'week', label: 'Bu hafta' },
  { id: 'month', label: 'Bu ay' },
  { id: 'all', label: 'Tümü' },
]

const SHOWN = 10

const firstName = (name: string) => name.split(' ')[0] || name

function PrizeList({ places, winners }: { places: Prize[]; winners?: PaidPeriod['winners'] }) {
  return (
    <ol className="flex flex-col gap-1 text-sm">
      {places.map((p, i) => {
        const winner = winners?.find((w) => w.place === i + 1)
        return (
          <li key={i} className="flex items-baseline gap-2">
            <span className="w-5 shrink-0 font-display font-bold tabular-nums text-muted-foreground">{i + 1}.</span>
            <span className="min-w-0 flex-1 font-semibold text-foreground">{prizeText(p)}</span>
            {winner && <span className="shrink-0 truncate text-xs text-muted-foreground">{firstName(winner.name)}</span>}
          </li>
        )
      })}
    </ol>
  )
}

export function Standings({
  tables,
  periods,
  paid,
  meId,
}: {
  tables: Record<LeagueScope, LeagueRow[]>
  periods: Record<PeriodKind, PeriodView>
  paid: Partial<Record<PeriodKind, PaidPeriod>>
  meId: string | null
}) {
  const [scope, setScope] = useState<LeagueScope>('week')
  const [all, setAll] = useState(false)
  const table = tables[scope]
  const shown = all ? table.slice(0, 20) : table.slice(0, SHOWN)
  const myIndex = meId ? table.findIndex((r) => r.userId === meId) : -1
  const mineBelow = myIndex >= shown.length ? table[myIndex] : null
  const period = scope === 'all' ? null : periods[scope]
  const last = scope === 'all' ? undefined : paid[scope]

  return (
    <section aria-labelledby="lig-tablosu" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="lig-tablosu" className="font-display text-base font-bold text-foreground">
          Lig tablosu
        </h2>
        {period && <span className="text-xs text-muted-foreground">{period.label}</span>}
      </div>
      <div role="tablist" aria-label="Dönem" className="grid grid-cols-3 gap-1 rounded-lg bg-background p-1">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={scope === s.id}
            onClick={() => setScope(s.id)}
            className={cn('h-8 rounded-md text-xs font-bold transition-colors', scope === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {s.label}
          </button>
        ))}
      </div>

      {period?.on && (
        <div className="flex flex-col gap-2 rounded-lg bg-background p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Gift className="size-3.5" aria-hidden="true" />
            {scope === 'week' ? 'Bu haftanın ödülleri' : 'Bu ayın ödülleri'}
          </p>
          <PrizeList places={period.places} />
          <p className="text-xs leading-relaxed text-muted-foreground">Dönem bitince ilk {period.places.length} sıraya kendiliğinden dağıtılır.</p>
        </div>
      )}

      {table.length ? (
        <ol className="flex flex-col">
          {shown.map((r, i) => (
            <Row key={r.userId} row={r} place={i + 1} me={r.userId === meId} />
          ))}
          {mineBelow && <Row row={mineBelow} place={myIndex + 1} me />}
        </ol>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {scope === 'all' ? 'İlk maçlar sonuçlanınca tablo burada oluşur.' : 'Bu dönemde henüz sonuçlanan maç yok. İlk doğru tahmin zirveye oturur.'}
        </p>
      )}
      {table.length > SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} className="self-start text-xs font-semibold text-primary underline-offset-2 hover:underline">
          {all ? 'Daha az göster' : `İlk ${Math.min(20, table.length)} sırayı göster`}
        </button>
      )}

      {last && last.winners.length > 0 && (
        <details className="group rounded-lg bg-background p-3">
          <summary className="cursor-pointer list-none text-xs font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            Önceki dönemin kazananları <span className="font-normal text-muted-foreground">· {last.label}</span>
          </summary>
          <ol className="flex flex-col gap-1 pt-2 text-sm">
            {last.winners.map((w) => (
              <li key={w.place} className="flex items-baseline gap-2">
                <span className="w-5 shrink-0 font-display font-bold tabular-nums text-muted-foreground">{w.place}.</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{firstName(w.name)}</span>
                <span className="shrink-0 text-xs text-primary">{prizeText(w.prize)}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}

function Row({ row, place, me }: { row: LeagueRow; place: number; me: boolean }) {
  return (
    <li className={cn('flex items-center gap-2.5 border-b border-border py-2 text-sm last:border-0', me && 'rounded-md bg-primary/10 px-2 font-bold')}>
      <span className="flex w-5 shrink-0 justify-center font-display font-bold tabular-nums text-muted-foreground">
        {place === 1 ? <Crown className="size-4 text-primary" aria-label="Lider" /> : place}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-foreground">{me ? 'Sen' : firstName(row.name)}</span>
        <MemberRank userId={row.userId} />
      </span>
      <span className="shrink-0 text-xs font-normal text-muted-foreground" title="Puan aldığı tahmin / toplam tahmin">
        {row.hits}/{row.picks}
      </span>
      <span className="w-9 shrink-0 text-right font-display font-bold tabular-nums text-primary">{row.points}</span>
    </li>
  )
}
