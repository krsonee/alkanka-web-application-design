'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { Gift, Trophy, Users } from 'lucide-react'
import { INTRO_SECONDS, RESULT_SECONDS, type CemberMe, type CemberRound, type CemberStatus } from '@/lib/cember-shared'
import { CemberArena, type ArenaEvent } from './cember-arena'
import { CemberConfetti } from './cember-confetti'
import { cemberFetch as fetchJson, serverNow } from './cember-clock'
import { cn } from '@/lib/utils'

const SEEN_KEY = 'ak-cember-seen'

type Phase = 'intro' | 'play' | 'result' | 'empty'

export function CemberOverlay() {
  const pathname = usePathname()
  const { data: status } = useSWR<CemberStatus>('/api/cember', fetchJson, { refreshInterval: 60_000, revalidateOnFocus: true })
  const { data: me } = useSWR<CemberMe>('/api/cember/me', fetchJson, { refreshInterval: 180_000, revalidateOnFocus: false })
  const [tick, setTick] = useState(0)
  const [activeSlot, setActiveSlot] = useState<string | null>(null)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const slotMs = status?.nextSlot ? Date.parse(status.nextSlot) : null

  useEffect(() => {
    if (!status?.enabled || !status.nextSlot || slotMs === null || activeSlot) return
    const now = serverNow()
    // Only open while the round is still running; latecomers get the result card instead.
    if (now < slotMs || now > slotMs + (INTRO_SECONDS + 75) * 1000) return
    if (localStorage.getItem(SEEN_KEY) === status.nextSlot) return
    setCompact(!!document.querySelector('[data-game-table]'))
    setActiveSlot(status.nextSlot)
  }, [tick, status, slotMs, activeSlot])

  const close = useCallback(() => {
    if (activeSlot) localStorage.setItem(SEEN_KEY, activeSlot)
    setActiveSlot(null)
  }, [activeSlot])

  if (pathname?.startsWith('/panel')) return null

  return (
    <>
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
  const startAt = slotMs + INTRO_SECONDS * 1000
  const [round, setRound] = useState<CemberRound | null>(demo ?? null)
  const [phase, setPhase] = useState<Phase>(serverNow() >= startAt ? 'play' : 'intro')
  const [alive, setAlive] = useState(demo?.participants.length ?? 0)
  const [feed, setFeed] = useState<{ key: number; name: string }[]>([])
  const [winner, setWinner] = useState<number | null>(null)
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
        await new Promise((r) => setTimeout(r, 1500))
      }
      if (!stop) setPhase('empty')
    }
    load()
    return () => {
      stop = true
    }
  }, [slot, isDemo])

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

  const title = round?.title ?? status?.title ?? 'Jako Çemberi'
  const prize = round?.prizeText ?? status?.prizeText ?? ''
  const total = participants?.length ?? 0
  const countdown = Math.max(0, Math.ceil((startAt - now) / 1000))
  const winnerP = winner !== null && participants ? participants[winner] : null
  const iWon = winnerP && meId && winnerP.id === meId

  const arena = useMemo(
    () =>
      round && phase !== 'intro' && phase !== 'empty' ? (
        <CemberArena participants={round.participants} seed={round.seed} startAt={startAt} now={serverNow} meId={meId} onEvent={onEvent} />
      ) : null,
    [round, phase === 'intro' || phase === 'empty', startAt, meId, onEvent], // eslint-disable-line react-hooks/exhaustive-deps
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
            {isDemo ? (
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

        {phase === 'intro' && <Intro compact={compact} countdown={countdown} total={total} prize={prize} />}

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
            {phase === 'result' && winnerP && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-2 pb-[8%] text-center animate-in fade-in zoom-in-90 duration-700">
                <div className="flex items-center gap-2 rounded-full bg-gold px-4 py-2 font-display font-bold text-gold-foreground shadow-xl">
                  <Trophy className="size-5" aria-hidden />
                  <span className={compact ? 'text-sm' : 'text-lg'}>{iWon ? 'Kazandın kanka!' : `${winnerP.name} kazandı`}</span>
                </div>
                {prize && <span className="rounded-full bg-background/85 px-3 py-1 text-sm font-semibold text-gold">{prize}</span>}
              </div>
            )}
            {phase === 'result' && <CemberConfetti />}
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {feed[0] ? `${feed[0].name} elendi` : ''}
        </p>

        {phase === 'play' && !round && <p className="py-16 text-sm text-muted-foreground">Çember hazırlanıyor...</p>}

        {!compact && phase !== 'empty' && (
          <p className="text-center text-xs text-muted-foreground text-pretty">
            Kaleye düşen elenir · Çemberde kalan son kanka kazanır
          </p>
        )}
      </div>
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

function Intro({ compact, countdown, total, prize }: { compact: boolean; countdown: number; total: number; prize: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-4 text-center', compact ? 'py-3' : 'py-8')}>
      <MascotBadge
        src="/images/mascots/jako-duyuru.png"
        alt="Jako maskotu çemberi duyuruyor"
        className={cn('animate-[cember-jako_1.4s_ease-in-out_infinite]', compact ? 'size-24' : 'size-40 sm:size-48')}
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
    </div>
  )
}
