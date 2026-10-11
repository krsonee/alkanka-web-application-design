'use client'

import type { CSSProperties, ReactNode } from 'react'
import { RED, type RouletteBet } from '@/lib/casino'
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

export function Chip({ amount, tone, size = 'md', active }: { amount: number; tone: string; size?: 'sm' | 'md' | 'lg'; active?: boolean }) {
  const isGold = tone === 'var(--primary)'
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full border-2 border-dashed font-bold shadow-lg',
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

function wins(kind: BetKind, value: number | undefined, n: number | null) {
  if (n === null) return false
  if (kind === 'number') return value === n
  if (n === 0) return false
  if (kind === 'red') return RED.has(n)
  if (kind === 'black') return !RED.has(n)
  if (kind === 'even') return n % 2 === 0
  if (kind === 'odd') return n % 2 === 1
  if (kind === 'low') return n <= 18
  if (kind === 'high') return n >= 19
  return Math.ceil(n / 12) === value
}

function Cell({
  kind,
  value,
  style,
  className,
  children,
  label,
  p,
}: {
  kind: BetKind
  value?: number
  style?: CSSProperties
  className?: string
  children: ReactNode
  label: string
  p: BoardProps
}) {
  const k = betKey(kind, value)
  const amount = p.mine.get(k) ?? 0
  const other = p.others.get(k) ?? 0
  const won = wins(kind, value, p.winner)
  return (
    <button
      type="button"
      onClick={() => p.onBet(kind, value)}
      disabled={p.disabled}
      aria-label={`${label}${amount ? `, bahsin ${amount}` : ''}`}
      style={style}
      className={cn(
        'relative flex min-h-11 items-center justify-center border border-foreground/40 font-display text-sm font-bold text-foreground transition-colors',
        'enabled:hover:bg-foreground/15 disabled:cursor-not-allowed',
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
          <Chip amount={amount} tone={chipTone(amount, p.chipValues)} size="sm" />
        </span>
      )}
    </button>
  )
}

const NUMBERS = Array.from({ length: 36 }, (_, i) => i + 1)
const OUTSIDE: { kind: BetKind; label: string; text: ReactNode }[] = [
  { kind: 'low', label: '1-18', text: '1-18' },
  { kind: 'even', label: 'Çift', text: 'ÇİFT' },
  { kind: 'red', label: 'Kırmızı', text: <span className="size-5 rotate-45 bg-[var(--rl-red)]" aria-hidden="true" /> },
  { kind: 'black', label: 'Siyah', text: <span className="size-5 rotate-45 border border-foreground/50 bg-[var(--rl-black)]" aria-hidden="true" /> },
  { kind: 'odd', label: 'Tek', text: 'TEK' },
  { kind: 'high', label: '19-36', text: '19-36' },
]
const numBg = (n: number) => ({ background: n === 0 ? 'var(--rl-green)' : RED.has(n) ? 'var(--rl-red)' : 'var(--rl-black)' })

function Horizontal(p: BoardProps) {
  return (
    <div className="hidden grid-cols-[3rem_repeat(12,minmax(0,1fr))] overflow-hidden rounded-lg border-2 border-foreground/50 md:grid">
      <Cell p={p} kind="number" value={0} label="Sayı 0" style={{ gridColumn: 1, gridRow: '1 / span 3', ...numBg(0) }} className="rounded-l-[2rem]">
        0
      </Cell>
      {NUMBERS.map((n) => (
        <Cell
          key={n}
          p={p}
          kind="number"
          value={n}
          label={`Sayı ${n}`}
          style={{ gridColumn: Math.ceil(n / 3) + 1, gridRow: 3 - ((n - 1) % 3), ...numBg(n) }}
          className="h-14"
        >
          {n}
        </Cell>
      ))}
      {[1, 2, 3].map((d) => (
        <Cell key={d} p={p} kind="dozen" value={d} label={`${d}. düzine`} style={{ gridColumn: `${(d - 1) * 4 + 2} / span 4`, gridRow: 4 }}>
          {d}. 12
        </Cell>
      ))}
      {OUTSIDE.map((o, i) => (
        <Cell key={o.kind} p={p} kind={o.kind} label={o.label} style={{ gridColumn: `${i * 2 + 2} / span 2`, gridRow: 5 }}>
          {o.text}
        </Cell>
      ))}
    </div>
  )
}

function Vertical(p: BoardProps) {
  return (
    <div className="grid grid-cols-[repeat(2,2.75rem)_repeat(3,minmax(0,1fr))] overflow-hidden rounded-lg border-2 border-foreground/50 md:hidden">
      <Cell p={p} kind="number" value={0} label="Sayı 0" style={{ gridColumn: '3 / span 3', gridRow: 1, ...numBg(0) }} className="rounded-t-[2rem]">
        0
      </Cell>
      {NUMBERS.map((n) => (
        <Cell
          key={n}
          p={p}
          kind="number"
          value={n}
          label={`Sayı ${n}`}
          style={{ gridColumn: ((n - 1) % 3) + 3, gridRow: Math.ceil(n / 3) + 1, ...numBg(n) }}
        >
          {n}
        </Cell>
      ))}
      {[1, 2, 3].map((d) => (
        <Cell key={d} p={p} kind="dozen" value={d} label={`${d}. düzine`} style={{ gridColumn: 2, gridRow: `${(d - 1) * 4 + 2} / span 4` }}>
          <span className="-rotate-90 whitespace-nowrap">{d}. 12</span>
        </Cell>
      ))}
      {OUTSIDE.map((o, i) => (
        <Cell key={o.kind} p={p} kind={o.kind} label={o.label} style={{ gridColumn: 1, gridRow: `${i * 2 + 2} / span 2` }}>
          <span className={cn(typeof o.text === 'string' && '-rotate-90 whitespace-nowrap text-xs')}>{o.text}</span>
        </Cell>
      ))}
    </div>
  )
}

export function RouletteBoard(p: BoardProps) {
  return (
    <>
      <Horizontal {...p} />
      <Vertical {...p} />
    </>
  )
}
