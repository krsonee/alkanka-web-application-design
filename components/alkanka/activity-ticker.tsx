import { Gift, Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TICKER_EVENTS, type TickerEvent } from './data'

const ICON = { telegram: Send, claim: Gift, drop: Sparkles }
const TONE = { telegram: 'text-accent', claim: 'text-primary', drop: 'text-live' }

function Item({ event }: { event: TickerEvent }) {
  const Icon = ICON[event.kind]
  return (
    <li className="flex shrink-0 items-center gap-2 px-5 text-sm">
      <Icon className={cn('size-4', TONE[event.kind])} aria-hidden="true" />
      <span className="text-foreground">{event.text}</span>
      <span className="text-xs text-muted-foreground">{event.time}</span>
      <span aria-hidden="true" className="ml-3 size-1 rounded-full bg-border" />
    </li>
  )
}

export function ActivityTicker() {
  return (
    <section aria-label="Canlı aktivite" className="glass flex items-center overflow-hidden rounded-xl">
      <span className="flex shrink-0 items-center gap-2 border-r border-border bg-live/10 px-4 py-3 text-xs font-bold uppercase tracking-wider text-live">
        <span className="size-1.5 animate-glow rounded-full bg-live" aria-hidden="true" />
        Canlı
      </span>
      <div className="relative flex-1 overflow-hidden py-3 [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
        <ul className="flex w-max animate-marquee hover:[animation-play-state:paused]">
          {TICKER_EVENTS.map((e) => (
            <Item key={e.id} event={e} />
          ))}
          {TICKER_EVENTS.map((e) => (
            <Item key={`${e.id}-dup`} event={e} />
          ))}
        </ul>
      </div>
    </section>
  )
}
