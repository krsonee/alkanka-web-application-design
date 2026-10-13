import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { publicRankName } from '@/lib/kanka-puan-shared'
import { jakoSrc } from './jako'

export type PodiumRow = { userId: string; name: string; points: number }

export function TopThree({ rows }: { rows: PodiumRow[] }) {
  const top = rows
    .filter((row) => row.points > 0)
    .slice(0, 3)
    .map((row, index) => ({ ...row, rank: index + 1, name: publicRankName(row.name) }))
  const podium = top.length >= 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top

  return (
    <section aria-labelledby="zirve-title" className="panel-gold grid items-center gap-6 overflow-hidden rounded-2xl p-5 md:grid-cols-[1fr_auto] md:p-7">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h2 id="zirve-title" className="font-display text-2xl font-bold uppercase tracking-tight text-primary sm:text-3xl">
            Sıralamanın zirvesi
          </h2>
          {top.length > 0 && <p className="text-sm leading-relaxed text-muted-foreground">Kanka Puan sırasının ilk üçü.</p>}
        </div>
        {top.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">Sıralama yakında başlıyor</p>
        ) : (
          <ol
            className={cn(
              'grid items-end gap-3',
              top.length === 1 && 'mx-auto w-full max-w-40 grid-cols-1',
              top.length === 2 && 'grid-cols-2',
              top.length >= 3 && 'grid-cols-3',
            )}
          >
            {podium.map((u) => (
              <li
                key={u.userId}
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
        )}
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
