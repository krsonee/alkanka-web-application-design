import type { ReactNode } from 'react'
import Image from 'next/image'
import type { WheelSegment } from '@/lib/rewards-shared'
import { cn } from '@/lib/utils'

const NO_TAP = '[-webkit-tap-highlight-color:transparent]'
const isGold = (i: number) => i % 2 === 0

type Landing = { index: number; won: boolean } | null

const rowTone = (i: number, landing: Landing) =>
  landing?.index !== i
    ? 'bg-background/70 inset-ring inset-ring-foreground/10'
    : landing.won
      ? 'bg-gold/20 inset-ring-2 inset-ring-gold'
      : 'bg-destructive/15 inset-ring inset-ring-destructive/60'

/** The wheel's slices as a list, in wheel order; the one the last spin stopped on is lit. Shown from 600 wide. */
export function RewardList({ segments, landing }: { segments: WheelSegment[]; landing: Landing }) {
  return (
    <ol aria-label="Çarktaki ödüller" className="flex flex-col gap-[3px]">
      {segments.map((segment, i) => (
        <li key={i} className={cn('flex h-[clamp(19px,2.5cqw,30px)] items-center gap-2 rounded-md px-2', rowTone(i, landing))}>
          <span
            aria-hidden="true"
            className={cn('size-2.5 shrink-0 rounded-full', isGold(i) ? 'bg-gold' : 'bg-secondary inset-ring inset-ring-gold/70')}
          />
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[clamp(10px,1.2cqw,13px)] font-bold',
              landing?.index === i ? 'text-foreground' : 'text-foreground/75',
            )}
          >
            {segment.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** The same list for phones: two rows of chips under the stage. */
export function RewardChips({ segments, landing }: { segments: WheelSegment[]; landing: Landing }) {
  return (
    <ol aria-label="Çarktaki ödüller" className="grid grid-cols-4 gap-1.5">
      {segments.map((segment, i) => (
        <li key={i} className={cn('flex h-12 min-w-0 flex-col items-center justify-center rounded-lg px-1 text-center', rowTone(i, landing))}>
          <span className={cn('text-sm leading-4 font-extrabold tabular-nums', isGold(i) ? 'text-gold' : 'text-foreground')}>{segment.short}</span>
          <span className="w-full truncate text-[10px] leading-[13px] font-medium text-muted-foreground">{segment.label}</span>
        </li>
      ))}
    </ol>
  )
}

/** The game's name on the gold plaque: top right on phones, at the head of the middle column from 600 wide. */
export function StagePlaque({ children, long = false }: { children: ReactNode; long?: boolean }) {
  return (
    <div className="absolute top-[3%] right-[3%] w-[40%] @min-[600px]:top-[6%] @min-[600px]:right-auto @min-[600px]:left-[31.5%] @min-[600px]:w-[19.5%]">
      <div className="relative aspect-[900/387]">
        <Image src="/images/wheel/plaque.webp" alt="" fill sizes="(min-width: 640px) 240px, 46vw" className="object-contain" />
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 flex items-center justify-center pb-[2%] font-display font-extrabold tracking-tight whitespace-nowrap text-foreground',
            long
              ? 'text-[clamp(11px,3.3cqw,22px)] @min-[600px]:text-[clamp(10px,1.7cqw,20px)]'
              : 'text-[clamp(14px,4.4cqw,28px)] @min-[600px]:text-[clamp(12px,2.2cqw,26px)]',
          )}
        >
          {children}
        </span>
      </div>
    </div>
  )
}

export type PayRow = { name: string; prize: string }

const payTone = (i: number, lit: number | null) =>
  lit === i ? 'bg-gold/20 inset-ring-2 inset-ring-gold' : 'bg-background/70 inset-ring inset-ring-foreground/10'

/** What each outcome pays, as rows in the middle column; the outcome that just happened is lit. Shown from 600 wide. */
export function PayRows({ label, rows, lit }: { label: string; rows: PayRow[]; lit: number | null }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-[3px]">
      {rows.map((row, i) => (
        <li key={i} className={cn('flex h-[clamp(24px,3.2cqw,38px)] items-center gap-2 rounded-md px-2', payTone(i, lit))}>
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[clamp(10px,1.2cqw,13px)] font-bold',
              lit === i ? 'text-foreground' : 'text-foreground/75',
            )}
          >
            {row.name}
          </span>
          <span className="shrink-0 text-[clamp(10px,1.2cqw,13px)] font-extrabold whitespace-nowrap text-gold tabular-nums">{row.prize}</span>
        </li>
      ))}
    </ol>
  )
}

/** The same rows for phones, as chips under the stage. */
export function PayChips({ label, rows, lit, columns }: { label: string; rows: PayRow[]; lit: number | null; columns: 2 | 3 }) {
  return (
    <ol aria-label={label} className={cn('grid gap-1.5', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
      {rows.map((row, i) => (
        <li key={i} className={cn('flex h-12 min-w-0 flex-col items-center justify-center rounded-lg px-1.5 text-center', payTone(i, lit))}>
          <span className="w-full truncate text-xs leading-4 font-bold text-foreground">{row.name}</span>
          <span className="w-full truncate text-xs leading-4 font-extrabold text-gold tabular-nums">{row.prize}</span>
        </li>
      ))}
    </ol>
  )
}

export function ActionButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-[clamp(44px,5cqw,54px)] w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-[clamp(14px,1.5cqw,16px)] font-extrabold whitespace-nowrap text-primary-foreground tabular-nums transition-[scale,filter] hover:brightness-110 active:scale-[0.97] disabled:cursor-default disabled:bg-secondary disabled:text-foreground/70 disabled:hover:brightness-100 disabled:active:scale-100',
        NO_TAP,
      )}
    >
      {children}
    </button>
  )
}

export function ActionNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-center text-xs leading-4 font-medium text-foreground/80 tabular-nums [text-shadow:0_1px_0_rgb(0_0_0/0.7)]">{children}</p>
  )
}

/** The result of a spin, over the stage: Jako stays visible beside it (above it on phones). */
export function ResultCard({
  won,
  title,
  points,
  label,
  note,
  action,
  onAction,
  onClose,
}: {
  won: boolean
  title: string
  points: number
  label: string
  note: string
  action: string
  onAction: () => void
  onClose: () => void
}) {
  return (
    <div
      className="wheel-fade absolute inset-0 z-10 flex items-center justify-center bg-linear-to-b from-transparent from-[22%] to-background/75 to-[36%] p-4 @min-[600px]:bg-linear-to-r @min-[600px]:from-[24%] @min-[600px]:to-[40%]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="status"
        className={cn(
          'wheel-rise flex w-[min(340px,100%)] flex-col items-center gap-3 rounded-2xl bg-card px-5 py-5 text-center shadow-2xl',
          won ? 'inset-ring-2 inset-ring-gold' : 'inset-ring-2 inset-ring-destructive/70',
        )}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      >
        <p className={cn('font-display text-lg leading-6 font-extrabold', won ? 'text-foreground' : 'text-destructive')}>{title}</p>
        {won && (
          <p className="flex items-baseline gap-2 font-display text-[44px] leading-none font-extrabold tracking-tight text-gold tabular-nums">
            +{points.toLocaleString('tr-TR')}
            <span className="text-lg font-bold tracking-normal">KC</span>
          </p>
        )}
        <p className="text-sm leading-5 font-semibold text-foreground">{label}</p>
        <p className="text-xs leading-[18px] text-muted-foreground">{note}</p>
        <button
          type="button"
          autoFocus
          onClick={onAction}
          className={cn(
            'flex h-12 w-full items-center justify-center rounded-xl bg-primary px-3 text-[15px] font-extrabold whitespace-nowrap text-primary-foreground transition-[scale,filter] hover:brightness-110 active:scale-[0.97]',
            NO_TAP,
          )}
        >
          {action}
        </button>
      </div>
    </div>
  )
}
