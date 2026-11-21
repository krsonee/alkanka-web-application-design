'use client'

import { useState } from 'react'
import { Crown, Gift, Trophy } from 'lucide-react'
import type { LeagueRow, LeagueScope, PaidPeriod } from '@/lib/predictions'
import { prizeText, type Board, type PeriodKind, type Prize } from '@/lib/predictions-shared'
import { plainClick } from '@/lib/plain-click'
import { leaguePath } from '@/lib/record-links'
import { cn } from '@/lib/utils'
import { MemberRank } from '../kp/member-rank'
import { filterChip, segmentItem, segmentTray } from './ui'

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
    <section aria-labelledby="lig-tablosu" className="flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4">
      <div className="-mx-4 -mt-4 flex items-center justify-between gap-2 border-b border-border bg-secondary/50 px-4 py-3">
        <h2 id="lig-tablosu" className="flex items-center gap-2 font-display text-base font-bold text-foreground">
          <Trophy className="size-4 text-primary" aria-hidden="true" />
          {board ? board.name : 'Lig tablosu'}
        </h2>
        {period && <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-foreground/80">{period.label}</span>}
        {board && <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', board.open ? 'bg-live/15 text-live' : 'bg-background text-muted-foreground')}>{board.open ? 'Devam ediyor' : 'Sona erdi'}</span>}
      </div>
      <div role="tablist" aria-label="Dönem" className={cn(segmentTray, 'grid grid-cols-3 gap-1')}>
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={!board && scope === s.id}
            onClick={() => onScope(s.id)}
            className={cn(segmentItem(!board && scope === s.id), 'h-9 text-xs')}
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
                className={cn(filterChip(board?.id === b.id), 'text-left')}
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
        <ol className="flex flex-col gap-1">
          <li aria-hidden="true" className="flex items-center gap-2.5 px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="w-6 shrink-0 text-center">#</span>
            <span className="min-w-0 flex-1">Üye</span>
            <span className="shrink-0">İsabet</span>
            <span className="w-10 shrink-0 text-right">Puan</span>
          </li>
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
    <li className={cn('flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors', me ? 'bg-primary/10 font-bold ring-1 ring-primary/40' : place <= 3 ? 'bg-background' : 'hover:bg-background')}>
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold tabular-nums',
          place === 1 ? 'bg-primary text-primary-foreground' : place <= 3 ? 'bg-primary/15 text-primary' : 'text-muted-foreground',
        )}
      >
        {place === 1 ? <Crown className="size-3.5" aria-label="Lider" /> : place}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-foreground">{me ? 'Sen' : firstName(row.name)}</span>
        <MemberRank userId={row.userId} />
      </span>
      <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground" title="Puan aldığı tahmin / toplam tahmin">
        {row.hits}/{row.picks}
      </span>
      <span className="w-10 shrink-0 text-right font-display text-base font-bold tabular-nums text-primary">{row.points}</span>
    </li>
  )
}
