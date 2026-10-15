'use client'

import { useMemo } from 'react'
import { Bot, Crown, Eye, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { legalCards, mustBid, MIN_BID, RANK_LABEL, SUIT_NAMES, SUIT_SYMBOLS, type BatakView, type BCard } from '@/lib/games/batak'
import type { Remote } from './remote'

const RED = 'text-[oklch(0.55_0.2_25)]'
const BLACK = 'text-[oklch(0.18_0.01_260)]'
const isRed = (s: number) => s === 1 || s === 2

export function BatakCard({ card, onClick, disabled, playable, small }: { card: BCard; onClick?: () => void; disabled?: boolean; playable?: boolean; small?: boolean }) {
  const Comp = onClick ? 'button' : 'div'
  const color = isRed(card.s) ? RED : BLACK
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-label={`${SUIT_NAMES[card.s]} ${RANK_LABEL(card.r)}`}
      className={cn(
        'card-deal relative flex shrink-0 flex-col justify-between rounded-lg border border-border bg-[oklch(0.97_0.01_90)] p-1 shadow-md transition-transform',
        small ? 'h-16 w-11' : 'h-24 w-16 sm:h-28 sm:w-[4.5rem]',
        onClick && playable && 'hover:-translate-y-3 ring-2 ring-primary',
        onClick && !playable && 'opacity-45',
      )}
    >
      <span className={cn('font-display font-bold leading-none', small ? 'text-xs' : 'text-sm sm:text-base', color)}>
        {RANK_LABEL(card.r)}
        <span className="block">{SUIT_SYMBOLS[card.s]}</span>
      </span>
      <span className={cn('self-center leading-none', small ? 'text-lg' : 'text-3xl', color)} aria-hidden="true">
        {SUIT_SYMBOLS[card.s]}
      </span>
    </Comp>
  )
}

function CardBack({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-12 w-8 items-center justify-center rounded-md border border-primary/40 bg-secondary shadow', className)} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logos/fist.png" alt="" className="size-5 rounded-full object-cover" />
    </div>
  )
}

export function BatakPvp({ remote }: { remote: Remote<BatakView> }) {
  const s = remote.state
  const me = remote.spectator ? -1 : remote.seat
  const base = me >= 0 ? me : 0
  const myTurn = remote.myTurn
  const hand = useMemo(() => {
    const h = me >= 0 ? [...(s.hands[me] ?? [])] : []
    const order = [0, 1, 3, 2]
    return h.sort((a, b) => order[a.s] - order[b.s] || b.r - a.r)
  }, [s.hands, me])
  const legal = useMemo(
    () => (myTurn && s.phase === 'play' ? legalCards(hand, s.trick, s.trump, s.broken) : []),
    [myTurn, s.phase, hand, s.trick, s.trump, s.broken],
  )
  const isLegal = (c: BCard) => legal.some((l) => l.s === c.s && l.r === c.r)
  const nameOf = (seat: number) => (seat === me ? 'Sen' : remote.names[seat] ?? `Oyuncu ${seat + 1}`)

  // Seats arranged around the table relative to me: bottom, left, top, right.
  const pos = (offset: number) => (base + offset) % 4
  const trickBy = (seat: number) => s.trick.find((p) => p.seat === seat)?.card
  const minBid = Math.max(MIN_BID, s.highBid + 1)
  const forced = myTurn && s.phase === 'bid' && mustBid(s as never, me)

  const SeatBadge = ({ seat }: { seat: number }) => (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-xl border bg-card/90 px-3 py-1.5 text-center text-xs',
        s.turn === seat ? 'border-primary ring-2 ring-primary/40' : 'border-border',
      )}
    >
      <span className="flex max-w-28 items-center gap-1 truncate font-bold text-foreground">
        {s.bidder === seat && <Crown className="size-3.5 text-primary" aria-label="İhale sahibi" />}
        {s.bots.includes(seat) && <Bot className="size-3.5 text-muted-foreground" aria-label="Bot" />}
        <span className="truncate">{nameOf(seat)}</span>
      </span>
      <span className="tabular-nums text-muted-foreground">
        {s.phase === 'bid'
          ? s.passed[seat]
            ? 'Pas'
            : s.bids[seat]
              ? `İhale ${s.bids[seat]}`
              : 'Bekliyor'
          : `${s.taken[seat]} el${s.bidder === seat ? ` / ${s.highBid}` : ''}`}
      </span>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {remote.spectator && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <Eye className="size-4 text-primary" aria-hidden="true" /> Masayı izliyorsun. Eller gizli, ortaya atılan kartlar canlı görünür.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
        <span className="font-semibold text-foreground">
          {s.handNo}/{s.handsTotal}. el
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          Koz:
          {s.trump != null ? (
            <span className={cn('rounded-md bg-[oklch(0.97_0.01_90)] px-2 py-0.5 text-base font-bold', isRed(s.trump) ? RED : BLACK)}>
              {SUIT_SYMBOLS[s.trump]} {SUIT_NAMES[s.trump]}
            </span>
          ) : (
            <span className="font-semibold text-foreground">seçilmedi</span>
          )}
          {s.trump != null && <span className="text-xs">{s.broken ? '· koz kırıldı' : '· koz kırılmadı'}</span>}
        </span>
        <span className="text-muted-foreground">
          İhale: <span className="font-bold text-foreground">{s.bidder != null ? `${nameOf(s.bidder)} · ${s.highBid}` : s.highBid ? s.highBid : '-'}</span>
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-wood p-2 shadow-xl sm:p-3">
        <div className="relative grid min-h-96 grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] items-center gap-2 rounded-[2rem] bg-felt p-3 sm:p-6">
          <div className="col-start-2 row-start-1 flex flex-col items-center gap-2">
            <SeatBadge seat={pos(2)} />
            <div className="flex -space-x-5" aria-label={`${s.handCounts[pos(2)]} kart`}>
              {Array.from({ length: Math.min(13, s.handCounts[pos(2)]) }, (_, i) => (
                <CardBack key={i} />
              ))}
            </div>
          </div>
          <div className="col-start-1 row-start-2 flex flex-col items-center gap-2">
            <SeatBadge seat={pos(1)} />
            <span className="text-xs tabular-nums text-muted-foreground">{s.handCounts[pos(1)]} kart</span>
          </div>
          <div className="col-start-3 row-start-2 flex flex-col items-center gap-2">
            <SeatBadge seat={pos(3)} />
            <span className="text-xs tabular-nums text-muted-foreground">{s.handCounts[pos(3)]} kart</span>
          </div>

          <div className="col-start-2 row-start-2 grid grid-cols-3 grid-rows-3 place-items-center gap-1 justify-self-center">
            {[2, 1, 3, 0].map((off) => {
              const seat = pos(off)
              const card = trickBy(seat)
              const area = off === 2 ? 'col-start-2 row-start-1' : off === 1 ? 'col-start-1 row-start-2' : off === 3 ? 'col-start-3 row-start-2' : 'col-start-2 row-start-3'
              return (
                <div key={off} className={cn(area, 'flex h-24 w-16 items-center justify-center sm:h-28 sm:w-[4.5rem]')}>
                  {card ? <BatakCard card={card} /> : <span className="size-full rounded-lg border border-dashed border-border/50" />}
                </div>
              )
            })}
            <div className="col-start-2 row-start-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {s.trick.length ? `${s.trick.length}/4` : 'Orta'}
            </div>
          </div>

          <div className="col-span-3 row-start-3 flex flex-col items-center gap-2">
            <p className="text-center text-sm font-semibold text-foreground" aria-live="polite">
              {s.note && !myTurn
                ? s.note
                : myTurn
                  ? s.phase === 'bid'
                    ? forced
                      ? `Herkes pas geçti, en az ${MIN_BID} ile ihaleyi almalısın.`
                      : 'İhale sırası sende: artır ya da pas geç.'
                    : s.phase === 'trump'
                      ? 'İhale senin! Koz rengini seç.'
                      : 'Sıra sende, oynanabilir kartlar parlıyor.'
                  : `${nameOf(s.turn)} düşünüyor`}
            </p>
            {me >= 0 && <SeatBadge seat={me} />}
          </div>
        </div>
      </div>

      {myTurn && s.phase === 'bid' && (
        <div className="flex flex-col gap-2 rounded-2xl border border-primary bg-card p-3 sm:p-4">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">İhale ver (en az {minBid})</span>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 13 - minBid + 1 }, (_, i) => minBid + i).map((b) => (
              <button
                key={b}
                type="button"
                disabled={remote.busy}
                onClick={() => remote.send({ type: 'bid', amount: b })}
                className="min-w-11 rounded-lg border border-border px-3 py-2 text-sm font-bold tabular-nums text-foreground hover:border-primary hover:bg-secondary disabled:opacity-40"
              >
                {b}
              </button>
            ))}
            <button
              type="button"
              disabled={remote.busy || forced}
              onClick={() => remote.send({ type: 'bid', amount: 'pass' })}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-foreground disabled:opacity-40"
            >
              Pas
            </button>
          </div>
        </div>
      )}

      {myTurn && s.phase === 'trump' && (
        <div className="flex flex-col gap-2 rounded-2xl border border-primary bg-card p-3 sm:p-4">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Koz seç</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((suit) => (
              <button
                key={suit}
                type="button"
                disabled={remote.busy}
                onClick={() => remote.send({ type: 'trump', suit })}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-[oklch(0.97_0.01_90)] px-3 py-3 font-bold hover:ring-2 hover:ring-primary disabled:opacity-40"
              >
                <span className={cn('text-2xl leading-none', isRed(suit) ? RED : BLACK)}>{SUIT_SYMBOLS[suit]}</span>
                <span className={cn('text-sm', isRed(suit) ? RED : BLACK)}>
                  {SUIT_NAMES[suit]} ({hand.filter((c) => c.s === suit).length})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {me >= 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card p-3 pt-5 sm:p-4 sm:pt-6">
          <div className="flex min-w-max justify-center -space-x-4 sm:-space-x-3">
            {hand.map((c) => {
              const ok = isLegal(c)
              return (
                <BatakCard
                  key={`${c.s}-${c.r}`}
                  card={c}
                  playable={ok}
                  disabled={!ok || remote.busy}
                  onClick={myTurn && s.phase === 'play' ? () => remote.send({ type: 'play', s: c.s, r: c.r }) : undefined}
                />
              )
            })}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <Trophy className="size-4 text-primary" aria-hidden="true" /> Puan tablosu
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-2 font-semibold">El</th>
                {[0, 1, 2, 3].map((i) => (
                  <th key={i} className="max-w-20 truncate py-1 pr-2 font-semibold">
                    {nameOf(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {s.results.map((r) => (
                <tr key={r.hand} className="border-t border-border">
                  <td className="py-1 pr-2 text-muted-foreground">{r.hand}</td>
                  {r.scores.map((sc, i) => (
                    <td key={i} className={cn('py-1 pr-2', sc < 0 ? 'font-bold text-destructive' : i === r.bidder ? 'font-bold text-primary' : 'text-foreground')}>
                      {sc}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-border font-bold">
                <td className="py-1 pr-2 text-muted-foreground">Toplam</td>
                {s.totals.map((t, i) => (
                  <td key={i} className="py-1 pr-2 text-foreground">
                    {t}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <h3 className="mb-2 text-sm font-bold text-foreground">Son el</h3>
          {s.lastTrick ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {s.lastTrick.map((p) => (
                  <div key={p.seat} className="flex flex-col items-center gap-1">
                    <BatakCard card={p.card} small />
                    <span className={cn('max-w-14 truncate text-[10px]', p.seat === s.lastWinner ? 'font-bold text-primary' : 'text-muted-foreground')}>{nameOf(p.seat)}</span>
                  </div>
                ))}
              </div>
              {s.lastWinner != null && <p className="text-xs text-muted-foreground">Eli {nameOf(s.lastWinner)} aldı.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Henüz el oynanmadı.</p>
          )}
        </div>
      </div>
    </div>
  )
}
