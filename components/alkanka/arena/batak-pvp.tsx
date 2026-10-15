'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { Bot, ChevronDown, Crown, Eye, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BURY_COUNT,
  legalCards,
  minBidFor,
  mustBid,
  RANK_LABEL,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  tricksPerHand,
  variantLabel,
  type BatakState,
  type BatakView,
  type BCard,
} from '@/lib/games/batak'
import type { Remote } from './remote'

const isRed = (s: number) => s === 1 || s === 2
const suitColor = (s: number) => (isRed(s) ? 'text-tile-red' : 'text-tile-black')
const sameCard = (a: BCard, b: BCard) => a.s === b.s && a.r === b.r
const SUIT_ORDER = [0, 1, 3, 2]

export function BatakCard({
  card,
  onClick,
  disabled,
  playable,
  dim,
  selected,
  size = 'md',
  className,
  style,
}: {
  card: BCard
  onClick?: () => void
  disabled?: boolean
  playable?: boolean
  dim?: boolean
  selected?: boolean
  size?: 'xs' | 'sm' | 'md'
  className?: string
  style?: CSSProperties
}) {
  const Comp = onClick ? 'button' : 'div'
  const color = suitColor(card.s)
  const label = RANK_LABEL(card.r)
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-label={`${SUIT_NAMES[card.s]} ${label}`}
      aria-pressed={selected}
      style={style}
      className={cn(
        'playing-card relative shrink-0 select-none rounded-md font-display transition-transform duration-150',
        size === 'xs' && 'h-10 w-7 rounded-sm',
        size === 'sm' && 'h-[4.4rem] w-[3.15rem] sm:h-[5.6rem] sm:w-16',
        size === 'md' && 'aspect-[5/7] w-[var(--cw)]',
        playable && 'ring-2 ring-gold hover:-translate-y-3 focus-visible:-translate-y-3',
        selected && '-translate-y-4 ring-2 ring-accent',
        dim && 'brightness-[0.55]',
        className,
      )}
    >
      <span className={cn('absolute left-1 top-0.5 flex flex-col items-center font-bold leading-none', color, size === 'xs' ? 'text-[10px]' : 'text-sm sm:text-base')}>
        {label}
        <span className={size === 'xs' ? 'text-[9px]' : 'text-xs sm:text-sm'} aria-hidden="true">
          {SUIT_SYMBOLS[card.s]}
        </span>
      </span>
      {size !== 'xs' && (
        <>
          <span className={cn('absolute inset-0 flex items-center justify-center text-2xl leading-none sm:text-4xl', color)} aria-hidden="true">
            {SUIT_SYMBOLS[card.s]}
          </span>
          <span className={cn('absolute bottom-0.5 right-1 flex rotate-180 flex-col items-center text-sm font-bold leading-none sm:text-base', color)} aria-hidden="true">
            {label}
            <span className="text-xs sm:text-sm">{SUIT_SYMBOLS[card.s]}</span>
          </span>
        </>
      )}
    </Comp>
  )
}

function BackFan({ count }: { count: number }) {
  const shown = Math.min(5, count)
  if (!count) return null
  return (
    <div className="relative flex h-8 w-12 items-end justify-center" aria-label={`${count} kart`}>
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className="card-back absolute bottom-0 h-8 w-6 origin-bottom rounded-sm"
          style={{ transform: `rotate(${(i - (shown - 1) / 2) * 12}deg)` }}
          aria-hidden="true"
        />
      ))}
      <span className="absolute -right-1 -top-1 z-10 rounded-full bg-background px-1.5 text-[10px] font-bold tabular-nums text-foreground ring-1 ring-border">{count}</span>
    </div>
  )
}

export function BatakPvp({ remote }: { remote: Remote<BatakView> }) {
  const s = remote.state
  const n = s.seats ?? 4
  const variant = s.variant ?? 'klasik'
  const me = remote.spectator ? -1 : remote.seat
  const base = me >= 0 ? me : 0
  const myTurn = remote.myTurn
  const [buryPick, setBuryPick] = useState<BCard[]>([])
  const [showScores, setShowScores] = useState(false)

  const hand = useMemo(() => {
    const h = me >= 0 ? [...(s.hands[me] ?? [])] : []
    return h.sort((a, b) => SUIT_ORDER[a.s] - SUIT_ORDER[b.s] || b.r - a.r)
  }, [s.hands, me])
  const legal = useMemo(
    () => (myTurn && s.phase === 'play' ? legalCards(hand, s.trick, s.trump, s.broken) : []),
    [myTurn, s.phase, hand, s.trick, s.trump, s.broken],
  )
  const isLegal = (c: BCard) => legal.some((l) => sameCard(l, c))
  const nameOf = (seat: number) => (seat === me ? 'Sen' : remote.names[seat] ?? `Oyuncu ${seat + 1}`)
  const isTeam = variant === 'esli'
  const teamName = (seat: number) => (seat % 2 === base % 2 ? 'Biz' : 'Onlar')

  // Play runs counter-clockwise: the next seat sits on my right.
  const places: { seat: number; place: 'top' | 'left' | 'right' }[] =
    n === 3
      ? [
          { seat: (base + 1) % 3, place: 'right' },
          { seat: (base + 2) % 3, place: 'left' },
        ]
      : [
          { seat: (base + 1) % 4, place: 'right' },
          { seat: (base + 2) % 4, place: 'top' },
          { seat: (base + 3) % 4, place: 'left' },
        ]
  const placeOf = (seat: number) => (seat === base ? 'bottom' : places.find((p) => p.seat === seat)!.place)

  const maxTricks = tricksPerHand({ seats: n })
  const minBid = Math.max(minBidFor(variant), s.highBid + 1)
  const forced = myTurn && s.phase === 'bid' && mustBid(s as unknown as BatakState, me)
  const ranking = useMemo(() => [...s.totals.keys()].sort((a, b) => s.totals[b] - s.totals[a]), [s.totals])

  const statusOf = (seat: number) => {
    if (s.phase === 'bid') return s.passed[seat] ? 'Pas' : s.bids[seat] ? `İhale ${s.bids[seat]}` : s.turn === seat ? 'Düşünüyor' : '—'
    if (s.phase === 'predict') return s.bids[seat] != null ? `Tahmin ${s.bids[seat]}` : s.turn === seat ? 'Düşünüyor' : '—'
    const goal = variant === 'koz-maca' ? s.bids[seat] : s.bidder === seat ? s.highBid : null
    return `${s.taken[seat]}${goal != null ? `/${goal}` : ''} el`
  }

  const prompt = myTurn
    ? s.phase === 'bid'
      ? forced
        ? `Herkes pas geçti, en az ${minBidFor(variant)} ile ihaleyi almalısın.`
        : 'İhale sırası sende'
      : s.phase === 'predict'
        ? 'Kaç el alacağını tahmin et'
        : s.phase === 'bury'
          ? `Gömmek için ${BURY_COUNT} kart seç`
          : s.phase === 'trump'
            ? 'İhale senin! Kozu seç'
            : s.trick.length
              ? 'Sıra sende, parlayan kartlardan birini at'
              : 'Sıra sende, ilk kartı sen atıyorsun'
    : s.note || `${nameOf(s.turn)} düşünüyor`

  const Seat = ({ seat, place }: { seat: number; place: 'top' | 'left' | 'right' }) => {
    const active = s.turn === seat
    const open = s.openSeat === seat && seat !== me ? s.hands[seat] : []
    return (
      <div
        className={cn(
          'absolute z-10 flex flex-col items-center gap-1',
          place === 'top' && 'left-1/2 top-2 -translate-x-1/2',
          place === 'left' && 'left-1.5 top-1/2 -translate-y-1/2 sm:left-4',
          place === 'right' && 'right-1.5 top-1/2 -translate-y-1/2 sm:right-4',
          n === 3 && place !== 'top' && 'top-[38%]',
        )}
      >
        <div className="relative">
          <div
            className={cn(
              'flex size-11 items-center justify-center rounded-full bg-background/80 font-display text-base font-bold text-foreground ring-2 transition sm:size-14 sm:text-lg',
              active ? 'ring-gold shadow-[0_0_18px_-2px_var(--gold)]' : 'ring-border',
            )}
          >
            {s.bots.includes(seat) ? <Bot className="size-5 text-muted-foreground" aria-label="Bot" /> : nameOf(seat).charAt(0).toUpperCase()}
          </div>
          {s.bidder === seat && (
            <span className="absolute -left-1 -top-1 flex size-5 items-center justify-center rounded-full bg-gold text-gold-foreground">
              <Crown className="size-3" aria-label="İhale sahibi" />
            </span>
          )}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 sm:hidden">
            <span className="rounded-full bg-background px-1.5 text-[10px] font-bold tabular-nums text-foreground ring-1 ring-border">{s.handCounts[seat]}</span>
          </div>
        </div>
        <div className={cn('flex min-w-0 max-w-24 flex-col items-center rounded-lg px-2 py-0.5 text-center sm:max-w-32', active ? 'bg-gold text-gold-foreground' : 'bg-background/75 text-foreground')}>
          <span className="w-full truncate text-[11px] font-bold leading-tight sm:text-xs">{nameOf(seat)}</span>
          <span className={cn('text-[10px] tabular-nums leading-tight sm:text-[11px]', active ? 'text-gold-foreground/80' : 'text-muted-foreground')}>
            {isTeam ? `${teamName(seat)} · ` : ''}
            {statusOf(seat)}
          </span>
        </div>
        <div className="hidden sm:block">
          <BackFan count={open.length ? 0 : s.handCounts[seat]} />
        </div>
        {open.length > 0 && (
          <div className="flex max-w-[11rem] flex-wrap justify-center -space-x-3 sm:max-w-none" aria-label={`${nameOf(seat)} açık eli`}>
            {[...open]
              .sort((a, b) => SUIT_ORDER[a.s] - SUIT_ORDER[b.s] || b.r - a.r)
              .map((c) => (
                <BatakCard key={`${c.s}-${c.r}`} card={c} size="xs" />
              ))}
          </div>
        )}
      </div>
    )
  }

  const trickOffset: Record<string, string> = {
    bottom: 'translate-y-[38%] rotate-[3deg]',
    top: '-translate-y-[38%] -rotate-[4deg]',
    left: '-translate-x-[62%] -rotate-[10deg]',
    right: 'translate-x-[62%] rotate-[9deg]',
  }
  const shownTrick = s.trick

  const sendBury = async () => {
    if (buryPick.length !== BURY_COUNT) return
    const ok = await remote.send({ type: 'bury', cards: buryPick })
    if (ok) setBuryPick([])
  }
  const toggleBury = (c: BCard) =>
    setBuryPick((p) => (p.some((x) => sameCard(x, c)) ? p.filter((x) => !sameCard(x, c)) : p.length < BURY_COUNT ? [...p, c] : p))

  const handCount = hand.length
  const mid = (handCount - 1) / 2

  return (
    <div className="flex flex-col gap-3">
      {remote.spectator && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground">
          <Eye className="size-4 text-primary" aria-hidden="true" /> Masayı izliyorsun. Eller gizli, ortaya atılan kartlar canlı görünür.
        </p>
      )}

      <section aria-label="Batak masası" className="tavla-wood rounded-[1.75rem] p-1.5 sm:p-2.5">
        <div className="baize-table relative h-[22rem] overflow-hidden rounded-[1.4rem] sm:h-[28rem] lg:h-[31rem]">
          <div className="absolute inset-x-2 top-2 z-20 flex items-start justify-between gap-2 text-[11px] sm:inset-x-4 sm:top-3 sm:text-xs">
            <div className="flex flex-col gap-1">
              <span className="w-fit rounded-md bg-background/70 px-2 py-0.5 font-bold text-foreground">{variantLabel(variant)}</span>
              <span className="w-fit rounded-md bg-background/70 px-2 py-0.5 tabular-nums text-muted-foreground">
                El {s.handNo}/{s.handsTotal}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="flex items-center gap-1 rounded-md bg-background/70 px-2 py-0.5 text-muted-foreground">
                Koz
                {s.trump != null ? (
                  <span className={cn('playing-card rounded px-1.5 text-sm font-bold leading-5', suitColor(s.trump))}>{SUIT_SYMBOLS[s.trump]}</span>
                ) : (
                  <span className="font-semibold text-foreground">?</span>
                )}
              </span>
              {variant !== 'koz-maca' && (
                <span className="max-w-28 truncate rounded-md bg-background/70 px-2 py-0.5 text-muted-foreground sm:max-w-40">
                  İhale <span className="font-bold text-foreground">{s.bidder != null ? `${nameOf(s.bidder)} ${s.highBid}` : s.highBid || '-'}</span>
                </span>
              )}
            </div>
          </div>

          {places.map((p) => (
            <Seat key={p.seat} seat={p.seat} place={p.place} />
          ))}

          <div className="absolute left-1/2 top-[46%] z-0 size-0">
            {s.trick.length === 0 && (s.phase === 'play' || !myTurn) && (
              <span className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-display text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/25">
                Al Kanka
              </span>
            )}
            {shownTrick.map((p, i) => (
              <div key={p.seat} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ zIndex: i + 1 }}>
                <BatakCard card={p.card} size="sm" className={cn('animate-pop', trickOffset[placeOf(p.seat)])} />
              </div>
            ))}
          </div>

          <div className="absolute inset-x-2 bottom-2 z-20 flex flex-col items-center gap-2">
            <p
              className={cn(
                'max-w-full truncate rounded-full px-3 py-1 text-center text-xs font-semibold',
                myTurn ? 'bg-gold text-gold-foreground' : 'bg-background/70 text-foreground',
              )}
              aria-live="polite"
            >
              {prompt}
            </p>

            {myTurn && (s.phase === 'bid' || s.phase === 'predict') && (
              <div className="w-full max-w-md rounded-2xl bg-background/85 p-2 ring-1 ring-gold/40 backdrop-blur">
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from(
                    { length: s.phase === 'predict' ? maxTricks + 1 : maxTricks - minBid + 1 },
                    (_, i) => (s.phase === 'predict' ? i : minBid + i),
                  ).map((b) => (
                    <button
                      key={b}
                      type="button"
                      disabled={remote.busy}
                      onClick={() => remote.send({ type: s.phase === 'predict' ? 'predict' : 'bid', amount: b })}
                      className="h-9 rounded-lg bg-secondary text-sm font-bold tabular-nums text-foreground transition hover:bg-gold hover:text-gold-foreground disabled:opacity-40"
                    >
                      {b}
                    </button>
                  ))}
                  {s.phase === 'bid' && (
                    <button
                      type="button"
                      disabled={remote.busy || forced}
                      onClick={() => remote.send({ type: 'bid', amount: 'pass' })}
                      className="col-span-2 h-9 rounded-lg bg-destructive/90 text-sm font-bold text-foreground disabled:opacity-40"
                    >
                      Pas
                    </button>
                  )}
                </div>
              </div>
            )}

            {myTurn && s.phase === 'trump' && (
              <div className="grid w-full max-w-md grid-cols-4 gap-2 rounded-2xl bg-background/85 p-2 ring-1 ring-gold/40 backdrop-blur">
                {[0, 1, 2, 3].map((suit) => (
                  <button
                    key={suit}
                    type="button"
                    disabled={remote.busy}
                    onClick={() => remote.send({ type: 'trump', suit })}
                    className="playing-card flex flex-col items-center rounded-xl py-1.5 transition hover:-translate-y-1 disabled:opacity-40"
                  >
                    <span className={cn('text-2xl leading-none', suitColor(suit))}>{SUIT_SYMBOLS[suit]}</span>
                    <span className={cn('text-[11px] font-bold', suitColor(suit))}>
                      {SUIT_NAMES[suit]} · {hand.filter((c) => c.s === suit).length}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {myTurn && s.phase === 'bury' && (
              <button
                type="button"
                disabled={remote.busy || buryPick.length !== BURY_COUNT}
                onClick={sendBury}
                className="rounded-full bg-gold px-5 py-2 text-sm font-bold text-gold-foreground disabled:opacity-50"
              >
                Seçilenleri göm ({buryPick.length}/{BURY_COUNT})
              </button>
            )}
          </div>
        </div>

        {me >= 0 && (
          <div className="flex items-end gap-2 px-1 pb-1 pt-2 sm:px-3">
            <div className={cn('flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-center', s.turn === me ? 'bg-gold text-gold-foreground' : 'bg-background/60 text-foreground')}>
              <span className="flex items-center gap-1 text-xs font-bold">
                {s.bidder === me && <Crown className="size-3" aria-label="İhale sahibi" />}
                Sen
              </span>
              <span className="text-[10px] tabular-nums">{statusOf(me)}</span>
            </div>
            <div
              className="flex min-w-0 flex-1 justify-center pt-5 [--cw:3.2rem] sm:[--cw:4.2rem] lg:[--cw:4.8rem]"
              aria-label="Elindeki kartlar"
            >
              {hand.map((c, i) => {
                const playing = myTurn && s.phase === 'play'
                const burying = myTurn && s.phase === 'bury'
                const ok = playing && isLegal(c)
                const picked = burying && buryPick.some((x) => sameCard(x, c))
                const rot = (i - mid) * (handCount > 13 ? 1.6 : 2.2)
                return (
                  <BatakCard
                    key={`${c.s}-${c.r}`}
                    card={c}
                    playable={ok}
                    selected={picked}
                    dim={playing && !ok}
                    disabled={remote.busy || (playing ? !ok : !burying)}
                    onClick={playing ? () => remote.send({ type: 'play', s: c.s, r: c.r }) : burying ? () => toggleBury(c) : undefined}
                    className="origin-bottom"
                    style={{
                      marginLeft: i === 0 ? 0 : `min(0.15rem, calc((100% - ${handCount} * var(--cw)) / ${Math.max(1, handCount - 1)}))`,
                      rotate: `${rot}deg`,
                      translate: `0 ${Math.abs(i - mid) ** 2 * 0.35}px`,
                      zIndex: i,
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section aria-label="Puan tablosu" className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 sm:px-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Trophy className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-foreground">Puan tablosu</h3>
            <p className="text-xs tabular-nums text-muted-foreground">
              El {s.handNo}/{s.handsTotal} · {variantLabel(variant)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowScores((v) => !v)}
            aria-expanded={showScores}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-secondary"
          >
            {showScores ? 'Gizle' : 'El el'}
            <ChevronDown className={cn('size-3.5 transition-transform', showScores && 'rotate-180')} aria-hidden="true" />
          </button>
        </div>

        <ol className={cn('grid gap-2 p-2 sm:gap-3 sm:p-3', n === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
          {ranking.map((seat, rank) => {
            const last = s.results.at(-1)?.scores[seat]
            const goal = variant === 'koz-maca' ? s.bids[seat] : s.bidder === seat ? s.highBid : null
            const taken = s.taken[seat] ?? 0
            const leader = rank === 0 && s.totals[seat] !== s.totals[ranking[1]]
            const isMe = seat === me
            return (
              <li
                key={seat}
                className={cn(
                  'relative flex min-w-0 flex-col gap-2 rounded-xl border p-2.5 sm:p-3',
                  leader ? 'border-gold/60 bg-gold/10' : isMe ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/40',
                  s.turn === seat && 'ring-2 ring-gold/50',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-black tabular-nums',
                      leader ? 'bg-gold text-gold-foreground' : 'bg-background text-muted-foreground ring-1 ring-border',
                    )}
                  >
                    {leader ? <Crown className="size-3.5" aria-label="Lider" /> : rank + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{nameOf(seat)}</span>
                  {s.bidder === seat && variant !== 'koz-maca' && (
                    <span className="shrink-0 rounded bg-gold px-1 text-[10px] font-bold text-gold-foreground">İhale</span>
                  )}
                </div>

                <div className="flex items-end justify-between gap-2">
                  <span className={cn('font-display text-2xl font-black leading-none tabular-nums sm:text-3xl', s.totals[seat] < 0 ? 'text-destructive' : 'text-foreground')}>
                    {s.totals[seat]}
                  </span>
                  {last != null && (
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums',
                        last < 0 ? 'bg-destructive/15 text-destructive' : last > 0 ? 'bg-primary/15 text-primary' : 'bg-background text-muted-foreground',
                      )}
                      aria-label={`Son el ${last}`}
                    >
                      {last > 0 ? `+${last}` : last}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
                    <span>Bu el</span>
                    <span className="font-semibold text-foreground">
                      {taken}
                      {goal != null ? ` / ${goal}` : ''} el
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-background" aria-hidden="true">
                    <div
                      className={cn('h-full rounded-full transition-[width] duration-500', goal != null && taken >= goal ? 'bg-primary' : 'bg-gold')}
                      style={{ width: `${Math.min(100, (taken / Math.max(1, goal ?? maxTricks)) * 100)}%` }}
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        {showScores && (
          <div className="grid gap-4 border-t border-border p-3 sm:p-4 md:grid-cols-2">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[18rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-2 font-semibold">El</th>
                  {[...s.totals.keys()].map((i) => (
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
            <div>
              <h3 className="mb-2 text-sm font-bold text-foreground">Son el</h3>
              {s.lastTrick ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    {s.lastTrick.map((p) => (
                      <div key={p.seat} className="flex flex-col items-center gap-1">
                        <BatakCard card={p.card} size="xs" />
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
        )}
      </section>
    </div>
  )
}
