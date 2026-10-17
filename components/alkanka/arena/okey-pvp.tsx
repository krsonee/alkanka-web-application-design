'use client'

import { useMemo, useState } from 'react'
import { ArrowDownToLine, Bot, Eye, Layers, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OkeyLast, OkeyState } from '@/lib/pvp/rules'
import type { Remote } from './remote'
import { BrandLogo } from '../logo-selector'
import { TileBack, TileFace, TurnSteps } from './okey'
import { OkeyRack, useRack } from './okey-rack'
import { findWinningDiscard, okeyFrom, type Okey as OkeyValue, type Tile } from './okey-engine'
import { TableBrand } from './table-brand'

type OkeyView = OkeyState & { deckCount: number; handCounts: number[]; oppSeat: number; seats: number; team: boolean; bots: number[]; last: OkeyLast[] }

const leftOf = (seat: number, n: number) => (seat - 1 + n) % n

export function OkeyPvp({ remote }: { remote: Remote<OkeyView> }) {
  const s = remote.state
  const n = s.seats ?? s.hands.length
  const spectator = remote.seat < 0
  const seat = spectator ? 0 : remote.seat
  const okey = useMemo(() => okeyFrom(s.indicator), [s.indicator])
  const hand = spectator ? [] : (s.hands[seat] ?? [])
  const rack = useRack(hand, okey)
  const selected = rack.selected
  const [sortMode, setSortMode] = useState<'seri' | 'cift'>('seri')
  const [knownIds, setKnownIds] = useState<string>(() => hand.map((t) => t.id).join(','))
  const [fresh, setFresh] = useState<number | null>(null)
  const idsKey = hand.map((t) => t.id).join(',')
  if (idsKey !== knownIds) {
    const prev = new Set(knownIds.split(',').filter(Boolean).map(Number))
    const added = hand.find((t) => !prev.has(t.id))
    setKnownIds(idsKey)
    setFresh(added && prev.size > 0 ? added.id : null)
    if (added && prev.size > 0) rack.setSelected(added.id)
  }

  const bots = s.bots ?? []
  const nameOf = (i: number) => remote.names[i] || (bots.includes(i) ? 'Bot' : `Oyuncu ${i + 1}`)
  const fromSeat = leftOf(seat, n)
  const myDraw = !spectator && remote.myTurn && s.phase === 'draw'
  const myDiscard = !spectator && remote.myTurn && s.phase === 'discard'
  const winning = myDiscard ? findWinningDiscard(hand, okey) : null
  const takeTop = s.discards[fromSeat]?.at(-1)
  const partner = s.team ? (seat + 2) % 4 : -1

  // Seats are drawn clockwise around the viewer: right, across, left.
  const around = n === 4 ? { right: (seat + 1) % 4, top: (seat + 2) % 4, left: (seat + 3) % 4 } : { top: (seat + 1) % 2 }

  function arrange() {
    rack.arrange(sortMode)
    setSortMode((m) => (m === 'seri' ? 'cift' : 'seri'))
  }

  let message: string
  if (spectator) message = `İzleyici modu · sıra ${nameOf(s.turn)} oyuncusunda`
  else if (myDraw)
    message = takeTop
      ? `1. adım: desteden çek ya da ${nameOf(fromSeat)} oyuncusunun attığı taşı al.`
      : '1. adım: ortadaki desteden taş çek.'
  else if (myDiscard)
    message = winning
      ? 'Elin bitmeye hazır! Bitiren taşı seç ve "Eli bitir" de.'
      : `2. adım: taşı "Taşı at" butonuna sürükle, çift tıkla ya da seçip butona bas.${fresh != null ? ' Yeni gelen taş "Yeni" etiketli.' : ''}`
  else message = `${nameOf(s.turn)} oynuyor...`

  const seatProps = (i: number) => ({
    name: nameOf(i),
    count: s.handCounts[i] ?? 0,
    active: s.turn === i,
    bot: bots.includes(i),
    partner: i === partner,
    team: s.team ? (i % 2 === 0 ? 'A' : 'B') : null,
    top: s.discards[i]?.at(-1),
    takeable: myDraw && i === fromSeat && Boolean(takeTop),
    okey,
  })

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {spectator && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <Eye className="size-4 text-primary" aria-hidden="true" /> Masayı izliyorsun. Oyuncuların elleri gizli, atılan taşlar canlı görünür.
        </p>
      )}
      <div className="relative overflow-hidden rounded-2xl bg-wood p-2 shadow-xl sm:p-3">
        <div className="relative flex min-h-72 flex-col justify-between gap-3 rounded-xl bg-felt p-2 sm:min-h-96 sm:p-5">
          <TableBrand />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-15">
            <BrandLogo />
          </div>

          <div className="relative flex justify-center">
            <SeatBadge {...seatProps(around.top)} />
          </div>

          <div className="relative flex items-center justify-between gap-2">
            {around.left != null ? <SeatBadge {...seatProps(around.left)} vertical /> : <span />}

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gösterge</span>
                <TileFace tile={s.indicator} okey={okey} size="sm" />
              </div>
              <button
                type="button"
                disabled={!myDraw || remote.busy}
                onClick={() => void remote.send({ type: 'draw', from: 'pile' })}
                className={cn('flex flex-col items-center gap-1 rounded-xl p-2', myDraw && 'animate-pulse ring-2 ring-primary')}
                aria-label={`Ortadan taş çek, ${s.deckCount} taş kaldı`}
              >
                <span className="relative">
                  <TileBack className="h-14 w-10" />
                  <Layers className="absolute inset-0 m-auto size-4 text-primary" aria-hidden="true" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.deckCount} taş</span>
              </button>
              {!spectator && (
                <button
                  type="button"
                  disabled={!myDraw || !takeTop || remote.busy}
                  onClick={() => void remote.send({ type: 'draw', from: 'discard' })}
                  className={cn('flex flex-col items-center gap-1 rounded-xl p-2', myDraw && takeTop && 'ring-2 ring-primary/60')}
                  aria-label={takeTop ? `${nameOf(fromSeat)} oyuncusunun attığı taşı al` : 'Alınacak taş yok'}
                >
                  {takeTop ? <TileFace tile={takeTop} okey={okey} size="sm" /> : <span className="h-11 w-8 rounded-md border border-dashed border-border" />}
                  <span className="max-w-20 truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Yerden al</span>
                </button>
              )}
            </div>

            {around.right != null ? <SeatBadge {...seatProps(around.right)} vertical /> : <span />}
          </div>

          <div className="relative flex flex-col items-center gap-1">
            <SeatBadge {...seatProps(seat)} name={spectator ? nameOf(seat) : 'Sen'} />
            <p className="text-center text-sm font-semibold text-foreground" aria-live="polite">
              {message}
            </p>
          </div>
        </div>

        {!spectator && (
          <div className="mt-2 sm:mt-3">
            <OkeyRack
              hand={hand}
              okey={okey}
              rack={rack}
              highlight={myDiscard ? fresh : null}
              onDoubleTile={(tile) => {
                if (myDiscard && !remote.busy) void remote.send({ type: 'discard', tileId: tile.id })
              }}
              onDropOut={(tileId, kind) => {
                if (!myDiscard || remote.busy) return
                if (kind === 'discard') void remote.send({ type: 'discard', tileId })
                else if (kind === 'finish' && winning) void remote.send({ type: 'finish', tileId })
              }}
            />
          </div>
        )}
      </div>

      <LastMoves last={s.last ?? []} nameOf={nameOf} okey={okey} />

      {!spectator && (
        <>
          <TurnSteps phase={myDraw ? 'draw' : myDiscard ? 'discard' : 'wait'} />
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <button onClick={arrange} className="rounded-xl border border-border px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-foreground hover:bg-secondary">
              {sortMode === 'seri' ? 'Seri diz' : 'Çift diz'}
            </button>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                data-drop={myDiscard && winning ? 'finish' : undefined}
                onClick={() => selected != null && void remote.send({ type: 'finish', tileId: selected })}
                disabled={!myDiscard || selected == null || !winning || remote.busy}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-primary px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary hover:bg-primary/10 disabled:opacity-40"
              >
                <Trophy className="size-4" aria-hidden="true" />
                Eli bitir
              </button>
              <button
                data-drop={myDiscard ? 'discard' : undefined}
                onClick={() => selected != null && void remote.send({ type: 'discard', tileId: selected })}
                disabled={!myDiscard || selected == null || remote.busy}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 disabled:opacity-40"
              >
                <ArrowDownToLine className="size-4" aria-hidden="true" />
                Taşı at
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SeatBadge({
  name,
  count,
  active,
  bot,
  partner,
  team,
  top,
  takeable,
  okey,
  vertical,
}: {
  name: string
  count: number
  active: boolean
  bot: boolean
  partner: boolean
  team: string | null
  top?: Tile
  takeable: boolean
  okey: OkeyValue
  vertical?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-2', vertical && 'flex-col')}>
      <div
        className={cn(
          'flex max-w-28 items-center gap-1.5 rounded-full border px-2 py-1 sm:max-w-40',
          active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card/90 text-foreground',
        )}
      >
        {bot && <Bot className="size-3.5 shrink-0" aria-label="Bot" />}
        <span className="truncate text-xs font-bold">{name}</span>
        {team && (
          <span className={cn('rounded px-1 text-[10px] font-bold', active ? 'bg-primary-foreground/20' : 'bg-secondary')}>
            {partner ? 'Eş' : team}
          </span>
        )}
        <span className="shrink-0 text-[10px] opacity-80">{count}</span>
      </div>
      <div className={cn('flex flex-col items-center rounded-md', takeable && 'ring-2 ring-primary')} title="Son attığı taş">
        {top ? <TileFace tile={top} okey={okey} size="sm" /> : <span className="h-11 w-8 rounded-md border border-dashed border-border/70" aria-hidden="true" />}
      </div>
    </div>
  )
}

function LastMoves({ last, nameOf, okey }: { last: OkeyLast[]; nameOf: (i: number) => string; okey: OkeyValue }) {
  if (!last.length) return null
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Son hamleler</span>
      <ol className="flex flex-col gap-1 text-xs text-foreground">
        {last
          .slice(-4)
          .reverse()
          .map((l, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="font-semibold">{nameOf(l.seat)}</span>
              <span className="text-muted-foreground">
                {l.type === 'pile' ? 'desteden taş çekti' : l.type === 'discard' ? 'yerden taş aldı' : 'taş attı'}
              </span>
              {l.tile && <TileFace tile={l.tile} okey={okey} size="sm" />}
            </li>
          ))}
      </ol>
    </div>
  )
}
