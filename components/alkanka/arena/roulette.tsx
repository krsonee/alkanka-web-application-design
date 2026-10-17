'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { spinRoulette } from '@/app/actions/arena'
import { RED, WHEEL, betReturn, type RouletteBet } from '@/lib/casino'
import type { ArenaGameSettings } from '@/lib/arena'
import { playSound } from '@/lib/sound'
import { formatAC, usePoints } from '../points-context'
import { TableBrand } from './table-brand'
import { RouletteBoard, betKey, parseKey, type BetKind } from './roulette-board'

const SEG = 360 / WHEEL.length
const numColor = (n: number) => (n === 0 ? 'zero' : RED.has(n) ? 'red' : 'black')

function Wheel({ rotation, result }: { rotation: number; result: number | null }) {
  const gradient = WHEEL.map((n, i) => {
    const c = n === 0 ? 'var(--felt)' : RED.has(n) ? 'oklch(0.5 0.19 25)' : 'oklch(0.2 0.01 260)'
    return `${c} ${i * SEG}deg ${(i + 1) * SEG}deg`
  }).join(',')
  return (
    <div className="relative mx-auto aspect-square w-full max-w-72">
      <TableBrand center={false} plaque={false} />
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 border-x-8 border-t-14 border-x-transparent border-t-primary" aria-hidden="true" />
      <div className="absolute inset-0 rounded-full border-8 border-wood p-1 shadow-2xl">
        <div
          className="relative size-full rounded-full transition-transform duration-[4500ms] ease-[cubic-bezier(0.15,0.85,0.25,1)]"
          style={{ transform: `rotate(${rotation}deg)`, background: `conic-gradient(${gradient})` }}
          aria-hidden="true"
        >
          {WHEEL.map((n, i) => (
            <span
              key={n}
              className="absolute left-1/2 top-0 h-1/2 origin-bottom -translate-x-1/2 pt-1 text-[9px] font-bold text-foreground sm:text-[10px]"
              style={{ transform: `rotate(${i * SEG + SEG / 2}deg)` }}
            >
              {n}
            </span>
          ))}
          <div className="absolute inset-[24%] flex items-center justify-center rounded-full border-4 border-primary/60 bg-background">
            <span className="font-display text-xs font-bold uppercase tracking-widest text-primary">Alkanka</span>
          </div>
        </div>
      </div>
      <p className="sr-only" role="status">
        {result === null ? '' : `Top ${result} sayısına düştü`}
      </p>
    </div>
  )
}

const NO_OTHERS = new Map<string, number>()

function Board({ t, chipValues }: { t: ReturnType<typeof useRouletteTable>; chipValues: number[] }) {
  return (
    <RouletteBoard
      mine={t.bets}
      others={NO_OTHERS}
      onBet={t.place}
      disabled={t.spinning}
      winner={t.spinning || t.bets.size ? null : t.result}
      chipValues={chipValues}
    />
  )
}

function useRouletteTable(chipValues: number[]) {
  const [chip, setChip] = useState(chipValues[0])
  const [bets, setBets] = useState<Map<string, number>>(new Map())
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<number | null>(null)
  const [spinning, setSpinning] = useState(false)
  const total = [...bets.values()].reduce((a, b) => a + b, 0)

  function place(kind: BetKind, value?: number) {
    const k = betKey(kind, value)
    setBets((m) => new Map(m).set(k, (m.get(k) ?? 0) + chip))
  }
  function list(): RouletteBet[] {
    return [...bets.entries()].map(([k, amount]) => ({ ...parseKey(k), amount }))
  }
  function animateTo(n: number) {
    const idx = WHEEL.indexOf(n)
    const target = 360 - (idx * SEG + SEG / 2)
    setRotation((r) => r - (r % 360) + 360 * 6 + target)
    setSpinning(true)
    playSound('spin')
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        setSpinning(false)
        setResult(n)
        playSound('ball')
        resolve()
      }, 4600),
    )
  }
  return { chip, setChip, bets, setBets, rotation, result, spinning, total, place, list, animateTo }
}

function ChipRack({ values, chip, setChip }: { values: number[]; chip: number; setChip: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Fiş değeri">
      {values.map((v) => (
        <button key={v} role="radio" aria-checked={chip === v} onClick={() => setChip(v)} className={cn('chip', chip === v && 'chip-active')}>
          {v}
        </button>
      ))}
    </div>
  )
}

function ResultBadge({ n }: { n: number | null }) {
  if (n === null) return null
  const c = numColor(n)
  return (
    <span
      className={cn(
        'pop-in flex size-12 items-center justify-center rounded-full font-display text-xl font-bold text-foreground',
        c === 'red' ? 'bg-[oklch(0.5_0.19_25)]' : c === 'black' ? 'bg-[oklch(0.2_0.01_260)]' : 'bg-felt',
      )}
    >
      {n}
    </span>
  )
}

/** Real-KC roulette. The number is drawn on the server. */
export function RouletteHouse({ settings }: { settings: ArenaGameSettings }) {
  const { points, setBalance, requireLogin } = usePoints()
  const t = useRouletteTable(settings.bets)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function spin() {
    if (t.spinning || t.total === 0 || !requireLogin()) return
    if (t.total > points) return setError('Bakiyen bu bahisler için yetersiz.')
    setError('')
    setMsg('')
    const res = await spinRoulette(t.list())
    if (!res.ok) return setError(res.error)
    await t.animateTo(res.number)
    setBalance(res.balance)
    playSound(res.returned > 0 ? 'win' : 'lose')
    setMsg(res.returned > 0 ? `${formatAC(res.returned)} kazandın!` : 'Bu tur olmadı.')
    t.setBets(new Map())
  }

  return (
    <div className="felt-table relative grid gap-6 overflow-hidden rounded-2xl border border-primary/30 p-4 sm:p-6 lg:grid-cols-[18rem_1fr]">
      <div className="flex flex-col items-center gap-4">
        <Wheel rotation={t.rotation} result={t.result} />
        <div className="flex min-h-12 items-center gap-3">
          <ResultBadge n={t.spinning ? null : t.result} />
          {msg && <p className="font-display text-lg font-bold text-primary">{msg}</p>}
        </div>
      </div>
      <div className="relative flex flex-col gap-4">
        <Board t={t} chipValues={settings.bets} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChipRack values={settings.bets} chip={t.chip} setChip={t.setChip} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => t.setBets(new Map())}
              disabled={t.spinning || t.total === 0}
              className="flex size-11 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground disabled:opacity-40"
              aria-label="Bahisleri temizle"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
            <button onClick={spin} disabled={t.spinning || t.total === 0} className="rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50">
              {t.spinning ? 'Dönüyor...' : `Çevir - ${formatAC(t.total)}`}
            </button>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">Sayı 36x, ayrık 18x, sokak 12x, köşe 9x, altılı 6x, düzine / kolon 3x, renk / tek-çift / yarı 2x öder. Sayı sunucuda çekilir.</p>
      </div>
    </div>
  )
}

const DUEL_SPINS = 5
const DUEL_CHIPS = 1000

/** Score round for a duel: 5 spins with 1000 practice chips. */
export function RouletteDuel({ onDone }: { onDone: (score: { for: number; against: number }) => void }) {
  const t = useRouletteTable([10, 25, 50, 100])
  const [chips, setChips] = useState(DUEL_CHIPS)
  const [spin, setSpin] = useState(0)

  async function go() {
    if (t.spinning || t.total === 0 || t.total > chips) return
    const bets = t.list()
    const n = Math.floor(Math.random() * 37)
    setChips((c) => c - t.total)
    await t.animateTo(n)
    const back = bets.reduce((a, b) => a + betReturn(b, n), 0)
    playSound(back > 0 ? 'coin' : 'lose')
    const after = chips - t.total + back
    setChips(after)
    t.setBets(new Map())
    const next = spin + 1
    setSpin(next)
    if (next >= DUEL_SPINS || after <= 0) setTimeout(() => onDone({ for: after, against: 0 }), 900)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
        <span className="font-semibold text-foreground">
          Tur {Math.min(spin + 1, DUEL_SPINS)}/{DUEL_SPINS}
        </span>
        <span className="text-muted-foreground">
          Fiş <strong className="text-primary">{chips}</strong>
        </span>
      </div>
      <div className="felt-table relative grid gap-6 overflow-hidden rounded-2xl border border-primary/30 p-4 sm:p-6 lg:grid-cols-[18rem_1fr]">
        <div className="flex flex-col items-center gap-4">
          <Wheel rotation={t.rotation} result={t.result} />
          <ResultBadge n={t.spinning ? null : t.result} />
        </div>
        <div className="flex flex-col gap-4">
          <Board t={t} chipValues={[10, 25, 50, 100]} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ChipRack values={[10, 25, 50, 100]} chip={t.chip} setChip={t.setChip} />
            <button onClick={go} disabled={t.spinning || t.total === 0 || t.total > chips} className="rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground disabled:opacity-50">
              {t.spinning ? 'Dönüyor...' : `Çevir - ${t.total}`}
            </button>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {DUEL_CHIPS} antrenman fişiyle {DUEL_SPINS} tur çevir. Sonunda daha çok fişi kalan masadaki KC’yi alır.
      </p>
    </div>
  )
}
