import { ArrowRight, ArrowUpRight, Clock, Send, Shield } from 'lucide-react'
import type { Deal, ParsedOdd } from '@/lib/deal-types'
import { TeamLogo, splitMatch } from './logo-context'

function timeAgo(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} sa önce`
  return `${Math.round(hours / 24)} gün önce`
}

function OddRow({ odd, deal }: { odd: ParsedOdd; deal: Deal }) {
  const teams = splitMatch(odd.match).filter(Boolean)
  const boost = odd.oldOdd ? Math.round((odd.newOdd / odd.oldOdd - 1) * 100) : null
  return (
    <li className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 -space-x-2">
            {teams.map((team) => (
              <TeamLogo key={team} name={team} className="ring-2 ring-card" />
            ))}
          </span>
          <span className="font-display text-lg font-bold leading-tight text-foreground text-pretty">{odd.match}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {odd.league && <span className="font-semibold uppercase tracking-wider text-accent">{odd.league}</span>}
          {odd.kickoff && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" aria-hidden="true" />
              {odd.kickoff}
            </span>
          )}
          {odd.limit && <span>{odd.limit}</span>}
        </span>
      </div>
      <div className="flex items-center gap-3 rounded-lg bg-background px-3 py-2">
        {odd.market && <span className="text-sm text-muted-foreground">{odd.market}</span>}
        {odd.oldOdd && (
          <>
            <span className="text-sm text-muted-foreground line-through tabular-nums">{odd.oldOdd.toFixed(2)}</span>
            <ArrowRight className="size-4 text-primary" aria-hidden="true" />
          </>
        )}
        <span className="rounded-md bg-primary px-2.5 py-1 font-display text-lg font-bold text-primary-foreground tabular-nums">
          {odd.newOdd.toFixed(2)}
        </span>
        {boost !== null && boost > 0 && <span className="text-xs font-bold text-live tabular-nums">+%{boost}</span>}
      </div>
      <a
        href={deal.link}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 md:w-28"
      >
        Oyna
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </a>
    </li>
  )
}

function PostFallback({ deal }: { deal: Deal }) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:flex-row">
      {deal.photo && (
        // eslint-disable-next-line @next/next/no-img-element -- Telegram CDN images are remote and short-lived
        <img src={deal.photo} alt="" loading="lazy" className="aspect-video w-full shrink-0 rounded-lg object-cover sm:w-56" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-foreground">{deal.body}</p>
        <a
          href={deal.link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="flex h-10 items-center justify-center gap-1.5 self-start rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
        >
          {deal.brand} sitesine git
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}

export function LiveOddsBoard({ deals }: { deals: Deal[] }) {
  return (
    <section aria-label="Telegram özel oranları" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-foreground">
          <span className="relative flex size-2.5" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-live" />
          </span>
          Canlı akış
        </h2>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="size-3.5" aria-hidden="true" />
          Markaların resmi Telegram kanallarından otomatik alınır
        </p>
      </div>
      <ul className="flex flex-col gap-4">
        {deals.map((deal) => (
          <li key={deal.id} className="panel-gold overflow-hidden rounded-xl">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-background/60 px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-display text-sm font-bold text-primary">{deal.brand}</span>
                <span className="flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <Send className="size-3" aria-hidden="true" />
                  Telegram
                </span>
              </span>
              <time dateTime={deal.createdAt} className="shrink-0 text-xs text-muted-foreground">
                {timeAgo(deal.createdAt)}
              </time>
            </div>
            {deal.odds && deal.odds.length > 0 ? (
              <ul className="divide-y divide-border">
                {deal.odds.map((odd, i) => (
                  <OddRow key={`${odd.match}-${i}`} odd={odd} deal={deal} />
                ))}
              </ul>
            ) : (
              <PostFallback deal={deal} />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
