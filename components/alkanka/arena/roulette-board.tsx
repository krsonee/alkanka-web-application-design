'use client'

import { useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { RACETRACK, RED, WHEEL, betLabel, betNumbers, betReturn, racetrackUnits, type RacetrackKey, type RouletteBet } from '@/lib/casino'
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
  fill?: boolean
}

type Ctx = BoardProps & { hover: number[]; setHover: (n: number[]) => void }

const wins = (kind: BetKind, value: number | undefined, n: number | null) =>
  n !== null && betReturn({ kind, value, amount: 2 }, n) > 1

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

/** Touch has no hover, so a press briefly lights the numbers the bet covers, like a dealer pointing at the felt. */
function previewHandlers(c: Ctx, kind: BetKind, value?: number) {
  return {
    onPointerEnter: (e: PointerEvent) => e.pointerType === 'mouse' && c.setHover(covered(kind, value)),
    onPointerLeave: () => c.setHover([]),
    onPointerDown: (e: PointerEvent) => e.pointerType !== 'mouse' && !c.disabled && c.setHover(covered(kind, value)),
    onPointerUp: (e: PointerEvent) => e.pointerType !== 'mouse' && window.setTimeout(() => c.setHover([]), 260),
    onPointerCancel: () => c.setHover([]),
  }
}

function Cell({
  kind,
  value,
  style,
  className,
  children,
  c,
  chip = 'corner',
}: {
  kind: BetKind
  value?: number
  style?: CSSProperties
  className?: string
  children: ReactNode
  c: Ctx
  chip?: 'corner' | 'center'
}) {
  const k = betKey(kind, value)
  const amount = c.mine.get(k) ?? 0
  const other = c.others.get(k) ?? 0
  const won = wins(kind, value, c.winner)
  const lit = kind === 'number' && value !== undefined && c.hover.includes(value)
  return (
    <button
      type="button"
      onClick={() => bet(c, kind, value)}
      {...previewHandlers(c, kind, value)}
      disabled={c.disabled}
      aria-label={`${betLabel({ kind, value })}${amount ? `, bahsin ${amount}` : ''}`}
      style={style}
      className={cn(
        'relative flex min-h-0 min-w-0 items-center justify-center p-0 font-display font-bold text-foreground transition-[filter,box-shadow,color]',
        'enabled:hover:brightness-125 disabled:cursor-not-allowed',
        lit && 'z-10 brightness-150 ring-2 ring-inset ring-foreground/80',
        className,
        won && 'z-10 text-primary ring-2 ring-inset ring-primary shadow-[0_0_14px_var(--primary)]',
        won && kind === 'number' && 'text-foreground',
      )}
    >
      {children}
      {other > 0 && (
        <span className="absolute left-0.5 top-0.5 rounded-full bg-background/75 px-1 text-[9px] font-semibold leading-tight text-muted-foreground" title="Diğer oyuncuların bahsi">
          {short(other)}
        </span>
      )}
      {amount > 0 &&
        (chip === 'center' ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Chip amount={amount} tone={chipTone(amount, c.chipValues)} size="md" />
          </span>
        ) : (
          <span className="pointer-events-none absolute bottom-0.5 right-0.5">
            <Chip amount={amount} tone={chipTone(amount, c.chipValues)} size="xs" />
          </span>
        ))}
    </button>
  )
}

/** Target sitting on a line or corner between numbers, for split / corner / street / six-line / trio / first-four bets. */
function Spot({ kind, value, x, y, c, touch }: { kind: BetKind; value: number; x: number; y: number; c: Ctx; touch?: boolean }) {
  const k = betKey(kind, value)
  const amount = c.mine.get(k) ?? 0
  const other = c.others.get(k) ?? 0
  const won = wins(kind, value, c.winner)
  const label = betLabel({ kind, value })
  return (
    <button
      type="button"
      onClick={() => bet(c, kind, value)}
      {...previewHandlers(c, kind, value)}
      onFocus={() => c.setHover(covered(kind, value))}
      onBlur={() => c.setHover([])}
      disabled={c.disabled}
      aria-label={`${label}${amount ? `, bahsin ${amount}` : ''}`}
      title={label}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      className={cn(
        'group absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full disabled:cursor-not-allowed',
        touch ? 'size-6' : 'size-5',
      )}
    >
      {amount > 0 ? (
        <Chip amount={amount} tone={chipTone(amount, c.chipValues)} size={touch ? 'sm' : 'xs'} active={won} />
      ) : (
        <span
          className={cn(
            'size-1.5 rounded-full transition-all',
            other > 0 ? 'bg-muted-foreground' : touch && kind === 'corner' ? 'size-1 bg-foreground/35' : 'bg-transparent',
            touch && 'group-active:size-full group-active:bg-primary/70',
            'group-enabled:group-hover:size-full group-enabled:group-hover:bg-primary/70 group-focus-visible:size-full group-focus-visible:bg-primary/70',
          )}
          aria-hidden="true"
        />
      )}
    </button>
  )
}

type SpotDef = { kind: BetKind; value: number; x: number; y: number }

/** Horizontal board: column i (0-11) left to right, row r (0-2) top to bottom; the top row holds 3, 6, 9... */
const hNum = (i: number, r: number) => 3 * i + (3 - r)

function horizontalSpots(): SpotDef[] {
  const s: SpotDef[] = []
  for (let r = 0; r < 3; r++) s.push({ kind: 'split', value: hNum(0, r), x: 0, y: (r + 0.5) / 3 })
  s.push({ kind: 'trio', value: 2, x: 0, y: 1 / 3 }, { kind: 'trio', value: 1, x: 0, y: 2 / 3 }, { kind: 'basket', value: 0, x: 0, y: 1 })
  for (let i = 0; i < 12; i++) {
    for (let r = 0; r < 3; r++) {
      const n = hNum(i, r)
      if (i < 11) s.push({ kind: 'split', value: n * 100 + n + 3, x: (i + 1) / 12, y: (r + 0.5) / 3 })
      if (r < 2) s.push({ kind: 'split', value: (n - 1) * 100 + n, x: (i + 0.5) / 12, y: (r + 1) / 3 })
      if (r < 2 && i < 11) s.push({ kind: 'corner', value: hNum(i, r + 1), x: (i + 1) / 12, y: (r + 1) / 3 })
    }
    s.push({ kind: 'street', value: 3 * i + 1, x: (i + 0.5) / 12, y: 1 })
    if (i < 11) s.push({ kind: 'line', value: 3 * i + 1, x: (i + 1) / 12, y: 1 })
  }
  return s
}

/** Vertical board for phones: row i (0-11) top to bottom, column j (0-2) left to right; row i holds 3i+1..3i+3. */
const vNum = (i: number, j: number) => 3 * i + j + 1

function verticalSpots(): SpotDef[] {
  const s: SpotDef[] = []
  for (let j = 0; j < 3; j++) s.push({ kind: 'split', value: j + 1, x: (j + 0.5) / 3, y: 0 })
  s.push({ kind: 'trio', value: 1, x: 1 / 3, y: 0 }, { kind: 'trio', value: 2, x: 2 / 3, y: 0 }, { kind: 'basket', value: 0, x: 0, y: 0 })
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 3; j++) {
      const n = vNum(i, j)
      if (j < 2) s.push({ kind: 'split', value: n * 100 + n + 1, x: (j + 1) / 3, y: (i + 0.5) / 12 })
      if (i < 11) s.push({ kind: 'split', value: n * 100 + n + 3, x: (j + 0.5) / 3, y: (i + 1) / 12 })
      if (j < 2 && i < 11) s.push({ kind: 'corner', value: n, x: (j + 1) / 3, y: (i + 1) / 12 })
    }
    s.push({ kind: 'street', value: 3 * i + 1, x: 0, y: (i + 0.5) / 12 })
    if (i < 11) s.push({ kind: 'line', value: 3 * i + 1, x: 0, y: (i + 1) / 12 })
  }
  return s
}

const H_SPOTS = horizontalSpots()
const V_SPOTS = verticalSpots()

function Spots({ c, defs, touch }: { c: Ctx; defs: SpotDef[]; touch?: boolean }) {
  return (
    <>
      {defs.map((s) => (
        <Spot key={betKey(s.kind, s.value)} {...s} c={c} touch={touch} />
      ))}
    </>
  )
}

const Diamond = ({ tone }: { tone: 'red' | 'black' }) => (
  <span
    className={cn('size-4 rotate-45', tone === 'red' ? 'bg-[var(--rl-red)]' : 'border border-foreground/50 bg-[var(--rl-black)]')}
    aria-hidden="true"
  />
)

const OUTSIDE: { kind: BetKind; text: ReactNode }[] = [
  { kind: 'low', text: '1-18' },
  { kind: 'even', text: 'ÇİFT' },
  { kind: 'red', text: <Diamond tone="red" /> },
  { kind: 'black', text: <Diamond tone="black" /> },
  { kind: 'odd', text: 'TEK' },
  { kind: 'high', text: '19-36' },
]
const numBg = (n: number) => ({ background: n === 0 ? 'var(--rl-green)' : RED.has(n) ? 'var(--rl-red)' : 'var(--rl-black)' })

const H_LINE = 'border border-foreground/35'

/** `fill` stretches the board to its parent's height, for the sideways phone table where every pixel counts. */
function HorizontalLayout({ c, fill }: { c: Ctx; fill?: boolean }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border-2 border-foreground/50',
        fill
          ? 'grid h-full grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] grid-rows-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)] bg-felt'
          : 'hidden grid-cols-[3rem_minmax(0,1fr)_3rem] md:grid',
      )}
    >
      <Cell c={c} kind="number" value={0} style={numBg(0)} className={cn(H_LINE, 'rounded-l-[2rem] text-sm')}>
        0
      </Cell>
      <div className={cn('relative grid grid-cols-12 grid-rows-3', fill && 'h-full')}>
        {[0, 1, 2].flatMap((r) =>
          Array.from({ length: 12 }, (_, i) => {
            const n = hNum(i, r)
            return (
              <Cell key={n} c={c} kind="number" value={n} style={numBg(n)} className={cn(H_LINE, fill ? 'text-sm tabular-nums' : 'h-14 text-sm')}>
                {n}
              </Cell>
            )
          }),
        )}
        <Spots c={c} defs={H_SPOTS} touch={fill} />
      </div>
      <div className={cn('grid grid-rows-3', fill && 'h-full')}>
        {[3, 2, 1].map((col) => (
          <Cell key={col} c={c} kind="column" value={col} className={cn(H_LINE, 'text-xs')}>
            2:1
          </Cell>
        ))}
      </div>
      <div className="col-start-2 grid grid-cols-3">
        {[1, 2, 3].map((d) => (
          <Cell key={d} c={c} kind="dozen" value={d} className={cn(H_LINE, fill ? 'text-xs' : 'h-11 text-sm')}>
            {d}. 12
          </Cell>
        ))}
      </div>
      <div className="col-start-2 grid grid-cols-6">
        {OUTSIDE.map((o) => (
          <Cell key={o.kind} c={c} kind={o.kind} className={cn(H_LINE, fill ? 'text-xs' : 'h-11 text-sm')}>
            {o.text}
          </Cell>
        ))}
      </div>
    </div>
  )
}

const FELT_CELL = 'bg-felt'
const SIDEWAYS = 'whitespace-nowrap text-xs font-bold tracking-[0.2em] [writing-mode:vertical-rl] rotate-180'
const ZERO_SHAPE = '[clip-path:polygon(0_100%,0_42%,50%_0,100%_42%,100%_100%)]'

/**
 * Portrait felt modelled on live-casino phone tables: the zero is the classic pointed cap, numbers run in
 * three tall columns with 48px rows so every number, line and corner is a comfortable thumb target, and
 * the outside bets read sideways down the left rail like a real layout seen from the dealer's end.
 */
function VerticalLayout({ c }: { c: Ctx }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl bg-felt p-1.5 shadow-[inset_0_0_30px_rgb(0_0_0/0.45),0_12px_28px_-12px_rgb(0_0_0/0.6)] ring-1 ring-primary/60 md:hidden">
      <div className="grid grid-cols-[2.75rem_2.75rem_minmax(0,1fr)]">
        <div className="col-start-3 bg-felt pb-px">
          <div className="bg-foreground/55 p-px pb-0 [clip-path:polygon(0_100%,0_42%,50%_0,100%_42%,100%_100%)]">
            <Cell c={c} kind="number" value={0} style={numBg(0)} className={cn(ZERO_SHAPE, 'h-14 w-full pt-3 text-2xl')}>
              0
            </Cell>
          </div>
        </div>

        <div className="col-span-3 grid grid-cols-subgrid overflow-hidden rounded-b-lg bg-foreground/55 p-px pt-0">
          <div className="grid grid-rows-6 gap-px pr-px">
            {OUTSIDE.map((o) => (
              <Cell key={o.kind} c={c} kind={o.kind} chip="center" className={cn(FELT_CELL, 'text-foreground/90')}>
                {typeof o.text === 'string' ? <span className={SIDEWAYS}>{o.text}</span> : o.text}
              </Cell>
            ))}
          </div>
          <div className="grid grid-rows-3 gap-px pr-px">
            {[1, 2, 3].map((d) => (
              <Cell key={d} c={c} kind="dozen" value={d} chip="center" className={cn(FELT_CELL, 'text-foreground/90')}>
                <span className={SIDEWAYS}>{`${12 * d - 11}-${12 * d}`}</span>
              </Cell>
            ))}
          </div>
          <div className="flex flex-col gap-px">
            <div className="relative grid grid-cols-3 gap-px">
              {Array.from({ length: 12 }, (_, i) =>
                [0, 1, 2].map((j) => {
                  const n = vNum(i, j)
                  return (
                    <Cell key={n} c={c} kind="number" value={n} chip="center" style={numBg(n)} className="h-12 text-xl tabular-nums">
                      {n}
                    </Cell>
                  )
                }),
              )}
              <Spots c={c} defs={V_SPOTS} touch />
            </div>
            <div className="grid grid-cols-3 gap-px">
              {[1, 2, 3].map((col) => (
                <Cell key={col} c={c} kind="column" value={col} chip="center" className={cn(FELT_CELL, 'h-11 text-sm text-foreground/90')}>
                  2:1
                </Cell>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RouletteBoard(p: BoardProps) {
  const [hover, setHover] = useState<number[]>([])
  const c = { ...p, hover, setHover }
  if (p.fill) return <HorizontalLayout c={c} fill />
  return (
    <div className="flex flex-col gap-1.5">
      <HorizontalLayout c={c} />
      <VerticalLayout c={c} />
      <p className="hidden text-pretty text-center text-xs leading-relaxed text-muted-foreground md:block">
        Çizgiye koy: ayrık · Köşeye: köşe · Kenara: sokak · İki sıra arası: altılı · Sıfır çizgisi: üçlü ve ilk dörtlü
      </p>
      <p className="text-pretty text-center text-xs leading-relaxed text-muted-foreground md:hidden">
        Sayıların arasındaki çizgiye ve köşelere de fiş koyabilirsin.
      </p>
    </div>
  )
}

const SECTION_NUMBERS: Record<RacetrackKey, number[]> = Object.fromEntries(
  (Object.keys(RACETRACK) as RacetrackKey[]).map((k) => [k, Array.from(new Set(RACETRACK[k].bets.flatMap((b) => betNumbers(b.kind, b.value) ?? [])))]),
) as Record<RacetrackKey, number[]>

/** Wheel-ordered strip for neighbour bets plus the three classic French call bets. */
export function Racetrack({
  chip,
  disabled,
  winner,
  onCall,
  onNeighbors,
}: {
  chip: number
  disabled: boolean
  winner: number | null
  onCall: (key: RacetrackKey) => void
  onNeighbors: (n: number) => void
}) {
  const [lit, setLit] = useState<number[]>([])
  const press = (fn: () => void) => {
    if (disabled) return
    playSound('chip')
    fn()
  }
  return (
    <section className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-foreground/25 bg-background/40 p-2.5" aria-labelledby="rl-track">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="rl-track" className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
          Yarış pisti
        </h3>
        <span className="text-xs text-muted-foreground">Sayıya dokun: kendisi ve iki yanındaki ikişer komşu (5 fiş)</span>
      </div>
      <ol className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:flex-wrap md:justify-center" aria-label="Çark sırasıyla sayılar">
        {WHEEL.map((n) => (
          <li key={n}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => press(() => onNeighbors(n))}
              aria-label={`${n} ve komşuları, ${chip * 5} KC`}
              className={cn(
                'flex size-9 items-center justify-center rounded-md border border-foreground/30 font-display text-sm font-bold text-foreground transition disabled:cursor-not-allowed disabled:opacity-60',
                lit.includes(n) && 'ring-2 ring-inset ring-primary',
                winner === n && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
              )}
              style={numBg(n)}
            >
              {n}
            </button>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(RACETRACK) as RacetrackKey[]).map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => press(() => onCall(k))}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setLit(SECTION_NUMBERS[k])}
            onPointerLeave={() => setLit([])}
            onFocus={() => setLit(SECTION_NUMBERS[k])}
            onBlur={() => setLit([])}
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-foreground/30 bg-background/60 px-1.5 py-1.5 text-center transition enabled:hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-balance text-xs font-bold leading-tight text-foreground">{RACETRACK[k].label}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              {racetrackUnits(k)} fiş · {racetrackUnits(k) * chip} KC
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
