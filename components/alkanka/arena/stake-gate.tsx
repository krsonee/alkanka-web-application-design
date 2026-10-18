'use client'

import Image from 'next/image'
import { useRef, useState, type ReactNode } from 'react'
import { finishBotGame, startBotGame } from '@/app/actions/arena'
import { Bot, Coins, RotateCcw, Swords, Trophy, Undo2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_META, MODE_LABEL, type ArenaGame, type ArenaGameSettings, type GameMode } from '@/lib/arena'

const MODE_ICON: Record<GameMode, typeof Bot> = { bot: Bot, pvp: Swords }

/** Mode picker shown inside the stake menu; `onEnter` handles every mode StakeGate doesn't start itself. */
export type ModeSelect = {
  modes: GameMode[]
  mode: GameMode | null
  onChange: (m: GameMode) => void
  onEnter: (m: GameMode, bet: number) => void
  botExternal?: boolean
}
import { formatAC, usePoints } from '../points-context'
import { ParticleBurst } from '../games/particle-burst'
import { LandscapeFit } from './landscape-fit'

export type GameResult = 'win' | 'lose' | 'draw'
export type GameApi = { bet: number; finish: (result: GameResult, note?: string, score?: { for: number; against: number }) => void }

type Phase = { kind: 'lobby' } | { kind: 'playing'; bet: number; round: number } | { kind: 'done'; bet: number; result: GameResult; note?: string; payout: number; mars?: boolean }

export function StakeGate({
  game,
  settings,
  rules,
  children,
  modeSelect,
}: {
  game: ArenaGame
  settings: ArenaGameSettings
  rules: string[]
  children: (api: GameApi) => ReactNode
  modeSelect?: ModeSelect
}) {
  const meta = ARENA_META[game]
  const { points, setBalance, requireLogin } = usePoints()
  const [bet, setBet] = useState(settings.bets[0])
  const [phase, setPhase] = useState<Phase>({ kind: 'lobby' })
  const [round, setRound] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const session = useRef<string | null>(null)

  async function start(amount: number) {
    if (busy || !requireLogin()) return
    setBusy(true)
    const res = await startBotGame(game, amount)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    session.current = res.sessionId
    setBalance(res.balance)
    setError('')
    const next = round + 1
    setRound(next)
    setPhase({ kind: 'playing', bet: amount, round: next })
  }

  async function finish(result: GameResult, note?: string, score?: { for: number; against: number }) {
    const id = session.current
    if (!id || phase.kind !== 'playing') return
    session.current = null
    const playedBet = phase.bet
    const res = await finishBotGame(id, result === 'lose' ? 'loss' : result, score)
    if (!res.ok) {
      setError(res.error)
      setPhase({ kind: 'done', bet: playedBet, result, note, payout: 0 })
      return
    }
    setBalance(res.balance)
    const final: GameResult = res.result === 'loss' ? 'lose' : res.result
    const mars = game === 'tavla' && final === 'win' && score?.for === 15 && score.against === 0
    setPhase({ kind: 'done', bet: playedBet, result: final, note: final !== result ? 'Oyun çok kısa sürdüğü için galibiyet sayılmadı.' : note, payout: res.payout, mars })
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
        <div key={phase.round} className="mx-auto w-full max-w-[min(100%,56rem,calc((100dvh-6rem)*1.25))]">
          {game === 'kafa-topu' || game === 'kafa-basketbolu' ? (
            children({ bet: phase.bet, finish })
          ) : (
            <LandscapeFit>{children({ bet: phase.bet, finish })}</LandscapeFit>
          )}
        </div>
      </div>
    )
  }

  if (phase.kind === 'done') {
    const won = phase.result === 'win'
    return (
      <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-2xl border border-primary/30 bg-card px-6 py-12 text-center">
        {won && <ParticleBurst key={round} count={phase.mars ? 48 : 28} distance={phase.mars ? 220 : 160} />}
        {phase.mars && (
          <span className="animate-badge-pulse rounded-full border-2 border-primary bg-primary/15 px-4 py-1 font-display text-sm font-bold uppercase tracking-[0.3em] text-primary">
            Mars · 3x
          </span>
        )}
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
            {phase.mars ? 'Mars yaptın kanka!' : won ? 'Kazandın kanka!' : phase.result === 'draw' ? 'Berabere' : 'Bu el rakibin'}
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
      <div className="relative aspect-[16/7] sm:aspect-[4/3] lg:aspect-auto">
        <Image src={settings.image || meta.image || '/placeholder.svg'} alt={`${meta.title} masası`} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-card to-transparent sm:hidden" aria-hidden="true" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary sm:left-4 sm:top-4 sm:px-2.5 sm:py-1 sm:text-xs">
          <Users className="size-3.5" aria-hidden="true" />
          {meta.players}
        </span>
        <h2 className="absolute bottom-2 left-4 font-display text-2xl font-bold uppercase text-foreground sm:hidden">{meta.title}</h2>
      </div>
      <div className="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-1 sm:gap-2">
          <p className="hidden text-xs font-bold uppercase tracking-[0.2em] text-primary sm:block">Kanka Coin masası</p>
          <h2 className="hidden font-display text-4xl font-bold uppercase text-foreground sm:block">{meta.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{meta.short}</p>
        </div>

        {modeSelect && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold text-foreground sm:mb-3">
              Oyun modunu seç <span className="text-primary">*</span>
            </legend>
            <div className={cn('grid gap-2', modeSelect.modes.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
              {modeSelect.modes.map((m) => {
                const Icon = MODE_ICON[m]
                const active = modeSelect.mode === m
                return (
                  <label
                    key={m}
                    className={cn(
                      'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2.5 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary sm:gap-1.5 sm:px-2 sm:py-3',
                      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-foreground hover:border-primary/50',
                    )}
                  >
                    <input type="radio" name="mode" value={m} checked={active} onChange={() => modeSelect.onChange(m)} className="sr-only" />
                    <Icon className="size-4 sm:size-5" aria-hidden="true" />
                    <span className="text-[11px] font-bold uppercase leading-tight tracking-wide sm:text-xs">{MODE_LABEL[m]}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold text-foreground sm:mb-3">Bahsini seç</legend>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {settings.bets.map((b) => (
              <label
                key={b}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-0 rounded-xl border px-1 py-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary sm:gap-0.5 sm:px-3 sm:py-3',
                  bet === b ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
                  b > points && 'opacity-50',
                )}
              >
                <input type="radio" name="bet" value={b} checked={bet === b} onChange={() => setBet(b)} className="sr-only" />
                <span className="font-display text-base font-bold text-foreground sm:text-lg">{formatAC(b)}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[11px]">KC</span>
              </label>
            ))}
          </div>
        </fieldset>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border text-sm">
          <div className="flex flex-col gap-0.5 bg-surface px-3 py-2 sm:px-4 sm:py-3">
            <dt className="text-xs text-muted-foreground sm:text-sm">Bakiyen</dt>
            <dd className="flex items-center gap-1.5 font-display text-base font-bold text-foreground sm:text-lg">
              <Coins className="size-4 text-primary" aria-hidden="true" />
              {formatAC(points)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 bg-surface px-3 py-2 sm:px-4 sm:py-3">
            <dt className="text-xs text-muted-foreground sm:text-sm">Kazanırsan</dt>
            <dd className="font-display text-base font-bold text-primary sm:text-lg">
              {formatAC(Math.round(bet * settings.multiplier))} KC <span className="text-xs text-muted-foreground">({settings.multiplier}x)</span>
            </dd>
          </div>
        </dl>

        <button
          onClick={() => {
            if (!modeSelect) return start(bet)
            const m = modeSelect.mode
            if (!m) return
            if (m === 'bot' && !modeSelect.botExternal) return start(bet)
            if (!requireLogin()) return
            modeSelect.onEnter(m, bet)
          }}
          disabled={(modeSelect != null && modeSelect.mode == null) || bet > points}
          className="rounded-xl bg-primary px-6 py-3.5 font-display text-base font-bold uppercase tracking-wide text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:py-4 sm:text-lg"
        >
          {!modeSelect || modeSelect.mode === 'bot' ? 'Masaya otur' : modeSelect.mode === 'pvp' ? 'Oyuncu masalarına geç' : 'Önce oyun modunu seç'}
        </button>
        {modeSelect && modeSelect.mode == null && (
          <p className="-mt-3 text-center text-xs text-muted-foreground">Devam etmek için bir oyun modu seçmen gerekiyor.</p>
        )}
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
