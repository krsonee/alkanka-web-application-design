'use client'

import { useState } from 'react'
import { Hand, Layers, Plus, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { blackjackAct, blackjackDeal } from '@/app/actions/arena'
import { RANKS, SUITS, bjAct, bjDeal, bjPayout, bjPublic, type BjPublic, type BjState, type Card } from '@/lib/casino'
import type { ArenaGameSettings } from '@/lib/arena'
import { formatAC, usePoints } from '../points-context'
import { TableBrand } from './table-brand'

export function PlayingCard({ card, hidden, index = 0 }: { card?: Card; hidden?: boolean; index?: number }) {
  const red = card && (card.s === 1 || card.s === 2)
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

function BjTable({
  hand,
  busy,
  canDouble,
  onAct,
  footer,
}: {
  hand: BjPublic | null
  busy: boolean
  canDouble: boolean
  onAct: (a: 'hit' | 'stand' | 'double') => void
  footer: React.ReactNode
}) {
  return (
    <div className="felt-table relative flex min-h-[26rem] flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-primary/30 p-4 sm:p-8">
      <TableBrand />
      <div className="relative flex flex-col items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Krupiye {hand ? `- ${hand.dealerValue}${hand.dealerHidden ? '+' : ''}` : ''}</p>
        <div className="flex min-h-24 justify-center -space-x-6 sm:min-h-32 sm:-space-x-8">
          {hand?.dealer.map((c, i) => <PlayingCard key={`d${i}-${c.r}-${c.s}`} card={c} index={i} />)}
          {hand?.dealerHidden && <PlayingCard hidden index={1} />}
        </div>
      </div>

      <div className="relative flex min-h-10 items-center justify-center">
        {hand?.phase === 'done' && hand.result && (
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
        <div className="flex min-h-24 justify-center -space-x-6 sm:min-h-32 sm:-space-x-8">
          {hand?.player.map((c, i) => <PlayingCard key={`p${i}-${c.r}-${c.s}`} card={c} index={i} />)}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Senin elin {hand ? `- ${hand.playerValue}` : ''}</p>
      </div>

      <div className="relative flex flex-wrap items-center justify-center gap-2">
        {hand?.phase === 'player' ? (
          <>
            <button disabled={busy} onClick={() => onAct('hit')} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50">
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
