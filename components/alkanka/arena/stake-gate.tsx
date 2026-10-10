'use client'

import Image from 'next/image'
import { useState, type ReactNode } from 'react'
import { Coins, RotateCcw, Trophy, Undo2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_META, type ArenaGame, type ArenaGameSettings } from '@/lib/arena'
import { formatAC, usePoints } from '../points-context'
import { ParticleBurst } from '../games/particle-burst'

export type GameResult = 'win' | 'lose' | 'draw'
export type GameApi = { bet: number; finish: (result: GameResult, note?: string) => void }

type Phase = { kind: 'lobby' } | { kind: 'playing'; bet: number; round: number } | { kind: 'done'; bet: number; result: GameResult; note?: string; payout: number }

export function StakeGate({
  game,
  settings,
  rules,
  children,
}: {
  game: ArenaGame
  settings: ArenaGameSettings
  rules: string[]
  children: (api: GameApi) => ReactNode
}) {
  const meta = ARENA_META[game]
  const { points, spend, add } = usePoints()
  const [bet, setBet] = useState(settings.bets[0])
  const [phase, setPhase] = useState<Phase>({ kind: 'lobby' })
  const [round, setRound] = useState(0)
  const [error, setError] = useState('')

  function start(amount: number) {
    if (!spend(amount)) {
      setError('Bakiyen bu bahis için yetersiz.')
      return
    }
    setError('')
    const next = round + 1
    setRound(next)
    setPhase({ kind: 'playing', bet: amount, round: next })
  }

  function finish(result: GameResult, note?: string) {
    setPhase((p) => {
      if (p.kind !== 'playing') return p
      const payout = result === 'win' ? Math.round(p.bet * settings.multiplier) : result === 'draw' ? p.bet : 0
      if (payout > 0) add(payout)
      return { kind: 'done', bet: p.bet, result, note, payout }
    })
  }

  if (phase.kind === 'playing') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
          <span className="font-display font-bold uppercase tracking-wide text-foreground">{meta.title} masası</span>
          <span className="flex items-center gap-4 text-muted-foreground">
            <span>
              Bahis <strong className="text-foreground">{formatAC(phase.bet)} KC</strong>
            </span>
            <span>
              Kazanç <strong className="text-primary">{formatAC(Math.round(phase.bet * settings.multiplier))} KC</strong>
            </span>
          </span>
        </div>
        <div key={phase.round}>{children({ bet: phase.bet, finish })}</div>
      </div>
    )
  }

  if (phase.kind === 'done') {
    const won = phase.result === 'win'
    return (
      <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-2xl border border-primary/30 bg-card px-6 py-12 text-center">
        {won && <ParticleBurst key={round} count={28} distance={160} />}
        <span
          className={cn(
            'flex size-16 items-center justify-center rounded-2xl',
            won ? 'bg-primary text-primary-foreground glow-gold' : 'bg-secondary text-muted-foreground',
          )}
        >
          <Trophy className="size-8" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{meta.title}</p>
          <h2 className="font-display text-4xl font-bold uppercase text-foreground text-balance">
            {won ? 'Kazandın kanka!' : phase.result === 'draw' ? 'Berabere' : 'Bu el rakibin'}
          </h2>
          {phase.note && <p className="text-sm text-muted-foreground">{phase.note}</p>}
        </div>
        <p className="font-display text-3xl font-bold text-primary" aria-live="polite">
          {phase.payout > 0 ? `+${formatAC(phase.payout)} KC` : `-${formatAC(phase.bet)} KC`}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => start(phase.bet)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Aynı bahisle tekrar
          </button>
          <button
            onClick={() => setPhase({ kind: 'lobby' })}
            className="flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-bold uppercase tracking-wide text-foreground hover:bg-secondary"
          >
            <Undo2 className="size-4" aria-hidden="true" />
            Lobiye dön
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <section className="grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[1.05fr_1fr]">
      <div className="relative aspect-[4/3] lg:aspect-auto">
        <Image src={meta.image || '/placeholder.svg'} alt={`${meta.title} masası`} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-md bg-background/90 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
          <Users className="size-3.5" aria-hidden="true" />
          {meta.players}
        </span>
      </div>
      <div className="flex flex-col gap-6 p-6 lg:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Kanka Coin masası</p>
          <h2 className="font-display text-4xl font-bold uppercase text-foreground">{meta.title}</h2>
          <p className="leading-relaxed text-muted-foreground">{meta.short}</p>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-semibold text-foreground">Bahsini seç</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {settings.bets.map((b) => (
              <label
                key={b}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-0.5 rounded-xl border px-3 py-3 transition-colors',
                  bet === b ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
                  b > points && 'opacity-50',
                )}
              >
                <input type="radio" name="bet" value={b} checked={bet === b} onChange={() => setBet(b)} className="sr-only" />
                <span className="font-display text-lg font-bold text-foreground">{formatAC(b)}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">KC</span>
              </label>
            ))}
          </div>
        </fieldset>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border text-sm">
          <div className="flex flex-col gap-0.5 bg-surface px-4 py-3">
            <dt className="text-muted-foreground">Bakiyen</dt>
            <dd className="flex items-center gap-1.5 font-display text-lg font-bold text-foreground">
              <Coins className="size-4 text-primary" aria-hidden="true" />
              {formatAC(points)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 bg-surface px-4 py-3">
            <dt className="text-muted-foreground">Kazanırsan</dt>
            <dd className="font-display text-lg font-bold text-primary">
              {formatAC(Math.round(bet * settings.multiplier))} KC <span className="text-xs text-muted-foreground">({settings.multiplier}x)</span>
            </dd>
          </div>
        </dl>

        <button
          onClick={() => start(bet)}
          disabled={bet > points}
          className="rounded-xl bg-primary px-6 py-4 font-display text-lg font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Masaya otur
        </button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <details className="group rounded-xl border border-border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-foreground">Kurallar</summary>
          <ul className="mt-3 flex flex-col gap-2 leading-relaxed text-muted-foreground">
            {rules.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  )
}
