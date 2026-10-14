'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Armchair, Hand, Layers, Loader2, Play, Plus, Trophy } from 'lucide-react'
import type { ArenaGameSettings } from '@/lib/arena'
import type { BlackjackLiveState } from '@/lib/blackjack-live'
import { actBlackjackTable, readyBlackjackTable, sitBlackjackTable } from '@/app/actions/arena'
import { cn } from '@/lib/utils'
import { formatAC, usePoints } from '../points-context'
import { useIdle } from '../use-idle'
import { PlayingCard } from './blackjack'

const fetcher = (url: string) => fetch(url).then((r) => r.json())
type Seat = NonNullable<BlackjackLiveState['seats'][number]>

const RESULT_LABEL: Record<string, string> = { blackjack: 'Blackjack!', win: 'Kazandı', push: 'Berabere', loss: 'Kaybetti' }
/** Server time, ticking locally between polls. */
function useServerNow(serverNow: number | undefined) {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    if (serverNow) setOffset(serverNow - Date.now())
  }, [serverNow])
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  return now === null ? null : now + offset
}

function dealerLine(phase: string, seated: number, secondsLeft: number, dealerValue: number) {
  if (phase === 'waiting') return 'Masa boş kanka. Bahsini seç, koltuğa otur, kartları hemen dağıtayım!'
  if (phase === 'bet') return seated > 1 ? `Bahisler açık, ${secondsLeft} saniye. Herkes "Dağıt" derse hemen başlarım.` : `Bahisler açık, ${secondsLeft} saniye. Beklemek istemezsen "Hemen dağıt" de.`
  if (phase === 'play') return `Kartlar dağıtıldı. Kart mı, dur mu? ${secondsLeft} saniye.`
  return dealerValue > 21 ? `Krupiye ${dealerValue} ile battı! Masada kalan herkes kazandı.` : `Krupiye ${dealerValue}. Ödemeler yapılıyor.`
}

function SeatBox({
  index,
  seat,
  canSit,
  busy,
  onSit,
  phase,
}: {
  index: number
  seat: Seat | null
  canSit: boolean
  busy: boolean
  onSit: (n: number) => void
  phase: string
}) {
  if (!seat) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-background/30 p-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">Koltuk {index + 1}</span>
        {canSit ? (
          <button
            onClick={() => onSit(index + 1)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
          >
            <Armchair className="size-3.5" aria-hidden="true" />
            Otur
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Boş</span>
        )}
      </div>
    )
  }

  const win = seat.delta !== null && seat.delta > 0
  return (
    <div
      className={cn(
        'relative flex min-h-36 flex-col items-center gap-1.5 rounded-2xl border bg-background/55 p-2 backdrop-blur',
        seat.mine ? 'border-primary ring-2 ring-primary/40' : 'border-primary/25',
        phase === 'play' && !seat.done && 'bj-seat-active',
      )}
    >
      <span className="w-full truncate text-center text-xs font-bold text-foreground">
        {seat.name}
        {seat.mine && <span className="ml-1 text-primary">(sen)</span>}
      </span>
      <div className="flex min-h-14 justify-center -space-x-5 sm:min-h-16">
        {seat.cards.length === 0 ? (
          <span className="self-center text-[10px] uppercase tracking-widest text-muted-foreground">Kart bekleniyor</span>
        ) : (
          seat.cards.map((c, i) => <PlayingCard key={`${i}-${c.r}-${c.s}`} card={c} index={i} small />)
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">{formatAC(seat.bet)}</span>
        {seat.cards.length > 0 && (
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums', seat.value > 21 ? 'bg-destructive text-primary-foreground' : 'bg-secondary text-foreground')}>
            {seat.value > 21 ? `${seat.value} Battı` : seat.value}
          </span>
        )}
      </div>
      {seat.result && (
        <span className={cn('pop-in rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase', win ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
          {RESULT_LABEL[seat.result]}
          {win && ` +${formatAC(seat.delta!)}`}
        </span>
      )}
      {phase === 'play' && seat.done && !seat.result && <span className="text-[10px] font-semibold uppercase text-muted-foreground">Durdu</span>}
    </div>
  )
}

export function BlackjackLive({ settings }: { settings: ArenaGameSettings }) {
  const { member, setBalance, requireLogin, points } = usePoints()
  const idle = useIdle()
  const [seatedHere, setSeatedHere] = useState(false)
  // Poll quickly only while this viewer is in a hand; spectators and idle tabs poll slowly.
  const { data, mutate } = useSWR<BlackjackLiveState>('/api/blackjack', fetcher, { refreshInterval: idle ? 30000 : seatedHere ? 1500 : 4000 })
  const now = useServerNow(data?.serverNow)
  const [bet, setBet] = useState(settings.bets[0] ?? 25)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const phase = data?.phase ?? 'waiting'
  const seats = data?.seats ?? Array.from({ length: 6 }, () => null)
  const me = seats.find((s) => s?.mine) ?? null
  const seated = seats.filter(Boolean).length
  const msLeft = data?.phaseEndsAt && now ? Math.max(0, data.phaseEndsAt - now) : 0
  const secondsLeft = Math.ceil(msLeft / 1000)
  const progress = data?.phaseTotal ? Math.min(1, msLeft / data.phaseTotal) : 0
  const canSit = (phase === 'waiting' || (phase === 'bet' && secondsLeft > 1)) && !me
  const myTurn = phase === 'play' && me && !me.done

  useEffect(() => {
    setSeatedHere(!!me && phase !== 'result')
  }, [me, phase])

  // When the countdown runs out, ask the server for the next phase instead of waiting for the next poll.
  const askedFor = useRef<number | null>(null)
  useEffect(() => {
    if (!data?.phaseEndsAt || msLeft > 0 || askedFor.current === data.phaseEndsAt) return
    askedFor.current = data.phaseEndsAt
    const t = setTimeout(() => mutate(), 300)
    return () => clearTimeout(t)
  }, [data?.phaseEndsAt, msLeft, mutate])

  const lastPhase = useRef(phase)
  useEffect(() => {
    if (lastPhase.current !== phase) {
      lastPhase.current = phase
      setError('')
    }
  }, [phase])

  useEffect(() => {
    if (typeof data?.balance === 'number' && data.phase === 'result') setBalance(data.balance)
  }, [data?.balance, data?.phase, setBalance])

  async function dealNow() {
    if (busy) return
    setBusy(true)
    setError('')
    const res = await readyBlackjackTable()
    setBusy(false)
    if (!res.ok) return setError(res.error)
    mutate()
  }

  async function sit(n: number) {
    if (busy || !requireLogin()) return
    if (bet > points) return setError('Bakiyen bu bahis için yetersiz.')
    setBusy(true)
    setError('')
    const res = await sitBlackjackTable(n, bet)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setBalance(res.balance)
    mutate()
  }

  async function act(a: 'hit' | 'stand' | 'double') {
    if (busy) return
    setBusy(true)
    setError('')
    const res = await actBlackjackTable(a)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setBalance(res.balance)
    mutate()
  }

  if (now === null || !data || !Array.isArray(data.seats)) {
    return (
      <div className="felt-table flex min-h-96 items-center justify-center rounded-3xl border border-primary/30">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Masa yükleniyor" />
      </div>
    )
  }

  const dealer = data.dealer
  const dealerHidden = data.dealerHidden
  const phaseLabel = phase === 'waiting' ? 'Oyuncu bekleniyor' : phase === 'bet' ? `Bahis · ${secondsLeft} sn` : phase === 'play' ? `Oyun · ${secondsLeft} sn` : 'Sonuç'

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
      <section className="flex flex-col overflow-hidden rounded-3xl border border-primary/30 bg-[color-mix(in_oklch,var(--wood)_80%,var(--background))] p-2 sm:p-3" aria-label="Canlı blackjack masası">
        <div className="felt-table relative flex flex-col gap-4 overflow-hidden rounded-[1.25rem] px-3 pb-4 pt-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
              Canlı masa · El #{data.roundId % 10000}
            </span>
            <span className="rounded-full border border-primary/40 bg-background/70 px-3 py-1 text-xs font-bold tabular-nums text-foreground">
              {phaseLabel}
            </span>
          </div>

          <div className="flex items-end justify-center gap-3">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-primary/60 bg-background sm:size-24">
              <Image src="/images/mascots/jako-dealer.png" alt="Krupiye Jako" fill sizes="96px" className="object-cover object-top" priority />
            </div>
            <p aria-live="polite" className="mb-1 max-w-64 rounded-2xl rounded-bl-sm border border-primary/40 bg-background/85 px-3 py-2 text-xs font-semibold text-foreground sm:text-sm">
              {dealerLine(phase, seated, secondsLeft, data.dealerValue)}
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex min-h-14 justify-center -space-x-5 sm:min-h-16">
              {dealer.map((c, i) => (
                <PlayingCard key={`d-${i}-${c.r}-${c.s}`} card={c} index={i} small />
              ))}
              {dealerHidden && <PlayingCard hidden small />}
            </div>
            {dealer.length > 0 && (
              <span className="rounded-full border border-primary/30 bg-background/60 px-2.5 py-0.5 text-xs font-bold tabular-nums text-foreground">
                Krupiye {data.dealerValue}
                {dealerHidden ? '+' : ''}
              </span>
            )}
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Blackjack 3:2 öder · Krupiye 17’de durur</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {seats.map((s, i) => (
              <SeatBox key={i} index={i} seat={s} canSit={canSit} busy={busy} onSit={sit} phase={phase} />
            ))}
          </div>
        </div>
        <div className="h-1 bg-background/60" aria-hidden="true">
          <div className="h-full bg-primary transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>

        <div className="flex flex-col items-center gap-3 px-2 pb-2 pt-4">
          {myTurn ? (
            <div className="flex flex-wrap justify-center gap-2">
              <button disabled={busy} onClick={() => act('hit')} className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50">
                <Plus className="size-4" aria-hidden="true" /> Kart çek
              </button>
              <button disabled={busy} onClick={() => act('stand')} className="flex items-center gap-2 rounded-xl border border-primary/50 bg-background/70 px-5 py-3 text-sm font-bold uppercase text-foreground disabled:opacity-50">
                <Hand className="size-4" aria-hidden="true" /> Dur
              </button>
              {me.cards.length === 2 && points >= me.bet && (
                <button disabled={busy} onClick={() => act('double')} className="flex items-center gap-2 rounded-xl border border-primary/50 bg-background/70 px-5 py-3 text-sm font-bold uppercase text-foreground disabled:opacity-50">
                  <Layers className="size-4" aria-hidden="true" /> İkiye katla
                </button>
              )}
            </div>
          ) : phase === 'bet' && me ? (
            <div className="flex flex-col items-center gap-2">
              {me.ready ? (
                <p className="text-center text-sm text-muted-foreground">
                  {seated > 1 ? `Hazırsın. Diğer oyuncular bekleniyor, en geç ${secondsLeft} saniye.` : 'Kartlar dağıtılıyor...'}
                </p>
              ) : (
                <button
                  disabled={busy}
                  onClick={dealNow}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50"
                >
                  <Play className="size-4" aria-hidden="true" />
                  {seated > 1 ? 'Hazırım, dağıt' : 'Hemen dağıt'}
                </button>
              )}
              <p className="text-xs text-muted-foreground">Koltuk {me.seat} senin. Basmazsan kartlar {secondsLeft} saniye sonra kendiliğinden dağıtılır.</p>
            </div>
          ) : (phase === 'bet' || phase === 'waiting') && !me ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Bahis">
                {settings.bets.map((b) => (
                  <button key={b} role="radio" aria-checked={bet === b} onClick={() => setBet(b)} className={cn('chip', bet === b && 'chip-active')}>
                    {formatAC(b)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{member ? 'Bahsini seç, sonra boş bir koltuğa otur.' : 'Oynamak için giriş yap. İzlemek serbest.'}</p>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              {me
                ? phase === 'play'
                    ? 'Elin tamam, diğer oyuncular bekleniyor.'
                    : me.delta !== null && me.delta > 0
                      ? `Tebrikler, +${formatAC(me.delta)} kazandın!`
                      : me.delta === 0
                        ? 'Berabere, bahsin iade edildi.'
                        : 'Bu el krupiyenin. Yeni el birazdan başlıyor.'
                : 'Bu eli izliyorsun. Bahis süresi açılınca boş koltuğa oturabilirsin.'}
            </p>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <p className="text-center text-xs text-muted-foreground">
            Masada 6 koltuk var. Herkes durunca krupiye hemen açar, süre dolunca oynamayan el otomatik durur. Kartlar sunucuda dağıtılır, herkes aynı masayı görür.
          </p>
        </div>
      </section>

      <aside className="flex h-fit flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-4" aria-labelledby="bj-winners">
        <h3 id="bj-winners" className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
          <Trophy className="size-4 text-primary" aria-hidden="true" />
          Son el kazananları
        </h3>
        {!data.lastRound ? (
          <p className="text-sm leading-relaxed text-muted-foreground">Henüz oynanmış el yok.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Krupiye: {data.lastRound.dealerValue > 21 ? `${data.lastRound.dealerValue} (battı)` : data.lastRound.dealerValue}</p>
            <LastWinners winners={data.lastRound.winners} />
          </>
        )}
      </aside>
    </div>
  )
}

function LastWinners({ winners }: { winners: { name: string; won: number }[] }) {
  if (winners.length === 0) return <p className="text-sm leading-relaxed text-muted-foreground">Son elde kazanan yok.</p>
  return (
    <ol className="flex flex-col gap-1.5">
      {winners.map((w, i) => (
        <li key={`${w.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
          <span className="truncate font-semibold text-foreground">{w.name}</span>
          <span className="shrink-0 font-bold tabular-nums text-primary">+{formatAC(w.won)}</span>
        </li>
      ))}
    </ol>
  )
}
