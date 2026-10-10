import { Flame, Gift, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TICKER_EVENTS, type TickerEvent } from './data'

const KIND_STYLE: Record<TickerEvent['kind'], { icon: typeof Send; className: string; label: string }> = {
  telegram: { icon: Send, className: 'text-primary', label: 'Telegram' },
  claim: { icon: Gift, className: 'text-gold', label: 'Claim' },
  drop: { icon: Flame, className: 'text-accent', label: 'Drop' },
}

function TickerItem({ event }: { event: TickerEvent }) {
  const { icon: Icon, className, label } = KIND_STYLE[event.kind]
  return (
    <li className="flex shrink-0 items-center gap-3 px-6">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-70" />
        <span className="relative inline-flex size-2 rounded-full bg-live" />
      </span>
      <Icon className={cn('size-4', className)} aria-hidden="true" />
      <span className="sr-only">{label}:</span>
      <span className="text-sm whitespace-nowrap text-foreground">{event.text}</span>
      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{event.time}</span>
    </li>
  )
}

export function ActivityTicker() {
  return (
    <section aria-label="Live community activity" className="relative border-y border-border bg-surface">
      <div className="flex items-stretch">
        <div className="z-10 flex shrink-0 items-center gap-2 border-r border-border bg-surface px-4 py-3">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-live" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-foreground">Live</span>
        </div>
        <div className="group relative flex-1 overflow-hidden py-3 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
          <ul className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
            {TICKER_EVENTS.map((e) => (
              <TickerItem key={e.id} event={e} />
            ))}
            {TICKER_EVENTS.map((e) => (
              <TickerItem key={`${e.id}-dup`} event={e} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
