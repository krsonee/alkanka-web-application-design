'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, Layers, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OkeyState } from '@/lib/pvp/rules'
import type { Remote } from './remote'
import { BrandLogo } from '../logo-selector'
import { TileBack, TileFace } from './okey'
import { findWinningDiscard, okeyFrom, sortHand, type Tile } from './okey-engine'

type OkeyView = OkeyState & { deckCount: number; handCounts: [number, number]; oppSeat: number }

export function OkeyPvp({ remote }: { remote: Remote<OkeyView> }) {
  const s = remote.state
  const seat = remote.seat
  const opp = s.oppSeat
  const okey = useMemo(() => okeyFrom(s.indicator), [s.indicator])
  const hand = s.hands[seat] ?? []
  const [order, setOrder] = useState<number[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [sortMode, setSortMode] = useState<'seri' | 'cift'>('seri')

  // Keep the player's own arrangement; new tiles are appended at the end.
  useEffect(() => {
    setOrder((prev) => {
      const ids = new Set(hand.map((t) => t.id))
      const kept = prev.filter((id) => ids.has(id))
      const added = hand.filter((t) => !kept.includes(t.id)).map((t) => t.id)
      return [...kept, ...added]
    })
    setSelected((sel) => (sel != null && hand.some((t) => t.id === sel) ? sel : null))
  }, [hand])

  const byId = new Map(hand.map((t) => [t.id, t]))
  const rack = order.map((id) => byId.get(id)).filter(Boolean) as Tile[]
  const myDraw = remote.myTurn && s.phase === 'draw'
  const myDiscard = remote.myTurn && s.phase === 'discard'
  const winning = myDiscard ? findWinningDiscard(hand, okey) : null
  const oppName = remote.names[opp] || 'Rakip'
  const oppTop = s.discards[opp]?.at(-1)
  const myTop = s.discards[seat]?.at(-1)

  function arrange() {
    setOrder(sortHand(hand, okey, sortMode).map((t) => t.id))
    setSortMode((m) => (m === 'seri' ? 'cift' : 'seri'))
  }

  function move(dir: -1 | 1) {
    if (selected == null) return
    setOrder((o) => {
      const i = o.indexOf(selected)
      const j = i + dir
      if (i < 0 || j < 0 || j >= o.length) return o
      const next = [...o]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  let message: string
  if (myDraw) message = oppTop ? 'Ortadan taş çek ya da rakibin attığı taşı al.' : 'Ortadan taş çek.'
  else if (myDiscard) message = winning ? 'Elin bitmeye hazır! Bitiren taşı seç ve "Eli bitir" de.' : 'Atacağın taşı seç.'
  else message = `${oppName} oynuyor...`

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="relative overflow-hidden rounded-2xl bg-wood p-2 shadow-xl sm:p-3">
        <div className="relative flex min-h-64 flex-col justify-between gap-4 rounded-xl bg-felt p-3 sm:min-h-80 sm:p-5">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-15">
            <BrandLogo />
          </div>

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={cn('flex size-9 items-center justify-center rounded-full border-2 font-display text-sm font-bold', !remote.myTurn ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground')}>
                {oppName.slice(0, 1).toUpperCase()}
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">{oppName}</span>
                <span className="text-xs text-muted-foreground">{s.handCounts[opp]} taş</span>
              </div>
            </div>
            <div className="flex -space-x-4" aria-hidden="true">
              {Array.from({ length: Math.min(s.handCounts[opp], 8) }).map((_, i) => (
                <TileBack key={i} />
              ))}
            </div>
          </div>

          <div className="relative flex flex-wrap items-center justify-center gap-4 sm:gap-8">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gösterge</span>
              <TileFace tile={s.indicator} okey={okey} size="sm" />
            </div>
            <button
              type="button"
              disabled={!myDraw || remote.busy}
              onClick={() => void remote.send({ type: 'draw', from: 'pile' })}
              className={cn('flex flex-col items-center gap-1 rounded-xl p-2', myDraw && 'ring-2 ring-primary animate-pulse')}
              aria-label={`Ortadan taş çek, ${s.deckCount} taş kaldı`}
            >
              <span className="relative">
                <TileBack className="h-14 w-10" />
                <Layers className="absolute inset-0 m-auto size-4 text-primary" aria-hidden="true" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.deckCount} taş</span>
            </button>
            <button
              type="button"
              disabled={!myDraw || !oppTop || remote.busy}
              onClick={() => void remote.send({ type: 'draw', from: 'discard' })}
              className={cn('flex flex-col items-center gap-1 rounded-xl p-2', myDraw && oppTop && 'ring-2 ring-primary/60')}
              aria-label={oppTop ? 'Rakibin attığı taşı al' : 'Rakip henüz taş atmadı'}
            >
              {oppTop ? <TileFace tile={oppTop} okey={okey} size="sm" /> : <span className="h-11 w-8 rounded-md border border-dashed border-border" />}
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rakibin attığı</span>
            </button>
            <div className="flex flex-col items-center gap-1 p-2">
              {myTop ? <TileFace tile={myTop} okey={okey} size="sm" /> : <span className="h-11 w-8 rounded-md border border-dashed border-border" />}
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Senin attığın</span>
            </div>
          </div>

          <p className="relative text-center text-sm font-semibold text-foreground" aria-live="polite">
            {message}
          </p>
        </div>

        <div className="mt-2 rounded-xl bg-wood/80 p-2 sm:mt-3">
          <div className="flex flex-wrap justify-center gap-1 sm:gap-1.5" role="group" aria-label="Istakan">
            {rack.map((t) => (
              <TileFace key={t.id} tile={t} okey={okey} selected={selected === t.id} onClick={() => setSelected(selected === t.id ? null : t.id)} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <button onClick={arrange} className="rounded-xl border border-border px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground hover:bg-secondary">
            {sortMode === 'seri' ? 'Seri diz' : 'Çift diz'}
          </button>
          <button onClick={() => move(-1)} disabled={selected == null} className="rounded-xl border border-border px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground hover:bg-secondary disabled:opacity-40">
            Sola
          </button>
          <button onClick={() => move(1)} disabled={selected == null} className="rounded-xl border border-border px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground hover:bg-secondary disabled:opacity-40">
            Sağa
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            onClick={() => selected != null && void remote.send({ type: 'finish', tileId: selected })}
            disabled={!myDiscard || selected == null || !winning || remote.busy}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-primary px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            <Trophy className="size-4" aria-hidden="true" />
            Eli bitir
          </button>
          <button
            onClick={() => selected != null && void remote.send({ type: 'discard', tileId: selected })}
            disabled={!myDiscard || selected == null || remote.busy}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 disabled:opacity-40"
          >
            <ArrowDownToLine className="size-4" aria-hidden="true" />
            Taşı at
          </button>
        </div>
      </div>
    </div>
  )
}
