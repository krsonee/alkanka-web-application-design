'use client'

import { ArrowRight, Eye, LayoutGrid, Plus, Users } from 'lucide-react'
import type { BlackjackLiveState } from '@/lib/blackjack-live'
import { cn } from '@/lib/utils'

const PHASE: Record<string, string> = { waiting: 'Boş', bet: 'Bahis', play: 'Oyunda', result: 'Sonuç' }

/** Entry screen: every open table first, then the player picks one or opens their own. */
export function BlackjackLobby({
  tables,
  busy,
  openLabel,
  onPick,
  onOpen,
  message,
}: {
  tables: BlackjackLiveState['tables']
  busy: boolean
  openLabel: string
  onPick: (no: number) => void
  onOpen: () => void
  message?: string
}) {
  const players = tables.reduce((n, t) => n + t.seated, 0)
  return (
    <section aria-labelledby="bj-lobby" className="flex flex-col gap-5 rounded-3xl border border-primary/30 bg-card p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="bj-lobby" className="font-display text-2xl font-bold uppercase tracking-wide text-foreground text-balance">
            Blackjack masaları
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {tables.length} açık masa · {players} oyuncu oynuyor. Bir masaya geç, izle ya da boş koltuğa otur.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onOpen}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          {openLabel}
        </button>
      </header>

      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((t) => {
          const full = t.seated >= 6
          return (
            <li key={t.no}>
              <button
                type="button"
                onClick={() => onPick(t.no)}
                className="felt-table group flex w-full flex-col gap-4 rounded-2xl border border-primary/30 p-4 text-left transition-colors hover:border-primary"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-lg font-bold text-foreground">Masa {t.no}</span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase',
                      t.phase === 'waiting' ? 'bg-background/70 text-muted-foreground' : 'bg-primary text-primary-foreground',
                    )}
                  >
                    {PHASE[t.phase] ?? t.phase}
                  </span>
                </span>
                <span className="flex gap-1.5" aria-label={`${t.seated} / 6 koltuk dolu`}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'size-4 rounded-full border',
                        i < t.seated ? 'border-primary bg-primary' : 'border-primary/40 bg-background/40',
                      )}
                    />
                  ))}
                </span>
                <span className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-3 tabular-nums">
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5 text-primary" aria-hidden="true" />
                      {t.seated}/6
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Eye className="size-3.5" aria-hidden="true" />
                      {t.watching}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 font-bold uppercase text-primary">
                    {full ? 'İzle' : 'Masaya geç'}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Every open table with its seat and spectator count, so anyone can hop over and watch. */
export function BlackjackTables({
  tables,
  current,
  locked,
  onView,
}: {
  tables: BlackjackLiveState['tables']
  current: number
  locked: boolean
  onView: (no: number) => void
}) {
  return (
    <section aria-labelledby="bj-tables" className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-4">
      <h3 id="bj-tables" className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
        <LayoutGrid className="size-4 text-primary" aria-hidden="true" />
        Masalar
      </h3>
      <ul className="flex flex-col gap-1.5">
        {tables.map((t) => {
          const here = t.no === current
          return (
            <li key={t.no}>
              <button
                type="button"
                disabled={locked && !here}
                onClick={() => onView(t.no)}
                aria-current={here ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  here ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-bold text-foreground">Masa {t.no}</span>
                  <span className="text-[11px] text-muted-foreground">{PHASE[t.phase] ?? t.phase}</span>
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold tabular-nums text-foreground" title="Oyuncu">
                  <Users className="size-3.5 text-primary" aria-hidden="true" />
                  {t.seated}/6
                  <span className="sr-only">oyuncu</span>
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold tabular-nums text-muted-foreground" title="İzleyici">
                  <Eye className="size-3.5" aria-hidden="true" />
                  {t.watching}
                  <span className="sr-only">izleyici</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {locked ? 'Elin bitene kadar bu masadasın.' : 'Bir masaya dokun, izleyici olarak katıl. Boş koltuk varsa oradan oturabilirsin.'}
      </p>
    </section>
  )
}

/** Who is watching this table right now. */
export function BlackjackWatchers({ names, spectating }: { names: string[]; spectating: boolean }) {
  return (
    <section aria-labelledby="bj-watchers" className="flex flex-col gap-2 rounded-2xl border border-primary/40 bg-card p-4">
      <h3 id="bj-watchers" className="flex items-center justify-between gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
        <span className="flex items-center gap-2">
          <Eye className="size-4 text-primary" aria-hidden="true" />
          İzleyiciler
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">{names.length}</span>
      </h3>
      {names.length === 0 ? (
        <p className="text-xs text-muted-foreground">Şu an kimse izlemiyor.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {names.slice(0, 18).map((n, i) => (
            <li key={`${n}-${i}`} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">
              {n}
            </li>
          ))}
          {names.length > 18 && <li className="px-1 text-[11px] text-muted-foreground">+{names.length - 18}</li>}
        </ul>
      )}
      {spectating && <p className="text-[11px] text-primary">Bu masayı izleyici olarak takip ediyorsun.</p>}
    </section>
  )
}
