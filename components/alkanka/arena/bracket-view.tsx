'use client'

import { useState, type ReactNode } from 'react'
import { Crown, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { roundLabel, type Bracket, type Match } from '@/lib/bracket'

type RenderPick = (round: number, match: number, m: Match) => ReactNode

function splitName(raw: string) {
  const guest = raw.startsWith('misafir:')
  return { name: guest ? raw.slice(8) : raw, guest }
}

function PlayerRow({ player, seed, state, placeholder }: { player: string | null; seed: number; state: 'win' | 'lose' | 'idle'; placeholder: string }) {
  if (!player) {
    return (
      <div className="flex h-11 items-center gap-2.5 px-2.5 text-sm text-muted-foreground">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[10px]">-</span>
        <span className="truncate italic">{placeholder}</span>
      </div>
    )
  }
  const { name, guest } = splitName(player)
  return (
    <div
      className={cn(
        'relative flex h-11 items-center gap-2.5 px-2.5 text-sm transition-colors',
        state === 'win' && 'bg-primary/15',
        state === 'lose' && 'opacity-50',
      )}
    >
      {state === 'win' && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-primary" aria-hidden="true" />}
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-md font-display text-xs font-bold',
          state === 'win' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
        )}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <span className={cn('min-w-0 flex-1 truncate', state === 'win' ? 'font-bold text-foreground' : 'font-medium text-foreground', state === 'lose' && 'line-through')}>
        {name}
      </span>
      {guest && <span className="shrink-0 rounded bg-secondary px-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">misafir</span>}
      <span className="w-4 shrink-0 text-right font-display text-[10px] font-bold tabular-nums text-muted-foreground">{seed}</span>
      {state === 'win' && <Crown className="size-3.5 shrink-0 text-primary" aria-label="Kazanan" />}
    </div>
  )
}

function MatchCard({ m, ri, mi, last, renderPick }: { m: Match; ri: number; mi: number; last: boolean; renderPick?: RenderPick }) {
  const empty = m.players.every((p) => !p)
  const live = !m.winner && m.players.every(Boolean)
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card shadow-sm',
        m.winner ? 'border-primary/50' : live ? 'border-destructive/50' : 'border-border',
        empty && 'opacity-50',
        last && 'ring-1 ring-primary/30',
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-background/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>Maç {mi + 1}</span>
        {live && (
          <span className="flex items-center gap-1 text-destructive">
            <span className="size-1.5 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
            Canlı
          </span>
        )}
        {m.winner && <span className="text-primary">Bitti</span>}
      </div>
      <div className="divide-y divide-border">
        {m.players.map((p, pi) => (
          <PlayerRow
            key={pi}
            player={p}
            seed={mi * 2 + pi + 1}
            state={!p || !m.winner ? 'idle' : m.winner === p ? 'win' : 'lose'}
            placeholder={ri === 0 ? 'Bay (otomatik tur atlar)' : 'Bekleniyor'}
          />
        ))}
      </div>
      {renderPick && !empty && <div className="border-t border-border bg-background/60 p-2">{renderPick(ri, mi, m)}</div>}
    </div>
  )
}

function ChampionCard({ champion, compact }: { champion: string | null; compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border text-center',
        compact ? 'flex-row p-3 text-left' : 'flex-col justify-center p-5',
        champion ? 'border-primary bg-primary/10 glow-gold' : 'border-dashed border-border bg-card',
      )}
    >
      <Trophy className={cn('shrink-0', compact ? 'size-7' : 'size-9', champion ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
      <div className="flex min-w-0 flex-col">
        {compact && <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Şampiyon</span>}
        <span className={cn('truncate font-display text-lg font-bold uppercase leading-tight', champion ? 'text-foreground' : 'text-muted-foreground')}>
          {champion ?? 'Belli olacak'}
        </span>
      </div>
    </div>
  )
}

function MobileBracket({ bracket, champion, renderPick }: { bracket: Bracket; champion: string | null; renderPick?: RenderPick }) {
  const total = bracket.rounds.length
  const firstOpen = bracket.rounds.findIndex((r) => r.some((m) => !m.winner))
  const [active, setActive] = useState(firstOpen === -1 ? total - 1 : firstOpen)
  const round = bracket.rounds[active] ?? []

  return (
    <div className="flex flex-col gap-3 md:hidden">
      <div role="tablist" aria-label="Turlar" className="grid gap-1 rounded-xl border border-border bg-background/60 p-1" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {bracket.rounds.map((r, ri) => {
          const done = r.filter((m) => m.winner).length
          const selected = ri === active
          const complete = done === r.length
          return (
            <button
              key={ri}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(ri)}
              className={cn(
                'flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-2 transition-colors',
                selected ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary',
              )}
            >
              <span className="w-full truncate text-center text-[11px] font-bold uppercase leading-tight tracking-wide">{roundLabel(ri, total)}</span>
              <span className={cn('text-[10px] font-semibold tabular-nums', selected ? 'text-primary-foreground/80' : complete ? 'text-primary' : 'text-muted-foreground')}>
                {done}/{r.length}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex h-1 gap-1" aria-hidden="true">
        {bracket.rounds.map((_, ri) => (
          <span key={ri} className={cn('flex-1 rounded-full', ri <= active ? 'bg-primary' : 'bg-secondary')} />
        ))}
      </div>

      <ol role="tabpanel" aria-label={roundLabel(active, total)} className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2">
        {round.map((m, mi) => (
          <li key={`${active}-${mi}`} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
            <MatchCard m={m} ri={active} mi={mi} last={active === total - 1} renderPick={renderPick} />
          </li>
        ))}
      </ol>

      <ChampionCard champion={champion} compact />
    </div>
  )
}

function DesktopBracket({ bracket, champion, renderPick }: { bracket: Bracket; champion: string | null; renderPick?: RenderPick }) {
  const total = bracket.rounds.length
  return (
    <div className="-mx-1 hidden overflow-x-auto px-1 pb-3 md:block">
      <ol className="flex min-w-max items-stretch gap-8">
        {bracket.rounds.map((round, ri) => {
          const last = ri === total - 1
          const done = round.filter((m) => m.winner).length
          return (
            <li key={ri} className="flex w-60 flex-col gap-4">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
                <span className={cn('text-xs font-bold uppercase tracking-[0.18em]', last ? 'text-primary' : 'text-foreground')}>{roundLabel(ri, total)}</span>
                <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {done}/{round.length} maç
                </span>
              </div>
              <ol className="flex flex-1 flex-col justify-around gap-4">
                {round.map((m, mi) => (
                  <li key={mi} className="relative">
                    {!last && <span className="absolute -right-8 top-1/2 h-px w-8 bg-border" aria-hidden="true" />}
                    {ri > 0 && <span className="absolute -left-8 top-1/2 h-px w-8 bg-border" aria-hidden="true" />}
                    <MatchCard m={m} ri={ri} mi={mi} last={last} renderPick={renderPick} />
                  </li>
                ))}
              </ol>
            </li>
          )
        })}
        <li className="flex w-48 flex-col gap-4">
          <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Şampiyon</div>
          <div className="relative flex flex-1 items-center">
            <span className="absolute -left-8 top-1/2 h-px w-8 bg-primary/50" aria-hidden="true" />
            <ChampionCard champion={champion} />
          </div>
        </li>
      </ol>
    </div>
  )
}

export function BracketView({ bracket, renderPick }: { bracket: Bracket; renderPick?: RenderPick }) {
  const total = bracket.rounds.length
  const final = bracket.rounds[total - 1]?.[0]
  const champion = final?.winner ? splitName(final.winner).name : null

  return (
    <>
      <MobileBracket bracket={bracket} champion={champion} renderPick={renderPick} />
      <DesktopBracket bracket={bracket} champion={champion} renderPick={renderPick} />
    </>
  )
}
