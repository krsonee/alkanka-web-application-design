import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LEADERBOARD } from './data'
import { jakoSrc } from './jako'

export function TopThree() {
  const podium = [LEADERBOARD[1], LEADERBOARD[0], LEADERBOARD[2]]
  return (
    <section aria-labelledby="zirve-title" className="panel-gold grid items-center gap-6 overflow-hidden rounded-2xl p-5 md:grid-cols-[1fr_auto] md:p-7">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h2 id="zirve-title" className="font-display text-2xl font-bold uppercase tracking-tight text-primary sm:text-3xl">
            Haftanın zirvesi
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">Pazartesi sıfırlanır. İlk 3 VIP sandık kazanır.</p>
        </div>
        <ol className="grid grid-cols-3 items-end gap-3">
          {podium.map((u) => (
            <li
              key={u.rank}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border bg-background px-2 text-center',
                u.rank === 1 ? 'border-primary py-6' : 'border-border py-4',
              )}
            >
              {u.rank === 1 ? (
                <Crown className="size-5 text-primary" aria-label="1." />
              ) : (
                <span className="font-display text-sm font-bold text-muted-foreground">{u.rank}.</span>
              )}
              <span className="max-w-full truncate font-semibold text-foreground">{u.name}</span>
              <span className="font-display text-sm font-bold text-primary tabular-nums">{u.points.toLocaleString('tr-TR')}</span>
            </li>
          ))}
        </ol>
        <Link
          href="/siralama"
          className="flex items-center gap-1 self-start text-xs font-bold uppercase tracking-wider text-primary hover:underline"
        >
          Tam sıralamayı gör
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="relative mx-auto size-40 md:size-48">
        <Image src={jakoSrc('kazandi') || '/placeholder.svg'} alt="Kazanan Jako" fill sizes="192px" className="object-contain" />
      </div>
    </section>
  )
}
