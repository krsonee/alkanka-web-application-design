'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { RED, betLabel, betNumbers, betReturn, type RouletteBet } from '@/lib/casino'
import { playSound } from '@/lib/sound'
import { cn } from '@/lib/utils'

export type BetKind = RouletteBet['kind']
export const betKey = (kind: BetKind, value?: number) => `${kind}:${value ?? ''}`
export function parseKey(k: string): Pick<RouletteBet, 'kind' | 'value'> {
  const [kind, v] = k.split(':')
  return { kind: kind as BetKind, value: v ? Number(v) : undefined }
}

const CHIP_TONES = ['var(--rl-red)', 'var(--felt)', 'var(--rl-green)', 'var(--primary)', 'var(--rl-black)']

export function chipTone(value: number, values: number[]) {
  const i = Math.max(0, values.findIndex((v) => v >= value))
  return CHIP_TONES[Math.min(i, CHIP_TONES.length - 1)]
}

const short = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n))

export function Chip({ amount, tone, size = 'md', active }: { amount: number; tone: string; size?: 'xs' | 'sm' | 'md' | 'lg'; active?: boolean }) {
  const isGold = tone === 'var(--primary)'
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full border-2 border-dashed font-bold shadow-lg',
        size === 'xs' && 'size-5 border text-[8px]',
        size === 'sm' && 'size-6 text-[9px]',
        size === 'md' && 'size-8 text-[10px]',
        size === 'lg' && 'size-12 text-xs',
        isGold ? 'text-primary-foreground' : 'text-foreground',
        active && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}
      style={{ background: tone, borderColor: 'color-mix(in oklch, var(--foreground) 75%, transparent)' }}
    >
      <span className="absolute inset-1 rounded-full border border-current opacity-30" aria-hidden="true" />
      {short(amount)}
    </span>
  )
}

type BoardProps = {
  mine: Map<string, number>
  others: Map<string, number>
  onBet: (kind: BetKind, value?: number) => void
  disabled: boolean
  winner: number | null
  chipValues: number[]
}

type Ctx = BoardProps & { compact: boolean; hover: number[]; setHover: (n: number[]) => void }

const wins = (kind: BetKind, value: number | undefined, n: number | null) => n !== null && betReturn({ kind, value, amount: 1 }, n) > 0

const OUTSIDE_NUMBERS: Partial<Record<BetKind, (n: number) => boolean>> = {
  red: (n) => RED.has(n),
  black: (n) => !RED.has(n),
  even: (n) => n % 2 === 0,
  odd: (n) => n % 2 === 1,
  low: (n) => n <= 18,
  high: (n) => n >= 19,
}
const ALL = Array.from({ length: 36 }, (_, i) => i + 1)
const covered = (kind: BetKind, value?: number) => betNumbers(kind, value) ?? ALL.filter(OUTSIDE_NUMBERS[kind] ?? (() => false))

function bet(c: Ctx, kind: BetKind, value?: number) {
  if (c.disabled) return
  playSound('chip')
  c.onBet(kind, value)
}

function Cell({ kind, value, style, className, children, c }: { kind: BetKind; value?: number; style?: CSSProperties; className?: string; children: ReactNode; c: Ctx }) {
  const k = betKey(kind, value)
  const amount = c.mine.get(k) ?? 0
  const other = c.others.get(k) ?? 0
  const won = wins(kind, value, c.winner)
  const lit = kind === 'number' && value !== undefined && c.hover.includes(value)
  return (
    <button
      type="button"
      onClick={() => bet(c, kind, value)}
      onPointerEnter={() => c.setHover(covered(kind, value))}
      onPointerLeave={() => c.setHover([])}
      disabled={c.disabled}
      aria-label={`${betLabel({ kind, value })}${amount ? `, bahsin ${amount}` : ''}`}
      style={style}
      className={cn(
        'relative flex items-center justify-center border border-foreground/40 font-display font-bold text-foreground transition-colors',
        c.compact ? 'min-h-0 border-foreground/35 p-0' : 'min-h-11 text-sm',
        'enabled:hover:bg-foreground/15 disabled:cursor-not-allowed',
        lit && 'bg-foreground/20',
        won && 'z-10 bg-primary/35 ring-2 ring-inset ring-primary',
        className,
      )}
    >
      {children}
      {other > 0 && (
        <span className="absolute left-0.5 top-0.5 rounded-full bg-background/70 px-1 text-[9px] font-semibold text-muted-foreground" title="Diğer oyuncuların bahsi">
          {short(other)}
        </span>
      )}
      {amount > 0 && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Chip amount={amount} tone={chipTone(amount, c.chipValues)} size={c.compact ? 'xs' : 'sm'} />
        </span>
      )}
    </button>
  )
}

/** Invisible target sitting on a line or corner between numbers, for split / corner / street / six-line bets. */
function Spot({ kind, value, x, y, c }: { kind: BetKind; value: number; x: number; y: number; c: Ctx }) {
  const k = betKey(kind, value)
  const amount = c.mine.get(k) ?? 0
  const other = c.others.get(k) ?? 0
  const won = wins(kind, value, c.winner)
  const label = betLabel({ kind, value })
  return (
    <button
      type="button"
      onClick={() => bet(c, kind, value)}
      onPointerEnter={() => c.setHover(covered(kind, value))}
      onPointerLeave={() => c.setHover([])}
      onFocus={() => c.setHover(covered(kind, value))}
      onBlur={() => c.setHover([])}
      disabled={c.disabled}
      aria-label={`${label}${amount ? `, bahsin ${amount}` : ''}`}
      title={label}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      className={cn(
        'group absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full disabled:cursor-not-allowed',
        c.compact ? 'size-3.5' : 'size-5',
      )}
    >
      {amount > 0 ? (
        <Chip amount={amount} tone={chipTone(amount, c.chipValues)} size="xs" active={won} />
      ) : (
        <span
          className={cn(
            'rounded-full transition-all',
            c.compact ? 'size-1.5' : 'size-2',
            other > 0 ? 'bg-muted-foreground' : 'bg-transparent',
            'group-enabled:group-hover:size-full group-enabled:group-hover:bg-primary/70 group-focus-visible:size-full group-focus-visible:bg-primary/70',
          )}
          aria-hidden="true"
        />
      )}
    </button>
  )
}

/** Column i (0-11) left to right, row r (0-2) top to bottom; the top row holds 3, 6, 9... */
const numAt = (i: number, r: number) => 3 * i + (3 - r)

function Spots({ c }: { c: Ctx }) {
  const spots: { kind: BetKind; value: number; x: number; y: number }[] = []
  for (let r = 0; r < 3; r++) spots.push({ kind: 'split', value: numAt(0, r), x: 0, y: (r + 0.5) / 3 })
  for (let i = 0; i < 12; i++) {
    for (let r = 0; r < 3; r++) {
      const n = numAt(i, r)
      if (i < 11) spots.push({ kind: 'split', value: n * 100 + n + 3, x: (i + 1) / 12, y: (r + 0.5) / 3 })
      if (r < 2) spots.push({ kind: 'split', value: (n - 1) * 100 + n, x: (i + 0.5) / 12, y: (r + 1) / 3 })
      if (r < 2 && i < 11) spots.push({ kind: 'corner', value: numAt(i, r + 1), x: (i + 1) / 12, y: (r + 1) / 3 })
    }
    spots.push({ kind: 'street', value: 3 * i + 1, x: (i + 0.5) / 12, y: 1 })
    if (i < 11) spots.push({ kind: 'line', value: 3 * i + 1, x: (i + 1) / 12, y: 1 })
  }
  return (
    <>
      {spots.map((s) => (
        <Spot key={betKey(s.kind, s.value)} {...s} c={c} />
      ))}
    </>
  )
}

const OUTSIDE: { kind: BetKind; text: ReactNode; compact?: ReactNode }[] = [
  { kind: 'low', text: '1-18' },
  { kind: 'even', text: 'ÇİFT' },
  {
    kind: 'red',
    text: <span className="size-5 rotate-45 bg-[var(--rl-red)]" aria-hidden="true" />,
    compact: <span className="size-3.5 rotate-45 bg-[var(--rl-red)]" aria-hidden="true" />,
  },
  {
    kind: 'black',
    text: <span className="size-5 rotate-45 border border-foreground/50 bg-[var(--rl-black)]" aria-hidden="true" />,
    compact: <span className="size-3.5 rotate-45 border border-foreground/50 bg-[var(--rl-black)]" aria-hidden="true" />,
  },
  { kind: 'odd', text: 'TEK' },
  { kind: 'high', text: '19-36' },
]
const numBg = (n: number) => ({ background: n === 0 ? 'var(--rl-green)' : RED.has(n) ? 'var(--rl-red)' : 'var(--rl-black)' })

function Layout({ c }: { c: Ctx }) {
  const h = c.compact ? 'h-10 text-[11px]' : 'h-14'
  const sub = c.compact ? 'h-9 text-[10px]' : ''
  return (
    <div
      className={cn(
        'grid overflow-hidden border-2 border-foreground/50',
        c.compact ? 'grid-cols-[1.6rem_minmax(0,1fr)_1.6rem] rounded-md md:hidden' : 'hidden grid-cols-[3rem_minmax(0,1fr)_3rem] rounded-lg md:grid',
      )}
    >
      <Cell c={c} kind="number" value={0} style={numBg(0)} className={cn(c.compact ? 'rounded-l-2xl text-xs' : 'rounded-l-[2rem]')}>
        0
      </Cell>
      <div className="relative grid grid-cols-12 grid-rows-3">
        {[0, 1, 2].flatMap((r) =>
          Array.from({ length: 12 }, (_, i) => {
            const n = numAt(i, r)
            return (
              <Cell key={n} c={c} kind="number" value={n} style={numBg(n)} className={h}>
                {n}
              </Cell>
            )
          }),
        )}
        <Spots c={c} />
      </div>
      <div className="grid grid-rows-3">
        {[3, 2, 1].map((col) => (
          <Cell key={col} c={c} kind="column" value={col} className={cn(c.compact ? 'text-[9px]' : 'text-xs')}>
            2:1
          </Cell>
        ))}
      </div>
      <div className="col-start-2 grid grid-cols-3">
        {[1, 2, 3].map((d) => (
          <Cell key={d} c={c} kind="dozen" value={d} className={cn(sub, c.compact && 'text-[11px]')}>
            {d}. 12
          </Cell>
        ))}
      </div>
      <div className="col-start-2 grid grid-cols-6">
        {OUTSIDE.map((o) => (
          <Cell key={o.kind} c={c} kind={o.kind} className={sub}>
            {c.compact ? (o.compact ?? o.text) : o.text}
          </Cell>
        ))}
      </div>
    </div>
  )
}

export function RouletteBoard(p: BoardProps) {
  const [hover, setHover] = useState<number[]>([])
  return (
    <div className="flex flex-col gap-1.5">
      <Layout c={{ ...p, compact: false, hover, setHover }} />
      <Layout c={{ ...p, compact: true, hover, setHover }} />
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        Çizgiye koy: ayrık 18x · Köşeye: 9x · Alt kenar: sokak 12x, iki sıra arası altılı 6x · 2:1 kolon 3x
      </p>
    </div>
  )
}
