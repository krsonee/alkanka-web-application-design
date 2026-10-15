'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Loader2, RotateCcw, Trash2, Trophy, Users } from 'lucide-react'
import { RED, RL_BET_MS, rouletteClock, betLabel, type RouletteBet } from '@/lib/casino'
import type { ArenaGameSettings } from '@/lib/arena'
import type { RouletteLiveState } from '@/lib/roulette-live'
import { placeLiveRouletteBets } from '@/app/actions/arena'
import { cn } from '@/lib/utils'
import { formatAC, usePoints } from '../points-context'
import { useIdle } from '../use-idle'
import { RouletteWheel, pocketColor } from './roulette-wheel'
import { Chip, RouletteBoard, betKey, chipTone, parseKey, type BetKind } from './roulette-board'
import { TableChat } from './table-chat'

const fetcher = (url: string) => fetch(url).then((r) => r.json())
const colorName = (n: number) => (n === 0 ? 'yeşil' : RED.has(n) ? 'kırmızı' : 'siyah')

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

function sumBets(bets: Pick<RouletteBet, 'kind' | 'value' | 'amount'>[], into = new Map<string, number>()) {
  for (const b of bets) {
    const k = betKey(b.kind, b.value)
    into.set(k, (into.get(k) ?? 0) + b.amount)
  }
  return into
}

function NumberPill({ n, size = 'sm' }: { n: number; size?: 'sm' | 'lg' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-display font-bold text-foreground',
        size === 'sm' ? 'size-7 text-xs' : 'size-16 border-4 border-primary text-2xl shadow-xl',
      )}
      style={{ background: pocketColor(n) }}
    >
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
        <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
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
                    <span className={cn('font-bold', delta > 0 ? 'text-primary' : 'text-destructive')}>
                      {delta > 0 ? `+${formatAC(delta)}` : formatAC(delta)}
                    </span>
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

/** Big flashing badge over the wheel so the winning number is unmistakable. */
function WinFlash({ n }: { n: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <span className="absolute size-28 animate-ping rounded-full border-4 border-primary opacity-60" />
      <span
        className="relative flex size-24 flex-col items-center justify-center rounded-full border-4 border-primary font-display text-foreground shadow-2xl"
        style={{ background: pocketColor(n) }}
      >
        <span className="text-4xl font-bold leading-none">{n}</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">{colorName(n)}</span>
      </span>
    </div>
  )
}

function WinnersPanel({ last }: { last: RouletteLiveState['lastRound'] | undefined }) {
  if (!last) {
    return (
      <aside className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Kazananlar her turun sonunda burada listelenir.
      </aside>
    )
  }
  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-4" aria-labelledby="rl-winners">
      <h3 id="rl-winners" className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
        <Trophy className="size-4 text-primary" aria-hidden="true" />
        Son tur kazananları
        <NumberPill n={last.number} />
      </h3>
      {last.winners.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">Bu turda kazanan çıkmadı, kasa kazandı.</p>
      ) : (
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
      )}
    </aside>
  )
}

export function RouletteLive({ settings }: { settings: ArenaGameSettings }) {
  const { member, setBalance, requireLogin, points } = usePoints()
  const idle = useIdle()
  // Phase changes trigger an immediate refetch below; the interval only keeps other players' bets fresh.
  const { data, mutate } = useSWR<RouletteLiveState>('/api/rulet', fetcher, { refreshInterval: idle ? 30000 : 6000 })
  const { offset, ready, clock } = useServerClock(data)
  const [chip, setChip] = useState(settings.bets[0] ?? 25)
  const [draft, setDraft] = useState<Map<string, number>>(new Map())
  const [lastConfirmed, setLastConfirmed] = useState<RouletteBet[]>([])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const lastPhase = useRef(clock.phase)
  useEffect(() => {
    if (lastPhase.current !== clock.phase) {
      lastPhase.current = clock.phase
      mutate()
      if (clock.phase === 'spin') setDraft(new Map())
      if (clock.phase === 'bet') setError('')
    }
  }, [clock.phase, mutate])

  const sameRound = data?.roundId === clock.roundId
  const number = sameRound && clock.phase !== 'bet' ? (data?.number ?? null) : null
  const players = sameRound ? (data?.players ?? []) : []
  const me = players.find((p) => p.mine)

  useEffect(() => {
    if (typeof data?.balance === 'number' && data.phase === 'result') setBalance(data.balance)
  }, [data?.balance, data?.phase, setBalance])

  const confirmed = useMemo(() => sumBets(me?.bets ?? []), [me])
  const others = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of players) if (!p.mine) sumBets(p.bets, m)
    return m
  }, [players])
  const mine = useMemo(() => {
    const m = new Map(confirmed)
    draft.forEach((v, k) => m.set(k, (m.get(k) ?? 0) + v))
    return m
  }, [confirmed, draft])

  const draftTotal = Array.from(draft.values()).reduce((a, b) => a + b, 0)
  const betting = clock.phase === 'bet'
  const secondsLeft = Math.max(0, Math.ceil((clock.phaseEndsAt - clock.now) / 1000))
  const progress = betting ? Math.max(0, (clock.phaseEndsAt - clock.now) / RL_BET_MS) : 0
  const myResult = clock.phase === 'result' && me && me.returned !== null ? me.returned - me.total : null

  function place(kind: BetKind, value?: number) {
    if (!betting || !requireLogin()) return
    const k = betKey(kind, value)
    setDraft((d) => new Map(d).set(k, (d.get(k) ?? 0) + chip))
  }

  async function confirm(bets: RouletteBet[]) {
    if (!bets.length || sending || !requireLogin()) return
    const total = bets.reduce((a, b) => a + b.amount, 0)
    if (total > points) return setError('Bakiyen bu bahisler için yetersiz.')
    setSending(true)
    setError('')
    const res = await placeLiveRouletteBets(bets)
    setSending(false)
    if (!res.ok) return setError(res.error)
    setBalance(res.balance)
    setLastConfirmed(bets)
    setDraft(new Map())
    mutate()
  }

  const draftList = (): RouletteBet[] => Array.from(draft, ([k, amount]) => ({ ...parseKey(k), amount }))

  if (!ready) {
    return (
      <div className="felt-table flex min-h-96 items-center justify-center rounded-3xl border border-primary/30">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Masa yükleniyor" />
      </div>
    )
  }

  const showWin = clock.phase === 'result' && number !== null

  return (
    <div className="flex flex-col gap-4">
      <header className="overflow-hidden rounded-3xl border border-primary/30 bg-card">
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
                Herkes aynı masada · Avrupa ruleti
              </span>
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
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Son sayılar</span>
              <ol className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-1" aria-label="Son çıkan sayılar">
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

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <section className="tavla-wood flex flex-col gap-4 rounded-3xl p-1.5 sm:rounded-[2rem] sm:p-3" aria-label="Rulet masası">
          <div className="felt-table flex flex-col gap-3 rounded-[1.25rem] p-2 sm:gap-5 sm:rounded-[1.6rem] sm:p-5">
            <div className="flex flex-col items-center gap-3 sm:gap-5 lg:flex-row lg:items-center">
              <div className="relative aspect-square w-44 shrink-0 sm:w-64 lg:w-72">
                <RouletteWheel clockOffset={offset} number={number} highlight={showWin ? number : null} />
                {showWin && <WinFlash n={number} />}
              </div>
              <div className="w-full min-w-0 flex-1">
                {!data ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Masa yükleniyor" />
                  </div>
                ) : (
                  <RouletteBoard mine={mine} others={others} onBet={place} disabled={!betting || sending} winner={showWin ? number : null} chipValues={settings.bets} />
                )}
              </div>
            </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex items-center justify-center gap-2 sm:justify-start" role="radiogroup" aria-label="Fiş değeri">
              {settings.bets.map((v) => (
                <button key={v} role="radio" aria-checked={chip === v} onClick={() => setChip(v)} className="rounded-full" aria-label={`${v} KC fiş`}>
                  <Chip amount={v} tone={chipTone(v, settings.bets)} size="lg" active={chip === v} />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDraft(new Map())}
                disabled={!draft.size || sending}
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground disabled:opacity-40"
                aria-label="Onaylanmamış bahisleri temizle"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
              <button
                onClick={() => confirm(lastConfirmed)}
                disabled={!betting || !lastConfirmed.length || sending || draft.size > 0}
                aria-label="Son bahsi tekrarla"
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background/70 px-3 text-sm font-semibold text-foreground disabled:opacity-40"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Tekrarla</span>
              </button>
              <button
                onClick={() => confirm(draftList())}
                disabled={!betting || !draft.size || sending}
                className="h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50 sm:flex-none sm:px-5"
              >
                {sending ? 'Gönderiliyor...' : betting ? `Bahsi koy · ${formatAC(draftTotal)}` : 'Bahisler kapalı'}
              </button>
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {me ? (
                <>
                  Bu turdaki bahsin: <strong className="text-foreground">{formatAC(me.total)}</strong>
                  <span className="hidden sm:inline"> · {me.bets.slice(0, 4).map(betLabel).join(', ')}{me.bets.length > 4 ? '...' : ''}</span>
                </>
              ) : member ? (
                'Fiş seç, alana dokun, sonra bahsi koy.'
              ) : (
                'Bahis koymak için giriş yap. İzlemek serbest.'
              )}
            </span>
            {myResult !== null && (
              <span className={cn('flex items-center gap-2 font-display text-lg font-bold', myResult > 0 ? 'text-primary' : 'text-destructive')}>
                {number !== null && <NumberPill n={number} />}
                {myResult > 0 ? `+${formatAC(myResult)} kazandın!` : myResult === 0 ? 'Berabere' : 'Bu tur olmadı.'}
              </span>
            )}
          </div>
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground">Sayıya 36x, düzine 3x, renk / tek-çift / alt-üst 2x öder. Top sunucuda atılır, herkes aynı turu görür.</p>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:flex xl:flex-col">
          <WinnersPanel last={data?.lastRound} />
          <PlayersPanel players={players} phase={clock.phase} />
          <TableChat tableId="rulet-canli" className="h-80 md:col-span-2 xl:h-96" />
        </div>
      </div>
    </div>
  )
}
