'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Bot, Eye, Layers, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { playSound } from '@/lib/sound'
import { RANK_LABEL, sideOf, type PCard, type PistiEvent, type PistiHandResult, type PistiView } from '@/lib/games/pisti'
import { BatakCard } from './batak-pvp'
import type { Remote } from './remote'
import { TableBrand } from './table-brand'

type Place = 'bottom' | 'top' | 'left' | 'right'

const FLY: Record<Place, [string, string]> = {
  bottom: ['0px', '170px'],
  top: ['0px', '-150px'],
  left: ['-170px', '0px'],
  right: ['170px', '0px'],
}

const EVENT_MS: Record<PistiEvent['kind'], number> = { drop: 750, capture: 1250, pisti: 2100, jpisti: 2400, sweep: 1400, deal: 900, hand: 900 }

function CardBack({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span className={cn('card-back block shrink-0 rounded-md', className)} style={style} aria-hidden="true" />
}

export function PistiPvp({ remote }: { remote: Remote<PistiView> }) {
  const s = remote.state
  const n = s.seats
  const me = remote.spectator ? -1 : remote.seat
  const base = me >= 0 ? me : 0
  const mySide = sideOf(s, base)

  const nameOf = (seat: number) => (seat === me ? 'Sen' : (remote.names[seat] ?? `Oyuncu ${seat + 1}`))
  const sideLabel = (side: number) => {
    if (s.team) return side === mySide ? (me >= 0 ? 'Biz' : 'Takım A') : me >= 0 ? 'Onlar' : 'Takım B'
    return nameOf(side)
  }

  // Play goes seat + 1, so the next player sits on my right.
  const places: { seat: number; place: Place }[] =
    n === 4
      ? [
          { seat: (base + 1) % 4, place: 'right' },
          { seat: (base + 2) % 4, place: 'top' },
          { seat: (base + 3) % 4, place: 'left' },
        ]
      : [{ seat: (base + 1) % 2, place: 'top' }]
  const placeOf = (seat: number): Place => (seat === base ? 'bottom' : (places.find((p) => p.seat === seat)?.place ?? 'top'))

  // ---- Event replay: every move (bots included) is shown one after another. ----
  const seenRef = useRef<number | null>(null)
  const [queue, setQueue] = useState<PistiEvent[]>([])
  const [current, setCurrent] = useState<PistiEvent | null>(null)
  const [summary, setSummary] = useState<PistiHandResult | null>(null)
  const resultsRef = useRef(s.results)
  resultsRef.current = s.results

  useEffect(() => {
    if (seenRef.current == null) {
      seenRef.current = s.seq
      return
    }
    const fresh = s.log.filter((e) => e.seq > (seenRef.current ?? 0))
    seenRef.current = s.seq
    if (fresh.length) setQueue((q) => [...q, ...fresh].slice(-14))
  }, [s.seq, s.log])

  useEffect(() => {
    if (current || !queue.length) return
    const [head, ...rest] = queue
    setCurrent(head)
    setQueue(rest)
    if (head.kind === 'pisti' || head.kind === 'jpisti') playSound('win')
    else if (head.kind === 'capture' || head.kind === 'sweep') playSound('coin')
    if (head.kind === 'hand') {
      const last = resultsRef.current.at(-1)
      if (last) setSummary(last)
    }
  }, [queue, current])

  useEffect(() => {
    if (!current) return
    const fast = queue.length > 3 ? 0.6 : 1
    const t = setTimeout(() => setCurrent(null), EVENT_MS[current.kind] * fast)
    return () => clearTimeout(t)
  }, [current, queue.length])

  useEffect(() => {
    if (!summary) return
    const t = setTimeout(() => setSummary(null), 6000)
    return () => clearTimeout(t)
  }, [summary])

  const replaying = current != null || queue.length > 0
  const lastEvent = current ?? s.log.at(-1) ?? null

  const finished = useMemo(() => {
    const max = Math.max(...s.totals)
    return max >= s.target && s.totals.filter((t) => t === max).length === 1 && s.log.at(-1)?.kind === 'hand'
  }, [s.totals, s.target, s.log])
  const winnerSide = finished ? s.totals.indexOf(Math.max(...s.totals)) : -1
  const iWon = finished && me >= 0 && winnerSide === mySide

  // ---- Pile shown: during replay it follows the replayed event. ----
  const pileTop = current ? current.pileTop : s.pileTop
  const pileCount = current ? current.pileCount : s.pileCount
  const pileFan: PCard[] = current ? (current.pileTop ? [current.pileTop] : []) : s.pileFan
  const pileHidden = current ? Math.max(0, pileCount - pileFan.length) : s.pileHidden + Math.max(0, s.pileCount - s.pileHidden - s.pileFan.length)

  const myTurn = remote.myTurn && !replaying && !finished
  const hand = me >= 0 ? s.hand : []
  const captures = (c: PCard) => s.pileTop != null && (c.r === s.pileTop.r || c.r === 11)
  const makesPisti = (c: PCard) => s.pileCount === 1 && s.pileTop != null && c.r === s.pileTop.r

  const prompt = finished
    ? iWon
      ? 'Kazandın!'
      : 'Oyun bitti'
    : replaying
      ? `${current && current.seat >= 0 && current.kind !== 'deal' && current.kind !== 'hand' ? nameOf(current.seat) + ' oynuyor' : 'Masa hazırlanıyor'}`
      : remote.myTurn
        ? s.pileTop
          ? 'Sıra sende. Aynı kart ya da Vale yeri alır.'
          : 'Sıra sende. Yer boş, bir kart at.'
        : `${nameOf(s.turn)} düşünüyor`

  const eventTone = (e: PistiEvent | null) =>
    !e ? 'bg-background/70 text-foreground' : e.kind === 'pisti' || e.kind === 'jpisti' ? 'bg-gold text-gold-foreground' : e.kind === 'capture' || e.kind === 'sweep' ? 'bg-primary text-primary-foreground' : 'bg-background/80 text-foreground'

  const eventText = (e: PistiEvent | null) => {
    if (!e) return s.note || 'Pişti masası'
    if (e.seat < 0 || e.kind === 'deal') return e.text
    return `${nameOf(e.seat)}: ${e.text}`
  }

  const sides = s.team ? [0, 1] : Array.from({ length: n }, (_, i) => i)

  const Seat = ({ seat, place }: { seat: number; place: Place }) => {
    const active = !replaying && s.turn === seat && !finished
    const acting = current?.seat === seat && current.kind !== 'deal' && current.kind !== 'hand'
    const count = s.handCounts[seat] ?? 0
    const partner = s.team && sideOf(s, seat) === mySide && me >= 0
    return (
      <div
        className={cn(
          'absolute z-10 flex items-center gap-2',
          place === 'top' && 'left-1/2 top-16 -translate-x-1/2 flex-row sm:top-20',
          place === 'left' && 'left-2 top-[44%] -translate-y-1/2 flex-col sm:left-4',
          place === 'right' && 'right-2 top-[44%] -translate-y-1/2 flex-col sm:right-4',
        )}
      >
        <div className="relative">
          <div
            className={cn(
              'flex size-11 items-center justify-center rounded-full bg-background/85 font-display text-base font-bold text-foreground ring-2 transition sm:size-14 sm:text-lg',
              active || acting ? 'ring-gold' : 'ring-border',
              active && 'animate-[pisti-ring_1.2s_ease-out_infinite]',
            )}
          >
            {s.bots.includes(seat) ? <Bot className="size-5 text-muted-foreground" aria-label="Bot" /> : nameOf(seat).charAt(0).toUpperCase()}
          </div>
          <span className="absolute -bottom-1 -right-1 rounded-full bg-background px-1.5 text-[10px] font-bold tabular-nums text-foreground ring-1 ring-border">{count}</span>
        </div>
        <div className={cn('flex max-w-24 flex-col rounded-lg px-2 py-0.5 sm:max-w-32', active ? 'bg-gold text-gold-foreground' : 'bg-background/80 text-foreground', place !== 'top' && 'items-center text-center')}>
          <span className="truncate text-[11px] font-bold leading-tight sm:text-xs">{nameOf(seat)}</span>
          <span className={cn('text-[10px] leading-tight', active ? 'text-gold-foreground/80' : 'text-muted-foreground')}>
            {partner ? 'Eşin' : s.team ? 'Rakip' : active ? 'Düşünüyor' : 'Rakip'}
          </span>
        </div>
        <div className={cn('hidden gap-0.5 sm:flex', place !== 'top' && 'flex-col')} aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <CardBack key={i} className={place === 'top' ? 'h-9 w-6' : 'h-6 w-9'} />
          ))}
        </div>
      </div>
    )
  }

  const flying = current?.card && current.kind !== 'deal' ? current : null
  const flyFrom = flying ? FLY[placeOf(flying.seat)] : FLY.bottom
  const sweepTo = flying && flying.kind !== 'drop' ? FLY[placeOf(flying.seat)] : null

  return (
    <div className="flex flex-col gap-3">
      {remote.spectator && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <Eye className="size-4 text-primary" aria-hidden="true" /> Masayı izliyorsun. Eller gizli, yere atılan kartlar canlı görünür.
        </p>
      )}

      <section aria-label="Pişti masası" className="tavla-wood rounded-[1.75rem] p-1.5 sm:p-2.5">
        <div className="baize-table relative h-[calc(100dvh-8.75rem)] min-h-[25rem] overflow-hidden lg:h-[min(38rem,calc(100dvh-11rem))] lg:min-h-[30rem] rounded-[1.4rem]">
          <TableBrand />
          {/* Scoreboard */}
          <div className="absolute inset-x-2 top-2 z-20 flex items-stretch gap-1.5 sm:inset-x-4 sm:top-3 sm:gap-2">
            {sides.map((side) => {
              const live = (s.capturedPoints[side] ?? 0) + (s.pistiPts[side] ?? 0)
              const shown = s.totals[side] + live
              const pct = Math.min(100, (shown / s.target) * 100)
              const mine = side === mySide && me >= 0
              const lead = finished && side === winnerSide
              return (
                <div
                  key={side}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col gap-1 rounded-xl px-2 py-1.5 backdrop-blur sm:px-3',
                    lead ? 'bg-gold text-gold-foreground' : mine ? 'bg-background/90 ring-1 ring-gold/60' : 'bg-background/75',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <span className={cn('truncate text-[11px] font-bold sm:text-xs', lead ? '' : 'text-foreground')}>{sideLabel(side)}</span>
                    <span key={shown} className={cn('animate-pop font-display text-lg font-black tabular-nums leading-none sm:text-xl', lead ? '' : 'text-foreground')} aria-label={`${sideLabel(side)} ${shown} puan`}>
                      {shown}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-gold transition-[width] duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <span className={cn('flex items-center gap-1.5 text-[10px] tabular-nums leading-none', lead ? 'text-gold-foreground/80' : 'text-muted-foreground')}>
                    <span className={cn('font-bold', live > 0 && !lead && 'text-gold')}>+{live} el</span>
                    <span>{s.capturedCounts[side]} kart</span>
                    {s.pistiCount[side] > 0 && <span className={cn('font-bold', !lead && 'text-gold')}>{s.pistiCount[side]}P</span>}
                  </span>
                </div>
              )
            })}
            <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-background/75 px-2 py-1 text-center backdrop-blur">
              <span className="text-[10px] font-semibold leading-tight text-muted-foreground">Hedef</span>
              <span className="font-display text-sm font-bold tabular-nums leading-tight text-foreground">{s.target}</span>
              <span className="text-[10px] tabular-nums leading-tight text-muted-foreground">{s.handNo}. el</span>
            </div>
          </div>

          {places.map((p) => (
            <Seat key={p.seat} seat={p.seat} place={p.place} />
          ))}

          {/* Deck */}
          <div className={cn('absolute z-10 flex flex-col items-center gap-1', n === 4 ? 'bottom-[42%] left-[22%]' : 'left-[12%] top-[46%] -translate-y-1/2 sm:left-[18%]')}>
            {s.deckCount > 0 ? (
              <div className="relative h-[4.4rem] w-[3.15rem] sm:h-[5.6rem] sm:w-16">
                {[2, 1, 0].map((i) => (
                  <CardBack key={i} className="absolute inset-0 size-full" style={{ transform: `translate(${i * 2}px, ${-i * 2}px)` }} />
                ))}
              </div>
            ) : (
              <span className="flex h-[4.4rem] w-[3.15rem] items-center justify-center rounded-md border border-dashed border-foreground/20 sm:h-[5.6rem] sm:w-16">
                <Layers className="size-4 text-foreground/30" aria-hidden="true" />
              </span>
            )}
            <span className="rounded-full bg-background/80 px-2 text-[10px] font-bold tabular-nums text-foreground">Deste {s.deckCount}</span>
          </div>

          {/* Pile */}
          <div className="absolute left-1/2 top-[46%] z-0 size-0">
            {pileCount === 0 && !flying && (
              <span className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-display text-[11px] font-bold uppercase tracking-[0.3em] text-foreground/25">
                Yer boş
              </span>
            )}
            {Array.from({ length: Math.min(4, pileHidden) }, (_, i) => (
              <CardBack
                key={`h${i}`}
                className="absolute h-[4.4rem] w-[3.15rem] -translate-x-1/2 -translate-y-1/2 sm:h-[5.6rem] sm:w-16"
                style={{ rotate: `${(i - 1.5) * 7}deg`, translate: `${(i - 1.5) * 3}px 0` }}
              />
            ))}
            {pileFan.map((c, i) => {
              const isTop = i === pileFan.length - 1
              if (isTop && flying?.kind === 'drop') return null
              return (
                <div key={`${c.s}-${c.r}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ zIndex: i + 5, rotate: `${(i - pileFan.length + 1) * 9}deg` }}>
                  <BatakCard card={c} size="sm" className={cn(isTop && 'ring-2 ring-gold/70')} />
                </div>
              )
            })}
            {flying && (
              <div key={flying.seq} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ zIndex: 30 }}>
                <div
                  style={
                    {
                      '--fx': flyFrom[0],
                      '--fy': flyFrom[1],
                      '--tx': sweepTo?.[0] ?? '0px',
                      '--ty': sweepTo?.[1] ?? '0px',
                      animation: sweepTo
                        ? 'pisti-fly 420ms cubic-bezier(0.2,0.8,0.2,1) both, pisti-sweep 520ms ease-in 700ms forwards'
                        : 'pisti-fly 420ms cubic-bezier(0.2,0.8,0.2,1) both',
                    } as CSSProperties
                  }
                >
                  <BatakCard card={flying.card!} size="sm" className="shadow-xl" />
                  {flying.taken > 1 && (
                    <span className="absolute -right-3 -top-3 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold tabular-nums text-primary-foreground ring-2 ring-background">
                      {flying.taken}
                    </span>
                  )}
                </div>
                {flying.points > 0 && (
                  <span
                    className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-2 py-0.5 text-xs font-bold tabular-nums text-gold-foreground"
                    style={{ animation: 'pisti-float 1100ms ease-out 350ms both' }}
                  >
                    +{flying.points}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Pişti burst */}
          {current && (current.kind === 'pisti' || current.kind === 'jpisti') && (
            <div key={`b${current.seq}`} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center" aria-hidden="true">
              <div className="flex flex-col items-center gap-1" style={{ animation: 'pisti-burst 600ms cubic-bezier(0.2,1.4,0.4,1) both' }}>
                <span className="flex items-center gap-2 rounded-2xl bg-gold px-6 py-2 font-display text-4xl font-black uppercase tracking-wide text-gold-foreground shadow-2xl ring-4 ring-background/60 sm:text-6xl">
                  <Sparkles className="size-7 sm:size-10" aria-hidden="true" />
                  {current.kind === 'jpisti' ? 'Vale Pişti' : 'Pişti'}
                </span>
                <span className="rounded-full bg-background/90 px-3 py-1 text-sm font-bold text-foreground">
                  {nameOf(current.seat)} · +{current.kind === 'jpisti' ? 20 : 10}
                </span>
              </div>
            </div>
          )}

          {/* Event line + prompt */}
          <div className="absolute inset-x-2 bottom-[8.6rem] z-20 flex flex-col items-center gap-1.5 sm:bottom-[10.4rem]">
            <p
              key={lastEvent?.seq ?? 0}
              className={cn('animate-rise max-w-full truncate rounded-full px-3 py-1 text-center text-xs font-bold shadow-sm sm:text-sm', eventTone(lastEvent))}
              aria-live="polite"
            >
              {eventText(lastEvent)}
            </p>
            <p className={cn('max-w-full truncate rounded-full px-3 py-0.5 text-center text-[11px] font-semibold', myTurn ? 'bg-gold text-gold-foreground' : 'bg-background/60 text-muted-foreground')}>
              {prompt}
            </p>
          </div>

          {/* My hand */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-center gap-2 px-2 pb-3 sm:gap-3 sm:pb-4 [--cw:4.3rem] sm:[--cw:5.4rem]" aria-label="Elindeki kartlar">
            {me < 0 && <span className="pb-8 text-xs text-muted-foreground">İzleyici modu</span>}
            {hand.map((c, i) => {
              const take = captures(c)
              const pisti = makesPisti(c)
              return (
                <div key={`${c.s}-${c.r}`} className="relative flex flex-col items-center" style={{ animation: `card-deal 380ms ease-out ${i * 70}ms both` }}>
                  {myTurn && (pisti || take) && (
                    <span className={cn('absolute -top-5 z-10 whitespace-nowrap rounded-full px-1.5 text-[10px] font-bold', pisti ? 'bg-gold text-gold-foreground' : 'bg-primary text-primary-foreground')}>
                      {pisti ? 'Pişti!' : c.r === 11 ? 'Süpürür' : 'Alır'}
                    </span>
                  )}
                  <BatakCard
                    card={c}
                    playable={myTurn}
                    dim={!myTurn && remote.myTurn}
                    disabled={!myTurn || remote.busy}
                    onClick={() => remote.send({ type: 'play', s: c.s, r: c.r })}
                    className={cn(pisti && myTurn && 'ring-4')}
                  />
                </div>
              )
            })}
          </div>

          {/* Hand summary */}
          {summary && !finished && (
            <HandSummary result={summary} sides={sides} label={sideLabel} mySide={me >= 0 ? mySide : -1} totals={s.totals} onClose={() => setSummary(null)} />
          )}

        </div>
      </section>
    </div>
  )
}

export function PistiFinalScore({ state, names, mySeat }: { state: PistiView; names: string[]; mySeat: number }) {
  const sides = state.team ? [0, 1] : state.totals.map((_, i) => i)
  const label = (side: number) => (state.team ? `${names[side]} & ${names[side + 2]}` : names[side])
  const max = Math.max(...state.totals)
  const mine = mySeat >= 0 ? sideOf(state, mySeat) : -1
  return (
    <div className="flex w-full flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Skor · {state.target} puan · {state.handNo} el
      </p>
      <ol className="flex w-full flex-col gap-1.5">
        {[...sides]
          .sort((a, b) => state.totals[b] - state.totals[a])
          .map((side, i) => (
            <li
              key={side}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-bold animate-in fade-in slide-in-from-bottom-2',
                state.totals[side] === max ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground',
              )}
              style={{ animationDelay: `${300 + i * 120}ms`, animationFillMode: 'both' }}
            >
              <span className="min-w-0 truncate text-left">
                {label(side)}
                {side === mine && <span className="ml-1 text-xs font-semibold opacity-75">(sen)</span>}
              </span>
              <span className="font-display text-lg font-black tabular-nums">{state.totals[side]}</span>
            </li>
          ))}
      </ol>
    </div>
  )
}

function HandSummary({
  result,
  sides,
  label,
  mySide,
  totals,
  onClose,
}: {
  result: PistiHandResult
  sides: number[]
  label: (side: number) => string
  mySide: number
  totals: number[]
  onClose: () => void
}) {
  const rows: { name: string; get: (i: number) => string; hint?: (i: number) => boolean }[] = [
    { name: 'Kart', get: (i) => `${result.cards[i]}${result.majority[i] ? ' (+3)' : ''}`, hint: (i) => result.majority[i] > 0 },
    { name: 'As, Vale, ♣2, ♦10', get: (i) => `+${result.cardPoints[i]}` },
    { name: 'Pişti', get: (i) => `+${result.pisti[i]}`, hint: (i) => result.pisti[i] > 0 },
  ]
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 p-3 backdrop-blur-sm" role="dialog" aria-label={`${result.hand}. el sonucu`}>
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-2xl" style={{ animation: 'pisti-burst 520ms cubic-bezier(0.2,1.4,0.4,1) both' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-foreground">{result.hand}. el bitti</h3>
          <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-full bg-secondary text-foreground" aria-label="Kapat">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-x-2 gap-y-1.5 text-sm" style={{ gridTemplateColumns: `minmax(0,1.3fr) repeat(${sides.length}, minmax(0,1fr))` }}>
          <span />
          {sides.map((i) => (
            <span key={i} className={cn('truncate text-center text-xs font-bold', i === mySide ? 'text-gold' : 'text-muted-foreground')}>
              {label(i)}
            </span>
          ))}
          {rows.map((row) => (
            <div key={row.name} className="contents">
              <span className="truncate text-xs text-muted-foreground">{row.name}</span>
              {sides.map((i) => (
                <span key={i} className={cn('rounded-md bg-secondary py-1 text-center font-bold tabular-nums', row.hint?.(i) ? 'text-gold' : 'text-foreground')}>
                  {row.get(i)}
                </span>
              ))}
            </div>
          ))}
          <span className="text-xs font-bold text-foreground">El puanı</span>
          {sides.map((i) => (
            <span key={i} className="rounded-md bg-primary py-1 text-center font-bold tabular-nums text-primary-foreground">
              {result.total[i]}
            </span>
          ))}
          <span className="text-xs font-bold text-foreground">Toplam</span>
          {sides.map((i) => (
            <span key={i} className="rounded-md bg-gold py-1 text-center font-display text-base font-black tabular-nums text-gold-foreground">
              {totals[i]}
            </span>
          ))}
        </div>
        <p className="text-center text-[11px] text-muted-foreground">Yeni el dağıtılıyor{'…'} {RANK_LABEL(11)} her zaman yeri alır.</p>
      </div>
    </div>
  )
}
