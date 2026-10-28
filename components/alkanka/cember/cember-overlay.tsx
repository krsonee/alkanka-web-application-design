'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { Gift, Trophy, Users, X } from 'lucide-react'
import {
  NOTICE_MINUTES,
  RESULT_SECONDS,
  INTRO_SECONDS,
  liveSeconds,
  type CemberMe,
  type CemberPreview,
  type CemberRound,
  type CemberStatus,
} from '@/lib/cember-shared'
import { PredictOutcome, PredictPanel } from './predict-panel'
import { CemberArena, JAKO_PP, type ArenaEvent } from './cember-arena'
import { KaraDelikCanvas, type KDEvent } from '../karadelik/karadelik-canvas'
import { type SVEvent } from '../survival/survival-canvas'
import { SurvivalArena } from '../survival/survival-arena'
import { CemberConfetti } from './cember-confetti'
import { ShareWinnerCard } from './share-winner-card'
import { cemberFetch as fetchJson, serverNow } from './cember-clock'
import { cn } from '@/lib/utils'

const SEEN_KEY = 'ak-cember-seen'

type Phase = 'intro' | 'play' | 'result' | 'empty'

export function CemberOverlay() {
  const pathname = usePathname()
  const { data: status } = useSWR<CemberStatus>('/api/cember', fetchJson, { refreshInterval: 20_000, revalidateOnFocus: true })
  const { data: me } = useSWR<CemberMe>('/api/cember/me', fetchJson, { refreshInterval: 180_000, revalidateOnFocus: false })
  const [tick, setTick] = useState(0)
  const [activeSlot, setActiveSlot] = useState<string | null>(null)
  const [compact, setCompact] = useState(false)
  const [dismissed, setDismissed] = useState<string[]>([])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const slotMs = status?.nextSlot ? Date.parse(status.nextSlot) : null

  useEffect(() => {
    if (!status?.enabled || !status.nextSlot || slotMs === null || activeSlot) return
    const now = serverNow()
    // Only open while the round is still running; latecomers get the result card instead.
    const windowSec = status.liveSeconds ?? liveSeconds({ game: status.game ?? 'cember', duration: 90 })
    if (now < slotMs || now > slotMs + windowSec * 1000) return
    if (localStorage.getItem(SEEN_KEY) === status.nextSlot) return
    setCompact(!!document.querySelector('[data-game-table]'))
    setActiveSlot(status.nextSlot)
  }, [tick, status, slotMs, activeSlot])

  const close = useCallback(() => {
    if (activeSlot) localStorage.setItem(SEEN_KEY, activeSlot)
    setActiveSlot(null)
  }, [activeSlot])

  if (pathname?.startsWith('/panel')) return null

  const nowMs = serverNow()
  const notice = activeSlot
    ? null
    : (status?.upcoming ?? []).find((u) => {
        const left = Date.parse(u.slot) - nowMs
        return left > 0 && left <= NOTICE_MINUTES * 60_000 && !dismissed.includes(u.slot)
      })

  return (
    <>
      {notice && (
        <CemberNotice
          title={notice.title}
          prize={notice.prizeText}
          left={Date.parse(notice.slot) - nowMs}
          eligible={!!me?.eligible && status?.nextSlot === notice.slot}
          signedIn={!!me?.signedIn}
          onClose={() => setDismissed((d) => [...d, notice.slot])}
        />
      )}
      {activeSlot && (
        <CemberStage
          key={activeSlot}
          slot={activeSlot}
          status={status ?? null}
          meId={me?.userId ?? null}
          compact={compact}
          onDone={close}
        />
      )}
    </>
  )
}

export function CemberStage({
  slot,
  status,
  meId,
  compact,
  onDone,
  demo,
}: {
  slot: string
  status: CemberStatus | null
  meId: string | null
  compact: boolean
  onDone: () => void
  /** Local preview round: skips the server fetch and grants nothing. */
  demo?: CemberRound
}) {
  const slotMs = Date.parse(slot)
  // Demo has no prediction step, so it keeps the short intro.
  const startAt = slotMs + (demo ? 5 : INTRO_SECONDS) * 1000
  const [round, setRound] = useState<CemberRound | null>(demo ?? null)
  const [preview, setPreview] = useState<CemberPreview | null>(null)
  const [picks, setPicks] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>(serverNow() >= startAt ? 'play' : 'intro')
  const [alive, setAlive] = useState(demo?.participants.length ?? 0)
  const [feed, setFeed] = useState<{ key: number; name: string }[]>([])
  const [powerNote, setPowerNote] = useState('')
  const [winner, setWinner] = useState<number | null>(null)
  const [kdWinners, setKdWinners] = useState<number[]>([])
  const [kdFinal, setKdFinal] = useState(false)
  const [winningTeam, setWinningTeam] = useState(-1)
  const [now, setNow] = useState(serverNow())
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const isDemo = !!demo

  useEffect(() => {
    if (isDemo) return
    let stop = false
    let tries = 0
    const load = async () => {
      while (!stop && tries++ < 20) {
        const res = await fetch(`/api/cember/round?slot=${encodeURIComponent(slot)}`).then((r) => r.json()).catch(() => null)
        if (stop) return
        if (res?.state === 'ready' && res.round) {
          setRound(res.round)
          setAlive(res.round.participants.length)
          return
        }
        if (res?.state === 'none') {
          setPhase('empty')
          return
        }
        if (res?.state === 'predict' && res.preview) {
          setPreview((p) => p ?? res.preview)
          setAlive(res.preview.participants.length)
          // The seed is released at the reveal; waiting for it doesn't count as a failed try.
          tries--
          await new Promise((r) => setTimeout(r, Math.min(5000, Math.max(400, startAt - serverNow() + 300))))
          continue
        }
        await new Promise((r) => setTimeout(r, 1500))
      }
      if (!stop) setPhase('empty')
    }
    load()
    return () => {
      stop = true
    }
  }, [slot, isDemo, startAt])

  const hasPreview = !!preview
  useEffect(() => {
    if (!hasPreview || !meId) return
    fetch(`/api/cember/tahmin?slot=${encodeURIComponent(slot)}`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d?.picks) && setPicks((p) => (p.length ? p : d.picks)))
      .catch(() => {})
  }, [hasPreview, meId, slot])

  useEffect(() => {
    const id = setInterval(() => {
      const n = serverNow()
      setNow(n)
      setPhase((p) => (p === 'intro' && n >= startAt ? 'play' : p))
    }, 250)
    return () => clearInterval(id)
  }, [startAt])

  useEffect(() => {
    if (phase !== 'result' && phase !== 'empty') return
    const id = setTimeout(() => doneRef.current(), (phase === 'empty' ? 5 : RESULT_SECONDS) * 1000)
    return () => clearTimeout(id)
  }, [phase])

  useEffect(() => {
    if (compact) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [compact])

  const participants = round?.participants
  const onEvent = useCallback(
    (e: ArenaEvent) => {
      if (!participants) return
      if (e.type === 'out') {
        setAlive(e.alive)
        setFeed((f) => [{ key: e.index, name: participants[e.index].name }, ...f].slice(0, 5))
      } else {
        setWinner(e.index)
        setAlive(1)
        setPhase('result')
      }
    },
    [participants],
  )

  const onKdEvent = useCallback(
    (e: KDEvent) => {
      if (!participants) return
      if (e.type === 'out') {
        setAlive(e.alive)
        setFeed((f) => [{ key: e.index, name: participants[e.index].name }, ...f].slice(0, 5))
      } else if (e.type === 'power') {
        setPowerNote(`${participants[e.index].name} ${e.kind === 1 ? 'kalkanla kurtuldu' : 'geri döndü'}`)
      } else if (e.type === 'final') {
        setKdFinal(true)
      } else if (e.type === 'done') {
        setKdWinners(e.winners)
        setAlive(e.winners.length)
        setPhase('result')
      }
    },
    [participants],
  )

  const onSvEvent = useCallback(
    (e: SVEvent) => {
      if (!participants) return
      if (e.type === 'out') {
        setAlive(e.alive)
        setFeed((f) => [{ key: e.index, name: participants[e.index].name }, ...f].slice(0, 5))
      } else if (e.type === 'power') {
        setPowerNote(`${participants[e.index].name} ${e.kind === 1 ? 'kalkanla kurtuldu' : 'geri döndü'}`)
      } else if (e.type === 'final') {
        setKdFinal(true)
      } else if (e.type === 'done') {
        setKdWinners(e.winners)
        setWinningTeam(e.winningTeam)
        setAlive(e.winners.length)
        setPhase('result')
      }
    },
    [participants],
  )

  const isSv = round?.game === 'survival'
  const isKd = round?.game === 'karadelik' || isSv
  const svOpts = round?.survival ?? { teams: 0 as const, rule: 'last' as const, shield: true, captain: false }
  const kdPlayers = useMemo(
    () =>
      round?.participants.map((p, i) => ({
        id: p.id,
        name: p.name,
        image: p.image ?? JAKO_PP[i % JAKO_PP.length],
        me: !!meId && p.id === meId,
      })) ?? [],
    [round, meId],
  )

  const title = round?.title ?? status?.title ?? 'Jako Çemberi'
  const prize = round?.prizeText ?? status?.prizeText ?? ''
  const total = participants?.length ?? preview?.participants.length ?? 0
  const canPredict = !isDemo && !!preview && preview.predictKp > 0
  const countdown = Math.max(0, Math.ceil((startAt - now) / 1000))
  const winnerP = winner !== null && participants ? participants[winner] : null
  const iWon = winnerP && meId && winnerP.id === meId
  const kdWinnerPs = participants ? kdWinners.map((i) => participants[i]).filter(Boolean) : []
  const iSurvived = !!meId && kdWinnerPs.some((p) => p.id === meId)

  const arena = useMemo(
    () =>
      round && phase !== 'intro' && phase !== 'empty' ? (
        round.game === 'survival' ? (
          <SurvivalArena
            players={kdPlayers}
            duration={round.duration || 90}
            winners={Math.max(1, round.winners.length)}
            teams={svOpts.teams}
            rule={svOpts.rule}
            shield={svOpts.shield}
            captain={!!svOpts.captain}
            seed={round.seed}
            powers={round.powers}
            startAt={startAt}
            now={serverNow}
            onEvent={onSvEvent}
          />
        ) : round.game === 'karadelik' ? (
          <KaraDelikCanvas
            players={kdPlayers}
            duration={round.duration || 90}
            winners={Math.max(1, round.winners.length)}
            seed={round.seed}
            powers={round.powers}
            startAt={startAt}
            now={serverNow}
            onEvent={onKdEvent}
          />
        ) : (
          <CemberArena participants={round.participants} seed={round.seed} startAt={startAt} now={serverNow} meId={meId} onEvent={onEvent} />
        )
      ) : null,
    [round, phase === 'intro' || phase === 'empty', startAt, meId, onEvent, onKdEvent, onSvEvent, kdPlayers], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div
      role="dialog"
      aria-modal={!compact}
      aria-labelledby="cember-title"
      className={cn(
        'fixed z-[90] flex flex-col text-foreground animate-in fade-in duration-500',
        compact
          ? 'bottom-20 right-3 w-72 overflow-hidden rounded-2xl border border-gold/40 bg-background/95 shadow-2xl backdrop-blur lg:bottom-4'
          : 'inset-0 items-center justify-center bg-background/90 p-3 backdrop-blur-md',
      )}
    >
      <div className={cn('relative flex w-full flex-col items-center', compact ? 'gap-2 p-3' : 'max-w-md gap-4')}>
        <header className="flex w-full flex-col items-center gap-2 text-center">
          <div className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-1.5 tabular-nums">
              <Users className="size-3.5 text-gold" aria-hidden />
              {total > 0 && phase !== 'intro' ? `${alive} / ${total}` : `${total} kanka`}
            </span>
            {phase === 'result' || phase === 'empty' ? (
              <button
                type="button"
                onClick={() => doneRef.current()}
                aria-label="Kapat"
                className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 normal-case tracking-normal text-foreground hover:border-gold/60"
              >
                <X className="size-3.5" aria-hidden /> Kapat
              </button>
            ) : isDemo ? (
              <button
                type="button"
                onClick={() => doneRef.current()}
                className="rounded-full border border-border bg-card px-3 py-1 normal-case tracking-normal text-muted-foreground hover:text-foreground"
              >
                Demo · Kapat
              </button>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 animate-pulse rounded-full bg-live" aria-hidden />
                Canlı
              </span>
            )}
          </div>
          <h2
            id="cember-title"
            className={cn('font-display font-black uppercase italic leading-none tracking-tight text-gold text-balance', compact ? 'text-lg' : 'text-3xl sm:text-4xl')}
          >
            {title}
          </h2>
          {prize && (
            <span className="flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold">
              <Gift className="size-3.5" aria-hidden />
              {prize}
            </span>
          )}
        </header>

        {phase === 'intro' && (
          <Intro compact={compact} countdown={countdown} total={total} prize={prize} small={canPredict}>
            {canPredict && preview && (
              <PredictPanel
                slot={slot}
                participants={preview.participants}
                meId={meId}
                kp={preview.predictKp}
                closesAt={Date.parse(preview.closesAt)}
                saved={picks}
                onSaved={setPicks}
                compact={compact}
              />
            )}
          </Intro>
        )}

        {phase === 'empty' && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <MascotBadge src="/images/mascots/jako-uzgun.png" className="size-28" />
            <p className="font-display text-lg font-bold text-balance">Bu turda şartları tamamlayan çıkmadı</p>
            <p className="text-sm text-muted-foreground">Görevleri yap, bir sonraki çemberde sen de ol kanka.</p>
          </div>
        )}

        {arena && (
          <div className="relative w-full">
            {arena}
            {isKd && kdFinal && phase === 'play' && (
              <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-destructive px-3 py-1 text-xs font-black uppercase tracking-widest text-destructive-foreground animate-pulse">
                Final
              </span>
            )}
            {phase === 'result' && isKd && kdWinnerPs.length > 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-[6%] text-center animate-in fade-in slide-in-from-bottom-4 delay-1000 duration-700 fill-mode-both">
                <div className="flex items-center gap-2 rounded-full bg-gold px-4 py-2 font-display font-bold text-gold-foreground shadow-xl">
                  <Trophy className="size-5" aria-hidden />
                  <span className={compact ? 'text-sm' : 'text-lg'}>
                    {isSv && winningTeam >= 0
                      ? iSurvived
                        ? 'Takımın kazandı kanka!'
                        : `${['Altın', 'Mavi', 'Yakut', 'Zümrüt', 'Gümüş'][winningTeam] ?? 'Altın'} Takım kazandı`
                      : isSv
                        ? iSurvived
                          ? 'Ayakta kaldın kanka!'
                          : `${kdWinnerPs.length} kişi ayakta kaldı`
                        : iSurvived
                          ? 'Sağ çıktın kanka!'
                          : `${kdWinnerPs.length} kişi sağ çıktı`}
                  </span>
                </div>
                {!isDemo && (() => {
                  const mineIdx = participants?.findIndex((p) => p.id === meId) ?? -1
                  const idx = iSurvived && kdWinners.includes(mineIdx) ? mineIdx : kdWinners[0]
                  const p = participants?.[idx]
                  return p ? <ShareWinnerCard slot={slot} index={idx} mine={iSurvived} name={p.name} /> : null
                })()}
                <button
                  type="button"
                  onClick={() => doneRef.current()}
                  className="pointer-events-auto rounded-full border border-border bg-background/90 px-4 py-1.5 text-sm font-semibold text-foreground hover:border-gold/60"
                >
                  Kapat
                </button>
              </div>
            )}
            {phase === 'result' && !isKd && winnerP && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-2 pb-[8%] text-center animate-in fade-in zoom-in-90 duration-700">
                <div className="flex items-center gap-2 rounded-full bg-gold px-4 py-2 font-display font-bold text-gold-foreground shadow-xl">
                  <Trophy className="size-5" aria-hidden />
                  <span className={compact ? 'text-sm' : 'text-lg'}>{iWon ? 'Kazandın kanka!' : `${winnerP.name} kazandı`}</span>
                </div>
                {prize && <span className="rounded-full bg-background/85 px-3 py-1 text-sm font-semibold text-gold">{prize}</span>}
                {!isDemo && winner !== null && <ShareWinnerCard slot={slot} index={winner} mine={!!iWon} name={winnerP.name} />}
                <button
                  type="button"
                  onClick={() => doneRef.current()}
                  className="pointer-events-auto mt-1 rounded-full border border-border bg-background/90 px-4 py-1.5 text-sm font-semibold text-foreground hover:border-gold/60"
                >
                  Kapat
                </button>
              </div>
            )}
            {phase === 'result' && <CemberConfetti />}
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {feed[0] ? `${feed[0].name} elendi` : ''}
        </p>

        {phase === 'play' && powerNote && (
          <p key={powerNote} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground animate-in fade-in" role="status">
            {powerNote}
          </p>
        )}

        {phase === 'result' && round && <PredictOutcome picks={picks} podium={round.podium ?? []} kp={round.predictKp ?? 0} />}

        {phase === 'play' && !round && <p className="py-16 text-sm text-muted-foreground">��ember hazırlanıyor...</p>}

        {!compact && phase !== 'empty' && (
          <p className="text-center text-xs text-muted-foreground text-pretty">
            {isSv
              ? svOpts.teams === 2
                ? `Kayan kaleye düşen elenir · ${svOpts.rule === 'most' ? 'Süre bitince sahada çoğunlukta olan takım kazanır' : 'Rakibin son oyuncusu düşünce takım kazanır'} · Kazanan takımın tamamı ödül alır`
                : `Kayan kaleye düşen elenir · Sahada kalan son ${Math.max(1, round?.winners.length || 1)} kişi ödül alır`
              : isKd
              ? `Kara deliğe düşen elenir · Süre bitince Final · Son ${Math.max(1, round?.winners.length || 1)} kişi ödül alır`
              : 'Kaleye düşen elenir · Çemberde kalan son kanka kazanır'}
          </p>
        )}
      </div>
    </div>
  )
}

function CemberNotice({
  title,
  prize,
  left,
  eligible,
  signedIn,
  onClose,
}: {
  title: string
  prize: string
  left: number
  eligible: boolean
  signedIn: boolean
  onClose: () => void
}) {
  const s = Math.max(0, Math.ceil(left / 1000))
  const mmss = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-16 z-[85] flex items-center gap-3 rounded-2xl border border-gold/50 bg-popover/95 p-3 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-top-4 duration-500 sm:inset-x-auto sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2"
    >
      <MascotBadge src="/images/mascots/jako-duyuru.png" className="size-12 border-2" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate font-display text-sm font-bold text-foreground">
          {title} <span className="font-mono tabular-nums text-gold">{mmss}</span> sonra
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {prize ? `Ödül: ${prize} · ` : ''}
          {eligible ? 'Çemberdesin, oyunların o sırada duracak.' : signedIn ? 'Şartları tamamla, çembere gir.' : 'Giriş yap, şartları tamamla.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Bildirimi kapat"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}

function MascotBadge({ src, alt = '', className }: { src: string; alt?: string; className?: string }) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-full border-4 border-gold bg-card shadow-[0_0_40px_-8px] shadow-gold/60', className)}>
      <img src={src || '/placeholder.svg'} alt={alt} className="size-full scale-110 object-cover" />
    </div>
  )
}

function Intro({
  compact,
  countdown,
  total,
  prize,
  small,
  children,
}: {
  compact: boolean
  countdown: number
  total: number
  prize: string
  /** Shrinks the mascot to make room for the prediction box. */
  small?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className={cn('flex w-full flex-col items-center gap-4 text-center', compact || small ? 'py-2' : 'py-8')}>
      <MascotBadge
        src="/images/mascots/jako-duyuru.png"
        alt="Jako maskotu çemberi duyuruyor"
        className={cn(
          'animate-[cember-jako_1.4s_ease-in-out_infinite]',
          small ? (compact ? 'size-14' : 'size-20') : compact ? 'size-24' : 'size-40 sm:size-48',
        )}
      />
      <div className="flex flex-col gap-1">
        <p className={cn('font-display font-bold text-balance', compact ? 'text-base' : 'text-2xl sm:text-3xl')}>Çember birazdan dönüyor!</p>
        <p className="text-sm text-muted-foreground">
          {total > 0 ? `${total} kanka çemberde` : 'Katılımcılar çembere diziliyor'}
          {prize ? ` · Ödül: ${prize}` : ''}
        </p>
      </div>
      <div
        key={countdown}
        className={cn(
          'flex items-center justify-center rounded-full border-4 border-gold font-display font-bold tabular-nums text-gold animate-in zoom-in-50 fade-in duration-300',
          compact ? 'size-14 text-2xl' : 'size-24 text-5xl',
        )}
        aria-live="assertive"
      >
        {countdown > 0 ? countdown : 'Başla'}
      </div>
      {children}
    </div>
  )
}
