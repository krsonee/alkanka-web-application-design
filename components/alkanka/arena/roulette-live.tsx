'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Loader2, RotateCcw, ShieldCheck, Trash2, Trophy, Undo2, Users } from 'lucide-react'
import { RED, RL_BET_MS, rouletteClock, betLabel, betReturn, expandRacetrack, neighborNumbers, type RacetrackKey, type RouletteBet } from '@/lib/casino'
import type { ArenaGameSettings } from '@/lib/arena'
import type { RouletteLiveState } from '@/lib/roulette-live'
import { placeLiveRouletteBets, withdrawLiveRouletteBets } from '@/app/actions/arena'
import { cn } from '@/lib/utils'
import { formatAC, usePoints } from '../points-context'
import { useIdle } from '../use-idle'
import { RouletteWheel, pocketColor } from './roulette-wheel'
import { playSound } from '@/lib/sound'
import { Chip, Racetrack, RouletteBoard, betKey, chipTone, parseKey, type BetKind } from './roulette-board'
import { TableChat } from './table-chat'
import { MobileTableChat } from './mobile-table-chat'
import { TableBrand } from './table-brand'

type Stake = Pick<RouletteBet, 'kind' | 'value' | 'amount'>

const fetcher = (url: string) => fetch(url).then((r) => r.json())
const colorName = (n: number) => (n === 0 ? 'yeşil' : RED.has(n) ? 'kırmızı' : 'siyah')
const signed = (n: number) => (n > 0 ? `+${formatAC(n)}` : formatAC(n))

/** Pending chips are sent in one batch this long after the last tap. */
const SEND_DEBOUNCE_MS = 350
/** Anything still unsent is flushed once the countdown drops to this, so taps never silently expire. */
const FORCE_SEND_MS = 2000

function useServerClock(data: RouletteLiveState | undefined) {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    if (data?.serverNow) setOffset(data.serverNow - Date.now())
  }, [data?.serverNow])
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  return { offset, ready: now !== null, clock: rouletteClock((now ?? 0) + offset) }
}

function sumBets(bets: Stake[], into = new Map<string, number>()) {
  for (const b of bets) {
    const k = betKey(b.kind, b.value)
    into.set(k, (into.get(k) ?? 0) + b.amount)
  }
  return into
}

const toList = (m: Map<string, number>): Stake[] => Array.from(m, ([k, amount]) => ({ ...parseKey(k), amount }))

function NumberPill({ n }: { n: number }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-foreground" style={{ background: pocketColor(n) }}>
      {n}
    </span>
  )
}

function DealerLine({ phase, number, secondsLeft }: { phase: string; number: number | null; secondsLeft: number }) {
  let text = `Bahislerinizi yapın, kankalar! ${secondsLeft} saniye.`
  if (phase === 'spin') text = 'Bahisler kapandı, top dönüyor...'
  if (phase === 'result' && number !== null) text = `${number} ${colorName(number)}! Kazananlara ödeme yapılıyor.`
  return (
    <p aria-live="polite" className="relative rounded-2xl rounded-bl-none border border-primary/40 bg-background/85 px-3 py-2 text-pretty break-words text-sm font-semibold leading-snug text-foreground shadow-lg backdrop-blur sm:px-4 sm:py-2.5">
      {text}
    </p>
  )
}

/** Corner badge instead of a centre overlay, so the ball sitting in its pocket stays visible. */
function WinBadge({ n }: { n: number }) {
  return (
    <span
      className="absolute -right-1 -top-1 flex size-14 flex-col items-center justify-center rounded-full border-4 border-primary font-display text-foreground shadow-2xl sm:size-16"
      style={{ background: pocketColor(n) }}
      aria-hidden="true"
    >
      <span className="text-xl font-bold leading-none sm:text-2xl">{n}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider">{colorName(n)}</span>
    </span>
  )
}

function ResultBand({ n, bets }: { n: number; bets: Stake[] }) {
  const total = bets.reduce((a, b) => a + b.amount, 0)
  const lines = bets.map((b) => ({ label: betLabel(b), stake: b.amount, back: betReturn(b, n) })).sort((a, b) => b.back - a.back)
  const net = lines.reduce((a, l) => a + l.back, 0) - total
  const tone = !total ? 'neutral' : net > 0 ? 'win' : net < 0 ? 'loss' : 'neutral'
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-2 rounded-2xl border-2 px-3 py-2.5 shadow-lg sm:px-4',
        tone === 'win' && 'border-primary bg-primary/20',
        tone === 'loss' && 'border-destructive/70 bg-destructive/15',
        tone === 'neutral' && 'border-foreground/30 bg-background/70',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-display text-base font-bold uppercase text-foreground sm:text-lg">
          <NumberPill n={n} />
          {n} {colorName(n)}
        </span>
        {total > 0 ? (
          <span className={cn('font-display text-lg font-bold tabular-nums sm:text-xl', net > 0 ? 'text-primary' : net < 0 ? 'text-destructive' : 'text-foreground')}>
            Net {signed(net)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Bu tur bahsin yoktu</span>
        )}
      </div>
      {total > 0 && (
        <ul className="flex flex-wrap gap-1.5 text-xs">
          {lines.slice(0, 8).map((l, i) => (
            <li
              key={`${l.label}-${i}`}
              className={cn('rounded-full px-2 py-0.5 tabular-nums', l.back > 0 ? 'bg-primary/25 font-semibold text-foreground' : 'bg-background/60 text-muted-foreground line-through')}
            >
              {l.label} {l.back > 0 ? `+${formatAC(l.back - l.stake)}` : `-${formatAC(l.stake)}`}
            </li>
          ))}
          {lines.length > 8 && <li className="px-1 text-muted-foreground">+{lines.length - 8} alan</li>}
        </ul>
      )}
    </div>
  )
}

function PlayersPanel({ players, phase }: { players: RouletteLiveState['players']; phase: string }) {
  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="rl-players">
      <h3 id="rl-players" className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
        <Users className="size-4 text-primary" aria-hidden="true" />
        Masadakiler
        <span className="rounded-full bg-secondary px-2 text-xs text-muted-foreground">{players.length}</span>
      </h3>
      {players.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">Bu turda henüz bahis yok. İlk fişi sen koy.</p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {players.map((p, i) => {
            const delta = p.returned !== null ? p.returned - p.total : null
            return (
              <li
                key={`${p.name}-${i}`}
                className={cn('flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm', p.mine ? 'bg-primary/15 ring-1 ring-primary/40' : 'bg-secondary/60')}
              >
                <span className="min-w-0 truncate font-semibold text-foreground">
                  {p.name}
                  {p.mine && <span className="ml-1 text-xs text-primary">(sen)</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  <span className="text-muted-foreground">{formatAC(p.total)}</span>
                  {phase === 'result' && delta !== null && (
                    <span className={cn('font-bold', delta > 0 ? 'text-primary' : 'text-destructive')}>{signed(delta)}</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}

function WinnersPanel({ last }: { last: RouletteLiveState['lastRound'] | undefined }) {
  if (!last || last.winners.length === 0) return null
  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-4" aria-labelledby="rl-winners">
      <h3 id="rl-winners" className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
        <Trophy className="size-4 text-primary" aria-hidden="true" />
        Son tur kazananları
        <NumberPill n={last.number} />
      </h3>
      <ol className="flex flex-col gap-1.5">
        {last.winners.map((w, i) => (
          <li key={`${w.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-4 shrink-0 text-xs font-bold text-primary tabular-nums">{i + 1}</span>
              <span className="truncate font-semibold text-foreground">{w.name}</span>
            </span>
            <span className="shrink-0 font-bold text-primary tabular-nums">+{formatAC(w.won)}</span>
          </li>
        ))}
      </ol>
    </aside>
  )
}

function FairPanel({ fair }: { fair: RouletteLiveState['fair'] | undefined }) {
  if (!fair) return null
  return (
    <details className="group rounded-2xl border border-border bg-card p-4 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
        <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
        Adil oyun kanıtı
        <span className="ml-auto text-xs font-normal normal-case text-muted-foreground group-open:hidden">Göster</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3 leading-relaxed text-muted-foreground">
        <p className="text-pretty">
          Her turun sonucu bahisler açılmadan önce belirlenir. Bahis sırasında sonucun parmak izini (SHA-256) gösteriyoruz, tur bitince
          anahtarın kendisini açıyoruz. Anahtarın SHA-256&apos;sı parmak izine eşitse sonuç sonradan değiştirilmemiştir. Sayı =
          anahtarın ilk 8 hanesi (16&apos;lık) mod 37.
        </p>
        <dl className="flex flex-col gap-2 text-xs">
          <div>
            <dt className="font-semibold text-foreground">Tur #{fair.roundId % 10000} parmak izi</dt>
            <dd className="break-all font-mono">{fair.commit}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">
              Tur #{fair.revealed.roundId % 10000} anahtarı · sonuç {fair.revealed.number}
            </dt>
            <dd className="break-all font-mono">{fair.revealed.seed}</dd>
          </div>
        </dl>
      </div>
    </details>
  )
}

function ActionButton({ onClick, disabled, label, children }: { onClick: () => void; disabled: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background/80 px-2 text-sm font-semibold text-foreground transition enabled:hover:border-primary disabled:opacity-40 lg:flex-none lg:px-3"
    >
      {children}
    </button>
  )
}

export function RouletteLive({ settings }: { settings: ArenaGameSettings }) {
  const { member, setBalance, requireLogin, points } = usePoints()
  const idle = useIdle()
  // Phase changes trigger an immediate refetch below; the interval only keeps other players' bets fresh.
  const { data, mutate } = useSWR<RouletteLiveState>('/api/rulet', fetcher, { refreshInterval: idle ? 30000 : 6000 })
  const { offset, ready, clock } = useServerClock(data)
  const [chip, setChip] = useState(settings.bets[0] ?? 25)
  const [pending, setPendingState] = useState<Map<string, number>>(new Map())
  const pendingRef = useRef(pending)
  const [actions, setActions] = useState<Stake[][]>([])
  const [lastRoundBets, setLastRoundBets] = useState<Stake[]>([])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const inflight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)

  const spotLimit = Math.max(...settings.bets) * 10
  const betting = clock.phase === 'bet'
  const msLeft = clock.phaseEndsAt - clock.now
  const secondsLeft = Math.max(0, Math.ceil(msLeft / 1000))
  const progress = betting ? Math.max(0, msLeft / RL_BET_MS) : 0

  const sameRound = data?.roundId === clock.roundId
  const number = sameRound && clock.phase !== 'bet' ? (data?.number ?? null) : null
  const players = sameRound ? (data?.players ?? []) : []
  const me = players.find((p) => p.mine)
  const meRef = useRef(me)
  meRef.current = me

  const setPending = (m: Map<string, number>) => {
    pendingRef.current = m
    setPendingState(m)
  }

  const confirmed = useMemo(() => sumBets(me?.bets ?? []), [me])
  const others = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of players) if (!p.mine) sumBets(p.bets, m)
    return m
  }, [players])
  const mine = useMemo(() => {
    const m = new Map(confirmed)
    pending.forEach((v, k) => m.set(k, (m.get(k) ?? 0) + v))
    return m
  }, [confirmed, pending])
  const mineList = useMemo(() => toList(mine), [mine])
  const pendingTotal = Array.from(pending.values()).reduce((a, b) => a + b, 0)
  const tableTotal = mineList.reduce((a, b) => a + b.amount, 0)

  async function flush() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (inflight.current) {
      timer.current = setTimeout(flush, 200)
      return
    }
    const snap = new Map(pendingRef.current)
    if (!snap.size) return
    inflight.current = true
    setSending(true)
    const res = await placeLiveRouletteBets(toList(snap) as RouletteBet[])
    if (res.ok) {
      setBalance(res.balance)
      await mutate()
    }
    const next = new Map(pendingRef.current)
    snap.forEach((v, k) => {
      const rest = (next.get(k) ?? 0) - v
      if (rest > 0) next.set(k, rest)
      else next.delete(k)
    })
    setPending(next)
    inflight.current = false
    setSending(false)
    if (!res.ok) {
      setError(res.error)
      setActions([])
      playSound('error')
    }
  }

  const lastPhase = useRef(clock.phase)
  useEffect(() => {
    if (lastPhase.current === clock.phase) return
    lastPhase.current = clock.phase
    mutate()
    if (clock.phase === 'spin') {
      setLastRoundBets(meRef.current?.bets ?? [])
      setPending(new Map())
      setActions([])
      playSound('spin')
      const el = wheelRef.current
      if (el && window.matchMedia('(max-width: 1023px)').matches) {
        const r = el.getBoundingClientRect()
        if (r.bottom < 0 || r.top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    if (clock.phase === 'result') playSound('ball')
    if (clock.phase === 'bet') {
      setError('')
      playSound('turn')
    }
  }, [clock.phase, mutate])

  useEffect(() => {
    if (betting && msLeft <= FORCE_SEND_MS && pendingRef.current.size && !inflight.current) flush()
  })

  const lastTick = useRef(0)
  useEffect(() => {
    if (!betting || secondsLeft > 5 || secondsLeft === 0 || lastTick.current === secondsLeft) return
    lastTick.current = secondsLeft
    playSound('tick')
  }, [betting, secondsLeft])

  useEffect(() => {
    if (typeof data?.balance === 'number' && data.phase === 'result') setBalance(data.balance)
  }, [data?.balance, data?.phase, setBalance])

  const myResult = clock.phase === 'result' && me && me.returned !== null ? me.returned - me.total : null
  const announced = useRef<number | null>(null)
  useEffect(() => {
    if (myResult === null || announced.current === clock.roundId) return
    announced.current = clock.roundId
    playSound(myResult > 0 ? 'win' : myResult < 0 ? 'lose' : 'coin')
  }, [myResult, clock.roundId])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function addBets(list: Stake[]) {
    if (!betting || !list.length || !requireLogin()) return
    const add = sumBets(list)
    const cost = Array.from(add.values()).reduce((a, b) => a + b, 0)
    if (cost > points - pendingTotal) {
      setError('Bakiyen bu bahis için yetersiz.')
      playSound('error')
      return
    }
    for (const [k, v] of add) {
      if ((mine.get(k) ?? 0) + v > spotLimit) {
        setError(`${betLabel(parseKey(k))} için masa limiti ${formatAC(spotLimit)}.`)
        playSound('error')
        return
      }
    }
    setError('')
    const next = new Map(pendingRef.current)
    add.forEach((v, k) => next.set(k, (next.get(k) ?? 0) + v))
    setPending(next)
    setActions((a) => [...a, toList(add)])
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, SEND_DEBOUNCE_MS)
  }

  async function withdraw(list?: Stake[]) {
    setSending(true)
    const res = await withdrawLiveRouletteBets(list as RouletteBet[] | undefined)
    setSending(false)
    if (!res.ok) {
      setError(res.error)
      playSound('error')
      return
    }
    setBalance(res.balance)
    mutate()
  }

  async function undo() {
    const last = actions[actions.length - 1]
    if (!last || inflight.current) return
    setActions((a) => a.slice(0, -1))
    const next = new Map(pendingRef.current)
    const rest: Stake[] = []
    for (const b of last) {
      const k = betKey(b.kind, b.value)
      const held = next.get(k) ?? 0
      const take = Math.min(held, b.amount)
      if (held - take > 0) next.set(k, held - take)
      else next.delete(k)
      if (b.amount > take) rest.push({ ...b, amount: b.amount - take })
    }
    setPending(next)
    playSound('chip')
    if (rest.length) await withdraw(rest)
  }

  async function clearAll() {
    if (inflight.current) return
    if (timer.current) clearTimeout(timer.current)
    setPending(new Map())
    setActions([])
    if (confirmed.size) await withdraw()
  }

  const place = (kind: BetKind, value?: number) => addBets([{ kind, value, amount: chip }])
  const neighbors = (n: number) => addBets(neighborNumbers(n).map((value) => ({ kind: 'number' as const, value, amount: chip })))
  const call = (k: RacetrackKey) => addBets(expandRacetrack(k, chip))

  if (!ready) {
    return (
      <div className="felt-table flex min-h-96 items-center justify-center rounded-3xl border border-primary/30">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Masa yükleniyor" />
      </div>
    )
  }

  const showWin = clock.phase === 'result' && number !== null
  const busy = sending || !betting

  return (
    <div className="flex flex-col gap-4 max-lg:pb-48">
      <header className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)] items-stretch md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="relative hidden bg-background md:block md:min-h-48">
            <Image
              src="/images/mascots/jako-krupiye.png"
              alt="Krupiye Jako masada, topu atmaya hazır"
              fill
              sizes="(min-width: 768px) 22rem, 100vw"
              className="object-contain object-center"
              priority
            />
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-3 p-3 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
                Canlı masa · Tur #{clock.roundId % 10000}
              </span>
              <span className="hidden rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground sm:inline">
                Avrupa ruleti · La Partage
              </span>
              <div className="ml-auto">
                <MobileTableChat tableId="rulet-canli" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="relative size-12 shrink-0 overflow-hidden rounded-full border-2 border-primary/60 bg-background md:hidden">
                <Image src="/images/mascots/jako-krupiye.png" alt="" fill sizes="48px" className="object-cover object-top" />
              </div>
              <div className="min-w-0 flex-1">
                <DealerLine phase={clock.phase} number={number} secondsLeft={secondsLeft} />
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Son</span>
              <ol
                className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-1 [mask-image:linear-gradient(to_right,black_85%,transparent)]"
                aria-label="Son çıkan sayılar"
              >
                {(data?.history ?? []).map((n, i) => (
                  <li key={i} className={cn(i === 0 && 'ring-2 ring-primary ring-offset-1 ring-offset-card', 'rounded-full')}>
                    <NumberPill n={n} />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="tavla-wood flex min-w-0 flex-col gap-4 rounded-3xl p-1.5 sm:rounded-[2rem] sm:p-3" aria-label="Rulet masası">
          <div className="felt-table relative flex flex-col gap-3 rounded-[1.25rem] p-2 sm:gap-5 sm:rounded-[1.6rem] sm:p-5">
            <TableBrand center={false} />
            <div className="flex flex-col items-center gap-3 sm:gap-5 lg:flex-row lg:items-start">
              <div
                ref={wheelRef}
                className={cn(
                  'relative aspect-square shrink-0 transition-[width] duration-500 ease-out lg:w-80',
                  betting ? 'w-44 sm:w-60' : 'w-[min(86vw,22rem)] sm:w-80',
                )}
              >
                <RouletteWheel clockOffset={offset} number={number} highlight={showWin ? number : null} />
                {showWin && <WinBadge n={number} />}
              </div>
              <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
                {showWin && <ResultBand n={number} bets={me?.bets ?? []} />}
                {!data ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Masa yükleniyor" />
                  </div>
                ) : (
                  <RouletteBoard mine={mine} others={others} onBet={place} disabled={!betting} winner={showWin ? number : null} chipValues={settings.bets} />
                )}
              </div>
            </div>

            <Racetrack chip={chip} disabled={!betting} winner={showWin ? number : null} onCall={call} onNeighbors={neighbors} />

            <div
              className={cn(
                'flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-3',
                'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-lg:z-40 max-lg:border-t max-lg:border-primary/40 max-lg:bg-background/95 max-lg:px-3 max-lg:py-2.5 max-lg:shadow-[0_-12px_30px_-10px_rgb(0_0_0/0.5)] max-lg:backdrop-blur-md',
              )}
            >
              <div className="flex items-center justify-between gap-2 text-xs lg:hidden" aria-live="polite">
                <span className="text-muted-foreground">
                  Masada <strong className="text-foreground tabular-nums">{formatAC(tableTotal)}</strong>
                  {pendingTotal > 0 && <span className="text-primary"> · gönderiliyor</span>}
                </span>
                <span className={cn('font-display font-bold tabular-nums', betting && secondsLeft <= 5 ? 'text-destructive' : 'text-foreground')}>
                  {betting ? `${secondsLeft} sn` : clock.phase === 'spin' ? 'Top dönüyor' : 'Sonuç'}
                </span>
              </div>
              <div
                className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1 max-lg:[mask-image:linear-gradient(to_right,black_88%,transparent)] lg:mx-0"
                role="radiogroup"
                aria-label="Fiş değeri"
              >
                {settings.bets.map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={chip === v} onClick={() => setChip(v)} className="shrink-0 rounded-full" aria-label={`${v} KC fiş`}>
                    <Chip amount={v} tone={chipTone(v, settings.bets)} size="lg" active={chip === v} />
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5 lg:flex lg:items-center lg:gap-2">
                <ActionButton onClick={undo} disabled={busy || !actions.length} label="Son fişi geri al">
                  <Undo2 className="size-4" aria-hidden="true" />
                  <span className="text-xs sm:text-sm">Geri al</span>
                </ActionButton>
                <ActionButton onClick={clearAll} disabled={busy || !mine.size} label="Masadaki bütün bahislerimi geri al">
                  <Trash2 className="size-4" aria-hidden="true" />
                  <span className="text-xs sm:text-sm">Temizle</span>
                </ActionButton>
                <ActionButton onClick={() => addBets(mineList)} disabled={!betting || !mine.size} label="Bahislerimi ikiye katla">
                  <span className="font-display text-sm font-bold">2x</span>
                  <span className="text-xs sm:text-sm">Katla</span>
                </ActionButton>
                <ActionButton onClick={() => addBets(lastRoundBets)} disabled={!betting || !lastRoundBets.length || mine.size > 0} label="Geçen turun bahsini tekrarla">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  <span className="text-xs sm:text-sm">Tekrar</span>
                </ActionButton>
              </div>
              {error && (
                <p role="alert" className="text-xs text-destructive lg:hidden">
                  {error}
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="hidden text-sm text-destructive lg:block">
                {error}
              </p>
            )}

            <div className="hidden flex-wrap items-center justify-between gap-2 text-sm lg:flex">
              <span className="text-muted-foreground">
                {member ? (
                  <>
                    Masada: <strong className="text-foreground tabular-nums">{formatAC(tableTotal)}</strong>
                    {pendingTotal > 0 && <span className="text-primary"> · gönderiliyor...</span>}
                  </>
                ) : (
                  'Bahis koymak için giriş yap. İzlemek serbest.'
                )}
              </span>
              <span className="text-xs text-muted-foreground">Alan başına limit {formatAC(spotLimit)}</span>
            </div>

            <div className="flex flex-col gap-1 text-pretty text-sm leading-relaxed text-muted-foreground">
              <p>
                Fişe dokunduğun an bahsin masaya gider, ayrıca onay yok. Ödemeler: sayı 36x, ayrık 18x, üçlü / sokak 12x, köşe / ilk dörtlü 9x, altılı 6x,
                düzine / kolon 3x, renk / tek-çift / alt-üst 2x.
              </p>
              <p>
                La Partage: sıfır gelirse renk, tek-çift ve alt-üst bahislerinin yarısı geri döner. Alan başına limit {formatAC(spotLimit)}.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:flex xl:flex-col">
          <WinnersPanel last={data?.lastRound} />
          <PlayersPanel players={players} phase={clock.phase} />
          <FairPanel fair={data?.fair} />
          <TableChat tableId="rulet-canli" className="hidden h-80 md:col-span-2 lg:flex xl:h-96" />
        </div>
      </div>
    </div>
  )
}
