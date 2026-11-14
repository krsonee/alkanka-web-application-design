'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cancelBotGame, finishBotGame, markBotGameStarted, matchNow, playBotsNow, startBotGame } from '@/app/actions/arena'
import { Bot, Coins, HelpCircle, Loader2, LogOut, Play, RotateCcw, Swords, Undo2, UserPlus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ARENA_META, botFillSeconds, botWinMultiplier, quickSeats, tablePot, type ArenaGame, type ArenaGameSettings } from '@/lib/arena'
import { formatAC, usePoints } from '../points-context'
import { ParticleBurst } from '../games/particle-burst'
import { LandscapeFit } from './landscape-fit'
import { SoundToggle } from './sound-toggle'
import { GameErrorBoundary } from './game-error-boundary'
import { GameResultCard } from './game-result-card'
import { MatchRecapBlock, useMatchRecap } from './match-recap'
import { clearSaved } from './saved-game'
import { TableThemeField } from './table-theme'
import { arenaThemeGame } from '@/lib/table-themes'
import { guestTrialUsed, isGuestTrialGame, markGuestTrialUsed } from '@/lib/guest-trial'

/** What the lobby's two play buttons do for this game. */
export type QuickPlay = {
  /** session: the bot game runs in the browser and settles through a solo session. table: a server-run table full of bots. */
  bot: 'session' | 'table' | null
  /** Player tables are on, so "Hemen eşleş" and the table list are offered. */
  pvp: boolean
  /** The member now sits at this table. */
  onTable: (id: string, stake: number) => void
  /** Waiting tables and the custom-table entry, shown under the play buttons. */
  tables?: ReactNode
}

/** A 0 KC bot game: nothing is staked, so it never reaches the server and earns nothing. */
const PRACTICE_SESSION = 'pratik'

export type GameResult = 'win' | 'lose' | 'draw'
/** `saveKey` is set per bot session; games that support it snapshot their state under it so a refresh resumes the same position. */
export type GameApi = {
  bet: number
  /** What a plain win pays back, commission already taken off. */
  win?: number
  finish: (result: GameResult, note?: string, score?: { for: number; against: number }) => void
  /** Gives up the hand: it counts as a loss and lands on the result card. */
  leave?: () => void
  /** Leaves before the match kicked off: the stake is refunded. A match that already started counts as a loss instead. */
  cancel?: () => void
  /** Reports that the match itself has started, which ends the refund window. */
  kickoff?: () => void
  /** False when this session already kicked off earlier, so leaving it forfeits the stake. */
  refundable?: boolean
  /** Settles this hand and immediately stakes the same bet on a fresh one, skipping the result screen. */
  again?: (result: GameResult, note?: string, score?: { for: number; against: number }) => void
  saveKey?: string
}

type Phase =
  | { kind: 'lobby' }
  | { kind: 'playing'; bet: number; round: number; resumed?: boolean; started?: boolean }
  | { kind: 'done'; bet: number; result: GameResult; note?: string; payout: number; mars?: boolean }

const SAVE_AWARE: ArenaGame[] = ['tavla', 'okey']
/** These take over the whole window, so an unfinished session asks first instead of dropping the player into it. */
const FULLSCREEN: ArenaGame[] = ['kafa-topu', 'kafa-basketbolu']

type PendingSession = { sessionId: string; stake: number; started: boolean }

function PendingSessionCard({
  pending,
  busy,
  onResume,
  onDrop,
}: {
  pending: PendingSession
  busy: boolean
  onResume: () => void
  onDrop: () => void
}) {
  const [arming, setArming] = useState(false)
  useEffect(() => {
    if (!arming) return
    const t = setTimeout(() => setArming(false), 3000)
    return () => clearTimeout(t)
  }, [arming])
  const forfeit = pending.started
  const stake = formatAC(pending.stake)
  return (
    <div role="group" aria-label="Yarım kalan maç" className="flex flex-col gap-3 rounded-xl border border-primary/50 bg-primary/10 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold text-foreground">Yarım kalan maçın var · {stake} KC bahis</p>
        <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
          {forfeit
            ? 'Devam edersen maç aynı bahisle baştan başlar. Bırakırsan maç kaybedilmiş sayılır.'
            : 'Bu maç hiç başlamadı. Devam edebilir ya da bahsini geri alabilirsin.'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onResume}
          className="rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60"
        >
          Devam et
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => (forfeit && !arming ? setArming(true) : onDrop())}
          className={cn(
            'rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors disabled:opacity-60',
            arming ? 'border-destructive bg-destructive/15 text-destructive' : 'border-border bg-card text-foreground hover:bg-secondary',
          )}
        >
          {forfeit ? (arming ? 'Emin misin? Bahis yanar' : `Bırak · ${stake} KC yanar`) : `Bırak · ${stake} KC iade`}
        </button>
      </div>
    </div>
  )
}

/** Leaving forfeits the stake, so the first tap only arms the button. */
function LeaveTableButton({ onLeave }: { onLeave: () => void }) {
  const [arming, setArming] = useState(false)
  useEffect(() => {
    if (!arming) return
    const t = setTimeout(() => setArming(false), 3000)
    return () => clearTimeout(t)
  }, [arming])
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => (arming ? onLeave() : setArming(true))}
      className={cn(
        'flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-bold transition-colors',
        arming ? 'border-destructive bg-destructive/15 text-destructive' : 'border-border bg-secondary text-foreground hover:bg-secondary/70',
      )}
    >
      <LogOut className="size-4" aria-hidden="true" />
      {arming ? 'Emin misin? Bahis yanar' : 'Masadan ayrıl'}
    </button>
  )
}

export function StakeGate({
  game,
  settings,
  rules,
  children,
  quick,
}: {
  game: ArenaGame
  settings: ArenaGameSettings
  rules: string[]
  children: (api: GameApi) => ReactNode
  quick: QuickPlay
}) {
  const meta = ARENA_META[game]
  const { member, points, loading, setBalance, requireLogin, refresh } = usePoints()
  const [bet, setBet] = useState(settings.bets[0])
  const [phase, setPhase] = useState<Phase>({ kind: 'lobby' })
  const [round, setRound] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'bot' | 'match' | 'pending' | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [pending, setPending] = useState<PendingSession | null>(null)
  const [notice, setNotice] = useState('')
  const session = useRef<string | null>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const resumeChecked = useRef(false)
  const [resumeKnown, setResumeKnown] = useState(false)
  const practiceDone = phase.kind === 'done' && phase.bet === 0
  const { recap, loading: recapLoading } = useMatchRecap(phase.kind === 'done' && member && !practiceDone ? { game, round } : null)
  const guest = !member && !loading
  const trialGame = quick.bot === 'session' && isGuestTrialGame(game)
  const [trialUsed, setTrialUsed] = useState(false)

  useEffect(() => {
    setTrialUsed(guestTrialUsed())
  }, [])

  useEffect(() => {
    if (!member || resumeChecked.current) return
    resumeChecked.current = true
    fetch(`/api/arena/open-session?game=${encodeURIComponent(game)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<{ session: PendingSession | null }>) : { session: null }))
      .then((res) => {
        if (!res.session || phaseRef.current.kind !== 'lobby') return
        if (FULLSCREEN.includes(game)) {
          setPending(res.session)
          return
        }
        session.current = res.session.sessionId
        setRound((r) => r + 1)
        setPhase({ kind: 'playing', bet: res.session.stake, round: Date.now(), resumed: true })
      })
      .catch(() => {})
      .finally(() => setResumeKnown(true))
  }, [member, game])

  function resumePending() {
    if (!pending) return
    session.current = pending.sessionId
    setRound((r) => r + 1)
    setNotice('')
    setPhase({ kind: 'playing', bet: pending.stake, round: Date.now(), resumed: true, started: pending.started })
    setPending(null)
  }

  async function dropPending() {
    if (!pending || busy) return
    setBusy('pending')
    const res = pending.started ? await finishBotGame(pending.sessionId, 'loss') : await cancelBotGame(pending.sessionId)
    setBusy(null)
    setPending(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setBalance(res.balance)
    setError('')
    setNotice(
      pending.started
        ? `Yarım kalan maç kapatıldı, ${formatAC(pending.stake)} KC bahsin yandı.`
        : `Yarım kalan maç kapatıldı, ${formatAC(pending.stake)} KC bahsin iade edildi.`,
    )
  }

  async function start(amount: number) {
    if (busy) return
    // A guest gets one hand, always a practice one; anything else asks for an account.
    const trial = guest && trialGame && !guestTrialUsed()
    if (!trial && !requireLogin()) return
    if (trial || amount === 0) {
      session.current = PRACTICE_SESSION
    } else {
      setBusy('bot')
      const res = await startBotGame(game, amount)
      setBusy(null)
      if (!res.ok) {
        setError(res.error)
        return
      }
      session.current = res.sessionId
      setBalance(res.balance)
    }
    setError('')
    setNotice('')
    const next = round + 1
    setRound(next)
    setPhase({ kind: 'playing', bet: trial ? 0 : amount, round: next })
  }

  async function finish(result: GameResult, note?: string, score?: { for: number; against: number }) {
    const id = session.current
    if (!id || phase.kind !== 'playing') return
    session.current = null
    clearSaved(`${game}:${id}`)
    const playedBet = phase.bet
    if (id === PRACTICE_SESSION) {
      if (!member) {
        markGuestTrialUsed()
        setTrialUsed(true)
      }
      setPhase({ kind: 'done', bet: 0, result, note, payout: 0 })
      return
    }
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
    const leave = () => void finish('lose', 'Masadan ayrıldın.')
    const again = async (result: GameResult, note?: string, score?: { for: number; against: number }) => {
      const sameBet = phase.bet
      await finish(result, note, score)
      // A guest's single hand ends at the result card, where the membership prompt is.
      if (member) await start(sameBet)
    }
    const cancel = async () => {
      const id = session.current
      if (!id) return
      if (id === PRACTICE_SESSION) {
        session.current = null
        setPhase({ kind: 'lobby' })
        return
      }
      const res = await cancelBotGame(id)
      if (res.ok) {
        session.current = null
        setBalance(res.balance)
        setError('')
        setNotice(`Maç başlamadı, ${formatAC(res.refund)} KC bahsin iade edildi.`)
        setPhase({ kind: 'lobby' })
        return
      }
      if ('started' in res) {
        await finish('lose', 'Yarıda bırakılan maç kaybedilmiş sayılır.')
        return
      }
      session.current = null
      setError(res.error)
      setPending({ sessionId: id, stake: phase.bet, started: false })
      setPhase({ kind: 'lobby' })
    }
    const kickoff = () => {
      const id = session.current
      if (id && id !== PRACTICE_SESSION) void markBotGameStarted(id)
    }
    const api: GameApi = {
      bet: phase.bet,
      win: Math.floor(phase.bet * botWinMultiplier(game, settings)),
      finish,
      leave,
      again,
      cancel,
      kickoff,
      refundable: !phase.started,
      saveKey,
    }
    return (
      <div data-table-playing className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
          <span className="font-display font-bold uppercase tracking-wide text-foreground">{meta.title} masası</span>
          {phase.bet === 0 ? (
            <span className="text-muted-foreground">{guest ? 'Deneme eli · üyelik gerekmez, KC kazandırmaz' : 'Pratik maçı · KC ve KP kazandırmaz'}</span>
          ) : (
            <span className="flex items-center gap-4 text-muted-foreground">
              <span>
                Bahis <strong className="text-foreground">{formatAC(phase.bet)} KC</strong>
              </span>
              <span>
                Kazanç <strong className="text-primary">{formatAC(Math.floor(phase.bet * botWinMultiplier(game, settings)))} KC</strong>
              </span>
            </span>
          )}
        </div>
        {phase.resumed && (
          <FadingNotice key={`notice-${phase.round}`}>
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
          <GameErrorBoundary label={meta.title}>
            {game === 'kafa-topu' || game === 'kafa-basketbolu' || game === 'bilardo' ? (
              children(api)
            ) : (
              <LandscapeFit
                label={meta.title}
                expandable
                force={game === 'tavla' || game === 'okey'}
                menu={
                  game === 'tavla' ? (
                    <>
                      <SoundToggle />
                      <LeaveTableButton onLeave={() => void leave()} />
                    </>
                  ) : undefined
                }
              >
                {children(api)}
              </LandscapeFit>
            )}
          </GameErrorBoundary>
        </div>
      </div>
    )
  }

  if (phase.kind === 'done') {
    const won = phase.result === 'win'
    const draw = phase.result === 'draw'
    return (
      <div className="relative flex flex-col items-center gap-3 py-4">
        {won && <ParticleBurst key={round} count={phase.mars ? 48 : 28} distance={phase.mars ? 220 : 160} />}
        <GameResultCard
          outcome={won ? 'win' : draw ? 'draw' : 'lose'}
          title={phase.mars ? 'Mars yaptın kanka!' : won ? 'Kazandın kanka!' : draw ? 'Berabere' : 'Bu el rakibin'}
          subtitle={
            phase.note ??
            (guest
              ? won
                ? 'Deneme elini aldın kanka. Gerçek masada bu el sana KC kazandırırdı.'
                : draw
                  ? 'Deneme eli berabere bitti.'
                  : 'Deneme eli botun oldu. Üye ol, rövanşı gerçek masada al.'
              : practiceDone
              ? won
                ? 'Pratik maçını aldın. Hazırsan KC ile oyna.'
                : draw
                  ? 'Pratik maçı berabere bitti.'
                  : 'Pratik maçı botun oldu. Bir el daha dene.'
              : won
              ? `${formatAC(phase.bet)} KC bahsine ${formatAC(phase.payout)} KC geri döndü.`
              : draw
                ? 'Bahsin iade edildi.'
                : `${formatAC(phase.bet)} KC bahsin masada kaldı.`)
          }
          gameTitle={meta.title}
          gameImage={meta.image}
          stake={phase.bet}
          delta={phase.payout - phase.bet}
          badge={phase.mars ? 'Mars · 3x' : undefined}
          players={[]}
          recap={
            guest ? (
              <p className="w-full rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-pretty text-sm leading-relaxed text-foreground">
                Bu bir deneme eliydi, KC dönmedi. Ücretsiz üye olunca hediye KC hesabına yüklenir ve bahisli masalarda kazandığın KC senin olur.
              </p>
            ) : practiceDone ? (
              <p className="w-full rounded-xl border border-border bg-background/40 px-3 py-2.5 text-pretty text-sm leading-relaxed text-muted-foreground">
                Pratik maçı: KC yatırılmaz, KC ve Kanka Puanı kazandırmaz, görevlere sayılmaz.
              </p>
            ) : (
              <MatchRecapBlock recap={recap} loading={recapLoading} />
            )
          }
        >
          {guest ? (
            <>
              <a
                href="#kayit"
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-base font-black text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
              >
                <UserPlus className="size-4" aria-hidden="true" />
                Ücretsiz üye ol, hediye KC al
              </a>
              <a
                href="#giris"
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-primary/50 py-2.5 text-sm font-bold text-foreground hover:bg-primary/10"
              >
                Zaten üyeyim, giriş yap
              </a>
            </>
          ) : (
            <button
              type="button"
              onClick={() => start(phase.bet)}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-base font-black text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {practiceDone ? 'Bir el daha · pratik' : `Bir el daha · ${formatAC(phase.bet)} KC`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPhase({ kind: 'lobby' })}
            className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-bold text-foreground hover:bg-secondary"
          >
            <Undo2 className="size-4" aria-hidden="true" />
            Lobiye dön
          </button>
        </GameResultCard>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  const practice = bet === 0
  const seats = quickSeats(game)
  const botTable = tablePot(game, bet, settings.commission, { humans: 1, bots: seats - 1 })
  const botWin = quick.bot === 'table' ? Math.floor(botTable.net) : Math.floor(bet * botWinMultiplier(game, settings))
  const botRate =
    quick.bot === 'table'
      ? `pot ${formatAC(botTable.pot)} KC · %${botTable.cut} kesinti`
      : game === 'okey'
        ? `${botWinMultiplier(game, settings).toLocaleString('tr-TR')}x · okeyle ya da çiftten bitiş 2 kat`
        : `${settings.multiplier.toLocaleString('tr-TR')}x`
  const fullTable = tablePot(game, bet, settings.commission, { humans: seats, bots: 0 })
  const fillSeconds = botFillSeconds(game, true)
  const blocked = !practice && !!member && bet > points
  // Starting a bot session closes any session still open for this game, so the bot button waits until we know
  // whether there is one to resume; it also waits for the member lookup so a member never hits the login wall.
  const checking = loading || (!!member && quick.bot === 'session' && !resumeKnown)
  const guestTrial = guest && trialGame && !trialUsed
  const themeGame = arenaThemeGame(game)

  async function playBots() {
    if (busy || !requireLogin()) return
    if (quick.bot === 'session') return start(bet)
    setBusy('bot')
    const res = await playBotsNow(game, bet)
    setBusy(null)
    refresh()
    if (!res.ok) return setError(res.error)
    setError('')
    quick.onTable(res.id, bet)
  }

  async function findMatch() {
    if (busy || !requireLogin()) return
    setBusy('match')
    const res = await matchNow(game, bet)
    setBusy(null)
    refresh()
    if (!res.ok) return setError(res.error)
    setError('')
    quick.onTable(res.id, bet)
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative aspect-[16/7] sm:aspect-[4/3] lg:aspect-auto lg:min-h-full">
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
        {pending && <PendingSessionCard pending={pending} busy={busy != null} onResume={resumePending} onDrop={() => void dropPending()} />}
        {notice && (
          <p role="status" className="text-pretty rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm leading-relaxed text-foreground">
            {notice}
          </p>
        )}

        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-foreground">
            Bahsini seç
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Coins className="size-3.5 text-primary" aria-hidden="true" />
              {member ? `Bakiye ${formatAC(points)}` : loading ? 'Bakiye…' : 'Üye olunca hediye KC'}
            </span>
          </legend>
          <div className="grid grid-cols-4 gap-2">
            {[...(quick.bot ? [0] : []), ...settings.bets].map((b) => {
              const active = bet === b
              const short = b > 0 && !!member && b > points
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
                  <span className="font-display text-lg font-bold leading-tight tabular-nums">{b === 0 ? 'Pratik' : formatAC(b)}</span>
                  <span className={cn('text-[10px] font-semibold uppercase tracking-wider', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {b === 0 ? '0 KC' : short ? 'Yetersiz' : 'KC'}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {themeGame && (
          // Below the play buttons on phones: picking a look must not push "Oyna" off the first screen.
          <div className="max-lg:order-1">
            <TableThemeField game={themeGame} />
          </div>
        )}

        <div className="flex flex-col gap-2">
          {guestTrial && (
            <PlayRow
              icon={Play}
              primary
              label="Üye olmadan bir el dene"
              busy={false}
              disabled={busy != null}
              onClick={() => void start(0)}
              caption="Deneme eli · bota karşı"
              amount="Bahissiz"
              detail="üyelik gerekmez · KC kazandırmaz"
            />
          )}
          {quick.bot && (
            <PlayRow
              icon={Bot}
              primary={!guestTrial}
              label="Bota karşı hemen oyna"
              busy={busy === 'bot' || checking}
              disabled={busy != null || checking || blocked || pending != null}
              onClick={() => void playBots()}
              caption={practice ? 'Pratik maçı' : game === 'papaz' ? `Dağıtılan pot · ${formatAC(bet)} KC bahis` : `Botu yenersen · ${formatAC(bet)} KC bahis`}
              amount={practice ? 'Bahissiz' : `${formatAC(botWin)} KC`}
              detail={practice ? 'KC ve Kanka Puanı kazandırmaz' : botRate}
            />
          )}
          {quick.pvp && (
            <PlayRow
              icon={Swords}
              primary={!quick.bot}
              label="Hemen eşleş"
              busy={busy === 'match'}
              disabled={busy != null || blocked || practice}
              onClick={() => void findMatch()}
              caption={`Oyuncuya karşı · ${seats} kişilik masa`}
              amount={practice ? 'Bahis seç' : `${formatAC(Math.floor(fullTable.net))} KC`}
              detail={
                practice
                  ? 'Oyuncu masası için bir bahis seç'
                  : fillSeconds
                    ? `dolu masada · ${fillSeconds} sn'de rakip gelmezse bot oturur`
                    : `pot ${formatAC(fullTable.pot)} KC · %${fullTable.cut} kesinti`
              }
            />
          )}
        </div>
        {blocked && (
          <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
            {'Bu bahis için bakiyen yetmiyor. Daha düşük bir bahis seç, pratik maçı oyna ya da '}
            <a href="/gorevler" className="font-semibold text-primary underline-offset-2 hover:underline">
              görevlerden KC kazan
            </a>
            .
          </p>
        )}
        {!member && !loading && (
          <button
            type="button"
            onClick={() => requireLogin()}
            className="-mt-1 flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-primary/20"
          >
            <Coins className="size-4 text-primary" aria-hidden="true" />
            {trialGame && trialUsed
              ? 'Deneme elini oynadın. Devam etmek için ücretsiz üye ol, hediye KC hesabına yüklensin'
              : 'Oynamak için ücretsiz üye ol, hediye KC hesabına yüklensin'}
          </button>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {quick.pvp && quick.tables}

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

function PlayRow({
  icon: Icon,
  label,
  caption,
  amount,
  detail,
  primary = false,
  busy,
  disabled,
  onClick,
}: {
  icon: typeof Bot
  label: string
  caption: string
  amount: string
  detail: string
  primary?: boolean
  busy: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-1 basis-40 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{caption}</span>
        <span className="flex flex-wrap items-baseline gap-x-1.5 font-display text-xl font-bold tabular-nums text-primary">
          <span className="whitespace-nowrap">{amount}</span>
          <span className="text-xs font-medium text-muted-foreground">{detail}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={busy}
        className={cn(
          'flex shrink-0 grow items-center justify-center gap-2 rounded-xl px-4 py-3 font-display text-sm font-bold uppercase tracking-wide transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:grow-0',
          primary
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 glow-gold hover:brightness-110 disabled:shadow-none'
            : 'border border-primary/60 bg-primary/10 text-foreground hover:bg-primary/20',
        )}
      >
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Icon className="size-5" aria-hidden="true" />}
        {label}
      </button>
    </div>
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
