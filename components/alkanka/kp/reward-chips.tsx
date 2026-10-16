import { cn } from '@/lib/utils'

export function RewardChips({ coin, kp, size = 'sm', className }: { coin: number; kp: number; size?: 'xs' | 'sm'; className?: string }) {
  const chip = cn('inline-flex items-center rounded-full font-bold tabular-nums', size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs')
  return (
    <span className={cn('flex flex-wrap items-center gap-1', className)}>
      {coin > 0 && <span className={cn(chip, 'bg-primary/15 text-primary')}>+{coin.toLocaleString('tr-TR')} KC</span>}
      {kp > 0 && <span className={cn(chip, 'bg-accent/15 text-accent')}>+{kp.toLocaleString('tr-TR')} KP</span>}
    </span>
  )
}
