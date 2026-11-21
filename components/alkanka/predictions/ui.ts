import { cn } from '@/lib/utils'

/** The look shared by every switch and filter on the predictions page, so they read as one family. */

/** The tray a group of tabs sits in. */
export const segmentTray = 'rounded-xl border border-border bg-secondary/60 p-1'

export const segmentItem = (on: boolean) =>
  cn(
    'flex min-w-0 items-center justify-center gap-1.5 rounded-lg font-bold transition-colors',
    on ? 'bg-primary text-primary-foreground shadow-sm shadow-background/40' : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
  )

/** The number riding on a tab. */
export const segmentCount = (on: boolean) => cn('rounded-full px-1.5 py-0.5 text-xs leading-none tabular-nums', on ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-background text-foreground')

/** A filter pill: sport, league. */
export const filterChip = (on: boolean) =>
  cn(
    'flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
    on ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card text-foreground/80 hover:border-primary/50 hover:text-foreground',
  )

export const filterCount = (on: boolean) => cn('rounded-full px-1.5 py-0.5 text-xs leading-none tabular-nums', on ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground')
