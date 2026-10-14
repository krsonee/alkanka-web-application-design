'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Hand, Layers, Plus, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { blackjackAct, blackjackDeal } from '@/app/actions/arena'
import { RANKS, SUITS, handValue, bjAct, bjDeal, bjPayout, bjPublic, type BjPublic, type BjState, type Card } from '@/lib/casino'
import type { ArenaGameSettings } from '@/lib/arena'
import { formatAC, usePoints } from '../points-context'
import { TableBrand } from './table-brand'

export function PlayingCard({ card, hidden, index = 0, small }: { card?: Card; hidden?: boolean; index?: number; small?: boolean }) {
  const red = card && (card.s === 1 || card.s === 2)
  if (small) {
    return (
      <div
        className={cn(
          'card-deal relative flex h-14 w-10 shrink-0 flex-col items-center justify-center rounded-md border shadow-md sm:h-16 sm:w-11',
          hidden || !card ? 'border-primary/40 bg-secondary' : 'border-border bg-[oklch(0.97_0.01_90)]',
        )}
        style={{ animationDelay: `${index * 90}ms` }}
        aria-label={hidden || !card ? 'Kapalı kart' : `${RANKS[card.r]} ${SUITS[card.s]}`}
      >
        {hidden || !card ? (
          <span className="text-[8px] font-bold uppercase tracking-widest text-primary">AK</span>
        ) : (
          <span className={cn('font-display text-sm font-bold leading-none', red ? 'text-[oklch(0.55_0.2_25)]' : 'text-[oklch(0.18_0.01_260)]')}>
            {RANKS[card.r]}
            <span className="block text-center text-base">{SUITS[card.s]}</span>
          </span>
        )}
      </div>
    )
  }
  return (
    <div
      className="card-deal relative flex h-24 w-16 shrink-0 flex-col justify-between rounded-lg border p-1.5 shadow-lg sm:h-32 sm:w-22"
      style={{ animationDelay: `${index * 90}ms` }}
      aria-label={hidden || !card ? 'Kapalı kart' : `${RANKS[card.r]} ${SUITS[card.s]}`}
    >
      {hidden || !card ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-primary/40 bg-secondary">
          <div className="flex size-[80%] items-center justify-center rounded-md border border-primary/30 bg-background">
            <span className="font-display text-[10px] font-bold uppercase tracking-widest text-primary sm:text-xs">Alkanka</span>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 rounded-lg bg-[oklch(0.97_0.01_90)]" aria-hidden="true" />
          <span className={cn('relative font-display text-sm font-bold leading-none sm:text-lg', red ? 'text-[oklch(0.55_0.2_25)]' : 'text-[oklch(0.18_0.01_260)]')}>
            {RANKS[card.r]}
            <br />
            {SUITS[card.s]}
          </span>
          <span className={cn('relative self-center text-3xl leading-none sm:text-4xl', red ? 'text-[oklch(0.55_0.2_25)]' : 'text-[oklch(0.18_0.01_260)]')} aria-hidden="true">
            {SUITS[card.s]}
          </span>
          <span className={cn('relative rotate-180 font-display text-sm font-bold leading-none sm:text-lg', red ? 'text-[oklch(0.55_0.2_25)]' : 'text-[oklch(0.18_0.01_260)]')} aria-hidden="true">
            {RANKS[card.r]}
          </span>
        </>
      )}
    </div>
  )
}

const RESULT_TEXT: Record<string, string> = { blackjack: 'Blackjack!', win: 'Kazandın', push: 'Berabere', loss: 'Krupiye aldı' }
const DEAL_STEP_MS = 650

type Slot = { who: 'p' | 'd'; i: number }

/** Real dealing order: player, dealer, player, dealer (hole), then extra player cards, then extra dealer cards. */
function dealOrder(playerCount: number, dealerCount: number): Slot[] {
  const order: Slot[] = []
  for (let i = 0; i < 2; i++) {
    if (i < playerCount) order.push({ who: 'p', i })
    if (i < dealerCount) order.push({ who: 'd', i })
  }
  for (let i = 2; i < playerCount; i++) order.push({ who: 'p', i })
  for (let i = 2; i < dealerCount; i++) order.push({ who: 'd', i })
  return order
}

/** Reveals cards one by one so every deal feels like a real dealer's hand. */
function useDealSequence(dealKey: number, total: number) {
  const [state, setState] = useState({ key: dealKey, shown: 0 })
  if (state.key !== dealKey) setState({ key: dealKey, shown: 0 })
  const shown = state.key === dealKey ? state.shown : 0

  useEffect(() => {
    if (shown >= total) return
    const t = setTimeout(() => setState((s) => ({ ...s, shown: s.shown + 1 })), shown === 0 ? 250 : DEAL_STEP_MS)
    return () => clearTimeout(t)
  }, [shown, total])

  return Math.min(shown, total)
}

function ValueBadge({ value, dim }: { value: string; dim?: boolean }) {
  return (
    <span className={cn('rounded-full border px-2.5 py-0.5 font-display text-sm font-bold tabular-nums', dim ? 'border-primary/30 bg-background/60 text-foreground' : 'border-primary bg-primary text-primary-foreground')}>
      {value}
    </span>
  )
}

function BjTable({
  hand,
  dealKey,
  busy,
  canDouble,
  onAct,
  footer,
}: {
  hand: BjPublic | null
  dealKey: number
  busy: boolean
  canDouble: boolean
  onAct: (a: 'hit' | 'stand' | 'double') => void
  footer: React.ReactNode
}) {
  const playerCount = hand?.player.length ?? 0
  const dealerCount = hand ? hand.dealer.length + (hand.dealerHidden ? 1 : 0) : 0
  const order = dealOrder(playerCount, dealerCount)
  const shown = useDealSequence(dealKey, order.length)
  const dealing = shown < order.length
  const visible = order.slice(0, shown)
  const pShown = visible.filter((s) => s.who === 'p').length
  const dShown = visible.filter((s) => s.who === 'd').length
  const playerCards = hand?.player.slice(0, pShown) ?? []
  const dealerCards = hand?.dealer.slice(0, dShown) ?? []
  const showHole = !!hand?.dealerHidden && dShown >= 2

  const jakoLine = !hand
    ? 'Bahsini seç, kartları dağıtayım.'
    : dealing
      ? 'Kartlar geliyor...'
      : hand.phase === 'player'
        ? 'Kart mı, dur mu?'
        : hand.result === 'loss'
          ? 'Bu el benim, bir dahakine!'
          : hand.result === 'push'
            ? 'Berabere, bahsin iade.'
            : 'Tebrikler, kazancın masada!'

  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl border border-primary/30 bg-[color-mix(in_oklch,var(--wood)_80%,var(--background))] p-2 sm:p-3">
      <div className="felt-table relative flex min-h-[30rem] flex-col items-center gap-4 overflow-hidden rounded-[1.25rem] rounded-b-[45%] px-4 pb-10 pt-3 sm:min-h-[34rem] sm:px-10 sm:pb-16">
        <TableBrand />

        <div className="relative flex w-full items-end justify-center gap-3">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-full border-2 border-primary/60 bg-background sm:size-32">
            <Image src="/images/mascots/jako-dealer.png" alt="Krupiye Jako" fill sizes="128px" className="object-cover object-top" priority />
          </div>
          <div className="mb-2 max-w-48 rounded-2xl rounded-bl-sm border border-primary/40 bg-background/85 px-3 py-2 text-xs font-semibold text-foreground sm:text-sm" aria-live="polite">
            {jakoLine}
          </div>
          <div className="absolute right-0 top-2 hidden h-20 w-14 rotate-6 rounded-md border border-primary/40 bg-secondary shadow-xl sm:block" aria-hidden="true">
            <div className="absolute inset-1 rounded-sm border border-primary/30 bg-background" />
            <span className="absolute inset-x-0 bottom-1 text-center text-[9px] font-bold uppercase tracking-widest text-primary">Deste</span>
          </div>
        </div>

        <div className="relative flex flex-col items-center gap-2">
          <div className="flex min-h-24 justify-center -space-x-6 sm:min-h-32 sm:-space-x-8">
            {dealerCards.map((c, i) =>
              i === 1 && showHole ? null : <PlayingCard key={`d${dealKey}-${i}-${c.r}-${c.s}`} card={c} />,
            )}
            {showHole && <PlayingCard key={`hole${dealKey}`} hidden />}
          </div>
          {hand && dShown > 0 && (
            <ValueBadge dim value={`Krupiye ${handValue(dealerCards)}${showHole ? '+' : ''}`} />
          )}
        </div>

        <svg viewBox="0 0 400 60" className="pointer-events-none relative w-full max-w-md" aria-hidden="true">
          <defs>
            <path id="bj-arc" d="M 20 10 Q 200 70 380 10" />
          </defs>
          <text className="fill-primary font-display text-[15px] font-bold uppercase tracking-[0.25em]">
            <textPath href="#bj-arc" startOffset="50%" textAnchor="middle">
              Blackjack 3:2 öder
            </textPath>
          </text>
          <text y="48" x="200" textAnchor="middle" className="fill-foreground/60 text-[10px] font-semibold uppercase tracking-[0.3em]">
            Krupiye 17’de durur
          </text>
        </svg>

        <div className="relative flex min-h-10 items-center justify-center">
          {!dealing && hand?.phase === 'done' && hand.result && (
            <p
              className={cn(
                'pop-in rounded-full px-5 py-2 font-display text-xl font-bold uppercase',
                hand.result === 'loss' ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground',
              )}
              role="status"
            >
              {RESULT_TEXT[hand.result]}
            </p>
          )}
        </div>

        <div className="relative flex flex-col items-center gap-2">
          <div className="relative flex min-h-28 min-w-32 items-center justify-center rounded-[50%] border-2 border-dashed border-primary/40 px-4 py-2 sm:min-h-36 sm:min-w-44">
            {hand && (
              <span className="absolute -left-3 -top-3 flex size-11 items-center justify-center rounded-full border-4 border-dashed border-primary-foreground/70 bg-primary font-display text-[10px] font-bold text-primary-foreground shadow-lg">
                {formatAC(hand.bet)}
              </span>
            )}
            <div className="flex justify-center -space-x-6 sm:-space-x-8">
              {playerCards.map((c, i) => <PlayingCard key={`p${dealKey}-${i}-${c.r}-${c.s}`} card={c} />)}
            </div>
            {!hand && <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary/70">Bahis alanı</span>}
          </div>
          {pShown > 0 && <ValueBadge value={`Senin elin ${handValue(playerCards)}`} />}
        </div>
      </div>

      <div className="relative flex flex-wrap items-center justify-center gap-2 px-2 pb-2 pt-4">
        {hand?.phase === 'player' || (hand && dealing) ? (
          <>
            <button disabled={busy || dealing} onClick={() => onAct('hit')} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50">
              <Plus className="size-4" aria-hidden="true" /> Kart çek
            </button>
            <button disabled={busy} onClick={() => onAct('stand')} className="flex items-center gap-2 rounded-xl border border-primary/50 bg-background/70 px-5 py-3 text-sm font-bold uppercase text-foreground disabled:opacity-50">
              <Hand className="size-4" aria-hidden="true" /> Dur
            </button>
            {canDouble && (
              <button disabled={busy} onClick={() => onAct('double')} className="flex items-center gap-2 rounded-xl border border-primary/50 bg-background/70 px-5 py-3 text-sm font-bold uppercase text-foreground disabled:opacity-50">
                <Layers className="size-4" aria-hidden="true" /> İkiye katla
              </button>
            )}
          </>
        ) : (
          footer
        )}
      </div>
    </div>
  )
}

/** Real-KC blackjack against the house. Every card is dealt on the server. */
export function BlackjackHouse({ settings }: { settings: ArenaGameSettings }) {
  const { points, setBalance, requireLogin } = usePoints()
  const [bet, setBet] = useState(settings.bets[0])
  const [id, setId] = useState<string | null>(null)
  const [hand, setHand] = useState<BjPublic | null>(null)
  const [dealKey, setDealKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function deal() {
    if (busy || !requireLogin()) return
    setBusy(true)
    setError('')
    const res = await blackjackDeal(bet)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setId(res.id)
    setDealKey((k) => k + 1)
    setHand(res.hand)
    setBalance(res.balance)
  }

  async function act(a: 'hit' | 'stand' | 'double') {
    if (!id || busy) return
    setBusy(true)
    const res = await blackjackAct(id, a)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setHand(res.hand)
    setBalance(res.balance)
  }

  return (
    <div className="flex flex-col gap-3">
      <BjTable
        hand={hand}
        dealKey={dealKey}
        busy={busy}
        canDouble={!!hand && hand.player.length === 2 && points >= hand.bet}
        onAct={act}
        footer={
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Bahis">
              {settings.bets.map((b) => (
                <button
                  key={b}
                  role="radio"
                  aria-checked={bet === b}
                  onClick={() => setBet(b)}
                  className={cn('chip', bet === b && 'chip-active')}
                >
                  {formatAC(b)}
                </button>
              ))}
            </div>
            <button disabled={busy} onClick={deal} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50">
              <RotateCcw className="size-4" aria-hidden="true" />
              {hand ? 'Yeni el dağıt' : 'Kartları dağıt'}
            </button>
          </div>
        }
      />
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
      <p className="text-center text-xs text-muted-foreground">Blackjack 3:2 öder, krupiye 17’de durur. Kartlar sunucuda karılır.</p>
    </div>
  )
}

const DUEL_HANDS = 5
const DUEL_CHIPS = 1000
const DUEL_BET = 100

/** Score round for a player-vs-player duel: 5 hands with practice chips. */
export function BlackjackDuel({ onDone }: { onDone: (score: { for: number; against: number }) => void }) {
  const [state, setState] = useState<BjState>(() => bjDeal(DUEL_BET))
  const [chips, setChips] = useState(DUEL_CHIPS - DUEL_BET)
  const [handNo, setHandNo] = useState(1)

  function settle(s: BjState) {
    if (s.phase === 'done') setChips((c) => c + bjPayout(s))
  }

  function act(a: 'hit' | 'stand' | 'double') {
    if (a === 'double') setChips((c) => c - state.bet)
    const next = bjAct(state, a)
    setState(next)
    settle(next)
  }

  function nextHand() {
    if (handNo >= DUEL_HANDS) return onDone({ for: chips, against: 0 })
    const s = bjDeal(DUEL_BET)
    setChips((c) => c - DUEL_BET)
    setHandNo((n) => n + 1)
    setState(s)
    settle(s)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
        <span className="font-semibold text-foreground">
          El {handNo}/{DUEL_HANDS}
        </span>
        <span className="text-muted-foreground">
          Fiş <strong className="text-primary">{chips}</strong>
        </span>
      </div>
      <BjTable
        hand={bjPublic(state)}
        dealKey={handNo}
        busy={false}
        canDouble={state.player.length === 2 && chips >= state.bet}
        onAct={act}
        footer={
          <button onClick={nextHand} className="rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground">
            {handNo >= DUEL_HANDS ? 'Skoru gönder' : 'Sonraki el'}
          </button>
        }
      />
      <p className="text-center text-xs text-muted-foreground">
        {DUEL_CHIPS} antrenman fişiyle {DUEL_HANDS} el oyna. Sonunda daha çok fişi kalan masadaki KC’yi alır.
      </p>
    </div>
  )
}
