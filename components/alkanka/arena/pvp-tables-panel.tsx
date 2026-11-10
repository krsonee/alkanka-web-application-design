'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Loader2, Plus, Users } from 'lucide-react'
import { openTable, sitAtTable } from '@/app/actions/arena'
import { isWizardGame, wizardEnabledFor, type SetupConfig } from '@/lib/home-v2-shared'
import { formatAC, usePoints } from '../points-context'
import { useIdle } from '../use-idle'
import type { ArenaGame } from '@/lib/arena'
import type { TableSummary } from './table-lobby'
import { TableSetupWizard } from './table-setup-wizard'

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error('Yüklenemedi')
  return r.json()
}

export function PvpTablesPanel({
  game,
  commission,
  onSeated,
  onCreate,
  setup,
  bets,
}: {
  game: ArenaGame
  commission: number
  onSeated: (id: string, stake: number) => void
  onCreate: () => void
  setup?: SetupConfig
  bets: number[]
}) {
  const { member, points, requireLogin, refresh } = usePoints()
  const idle = useIdle()
  const [creating, setCreating] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const inlineWizard = setup && isWizardGame(game) && wizardEnabledFor(setup, game) ? setup : null
  const { data } = useSWR<{ open: TableSummary[] }>(`/api/tables?game=${game}`, fetcher, { refreshInterval: idle ? 30000 : 6000 })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const open = (data?.open ?? []).filter((t) => t.status === 'bekliyor' && t.seat < 0)

  const sit = async (t: TableSummary) => {
    if (!requireLogin()) return
    setBusyId(t.id)
    setError(null)
    const r = await sitAtTable(t.id, t.stake)
    setBusyId(null)
    refresh()
    if (!r.ok) return setError(r.error ?? 'Masaya oturulamadı.')
    onSeated(t.id, t.stake)
  }

  if (creating && inlineWizard && isWizardGame(game)) {
    return (
      <TableSetupWizard
        embedded
        game={game}
        config={inlineWizard}
        bets={bets}
        balance={member ? points : null}
        commission={commission}
        busy={createBusy}
        error={createError}
        onClose={() => {
          setCreating(false)
          setCreateError(null)
        }}
        onCreate={async (stake, options) => {
          if (!requireLogin()) return
          setCreateBusy(true)
          setCreateError(null)
          const r = await openTable(game, stake, options)
          setCreateBusy(false)
          refresh()
          if (!r.ok) return setCreateError(r.error ?? 'Masa açılamadı.')
          setCreating(false)
          onSeated(r.id, stake)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">Açık masalar</span>
        <span className="text-xs font-medium text-muted-foreground">
          {!data ? 'Yükleniyor' : open.length === 0 ? 'Bekleyen masa yok' : `${open.length} masa bekliyor`}
        </span>
      </div>

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {!data && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Masalar yükleniyor
          </div>
        )}
        {data && open.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-center text-sm leading-relaxed text-muted-foreground">
            Şu an bekleyen masa yok. İlk masayı sen aç, kankalar otururken haber verelim.
          </p>
        )}
        {open.map((t) => {
          const host = t.players.find((p) => !p.bot)?.name ?? 'Kanka'
          const humans = t.players.length
          const prize = t.stake * t.seats - Math.round((t.stake * t.seats * commission) / 100)
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
                    {`${humans}/${t.seats}`}
                  </span>
                  <span className="hidden tabular-nums text-primary sm:inline">{`Kazanç ${formatAC(prize)} KC`}</span>
                </span>
              </div>
              <button
                type="button"
                disabled={busyId != null || short}
                onClick={() => sit(t)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
              >
                {busyId === t.id && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {short ? 'Yetersiz' : 'Otur'}
              </button>
            </div>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          if (!requireLogin()) return
          if (inlineWizard) setCreating(true)
          else onCreate()
        }}
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 font-display text-base font-bold uppercase tracking-wide text-primary-foreground shadow-lg shadow-primary/30 glow-gold transition hover:brightness-110 active:scale-95"
      >
        <Plus className="size-5" aria-hidden="true" />
        Kendi masanı aç
      </button>
    </div>
  )
}
