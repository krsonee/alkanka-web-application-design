'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { finishBotGame, getOpenBotGame, startBotGame } from '@/app/actions/arena'
import { Bot, Coins, HelpCircle, Loader2, Play, RotateCcw, Swords, Trophy, Undo2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_META, MODE_LABEL, type ArenaGame, type ArenaGameSettings, type GameMode } from '@/lib/arena'
import { formatAC, usePoints } from '../points-context'
import { ParticleBurst } from '../games/particle-burst'
import { LandscapeFit } from './landscape-fit'
import { clearSaved, loadMode, saveMode } from './saved-game'

const MODE_ICON: Record<GameMode, typeof Bot> = { bot: Bot, pvp: Swords }

/** Mode picker shown inside the stake menu; `onEnter` handles every mode StakeGate doesn't start itself. */
export type ModeSelect = {
  modes: GameMode[]
  mode: GameMode | null
  onChange: (m: GameMode) => void
  onEnter: (m: GameMode, bet: number) => void
  botExternal?: boolean
}

export type GameResult = 'win' | 'lose' | 'draw'
/** `saveKey` is set per bot session; games that support it snapshot their state under it so a refresh resumes the same position. */
export type GameApi = {
  bet: number
  finish: (result: GameResult, note?: string, score?: { for: number; against: number }) => void
  saveKey?: string
}

type Phase =
  | { kind: 'lobby' }
  | { kind: 'playing'; bet: number; round: number; resumed?: boolean }
  | { kind: 'done'; bet: number; result: GameResult; note?: string; payout: number; mars?: boolean }

const SAVE_AWARE: ArenaGame[] = ['tavla', 'okey']

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
  const { member, points, setBalance, requireLogin } = usePoints()
  const [bet, setBet] = useState(settings.bets[0])
  const [phase, setPhase] = useState<Phase>({ kind: 'lobby' })
  const [round, setRound] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const session = useRef<string | null>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const resumeChecked = useRef(false)
  const pvpMode = modeSelect?.mode === 'pvp'
  const singleMode = modeSelect != null && modeSelect.modes.length === 1

  useEffect(() => {
    if (!modeSelect || modeSelect.mode != null) return
    const remembered = loadMode(game) as GameMode | null
    modeSelect.onChange(remembered && modeSelect.modes.includes(remembered) ? remembered : modeSelect.modes[0])
  }, [modeSelect, game])

  useEffect(() => {
    if (!member || resumeChecked.current || modeSelect?.botExternal) return
    resumeChecked.current = true
    getOpenBotGame(game).then((res) => {
      if (!res.session || phaseRef.current.kind !== 'lobby') return
      session.current = res.session.sessionId
      setRound((r) => r + 1)
      setPhase({ kind: 'playing', bet: res.session.stake, round: Date.now(), resumed: true })
    })
  }, [member, game, modeSelect?.botExternal])

  function pickMode(m: GameMode) {
    saveMode(game, m)
    modeSelect?.onChange(m)
  }

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
    clearSaved(`${game}:${id}`)
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
    setPhase({ kind: 'done', bet: playedBet, result: final, note: res.note ?? note, payout: res.payout, mars })
  }

  if (phase.kind === 'playing') {
    const saveKey = session.current ? `${game}:${session.current}` : undefined
    const api: GameApi = { bet: phase.bet, finish, saveKey }
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
        {phase.resumed && (
          <FadingNotice key={phase.round}>
            {SAVE_AWARE.includes(game)
              ? 'Kaldığın yerden devam ediyorsun kanka, bahsin masada duruyor.'
              : 'Yarım kalan masana geri döndün. Bahsin korunuyor, bu el baştan başlıyor.'}
          </FadingNotice>
        )}
        <div
          key={phase.round}
          className={cn(
            'mx-auto w-full',
            game === 'tavla'
              ? 'max-w-[min(100%,76rem,calc((100dvh-9rem)*1.3))]'
              : game === 'bilardo'
                ? 'max-w-[min(100%,84rem,calc((100dvh-9rem)*1.87))]'
                : game === 'okey'
                ? 'max-w-[min(100%,56rem,calc((100dvh-6rem)*1.25))] lg:max-w-[min(100%,80rem,calc((100dvh-7rem)*1.75))]'
                : 'max-w-[min(100%,56rem,calc((100dvh-6rem)*1.25))]',
          )}
        >
          {game === 'kafa-topu' || game === 'kafa-basketbolu' || game === 'bilardo' ? children(api) : <LandscapeFit label={meta.title} force={game === 'tavla'}>{children(api)}</LandscapeFit>}
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

  const pvpWin = bet * 2 - Math.round((bet * 2 * settings.commission) / 100)
  const winAmount = pvpMode ? pvpWin : Math.round(bet * settings.multiplier)
  const blocked = !pvpMode && bet > points

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-full">
        <Image src={settings.image || meta.image || '/placeholder.svg'} alt={`${meta.title} masası`} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover object-top" />
        <span className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 lg:p-8">
          <span className="flex w-fit items-center gap-1.5 rounded-md bg-background/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
            <Users className="size-3.5" aria-hidden="true" />
            {meta.players}
          </span>
          <h2 className="font-display text-3xl font-bold uppercase leading-none text-foreground lg:text-5xl">{meta.title}</h2>
          <p className="line-clamp-1 text-sm text-muted-foreground lg:line-clamp-none">{meta.short}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
        {modeSelect && !singleMode && (
          <div role="radiogroup" aria-label="Oyun modu" className="grid grid-cols-2 gap-1 rounded-xl bg-secondary/60 p-1">
            {modeSelect.modes.map((m) => {
              const Icon = MODE_ICON[m]
              const active = modeSelect.mode === m
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => pickMode(m)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors',
                    active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-background/60',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {MODE_LABEL[m]}
                </button>
              )
            })}
          </div>
        )}

        {pvpMode ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Gerçek kankalarla oyna. Açık bir masaya otur ya da kendi masanı aç, bahsi masa sahibi belirler.
          </p>
        ) : (
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-foreground">
              Bahsini seç
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Coins className="size-3.5 text-primary" aria-hidden="true" />
                Bakiye {formatAC(points)}
              </span>
            </legend>
            <div className="grid grid-cols-4 gap-2">
              {settings.bets.map((b) => {
                const active = bet === b
                const short = b > points
                return (
                  <label
                    key={b}
                    className={cn(
                      'flex min-w-0 cursor-pointer flex-col items-center rounded-xl border px-1 py-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary',
                      active ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'border-border bg-surface text-foreground hover:border-primary/50',
                      short && !active && 'opacity-45',
                    )}
                  >
                    <input type="radio" name="bet" value={b} checked={active} onChange={() => setBet(b)} className="sr-only" />
                    <span className="font-display text-lg font-bold leading-tight tabular-nums">{formatAC(b)}</span>
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wider', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                      {short ? 'Yetersiz' : 'KC'}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {pvpMode ? `Oyuncu masası · ${formatAC(bet)} KC bahis` : `Botu yenersen · ${formatAC(bet)} KC bahis`}
            </span>
            <span className="flex flex-wrap items-baseline gap-x-1 font-display text-xl font-bold tabular-nums text-primary">
              <span className="whitespace-nowrap">{formatAC(winAmount)} KC</span>
              <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                {pvpMode ? `%${settings.commission} kesinti` : `${settings.multiplier}x`}
              </span>
            </span>
          </div>
          <button
            onClick={() => {
              if (!modeSelect) return start(bet)
              const m = modeSelect.mode
              if (!m) return
              if (m === 'bot' && !modeSelect.botExternal) return start(bet)
              if (!requireLogin()) return
              modeSelect.onEnter(m, bet)
            }}
            disabled={busy || (modeSelect != null && modeSelect.mode == null) || blocked}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-3.5 font-display text-base font-bold uppercase tracking-wide text-primary-foreground shadow-lg shadow-primary/30 glow-gold transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : pvpMode ? <Swords className="size-5" aria-hidden="true" /> : <Play className="size-5" aria-hidden="true" />}
            {pvpMode ? 'Masalara geç' : 'Oyna'}
          </button>
        </div>
        {blocked && <p className="-mt-2 text-xs text-muted-foreground">Bu bahis için bakiyen yetmiyor, daha düşük bir bahis seç.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          aria-expanded={showRules}
          className="flex items-center gap-2 self-start text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="size-4" aria-hidden="true" />
          {showRules ? 'Kuralları gizle' : 'Nasıl oynanır?'}
        </button>
        {showRules && (
          <ul className="-mt-2 flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-muted-foreground">
            {rules.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function FadingNotice({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4500)
    return () => clearTimeout(t)
  }, [])
  if (!visible) return null
  return (
    <p role="status" className="animate-in fade-in rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm leading-relaxed text-foreground">
      {children}
    </p>
  )
}
