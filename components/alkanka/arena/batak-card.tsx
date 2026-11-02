import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { RANK_LABEL, SUIT_NAMES, SUIT_SYMBOLS, type BCard } from '@/lib/games/batak'

export const isRed = (s: number) => s === 1 || s === 2
export const suitColor = (s: number) => (isRed(s) ? 'text-tile-red' : 'text-tile-black')
export const sameCard = (a: BCard, b: BCard) => a.s === b.s && a.r === b.r
const SUIT_ORDER = [0, 1, 3, 2]
export const sortCards = (h: BCard[]) => [...h].sort((a, b) => SUIT_ORDER[a.s] - SUIT_ORDER[b.s] || b.r - a.r)
export type Place = 'bottom' | 'top' | 'left' | 'right'

export function BatakCard({
  card,
  onClick,
  disabled,
  playable,
  dim,
  selected,
  size = 'md',
  className,
  style,
}: {
  card: BCard
  onClick?: () => void
  disabled?: boolean
  playable?: boolean
  dim?: boolean
  selected?: boolean
  size?: 'xs' | 'sm' | 'md'
  className?: string
  style?: CSSProperties
}) {
  const Comp = onClick ? 'button' : 'div'
  const color = suitColor(card.s)
  const label = RANK_LABEL(card.r)
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-label={`${SUIT_NAMES[card.s]} ${label}`}
      aria-pressed={onClick ? selected : undefined}
      style={style}
      className={cn(
        'playing-card relative shrink-0 select-none rounded-md font-display transition-transform duration-150',
        size === 'xs' && 'h-10 w-7 rounded-sm',
        size === 'sm' && 'h-[4.6rem] w-[3.3rem] sm:h-[5.8rem] sm:w-[4.15rem] lg:h-[6.4rem] lg:w-[4.6rem] [@media(max-height:500px)]:!h-[4.6rem] [@media(max-height:500px)]:!w-[3.3rem]',
        size === 'md' && 'aspect-[5/7] w-[var(--cw)]',
        playable && !selected && 'ring-2 ring-gold hover:-translate-y-4 hover:shadow-[0_10px_22px_-6px_var(--gold)] focus-visible:-translate-y-4',
        selected && '-translate-y-7 scale-110 ring-[3px] ring-gold shadow-[0_0_26px_-2px_var(--gold)]',
        dim && 'opacity-50 brightness-75 grayscale',
        className,
      )}
    >
      <span className={cn('absolute left-1 top-0.5 flex flex-col items-center font-bold leading-none', color, size === 'xs' ? 'text-[10px]' : 'text-base sm:text-lg')}>
        {label}
        <span className={size === 'xs' ? 'text-[10px]' : 'text-sm sm:text-base'} aria-hidden='true'>
          {SUIT_SYMBOLS[card.s]}
        </span>
      </span>
      {size !== 'xs' && (
        <>
          <span className={cn('absolute inset-0 flex items-center justify-center pt-2 text-2xl leading-none sm:text-4xl', color)} aria-hidden='true'>
            {SUIT_SYMBOLS[card.s]}
          </span>
          <span className={cn('absolute bottom-0.5 right-1 flex rotate-180 flex-col items-center text-sm font-bold leading-none sm:text-base', color)} aria-hidden='true'>
            {label}
            <span className='text-xs sm:text-sm'>{SUIT_SYMBOLS[card.s]}</span>
          </span>
        </>
      )}
    </Comp>
  )
}

/** One small card per trick taken, so nobody has to read '3 el'. */
export function TrickPips({ count, goal }: { count: number; goal?: number | null }) {
  const slots = Math.max(count, goal ?? 0)
  if (!slots) return null
  return (
    <span className='flex max-w-[6.5rem] flex-wrap justify-center gap-[3px]' aria-label={`${count} el aldı${goal ? `, hedef ${goal}` : ''}`}>
      {Array.from({ length: slots }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-2.5 w-[7px] rounded-[2px]',
            i < count ? (goal != null && count >= goal ? 'bg-primary' : 'card-back') : 'border border-dashed border-current opacity-40',
          )}
          aria-hidden='true'
        />
      ))}
    </span>
  )
}
