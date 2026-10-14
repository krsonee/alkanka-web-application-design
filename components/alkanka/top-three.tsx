import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { publicRankName } from '@/lib/kanka-puan-shared'
import { jakoSrc } from './jako'

export type PodiumRow = { userId: string; name: string; points: number }

const RANK = {
  1: {
    label: 'Altın',
    card: 'border-primary/60 bg-primary/10',
    badge: 'bg-gradient-to-b from-primary to-primary/60 text-primary-foreground',
    ring: 'ring-primary',
    bar: 'bg-primary',
  },
  2: {
    label: 'Gümüş',
    card: 'border-foreground/15 bg-foreground/[0.03]',
    badge: 'bg-gradient-to-b from-foreground/90 to-foreground/50 text-background',
    ring: 'ring-foreground/40',
    bar: 'bg-foreground/60',
  },
  3: {
    label: 'Bronz',
    card: 'border-bronze/40 bg-bronze/[0.06]',
    badge: 'bg-gradient-to-b from-bronze to-bronze/60 text-background',
    ring: 'ring-bronze/70',
    bar: 'bg-bronze',
  },
} as const

export function TopThree({ rows }: { rows: PodiumRow[] }) {
  const top = rows
    .filter((row) => row.points > 0)
    .slice(0, 3)
    .map((row, index) => ({ ...row, rank: (index + 1) as 1 | 2 | 3, name: publicRankName(row.name) }))
  const leader = top[0]?.points || 1

  return (
    <section aria-labelledby="zirve-title" className="panel-gold relative overflow-hidden rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Crown className="size-5 text-primary" aria-hidden="true" />
          <h2 id="zirve-title" className="font-display text-lg font-bold uppercase tracking-tight text-foreground sm:text-xl">
            Sıralamanın zirvesi
          </h2>
        </div>
        <Link
          href="/siralama"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary hover:underline"
        >
          Tam sıralama
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      {top.length === 0 ? (
        <div className="mt-3 flex items-center gap-4 rounded-xl border border-border/60 bg-background/40 p-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg">
            <Image src={jakoSrc('kazandi') || '/placeholder.svg'} alt="" fill sizes="56px" className="object-cover" />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">Sıralama yakında başlıyor. İlk puanı alan zirveye çıkar.</p>
        </div>
      ) : (
        <ol className="mt-3 grid gap-2.5 sm:grid-cols-3" aria-label="İlk üç">
          {top.map((u) => {
            const r = RANK[u.rank]
            const pct = Math.max(6, Math.round((u.points / leader) * 100))
            return (
              <li
                key={u.userId}
                className={cn(
                  'relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 motion-safe:animate-[rise_0.5s_ease-out_both]',
                  r.card,
                )}
                style={{ animationDelay: `${(u.rank - 1) * 90}ms` }}
              >
                {u.rank === 1 && <span className="tier-shine pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />}
                <span
                  className={cn('relative flex size-9 shrink-0 items-center justify-center rounded-lg font-display text-lg font-black shadow-sm', r.badge)}
                >
                  <span className="sr-only">{r.label} · </span>
                  {u.rank}
                </span>
                <span
                  className={cn(
                    'relative flex size-10 shrink-0 items-center justify-center rounded-full bg-card font-display text-base font-bold text-foreground ring-2',
                    r.ring,
                  )}
                  aria-hidden="true"
                >
                  {u.name.charAt(0).toUpperCase()}
                </span>
                <div className="relative flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-bold text-foreground">{u.name}</span>
                    <span className="shrink-0 font-display text-sm font-bold tabular-nums text-primary">
                      {u.points.toLocaleString('tr-TR')}
                      <span className="ml-0.5 text-[10px] text-muted-foreground">KP</span>
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
                    <div className={cn('h-full rounded-full', r.bar)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {u.rank === 1 && (
                  <div className="relative -my-3 -mr-3 hidden h-16 w-14 shrink-0 lg:block">
                    <Image src={jakoSrc('kazandi') || '/placeholder.svg'} alt="" fill sizes="56px" className="object-cover object-center" />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
