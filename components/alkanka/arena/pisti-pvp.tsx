'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Bot, Eye, Layers, Scissors, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { playSound } from '@/lib/sound'
import { RANK_LABEL, SUIT_SYMBOLS, sideOf, type PCard, type PistiEvent, type PistiHandResult, type PistiView } from '@/lib/games/pisti'
import { BatakCard } from './batak-card'
import type { Remote } from './remote'
import { TableBrand } from './table-brand'
import { FixedStage } from './fixed-stage'
import { MobileTableChat } from './mobile-table-chat'
import { ThemeDecor, themeSurfaceProps, useTableTheme } from './table-theme'

type Place = 'bottom' | 'top' | 'left' | 'right'

/**
 * Like Batak, the table is composed once on a fixed 1100×550 canvas and scaled as a whole (see FixedStage),
 * so phones, tablets and desktops all see the same picture. Positions below are design pixels.
 */
const STAGE_W = 1100
const STAGE_H = 550
const PILE_X = 550
const PILE_Y = 226

/** Where a card flies in from (and is swept back to), relative to the pile, in design pixels. */
const FLY: Record<Place, [string, string]> = {
  bottom: ['0px', '250px'],
  top: ['0px', '-200px'],
  left: ['-420px', '0px'],
  right: ['420px', '0px'],
}

const SEAT_POS: Record<Exclude<Place, 'bottom'>, string> = {
  top: 'left-1/2 top-3 -translate-x-1/2',
  left: 'left-[88px] top-[226px] -translate-x-1/2 -translate-y-1/2',
  right: 'left-[1012px] top-[226px] -translate-x-1/2 -translate-y-1/2',
}

const EVENT_MS: Record<PistiEvent['kind'], number> = { drop: 900, capture: 1500, pisti: 2500, jpisti: 2800, sweep: 1600, deal: 900, hand: 900, cut: 1400 }

function CardBack({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span className={cn('card-back block shrink-0 rounded-md', className)} style={style} aria-hidden="true" />
}

const shortCard = (c: PCard) => `${SUIT_SYMBOLS[c.s]}${RANK_LABEL(c.r)}`

/** Small stack of face-down cards showing how many cards a side has taken this hand. */
function CapturedStack({ count, majority, label }: { count: number; majority: boolean; label: string }) {
  if (!count) return null
  const layers = Math.min(4, Math.ceil(count / 6))
  return (
    <span className="flex items-center gap-1.5" aria-label={`${label}: ${count} kart topladı`}>
      <span className="relative h-9 w-6" aria-hidden="true">
        {Array.from({ length: layers }, (_, i) => (
          <CardBack key={i} className="absolute inset-0 size-full rounded-[4px]" style={{ transform: `translate(${i * 2}px, ${-i * 2}px)` }} />
        ))}
      </span>
      <span className={cn('rounded-full px-2 text-[13px] font-bold tabular-nums leading-5', majority ? 'bg-gold text-gold-foreground' : 'bg-background/85 text-foreground')}>{count}</span>
    </span>
  )
}

export function PistiPvp({ remote }: { remote: Remote<PistiView> }) {
  const s = remote.state
  const n = s.seats
  const me = remote.spectator ? -1 : remote.seat
  const base = me >= 0 ? me : 0
  const mySide = sideOf(s, base)
  const { theme: tableTheme } = useTableTheme('pisti')

  const nameOf = (seat: number) => (seat === me ? 'Sen' : (remote.names[seat] ?? `Oyuncu ${seat + 1}`))
  const sideLabel = (side: number) => {
    if (s.team) return side === mySide ? (me >= 0 ? 'Biz' : 'Takım A') : me >= 0 ? 'Onlar' : 'Takım B'
    return nameOf(side)
  }

  // Play goes seat + 1, so the next player sits on my right.
  const places: { seat: number; place: Exclude<Place, 'bottom'> }[] =
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
    else if (head.kind === 'drop') playSound('card')
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

  // The summary waits for "Devam"; it only closes on its own if the player walks away.
  useEffect(() => {
    if (!summary) return
    const t = setTimeout(() => setSummary(null), 20000)
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
  const showPileInfo = !current && s.pileCount > 0

  const myTurn = remote.myTurn && !replaying && !finished
  const hand = me >= 0 ? s.hand : []
  const captures = (c: PCard) => s.pileTop != null && (c.r === s.pileTop.r || c.r === 11)
  const makesPisti = (c: PCard) => s.pileCount === 1 && s.pileTop != null && c.r === s.pileTop.r

  const prompt = finished
    ? iWon
      ? 'Kazandın!'
      : 'Oyun bitti'
    : replaying
      ? `${current && current.seat >= 0 && current.kind !== 'deal' && current.kind !== 'hand' && current.kind !== 'cut' ? nameOf(current.seat) + ' oynuyor' : 'Kartlar dağıtılıyor'}`
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
  const majorityLive = s.majorityLive ?? sides.map(() => 0)

  const Seat = ({ seat, place }: { seat: number; place: Exclude<Place, 'bottom'> }) => {
    const active = !replaying && s.turn === seat && !finished
    const acting = current?.seat === seat && current.kind !== 'deal' && current.kind !== 'hand'
    const count = s.handCounts[seat] ?? 0
    const side = sideOf(s, seat)
    const partner = s.team && side === mySide && me >= 0
    const top = place === 'top'
    // In teams both partners share one pile; it sits with the first seat of the side shown.
    const showsPile = !s.team || (side !== mySide && places.find((p) => sideOf(s, p.seat) === side)?.seat === seat)
    return (
      <div className={cn('absolute z-10 flex items-center', top ? 'flex-row gap-3' : 'flex-col gap-2', SEAT_POS[place])}>
        <div
          data-turn={active || undefined}
          className={cn(
            'bt-ava flex size-14 shrink-0 items-center justify-center rounded-full font-display text-xl font-bold text-foreground ring-2 transition',
            active || acting ? 'ring-gold' : partner ? 'ring-gold/50' : 'ring-border',
          )}
        >
          {s.bots.includes(seat) ? <Bot className="size-6 text-muted-foreground" aria-label="Bot" /> : nameOf(seat).charAt(0).toUpperCase()}
        </div>
        <div
          data-turn={active || undefined}
          className={cn('bt-plate flex flex-col rounded-2xl px-3 py-1.5 text-foreground', top ? 'max-w-44' : 'w-36 items-center text-center')}
        >
          <span className="w-full truncate text-[16px] font-bold leading-tight">{nameOf(seat)}</span>
          <span className={cn('text-[13px] leading-tight', active ? 'font-semibold text-gold' : 'text-muted-foreground')}>
            {active ? 'Düşünüyor' : partner ? 'Eşin' : 'Rakip'}
          </span>
        </div>
        <div className={cn('flex', top ? 'gap-1' : 'gap-1')} aria-label={`${nameOf(seat)} elinde ${count} kart`}>
          {Array.from({ length: count }, (_, i) => (
            <CardBack key={i} className={top ? 'h-11 w-8' : 'h-9 w-[26px]'} />
          ))}
        </div>
        {showsPile && <CapturedStack count={s.capturedCounts[side] ?? 0} majority={majorityLive[side] > 0} label={sideLabel(side)} />}
      </div>
    )
  }

  const flying = current?.card && current.kind !== 'deal' && current.kind !== 'cut' ? current : null
  const flyFrom = flying ? FLY[placeOf(flying.seat)] : FLY.bottom
  const sweepTo = flying && flying.kind !== 'drop' ? FLY[placeOf(flying.seat)] : null
  const isBurst = current && (current.kind === 'pisti' || current.kind === 'jpisti')

  return (
    <div data-ls-main="full" className="flex min-w-0 flex-col gap-3">
      {remote.spectator && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <Eye className="size-4 text-primary" aria-hidden="true" /> Masayı izliyorsun. Eller gizli, yere atılan kartlar canlı görünür.
        </p>
      )}

      <section aria-label="Pişti masası" className="bt-stage w-full overflow-hidden rounded-[1.75rem] border border-border" {...themeSurfaceProps(tableTheme)}>
        {/* On desktop the stage is capped by the window height; inside the fullscreen layer LandscapeFit sizes it. */}
        <FixedStage width={STAGE_W} height={STAGE_H} className="max-w-[calc((100dvh-15rem)*2)] [.ls-split_&]:max-w-none">
          {remote.id && <MobileTableChat tableId={remote.id} placement="table" />}
          <div className="bt-rim absolute left-[170px] top-[78px] h-[296px] w-[760px] rounded-[3rem] p-2.5" aria-hidden="true">
            <div className="bt-felt pt-felt relative size-full overflow-hidden rounded-[2.5rem]">
              <TableBrand plaque={false} corners={false} jako={false} className="[&_.tb-word]:hidden" />
              <ThemeDecor theme={tableTheme} />
            </div>
          </div>

          {places.map((p) => (
            <Seat key={p.seat} seat={p.seat} place={p.place} />
          ))}

          {/* Deck + cut card */}
          <div className="absolute left-[275px] top-[226px] z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
            {s.deckCount > 0 ? (
              <div className="relative h-[98px] w-[70px]">
                {[2, 1, 0].map((i) => (
                  <CardBack key={i} className="absolute inset-0 size-full" style={{ transform: `translate(${i * 2}px, ${-i * 2}px)` }} />
                ))}
              </div>
            ) : (
              <span className="flex h-[98px] w-[70px] items-center justify-center rounded-md border border-dashed border-foreground/20">
                <Layers className="size-5 text-foreground/30" aria-hidden="true" />
              </span>
            )}
            <span className="rounded-full bg-background/85 px-2.5 text-[13px] font-bold tabular-nums leading-6 text-foreground">Deste {s.deckCount}</span>
            {s.cutCard && s.deckCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-background/85 px-2.5 text-[13px] font-bold leading-6 text-foreground" title="Deste kesildi, alttaki kart son elde dağıtana gider">
                <Scissors className="size-3.5 text-muted-foreground" aria-hidden="true" />
                Alt <span className={cn(s.cutCard.s === 1 || s.cutCard.s === 2 ? 'text-destructive' : 'text-foreground')}>{shortCard(s.cutCard)}</span>
              </span>
            )}
          </div>

          {/* Pile */}
          <div className="absolute z-0 size-0 [--cw:78px]" style={{ left: PILE_X, top: PILE_Y }}>
            {pileCount === 0 && !flying && (
              <span className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-display text-[15px] font-bold uppercase tracking-[0.3em] text-foreground/30">
                Yer boş
              </span>
            )}
            {Array.from({ length: Math.min(4, pileHidden) }, (_, i) => (
              <CardBack
                key={`h${i}`}
                className="absolute aspect-[5/7] w-[var(--cw)] -translate-x-1/2 -translate-y-1/2"
                style={{ rotate: `${(i - 1.5) * 7}deg`, translate: `${(i - 1.5) * 3}px 0` }}
              />
            ))}
            {pileFan.map((c, i) => {
              const isTop = i === pileFan.length - 1
              if (isTop && flying?.kind === 'drop') return null
              return (
                <div key={`${c.s}-${c.r}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ zIndex: i + 5, rotate: `${(i - pileFan.length + 1) * 9}deg` }}>
                  <BatakCard card={c} className={cn(isTop && 'ring-2 ring-gold/70')} />
                </div>
              )
            })}
            {showPileInfo && (
              <span className="absolute left-1/2 top-[66px] z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-background/85 px-3 text-[14px] font-bold tabular-nums leading-7 text-foreground shadow-sm">
                Yerde {s.pileCount} kart
                <span className={cn(s.pileVisiblePoints > 0 ? 'text-gold' : 'text-muted-foreground')}>
                  {' · '}
                  {s.pileVisiblePoints}
                  {s.pileHidden > 0 ? '+' : ''} puan
                </span>
              </span>
            )}
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
                        ? `pisti-fly 420ms cubic-bezier(0.2,0.8,0.2,1) both, pisti-sweep 560ms ease-in ${isBurst ? 1600 : 900}ms forwards`
                        : 'pisti-fly 420ms cubic-bezier(0.2,0.8,0.2,1) both',
                    } as CSSProperties
                  }
                >
                  <BatakCard card={flying.card!} className="shadow-xl" />
                  {flying.taken > 1 && (
                    <span className="absolute -right-3 -top-3 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold tabular-nums text-primary-foreground ring-2 ring-background">
                      {flying.taken}
                    </span>
                  )}
                </div>
                {flying.points > 0 && !isBurst && (
                  <span
                    className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-2.5 py-0.5 text-sm font-bold tabular-nums text-gold-foreground"
                    style={{ animation: 'pisti-float 1100ms ease-out 350ms both' }}
                  >
                    +{flying.points}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Event line + prompt, on the right side of the felt */}
          <div className="absolute left-[805px] top-[226px] z-20 flex w-[220px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center">
            <p
              key={lastEvent?.seq ?? 0}
              className={cn('animate-rise line-clamp-3 max-w-full text-balance rounded-2xl px-3 py-1.5 text-[14px] font-bold leading-snug shadow-sm', eventTone(lastEvent))}
              aria-live="polite"
            >
              {eventText(lastEvent)}
            </p>
            <p className={cn('line-clamp-2 max-w-full text-balance rounded-2xl px-3 py-1 text-[13px] font-semibold leading-snug', myTurn ? 'bg-gold text-gold-foreground' : 'bg-background/70 text-muted-foreground')}>
              {prompt}
            </p>
          </div>

          {/* Scoreboard */}
          <div className="absolute bottom-4 right-4 z-20 flex w-[260px] flex-col gap-1.5" aria-label="Skor">
            <div className="bt-plate flex items-center justify-between rounded-xl px-3 py-1 text-[13px] font-semibold text-muted-foreground">
              <span>
                Hedef <span className="font-display text-base font-black tabular-nums text-foreground">{s.target}</span>
              </span>
              <span className="tabular-nums">{s.handNo}. el</span>
            </div>
            {sides.map((side) => {
              const live = (s.capturedPoints[side] ?? 0) + (s.pistiPts[side] ?? 0) + (majorityLive[side] ?? 0)
              const shown = s.totals[side] + live
              const pct = Math.min(100, (shown / s.target) * 100)
              const mine = side === mySide && me >= 0
              const lead = finished && side === winnerSide
              return (
                <div
                  key={side}
                  className={cn('flex flex-col gap-1 rounded-xl px-3 py-1.5', lead ? 'border border-gold bg-gold text-gold-foreground' : 'bt-plate text-foreground', mine && !lead && 'ring-1 ring-gold/60')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-bold leading-tight">
                      <span className="truncate">{sideLabel(side)}</span>
                      {majorityLive[side] > 0 && !lead && (
                        <span className="shrink-0 rounded-full bg-gold px-1.5 text-[11px] font-black text-gold-foreground" title="En çok kart sende, el sonunda +3">
                          +3
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      <span className={cn('text-[12px] tabular-nums', lead ? 'text-gold-foreground/80' : 'text-muted-foreground')}>
                        {s.capturedCounts[side] ?? 0} kart
                        {(s.pistiCount[side] ?? 0) > 0 && <span className={cn('font-bold', !lead && 'text-gold')}> · {s.pistiCount[side]} pişti</span>}
                      </span>
                      <span key={shown} className="animate-pop font-display text-xl font-black tabular-nums leading-none" aria-label={`${sideLabel(side)} ${shown} puan`}>
                        {shown}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-gold transition-[width] duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* My plate + my side's captured pile */}
          <div className="absolute bottom-5 left-5 z-20 flex items-center gap-3">
            <div data-turn={myTurn || undefined} className="bt-plate flex flex-col rounded-2xl px-3 py-1.5 text-foreground">
              <span className="max-w-40 truncate text-[16px] font-bold leading-tight">{me >= 0 ? (s.team ? `Sen · ${sideLabel(mySide)}` : 'Sen') : nameOf(base)}</span>
              <span className={cn('text-[13px] leading-tight', myTurn ? 'font-semibold text-gold' : 'text-muted-foreground')}>
                {me < 0 ? 'İzleyici modu' : myTurn ? 'Sıra sende' : 'Bekliyor'}
              </span>
            </div>
            <CapturedStack count={s.capturedCounts[mySide] ?? 0} majority={majorityLive[mySide] > 0} label={sideLabel(mySide)} />
          </div>

          {/* My hand */}
          <div className="absolute bottom-0 left-1/2 z-20 flex -translate-x-1/2 items-end justify-center gap-3 pb-4 [--cw:92px]" aria-label="Elindeki kartlar">
            {hand.map((c, i) => {
              const take = captures(c)
              const pisti = makesPisti(c)
              return (
                <div
                  key={`${c.s}-${c.r}`}
                  className={cn('relative flex flex-col items-center transition-transform duration-200', myTurn && (pisti || take) && '-translate-y-2')}
                  style={{ animation: `card-deal 380ms ease-out ${i * 70}ms both` }}
                >
                  {myTurn && (pisti || take) && (
                    <span className={cn('absolute -top-7 z-10 whitespace-nowrap rounded-full px-2 text-[13px] font-bold leading-6', pisti ? 'bg-gold text-gold-foreground' : 'bg-primary text-primary-foreground')}>
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

          {/* Pişti burst */}
          {isBurst && (
            <div key={`b${current.seq}`} className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/20" aria-hidden="true">
              <div className="flex flex-col items-center gap-3" style={{ animation: 'pisti-burst 600ms cubic-bezier(0.2,1.4,0.4,1) both' }}>
                <span className="flex items-center gap-3 rounded-3xl bg-gold px-8 py-3 font-display text-7xl font-black uppercase tracking-wide text-gold-foreground shadow-2xl ring-4 ring-background/60">
                  <Sparkles className="size-12" aria-hidden="true" />
                  {current.kind === 'jpisti' ? 'Vale Pişti' : 'Pişti'}
                </span>
                <span className="rounded-full bg-background/95 px-5 py-1.5 font-display text-2xl font-black tabular-nums text-foreground">
                  {nameOf(current.seat)} · +{current.kind === 'jpisti' ? 20 : 10}
                </span>
              </div>
            </div>
          )}

          {/* Hand summary */}
          {summary && !finished && (
            <HandSummary result={summary} sides={sides} label={sideLabel} mySide={me >= 0 ? mySide : -1} totals={s.totals} target={s.target} team={s.team} onClose={() => setSummary(null)} />
          )}
        </FixedStage>
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
  target,
  team,
  onClose,
}: {
  result: PistiHandResult
  sides: number[]
  label: (side: number) => string
  mySide: number
  totals: number[]
  target: number
  team: boolean
  onClose: () => void
}) {
  const best = Math.max(...result.total)
  const handWinners = sides.filter((i) => result.total[i] === best)
  const tieCards = result.majority.every((m) => m === 0)
  const ordered = [...sides].sort((a, b) => result.total[b] - result.total[a])
  const scoreLine = ordered.map((i) => result.total[i]).join('–')
  const totalLine = ordered.map((i) => totals[i]).join('–')
  const verb = (i: number) => (label(i) === 'Sen' || label(i) === 'Biz' ? (team ? 'kazandık' : 'kazandın') : 'kazandı')
  const headline =
    handWinners.length > 1
      ? `Bu el berabere bitti · ${scoreLine}`
      : `${label(handWinners[0])} bu eli ${scoreLine} ${verb(handWinners[0])}`

  const rows: { name: string; get: (i: number) => string; hint?: (i: number) => boolean }[] = [
    { name: 'Kart', get: (i) => `${result.cards[i]}${result.majority[i] ? ' (+3)' : ''}`, hint: (i) => result.majority[i] > 0 },
    { name: 'As, Vale, ♣2, ♦10', get: (i) => `+${result.cardPoints[i]}` },
    { name: 'Pişti', get: (i) => `+${result.pisti[i]}`, hint: (i) => result.pisti[i] > 0 },
  ]
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/50 p-3 backdrop-blur-[2px]" role="dialog" aria-label={`${result.hand}. el sonucu`}>
      <div className="flex w-full max-w-md flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-2xl sm:p-5" style={{ animation: 'pisti-burst 520ms cubic-bezier(0.2,1.4,0.4,1) both' }}>
        <div className="flex flex-col gap-1 text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{result.hand}. el bitti</span>
          <h3 className="text-balance font-display text-xl font-black leading-tight text-foreground sm:text-2xl">{headline}</h3>
          <p className="text-sm font-semibold tabular-nums text-muted-foreground">
            Toplam {totalLine} · Hedef {target}
          </p>
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
        {tieCards && <p className="text-center text-xs font-semibold text-muted-foreground">Kart sayısı eşit, en çok kart +3 puanı kimseye verilmedi.</p>}
        <button type="button" onClick={onClose} className="rounded-xl bg-primary py-2.5 font-display text-base font-bold text-primary-foreground transition-transform active:scale-[0.98]" autoFocus>
          Devam
        </button>
      </div>
    </div>
  )
}
