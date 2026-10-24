'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Bot, ChevronDown, Crown, Eye, HelpCircle, Trophy, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BATAK_RULE_OPTIONS,
  BATMA_PENALTY,
  BURY_COUNT,
  buryable,
  canNoTrump,
  legalCards,
  minBidFor,
  mustBid,
  RANK_LABEL,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  teamOf,
  tricksPerHand,
  variantLabel,
  ZERO_BONUS,
  type BatakResult,
  type BatakState,
  type BatakView,
  type BCard,
  type Play,
} from '@/lib/games/batak'
import { playSound } from '@/lib/sound'
import type { Remote } from './remote'
import { TableBrand } from './table-brand'

const isRed = (s: number) => s === 1 || s === 2
const suitColor = (s: number) => (isRed(s) ? 'text-tile-red' : 'text-tile-black')
const sameCard = (a: BCard, b: BCard) => a.s === b.s && a.r === b.r
const SUIT_ORDER = [0, 1, 3, 2]
const sortCards = (h: BCard[]) => [...h].sort((a, b) => SUIT_ORDER[a.s] - SUIT_ORDER[b.s] || b.r - a.r)
type Place = 'bottom' | 'top' | 'left' | 'right'

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
      aria-pressed={onClick ? selected : undefined}
      style={style}
      className={cn(
        'playing-card relative shrink-0 select-none rounded-md font-display transition-transform duration-150',
        size === 'xs' && 'h-10 w-7 rounded-sm',
        size === 'sm' && 'h-[4.6rem] w-[3.3rem] sm:h-[5.8rem] sm:w-[4.15rem] lg:h-[6.4rem] lg:w-[4.6rem]',
        size === 'md' && 'aspect-[5/7] w-[var(--cw)]',
        playable && !selected && 'ring-2 ring-gold hover:-translate-y-4 hover:shadow-[0_10px_22px_-6px_var(--gold)] focus-visible:-translate-y-4',
        selected && '-translate-y-7 scale-110 ring-[3px] ring-gold shadow-[0_0_26px_-2px_var(--gold)]',
        dim && 'opacity-50 brightness-75 grayscale',
        className,
      )}
    >
      <span className={cn('absolute left-1 top-0.5 flex flex-col items-center font-bold leading-none', color, size === 'xs' ? 'text-[10px]' : 'text-base sm:text-lg')}>
        {label}
        <span className={size === 'xs' ? 'text-[9px]' : 'text-sm sm:text-base'} aria-hidden="true">
          {SUIT_SYMBOLS[card.s]}
        </span>
      </span>
      {size !== 'xs' && (
        <>
          <span className={cn('absolute inset-0 flex items-center justify-center pt-2 text-2xl leading-none sm:text-4xl', color)} aria-hidden="true">
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

/** One small card per trick taken, so nobody has to read "3 el". */
function TrickPips({ count, goal, light }: { count: number; goal?: number | null; light?: boolean }) {
  const slots = Math.max(count, goal ?? 0)
  if (!slots) return <span className={cn('text-[10px] leading-none', light ? 'text-gold-foreground/70' : 'text-muted-foreground')}>el yok</span>
  return (
    <span className="flex max-w-[6.5rem] flex-wrap justify-center gap-[3px]" aria-label={`${count} el aldı${goal ? `, hedef ${goal}` : ''}`}>
      {Array.from({ length: slots }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-2.5 w-[7px] rounded-[2px]',
            i < count ? (goal != null && count >= goal ? 'bg-primary' : 'card-back') : 'border border-dashed border-current opacity-40',
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

const TRICK_OFFSET: Record<Place, string> = {
  bottom: 'translate-y-[40%] rotate-[3deg]',
  top: '-translate-y-[40%] -rotate-[4deg]',
  left: '-translate-x-[66%] -rotate-[10deg]',
  right: 'translate-x-[66%] rotate-[9deg]',
}
const SLIDE_TO: Record<Place, string> = {
  bottom: 'translateY(11rem) scale(.5)',
  top: 'translateY(-11rem) scale(.5)',
  left: 'translateX(-14rem) scale(.5)',
  right: 'translateX(14rem) scale(.5)',
}

export function BatakPvp({ remote }: { remote: Remote<BatakView> }) {
  const s = remote.state
  const n = s.seats ?? 4
  const variant = s.variant ?? 'klasik'
  const rules = s.rules ?? { batma: false, gommeYasak: false, ikiKat: false, kozsuz: false }
  const target = s.target ?? 0
  const me = remote.spectator ? -1 : remote.seat
  const base = me >= 0 ? me : 0
  const myTurn = remote.myTurn
  const isTeam = variant === 'esli'
  const kozMaca = variant === 'koz-maca'
  const [buryPick, setBuryPick] = useState<BCard[]>([])
  const [picked, setPicked] = useState<BCard | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)

  const hand = useMemo(() => (me >= 0 ? sortCards(s.hands[me] ?? []) : []), [s.hands, me])
  const playing = myTurn && s.phase === 'play'
  const burying = myTurn && s.phase === 'bury'
  const legal = useMemo(() => (playing ? legalCards(hand, s.trick, s.trump, s.broken) : []), [playing, hand, s.trick, s.trump, s.broken])
  const canBury = useMemo(() => (burying ? buryable(hand, s) : []), [burying, hand, s])
  const isLegal = (c: BCard) => legal.some((l) => sameCard(l, c))
  const nameOf = (seat: number) => (seat === me ? 'Sen' : remote.names[seat] ?? `Oyuncu ${seat + 1}`)
  const teamLabel = (seat: number) => (teamOf(seat) === teamOf(base) ? 'Biz' : 'Onlar')

  // Play runs counter-clockwise: the next seat sits on my right.
  const places: { seat: number; place: Exclude<Place, 'bottom'> }[] =
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
  const placeOf = (seat: number): Place => (seat === base ? 'bottom' : places.find((p) => p.seat === seat)!.place)

  const maxTricks = tricksPerHand({ seats: n })
  const minBid = Math.max(minBidFor(variant), s.highBid + 1)
  const forced = myTurn && s.phase === 'bid' && mustBid(s as unknown as BatakState, me)
  const goalOf = (seat: number) => (kozMaca ? s.bids[seat] : !isTeam && s.bidder === seat ? s.highBid : null)
  const teamTaken = (t: number) => s.taken.reduce((a, x, i) => a + (teamOf(i) === t ? x : 0), 0)

  // Hold a finished trick in the middle for a moment, then slide it to the winner.
  const trickKey = s.lastTrick && s.trick.length === 0 ? s.played.length : 0
  const seenKey = useRef(trickKey)
  const [hold, setHold] = useState<{ key: number; trick: Play[]; winner: number; slide: boolean } | null>(null)
  useEffect(() => {
    if (!trickKey || trickKey === seenKey.current || !s.lastTrick || s.lastWinner == null) return
    seenKey.current = trickKey
    const entry = { key: trickKey, trick: s.lastTrick, winner: s.lastWinner, slide: false }
    setHold(entry)
    const a = setTimeout(() => setHold((h) => (h?.key === trickKey ? { ...h, slide: true } : h)), 1500)
    const b = setTimeout(() => setHold((h) => (h?.key === trickKey ? null : h)), 2100)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [trickKey, s.lastTrick, s.lastWinner])
  const holding = hold && s.trick.length === 0 ? hold : null

  // Show the hand summary each time a hand is scored.
  const resultCount = s.results.length
  const seenResults = useRef(resultCount)
  const [summary, setSummary] = useState<BatakResult | null>(null)
  useEffect(() => {
    if (resultCount > seenResults.current) setSummary(s.results[resultCount - 1])
    seenResults.current = resultCount
  }, [resultCount, s.results])

  useEffect(() => {
    if (!playing) setPicked(null)
  }, [playing])

  const sendBury = async () => {
    if (buryPick.length !== BURY_COUNT) return
    const ok = await remote.send({ type: 'bury', cards: buryPick })
    if (ok) setBuryPick([])
  }
  const toggleBury = (c: BCard) =>
    setBuryPick((p) => (p.some((x) => sameCard(x, c)) ? p.filter((x) => !sameCard(x, c)) : p.length < BURY_COUNT ? [...p, c] : p))
  const playCard = (c: BCard) => {
    setPicked(null)
    void remote.send({ type: 'play', s: c.s, r: c.r })
  }

  const [nope, setNope] = useState<{ id: string; text: string; n: number } | null>(null)
  const nopeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (nopeTimer.current) clearTimeout(nopeTimer.current)
  }, [])
  const reject = (c: BCard, text: string) => {
    playSound('error')
    setNope((p) => ({ id: `${c.s}-${c.r}`, text, n: (p?.n ?? 0) + 1 }))
    if (nopeTimer.current) clearTimeout(nopeTimer.current)
    nopeTimer.current = setTimeout(() => setNope(null), 1800)
  }
  const illegalReason = (c: BCard) => {
    if (!s.trick.length) {
      return s.trump != null && c.s === s.trump && !s.broken ? 'Koz kırılmadan kozla açamazsın' : 'Bu kart şu an atılamaz'
    }
    const led = s.trick[0].card.s
    if (hand.some((x) => x.s === led)) {
      return c.s !== led ? `${SUIT_NAMES[led]} atmak zorundasın` : `Daha büyük ${SUIT_NAMES[led]} atmalısın`
    }
    if (s.trump != null && hand.some((x) => x.s === s.trump)) {
      return c.s !== s.trump ? 'Rengin yok, koz çakmak zorundasın' : 'Daha büyük koz atmalısın'
    }
    return 'Bu kart şu an atılamaz'
  }

  /** Touch screens pick first and play on the second tap to avoid mis-taps. */
  const tapCard = (c: BCard, twoStep: boolean) => {
    if (remote.busy) return
    if (burying) {
      if (!canBury.some((x) => sameCard(x, c))) return reject(c, rules.gommeYasak ? 'As ve koz gömülemez' : 'Bu kart gömülemez')
      playSound('card')
      return toggleBury(c)
    }
    if (!playing) return reject(c, 'Sıra sende değil, bekle')
    if (!isLegal(c)) return reject(c, illegalReason(c))
    if (!twoStep || (picked && sameCard(picked, c))) return playCard(c)
    playSound('card')
    setPicked(c)
  }

  const trumpBadge =
    s.noTrump ? (
      <span className="rounded bg-background px-1.5 text-xs font-black leading-5 text-foreground">Kozsuz</span>
    ) : s.trump != null ? (
      <span className={cn('playing-card rounded px-1.5 text-base font-bold leading-5', suitColor(s.trump))} aria-label={`Koz ${SUIT_NAMES[s.trump]}`}>
        {SUIT_SYMBOLS[s.trump]}
      </span>
    ) : (
      <span className="font-semibold text-foreground">?</span>
    )

  const bidLine = (() => {
    if (kozMaca) {
      if (s.phase === 'predict') return 'Tahminler alınıyor'
      return me >= 0 ? `Tahminin ${s.bids[me] ?? 0} · Aldın ${s.taken[me]}` : 'Herkes tahminini tutturmaya çalışıyor'
    }
    if (s.bidder == null) return s.highBid ? `En yüksek ihale ${s.highBid}` : 'İhale bekleniyor'
    if (isTeam) {
      const mine = teamTaken(teamOf(base))
      const theirs = teamTaken(1 - teamOf(base))
      return `İhale ${teamLabel(s.bidder)} ${s.highBid} · Biz ${mine} – Onlar ${theirs}`
    }
    return `İhale ${nameOf(s.bidder)} ${s.highBid} · Aldı ${s.taken[s.bidder]}/${s.highBid}`
  })()

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
            : picked
              ? 'Atmak için karta tekrar dokun'
              : s.trick.length
                ? 'Sıra sende, parlayan kartlardan birini at'
                : 'Sıra sende, ilk kartı sen atıyorsun'
    : holding
      ? `${nameOf(holding.winner)} eli aldı`
      : s.note || `${nameOf(s.turn)} düşünüyor`

  const ranking = useMemo(() => {
    const seats = [...s.totals.keys()]
    const list = isTeam ? seats.filter((i) => i < 2) : seats
    return list.sort((a, b) => s.totals[b] - s.totals[a])
  }, [s.totals, isTeam])
  const rowName = (seat: number) =>
    isTeam ? `${teamLabel(seat)} · ${nameOf(seat)} & ${nameOf((seat + 2) % 4)}` : nameOf(seat)

  const Seat = ({ seat, place }: { seat: number; place: Exclude<Place, 'bottom'> }) => {
    const active = s.turn === seat && !holding
    const bid = s.bids[seat]
    const showBubble = (s.phase === 'bid' && (s.passed[seat] || (bid ?? 0) > 0)) || (s.phase === 'predict' && bid != null)
    return (
      <div
        className={cn(
          'absolute z-10 flex flex-col items-center gap-1',
          place === 'top' && 'left-1/2 top-11 -translate-x-1/2 sm:top-12',
          place === 'left' && 'left-1.5 top-[44%] -translate-y-1/2 sm:left-5 lg:left-[7%]',
          place === 'right' && 'right-1.5 top-[44%] -translate-y-1/2 sm:right-5 lg:right-[7%]',
        )}
      >
        <div className="relative">
          <div
            className={cn(
              'flex size-11 items-center justify-center rounded-full bg-background/85 font-display text-base font-bold text-foreground ring-2 transition sm:size-14 sm:text-lg',
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
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-background px-1.5 text-[10px] font-bold tabular-nums text-foreground ring-1 ring-border">
            {s.handCounts[seat]}
          </span>
          {showBubble && (
            <span
              key={`${s.phase}-${bid}-${s.passed[seat]}`}
              className={cn(
                'absolute top-1/2 z-20 -translate-y-1/2 animate-pop whitespace-nowrap rounded-xl px-2.5 py-1 text-sm font-black shadow-lg',
                place === 'right' ? 'right-full mr-2' : 'left-full ml-2',
                s.passed[seat] ? 'bg-secondary text-muted-foreground' : 'bg-gold text-gold-foreground',
              )}
            >
              {s.phase === 'predict' ? `Tahmin ${bid}` : s.passed[seat] ? 'Pas' : bid}
            </span>
          )}
        </div>
        <div
          className={cn(
            'flex w-24 flex-col items-center gap-1 rounded-lg px-1.5 py-1 text-center sm:w-28',
            active ? 'bg-gold text-gold-foreground' : 'bg-background/80 text-foreground',
          )}
        >
          <span className="w-full break-words text-[11px] font-bold leading-tight sm:text-xs">{nameOf(seat)}</span>
          {(s.phase === 'play' || s.phase === 'bury' || s.phase === 'trump') && <TrickPips count={s.taken[seat]} goal={goalOf(seat)} light={active} />}
          <span className={cn('text-[10px] font-semibold tabular-nums leading-none', active ? 'text-gold-foreground/80' : 'text-muted-foreground')}>
            {isTeam ? `${teamLabel(seat)} · ` : ''}
            {s.totals[seat]} puan
          </span>
        </div>
      </div>
    )
  }

  const handRows = hand.length > 9 ? [hand.slice(0, Math.ceil(hand.length / 2)), hand.slice(Math.ceil(hand.length / 2))] : [hand]
  const mid = (hand.length - 1) / 2

  const cardState = (c: BCard) => {
    const ok = playing && isLegal(c)
    const buryOk = burying && canBury.some((x) => sameCard(x, c))
    return {
      ok,
      buryOk,
      selected: (burying && buryPick.some((x) => sameCard(x, c))) || (playing && picked != null && sameCard(picked, c)),
      dim: (playing && !ok) || (burying && !buryOk),
      disabled: remote.busy,
      nope: nope?.id === `${c.s}-${c.r}`,
    }
  }
  const tappable = !remote.spectator && (s.phase === 'play' || burying)

  const activeRules = BATAK_RULE_OPTIONS.filter((o) => rules[o.key])
  const rulesSummary = kozMaca
    ? [
        'Koz hep maçadır. Herkes kaç el alacağını tahmin eder.',
        'Tahminini tutturursan aldığın el kadar artı, tutturamazsan tahmin kadar eksi yazılır.',
        `0 deyip hiç el almazsan +${ZERO_BONUS}, tek el bile alırsan −${ZERO_BONUS}.`,
      ]
    : [
        `En yüksek ihaleyi veren kozu seçer${variant === 'gommeli' ? ', yerdeki 4 kartı alıp 4 kart gömer' : ''}. En az ${minBidFor(variant)} verilir.`,
        `İhaleyi ${isTeam ? 'takım olarak ' : ''}tutturan aldığı el kadar artı, tutturamayan ihale${rules.ikiKat ? 'nin 2 katı' : ' kadar'} eksi yazar.`,
        `Diğerleri aldıkları el kadar puan alır.${rules.batma ? ` Hiç el alamayan −${BATMA_PENALTY} yer.` : ''} Renge uymak, yükseltmek ve renk yoksa koz çakmak zorunludur.`,
      ]

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
      <div data-ls-main className="flex min-w-0 flex-col gap-3">
        {remote.spectator && (
          <p className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground">
            <Eye className="size-4 text-primary" aria-hidden="true" /> Masayı izliyorsun. Eller gizli, ortaya atılan kartlar canlı görünür.
          </p>
        )}

        <section aria-label="Batak masası" className="tavla-wood mx-auto w-full max-w-4xl rounded-[1.75rem] p-1.5 sm:p-2.5">
          <div className="baize-table relative h-[25rem] overflow-hidden rounded-[1.4rem] sm:h-[29rem] lg:h-[32rem]">
            <TableBrand />
            <div className="absolute inset-x-2 top-2 z-20 flex items-start justify-between gap-2 text-[11px] sm:inset-x-4 sm:top-3 sm:text-xs">
              <div className="flex flex-col gap-1">
                <span className="w-fit rounded-md bg-background/75 px-2 py-0.5 font-bold text-foreground">{variantLabel(variant)}</span>
                <span className="w-fit rounded-md bg-background/75 px-2 py-0.5 tabular-nums text-muted-foreground">
                  {target ? `${s.handNo}. el · Hedef ${target}` : s.handsTotal > 1 ? `El ${s.handNo}/${s.handsTotal}` : 'Tek el'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="flex items-center gap-1 rounded-md bg-background/75 px-2 py-1 font-bold text-foreground transition hover:bg-background"
                aria-haspopup="dialog"
              >
                <HelpCircle className="size-3.5" aria-hidden="true" /> Kurallar
              </button>
            </div>

            {places.map((p) => (
              <Seat key={p.seat} seat={p.seat} place={p.place} />
            ))}

            <div className="absolute left-1/2 top-[47%] z-0 size-0">
              {(holding ? holding.trick : s.trick).map((p, i) => {
                const won = holding && p.seat === holding.winner
                return (
                  <div
                    key={p.seat}
                    className="absolute -translate-x-1/2 -translate-y-1/2 transition-[transform,opacity] duration-500 ease-in"
                    style={{
                      zIndex: won ? 10 : i + 1,
                      transform: holding?.slide ? `translate(-50%, -50%) ${SLIDE_TO[placeOf(holding.winner)]}` : undefined,
                      opacity: holding?.slide ? 0 : 1,
                    }}
                  >
                    <BatakCard
                      card={p.card}
                      size="sm"
                      className={cn(!holding && 'animate-pop', TRICK_OFFSET[placeOf(p.seat)], won && 'ring-[3px] ring-gold shadow-[0_0_24px_-2px_var(--gold)]', holding && !won && 'brightness-75')}
                    />
                  </div>
                )
              })}
            </div>

            {s.phase !== 'bid' && s.phase !== 'predict' && (
              <div className="absolute left-1/2 top-[73%] z-10 -translate-x-1/2 sm:top-[75%]">
                <div className="flex items-center gap-2 whitespace-nowrap rounded-full bg-background/85 py-1 pl-1.5 pr-3 text-xs font-bold text-foreground shadow-lg ring-1 ring-gold/40 backdrop-blur sm:text-sm">
                  <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">Koz {trumpBadge}</span>
                  <span className="tabular-nums">{bidLine}</span>
                </div>
              </div>
            )}

            <div className="absolute inset-x-2 bottom-2 z-20 flex flex-col items-center gap-2">
              <p
                key={nope ? `nope-${nope.n}` : 'prompt'}
                className={cn(
                  'max-w-full truncate rounded-full px-3 py-1 text-center text-xs font-semibold',
                  nope ? 'bg-destructive text-foreground shadow-lg animate-pop' : myTurn ? 'bg-gold text-gold-foreground' : 'bg-background/75 text-foreground',
                )}
                aria-live="polite"
              >
                {nope?.text ?? prompt}
              </p>

              {myTurn && (s.phase === 'bid' || s.phase === 'predict') && (
                <div className="w-full max-w-md rounded-2xl bg-background/90 p-2 ring-1 ring-gold/40 backdrop-blur">
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: s.phase === 'predict' ? maxTricks + 1 : maxTricks - minBid + 1 }, (_, i) => (s.phase === 'predict' ? i : minBid + i)).map((b) => (
                      <button
                        key={b}
                        type="button"
                        disabled={remote.busy}
                        onClick={() => remote.send({ type: s.phase === 'predict' ? 'predict' : 'bid', amount: b })}
                        className="h-10 rounded-lg bg-secondary text-sm font-bold tabular-nums text-foreground transition hover:bg-gold hover:text-gold-foreground disabled:opacity-40"
                      >
                        {b}
                      </button>
                    ))}
                    {s.phase === 'bid' && (
                      <button
                        type="button"
                        disabled={remote.busy || forced}
                        onClick={() => remote.send({ type: 'bid', amount: 'pass' })}
                        className="col-span-2 h-10 rounded-lg bg-muted text-sm font-bold text-foreground ring-1 ring-border disabled:opacity-40"
                      >
                        Pas
                      </button>
                    )}
                  </div>
                  {s.phase === 'predict' && <p className="mt-1.5 text-center text-[11px] text-muted-foreground">0 dersen ve hiç el almazsan +{ZERO_BONUS}</p>}
                </div>
              )}

              {myTurn && s.phase === 'trump' && (
                <div className="flex w-full max-w-md flex-col gap-2 rounded-2xl bg-background/90 p-2 ring-1 ring-gold/40 backdrop-blur">
                  <div className="grid grid-cols-4 gap-2">
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
                  {rules.kozsuz && (
                    <button
                      type="button"
                      disabled={remote.busy || !canNoTrump(s)}
                      onClick={() => remote.send({ type: 'trump', suit: 'none' })}
                      className="h-9 rounded-xl bg-secondary text-xs font-bold text-foreground ring-1 ring-border transition hover:bg-gold hover:text-gold-foreground disabled:opacity-40"
                    >
                      {canNoTrump(s) ? 'Kozsuz oyna · tutarsa 2 kat puan' : `Kozsuz için en az ${minBidFor(variant) + 1} ihale gerekir`}
                    </button>
                  )}
                </div>
              )}

              {burying && (
                <div className="flex flex-col items-center gap-1">
                  {rules.gommeYasak && <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground">As ve koz gömülemez</span>}
                  <button
                    type="button"
                    disabled={remote.busy || buryPick.length !== BURY_COUNT}
                    onClick={sendBury}
                    className="rounded-full bg-gold px-5 py-2 text-sm font-bold text-gold-foreground disabled:opacity-50"
                  >
                    Seçilenleri göm ({buryPick.length}/{BURY_COUNT})
                  </button>
                </div>
              )}
            </div>
          </div>

          {me >= 0 && (
            <div className="flex flex-col gap-1 px-1 pb-1 pt-2 sm:px-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold', s.turn === me ? 'bg-gold text-gold-foreground' : 'bg-background/70 text-foreground')}>
                  {s.bidder === me && <Crown className="size-3" aria-label="İhale sahibi" />}
                  Sen{isTeam ? ` · ${teamLabel(me)}` : ''} · {s.totals[me]} puan
                </span>
                {(s.phase === 'play' || s.phase === 'bury' || s.phase === 'trump') && <TrickPips count={s.taken[me]} goal={goalOf(me)} />}
              </div>

              <div className="flex flex-col items-center gap-1 pt-4 [--cw:2.85rem] sm:hidden" aria-label="Elindeki kartlar">
                {handRows.map((row, ri) => (
                  <div key={ri} className="flex justify-center" style={{ marginTop: ri ? '-1.1rem' : 0 }}>
                    {row.map((c, i) => {
                      const st = cardState(c)
                      return (
                        <BatakCard
                          key={`${c.s}-${c.r}${st.nope ? `-n${nope?.n}` : ''}`}
                          card={c}
                          playable={st.ok || st.buryOk}
                          selected={st.selected}
                          dim={st.dim}
                          disabled={st.disabled}
                          onClick={tappable ? () => tapCard(c, true) : undefined}
                          className={cn(st.nope && 'card-nope ring-2 ring-destructive')}
                          style={{ marginLeft: i === 0 ? 0 : '-0.55rem', zIndex: st.selected ? 60 : i + ri * 20 }}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>

              <div className="hidden min-w-0 justify-center pt-5 [--cw:4.2rem] sm:flex lg:[--cw:4.8rem]" aria-label="Elindeki kartlar">
                {hand.map((c, i) => {
                  const st = cardState(c)
                  return (
                    <BatakCard
                      key={`${c.s}-${c.r}${st.nope ? `-n${nope?.n}` : ''}`}
                      card={c}
                      playable={st.ok || st.buryOk}
                      selected={st.selected}
                      dim={st.dim}
                      disabled={st.disabled}
                      onClick={tappable ? () => tapCard(c, false) : undefined}
                      className={cn('origin-bottom', st.nope && 'card-nope ring-2 ring-destructive')}
                      style={{
                        marginLeft: i === 0 ? 0 : `min(0.15rem, calc((100% - ${hand.length} * var(--cw)) / ${Math.max(1, hand.length - 1)}))`,
                        rotate: `${(i - mid) * (hand.length > 13 ? 1.6 : 2.2)}deg`,
                        // Fan curve via margin: an inline `translate` would override the hover/selected lift classes.
                        marginTop: `${Math.abs(i - mid) ** 2 * 0.35}px`,
                        zIndex: st.selected ? 60 : i,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      <section aria-label="Puan tablosu" className="overflow-hidden rounded-2xl border border-border bg-card lg:sticky lg:top-20">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Trophy className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="text-sm font-bold text-foreground">Puan tablosu</h3>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {target ? `${target} puana ilk ulaşan kazanır` : s.handsTotal > 1 ? `${s.handsTotal} el sonunda en yüksek kazanır` : 'Tek el, en yüksek kazanır'}
            </p>
          </div>
        </div>

        <ol className="flex flex-col gap-1.5 p-2">
          {ranking.map((seat, rank) => {
            const last = s.results.at(-1)?.scores[seat]
            const leader = rank === 0 && ranking.length > 1 && s.totals[seat] !== s.totals[ranking[1]]
            const mine = isTeam ? teamOf(seat) === teamOf(base) && me >= 0 : seat === me
            const total = s.totals[seat]
            return (
              <li
                key={seat}
                className={cn(
                  'flex flex-col gap-1.5 rounded-xl border p-2',
                  leader ? 'border-gold/60 bg-gold/10' : mine ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/40',
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black tabular-nums',
                      leader ? 'bg-gold text-gold-foreground' : 'bg-background text-muted-foreground ring-1 ring-border',
                    )}
                  >
                    {leader ? <Crown className="size-3" aria-label="Lider" /> : rank + 1}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-xs font-bold leading-snug text-foreground">{rowName(seat)}</span>
                  <span className={cn('font-display text-xl font-black leading-none tabular-nums', total < 0 ? 'text-destructive' : 'text-foreground')}>{total}</span>
                  {last != null && (
                    <span
                      className={cn(
                        'rounded px-1 py-0.5 text-[10px] font-bold leading-none tabular-nums',
                        last < 0 ? 'bg-destructive/15 text-destructive' : last > 0 ? 'bg-primary/15 text-primary' : 'bg-background text-muted-foreground',
                      )}
                      aria-label={`Son el ${last}`}
                    >
                      {last > 0 ? `+${last}` : last}
                    </span>
                  )}
                </div>
                {target > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background" aria-hidden="true">
                      <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, (total / target) * 100))}%` }} />
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{Math.max(0, target - total)} kaldı</span>
                  </div>
                )}
              </li>
            )
          })}
        </ol>

        {s.results.length > 0 && (
          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold text-foreground hover:bg-secondary/50"
            >
              El el puanlar
              <ChevronDown className={cn('size-3.5 transition-transform', showHistory && 'rotate-180')} aria-hidden="true" />
            </button>
            {showHistory && (
              <div className="overflow-x-auto px-3 pb-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 pr-2 font-semibold">El</th>
                      {ranking.map((i) => (
                        <th key={i} className="py-1 pr-2 font-semibold">
                          {isTeam ? teamLabel(i) : nameOf(i)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {s.results.map((r) => (
                      <tr key={r.hand} className="border-t border-border">
                        <td className="py-1 pr-2 text-muted-foreground">{r.hand}</td>
                        {ranking.map((i) => (
                          <td key={i} className={cn('py-1 pr-2', r.scores[i] < 0 ? 'font-bold text-destructive' : 'text-foreground')}>
                            {r.scores[i] > 0 ? `+${r.scores[i]}` : r.scores[i]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {rulesOpen && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-background/70 p-3 backdrop-blur-sm sm:items-center" onClick={() => setRulesOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="batak-rules-title"
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="batak-rules-title" className="text-sm font-bold text-foreground">
                {variantLabel(variant)} kuralları
              </h2>
              <button type="button" onClick={() => setRulesOpen(false)} className="flex size-7 items-center justify-center rounded-full hover:bg-secondary" aria-label="Kapat">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <ul className="flex flex-col gap-2 text-sm leading-relaxed text-foreground">
              {rulesSummary.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                  <span className="text-pretty">{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-1.5 rounded-xl bg-secondary/60 p-3 text-xs">
              <span className="font-bold text-foreground">Bu masanın ayarları</span>
              <span className="text-muted-foreground">{target ? `${target} puana ilk ulaşan kazanır, eşitlikte bir el daha.` : 'Tek el, eşitlikte ihaleyi alan kazanır.'}</span>
              {activeRules.length ? (
                activeRules.map((o) => (
                  <span key={o.key} className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{o.label}:</span> {o.hint}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground">Ek kural açık değil.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {summary && (
        <HandSummary
          result={summary}
          variant={variant}
          seats={n}
          target={target}
          ikiKat={rules.ikiKat}
          nameOf={nameOf}
          teamLabel={teamLabel}
          onClose={() => setSummary(null)}
        />
      )}
    </div>
  )
}

function HandSummary({
  result,
  variant,
  seats,
  target,
  ikiKat,
  nameOf,
  teamLabel,
  onClose,
}: {
  result: BatakResult
  variant: BatakView['variant']
  seats: number
  target: number
  ikiKat: boolean
  nameOf: (seat: number) => string
  teamLabel: (seat: number) => string
  onClose: () => void
}) {
  const isTeam = variant === 'esli'
  const kozMaca = variant === 'koz-maca'
  const totals = result.totals ?? []
  const rows = (isTeam ? [0, 1] : Array.from({ length: seats }, (_, i) => i)).map((seat) => {
    const taken = isTeam ? result.taken.reduce((a, x, i) => a + (teamOf(i) === teamOf(seat) ? x : 0), 0) : result.taken[seat]
    const score = result.scores[seat]
    const isBidder = result.bidder != null && (isTeam ? teamOf(result.bidder) === teamOf(seat) : result.bidder === seat)
    let said = '—'
    let why = 'Aldığı el kadar'
    if (kozMaca) {
      const p = result.predictions?.[seat] ?? 0
      said = String(p)
      why = p === 0 ? (taken === 0 ? `Sıfır tuttu, +${ZERO_BONUS}` : `Sıfır bozuldu, −${ZERO_BONUS}`) : taken >= p ? 'Tahmin tuttu' : 'Tahmin tutmadı'
    } else if (isBidder) {
      said = String(result.bid)
      why = result.made ? (result.noTrump ? 'İhale tuttu · kozsuz 2 kat' : 'İhale tuttu') : ikiKat ? 'İhale battı · 2 kat ceza' : 'İhale battı'
    } else if (score < 0) {
      why = 'Hiç el alamadı, batma cezası'
    }
    return { seat, name: isTeam ? `${teamLabel(seat)} (${nameOf(seat)} & ${nameOf((seat + 2) % 4)})` : nameOf(seat), said, taken, score, why, total: totals[seat] }
  })
  const best = Math.max(...rows.map((r) => r.total ?? 0))

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-background/75 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="batak-summary-title"
        className="w-full max-w-md rounded-3xl border-2 border-gold/50 bg-card p-4 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{result.hand}. el bitti</p>
            <h2 id="batak-summary-title" className="text-balance font-display text-lg font-black text-foreground">
              {kozMaca
                ? 'Tahmin sonuçları'
                : result.bidder != null
                  ? `${isTeam ? teamLabel(result.bidder) : nameOf(result.bidder)} ${result.bid} dedi, ${result.made ? 'tutturdu' : 'battı'}`
                  : 'El sonucu'}
            </h2>
          </div>
          {!kozMaca && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-foreground">
              Koz{' '}
              {result.noTrump ? 'Kozsuz' : result.trump != null ? <span className={suitColor(result.trump)}>{SUIT_SYMBOLS[result.trump]}</span> : '?'}
            </span>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-muted-foreground">
              <th className="pb-1 font-semibold">Oyuncu</th>
              <th className="pb-1 text-center font-semibold">{kozMaca ? 'Tahmin' : 'Dedi'}</th>
              <th className="pb-1 text-center font-semibold">Aldı</th>
              <th className="pb-1 text-right font-semibold">Puan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.seat} className="border-t border-border align-top">
                <td className="py-1.5 pr-2">
                  <span className="block text-xs font-bold leading-snug text-foreground">{r.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{r.why}</span>
                </td>
                <td className="py-1.5 text-center tabular-nums text-foreground">{r.said}</td>
                <td className="py-1.5 text-center tabular-nums text-foreground">{r.taken}</td>
                <td className={cn('py-1.5 text-right font-black tabular-nums', r.score < 0 ? 'text-destructive' : 'text-primary')}>{r.score > 0 ? `+${r.score}` : r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {totals.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5 rounded-2xl bg-secondary/60 p-3">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Toplam</span>
            {rows
              .slice()
              .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
              .map((r) => (
                <div key={r.seat} className="flex items-center justify-between gap-2 text-sm">
                  <span className={cn('min-w-0 break-words font-semibold', r.total === best ? 'text-foreground' : 'text-muted-foreground')}>{r.name}</span>
                  <span className="shrink-0 tabular-nums font-bold text-foreground">
                    {r.total}
                    {target > 0 && <span className="ml-1 text-[11px] font-normal text-muted-foreground">({Math.max(0, target - (r.total ?? 0))} kaldı)</span>}
                  </span>
                </div>
              ))}
          </div>
        )}

        <button type="button" onClick={onClose} className="mt-4 h-11 w-full rounded-2xl bg-gold text-sm font-black text-gold-foreground">
          Devam
        </button>
      </div>
    </div>
  )
}
