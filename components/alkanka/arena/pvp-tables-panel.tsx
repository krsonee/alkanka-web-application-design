'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Loader2, Plus, Users } from 'lucide-react'
import { sitAtTable } from '@/app/actions/arena'
import { tableWinAmount, type ArenaGame } from '@/lib/arena'
import { formatAC, usePoints } from '../points-context'
import { useIdle } from '../use-idle'
import type { TableSummary } from './table-lobby'

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error('Yüklenemedi')
  return r.json()
}

/** Tables waiting for a rival, right under the quick-play buttons, plus the way into custom tables. */
export function PvpTablesPanel({
  game,
  commission,
  onSeated,
  onBrowse,
  onCreate,
}: {
  game: ArenaGame
  commission: number
  onSeated: (id: string, stake: number) => void
  onBrowse: () => void
  onCreate: () => void
}) {
  const { member, points, requireLogin, refresh } = usePoints()
  const idle = useIdle()
  const { data } = useSWR<{ open: (TableSummary & { ambient?: boolean })[] }>(`/api/tables?game=${game}`, fetcher, {
    refreshInterval: idle ? 30000 : 6000,
  })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const open = (data?.open ?? []).filter((t) => t.status === 'bekliyor' && t.seat < 0)

  const sit = async (t: TableSummary & { ambient?: boolean }) => {
    if (!requireLogin()) return
    if (t.ambient) return onBrowse()
    setBusyId(t.id)
    setError(null)
    const r = await sitAtTable(t.id, t.stake)
    setBusyId(null)
    refresh()
    if (!r.ok) return setError(r.error ?? 'Masaya oturulamadı.')
    onSeated(t.id, t.stake)
  }

  return (
    <section aria-labelledby="open-tables-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id="open-tables-title" className="text-sm font-semibold text-foreground">
          Rakip bekleyen masalar
        </h3>
        <span className="text-xs font-medium text-muted-foreground">
          {!data ? 'Yükleniyor' : open.length === 0 ? 'Bekleyen masa yok' : `${open.length} masa`}
        </span>
      </div>

      {open.length > 0 && (
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          {open.map((t) => {
            const host = t.players.find((p) => !p.bot)?.name ?? 'Kanka'
            const prize = tableWinAmount(t.game, t.stake, commission, { humans: t.seats - t.bots, bots: t.bots })
            const short = member != null && points < t.stake
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold uppercase text-foreground">
                  {host.charAt(0)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-bold text-foreground">{host}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">{`${formatAC(t.stake)} KC`}</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Users className="size-3" aria-hidden="true" />
                      {`${t.players.length}/${t.seats}`}
                    </span>
                    <span className="hidden tabular-nums text-primary sm:inline">{`Pot ${formatAC(prize)} KC`}</span>
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busyId != null || short}
                  onClick={() => sit(t)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
                >
                  {busyId === t.id && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {short ? 'Yetersiz' : `Otur · ${formatAC(t.stake)} KC`}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            if (requireLogin()) onCreate()
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-secondary"
        >
          <Plus className="size-4" aria-hidden="true" />
          Özel masa aç
        </button>
        <button
          type="button"
          onClick={onBrowse}
          className="flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-secondary"
        >
          <Users className="size-4" aria-hidden="true" />
          Tüm masalar
        </button>
      </div>
    </section>
  )
}
