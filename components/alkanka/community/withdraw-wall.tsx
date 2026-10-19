import { BadgeCheck, Clock } from 'lucide-react'
import type { WithdrawShare } from '@/lib/withdrawals'
import { cn } from '@/lib/utils'

const tl = (n: number) => `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL`
const when = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function WithdrawWall({ shares, showSite = true, empty, className }: { shares: WithdrawShare[]; showSite?: boolean; empty: string; className?: string }) {
  if (!shares.length) {
    return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <ul className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4', className)}>
      {shares.map((s, i) => (
        <li
          key={s.id}
          className="group flex animate-rise flex-col overflow-hidden rounded-xl border border-border bg-card motion-reduce:animate-none"
          style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
        >
          <a href={s.image} target="_blank" rel="noreferrer" className="relative block aspect-[4/5] overflow-hidden bg-background">
            <img
              src={s.image || '/placeholder.svg'}
              alt={`${s.siteName} ${tl(s.amount)} çekim ekran görüntüsü`}
              loading="lazy"
              className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
            />
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-card/90 px-1.5 py-0.5 text-[10px] font-bold text-live">
              <BadgeCheck className="size-3" aria-hidden /> Onaylı
            </span>
            <span className="absolute inset-x-0 bottom-0 flex flex-col bg-gradient-to-t from-card via-card/80 to-transparent px-2.5 pb-2 pt-8">
              <span className="font-display text-lg font-bold tabular-nums leading-tight text-primary">{tl(s.amount)}</span>
            </span>
          </a>
          <div className="flex flex-col gap-0.5 p-2.5">
            {showSite && <span className="truncate text-xs font-bold text-foreground">{s.siteName}</span>}
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3 shrink-0" aria-hidden />
              {when(s.paidAt)}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {s.userName} · {s.siteUsername}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
