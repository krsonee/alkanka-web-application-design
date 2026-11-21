'use client'

import { useState } from 'react'
import { Crown, Gift } from 'lucide-react'
import type { LeagueRow, LeagueScope, PaidPeriod } from '@/lib/predictions'
import { prizeText, type Board, type PeriodKind, type Prize } from '@/lib/predictions-shared'
import { plainClick } from '@/lib/plain-click'
import { leaguePath } from '@/lib/record-links'
import { cn } from '@/lib/utils'
import { MemberRank } from '../kp/member-rank'

export type PeriodView = { on: boolean; places: Prize[]; label: string }

/** A special league with its own table. */
export type BoardView = Board & { table: LeagueRow[] }

const SCOPES: { id: LeagueScope; label: string }[] = [
  { id: 'week', label: 'Bu hafta' },
  { id: 'month', label: 'Bu ay' },
  { id: 'all', label: 'Tümü' },
]

const SHOWN = 10

const firstName = (name: string) => name.split(' ')[0] || name

function PrizeList({ places, winners }: { places: Prize[]; winners?: { place: number; name: string }[] }) {
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
  boards,
  meId,
  scope,
  onScope,
  boardId,
  onBoard,
}: {
  tables: Record<LeagueScope, LeagueRow[]>
  periods: Record<PeriodKind, PeriodView>
  paid: Partial<Record<PeriodKind, PaidPeriod>>
  boards: BoardView[]
  meId: string | null
  /** The period and the special league on show live with the page, which also writes them to the address. */
  scope: LeagueScope
  onScope: (scope: LeagueScope) => void
  boardId: number | null
  onBoard: (id: number | null) => void
}) {
  const [all, setAll] = useState(false)
  const board = boards.find((b) => b.id === boardId) ?? null
  const table = board ? board.table : tables[scope]
  const shown = all ? table.slice(0, 20) : table.slice(0, SHOWN)
  const myIndex = meId ? table.findIndex((r) => r.userId === meId) : -1
  const mineBelow = myIndex >= shown.length ? table[myIndex] : null
  const period = board || scope === 'all' ? null : periods[scope]
  const last = board || scope === 'all' ? undefined : paid[scope]

  return (
    <section aria-labelledby="lig-tablosu" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="lig-tablosu" className="font-display text-base font-bold text-foreground">
          Lig tablosu
        </h2>
        {period && <span className="text-xs text-muted-foreground">{period.label}</span>}
        {board && <span className="text-xs text-muted-foreground">{board.open ? 'Devam ediyor' : 'Sona erdi'}</span>}
      </div>
      <div role="tablist" aria-label="Dönem" className="grid grid-cols-3 gap-1 rounded-lg bg-background p-1">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={!board && scope === s.id}
            onClick={() => onScope(s.id)}
            className={cn('h-8 rounded-md text-xs font-bold transition-colors', !board && scope === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {s.label}
          </button>
        ))}
      </div>

      {boards.length > 0 && (
        <nav aria-label="Özel ligler" className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Özel ligler</span>
          <div className="flex flex-wrap gap-1.5">
            {boards.map((b) => (
              <a
                key={b.id}
                href={leaguePath(b.id, b.name)}
                aria-current={board?.id === b.id ? 'page' : undefined}
                onClick={(e) => {
                  if (!plainClick(e)) return
                  e.preventDefault()
                  onBoard(board?.id === b.id ? null : b.id)
                }}
                className={cn(
                  'flex min-h-9 items-center rounded-full border px-3 py-1 text-left text-xs font-semibold transition-colors',
                  board?.id === b.id ? 'border-primary bg-primary/15 text-primary' : 'border-border text-foreground hover:border-primary hover:text-primary',
                )}
              >
                <span>
                  {b.name}
                  {!b.open && <span className="font-normal text-muted-foreground"> · bitti</span>}
                </span>
              </a>
            ))}
          </div>
        </nav>
      )}

      {board && (
        <div className="flex flex-col gap-2 rounded-lg bg-background p-3">
          {board.places.length > 0 && (
            <>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Gift className="size-3.5" aria-hidden="true" />
                {board.name} ödülleri
              </p>
              <PrizeList places={board.places} winners={board.open ? undefined : board.winners} />
            </>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {board.places.length > 0 ? (board.open ? `Lig bitince ilk ${board.places.length} sıraya dağıtılır. ` : 'Lig bitti, ödüller dağıtıldı. ') : board.open ? '' : 'Lig bitti. '}
            {board.general ? 'Bu ligin maçları haftalık ve aylık tabloya da sayılır.' : 'Bu ligin puanları sadece bu tabloya yazılır.'}
          </p>
        </div>
      )}

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
          {board ? 'Bu ligde henüz sonuçlanan maç yok. İlk doğru tahmin zirveye oturur.' : scope === 'all' ? 'İlk maçlar sonuçlanınca tablo burada oluşur.' : 'Bu dönemde henüz sonuçlanan maç yok. İlk doğru tahmin zirveye oturur.'}
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
