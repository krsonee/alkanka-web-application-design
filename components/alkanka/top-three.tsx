import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Crown, Medal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { publicRankName } from '@/lib/kanka-puan-shared'
import { jakoSrc } from './jako'

export type PodiumRow = { userId: string; name: string; points: number }

const STEP = {
  1: { block: 'h-32 sm:h-40 border-primary bg-primary/15', medal: 'bg-primary text-primary-foreground', ring: 'ring-primary', label: 'Altın', delay: '240ms' },
  2: { block: 'h-24 sm:h-28 border-foreground/30 bg-foreground/5', medal: 'bg-foreground/80 text-background', ring: 'ring-foreground/50', label: 'Gümüş', delay: '120ms' },
  3: { block: 'h-16 sm:h-20 border-bronze/60 bg-bronze/10', medal: 'bg-bronze text-background', ring: 'ring-bronze', label: 'Bronz', delay: '0ms' },
} as const

export function TopThree({ rows }: { rows: PodiumRow[] }) {
  const top = rows
    .filter((row) => row.points > 0)
    .slice(0, 3)
    .map((row, index) => ({ ...row, rank: (index + 1) as 1 | 2 | 3, name: publicRankName(row.name) }))
  const podium = top.length >= 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top

  return (
    <section aria-labelledby="zirve-title" className="panel-gold relative overflow-hidden rounded-2xl p-5 md:p-7">
      <div className="flex flex-col gap-1.5 md:max-w-md">
        <h2 id="zirve-title" className="font-display text-2xl font-bold uppercase tracking-tight text-primary sm:text-3xl">
          Sıralamanın zirvesi
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {top.length > 0 ? 'Kanka Puan sırasının ilk üçü. Her dönemin birincisi şampiyon rozetini alır.' : 'Sıralama yakında başlıyor. İlk puanı alan zirveye çıkar.'}
        </p>
      </div>

      <div className="mt-6 flex items-end gap-4">
        {top.length > 0 && (
          <ol className="flex flex-1 items-end justify-center gap-2 sm:gap-4" aria-label="İlk üç">
            {podium.map((u) => {
              const s = STEP[u.rank]
              return (
                <li
                  key={u.userId}
                  className="flex w-full max-w-44 flex-col items-center motion-safe:animate-[rise_0.6s_ease-out_both]"
                  style={{ animationDelay: s.delay }}
                >
                  <div className="relative mb-2 flex flex-col items-center gap-1.5">
                    {u.rank === 1 && <Crown className="size-6 text-primary motion-safe:animate-bounce" aria-hidden="true" />}
                    <span
                      className={cn(
                        'flex items-center justify-center rounded-full bg-card font-display font-bold text-foreground ring-2 ring-offset-2 ring-offset-background',
                        s.ring,
                        u.rank === 1 ? 'size-16 text-2xl glow-gold' : 'size-12 text-lg',
                      )}
                      aria-hidden="true"
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-full truncate px-1 text-sm font-bold text-foreground">{u.name}</span>
                    <span className="font-display text-sm font-bold tabular-nums text-primary">
                      {u.points.toLocaleString('tr-TR')} <span className="text-[10px] text-muted-foreground">KP</span>
                    </span>
                  </div>
                  <div className={cn('relative flex w-full flex-col items-center justify-start gap-1 overflow-hidden rounded-t-xl border border-b-0 pt-3', s.block)}>
                    {u.rank === 1 && <span className="tier-shine pointer-events-none absolute inset-0" aria-hidden="true" />}
                    <span className={cn('flex size-8 items-center justify-center rounded-full font-display text-base font-bold', s.medal)}>
                      <span className="sr-only">{s.label} · </span>
                      {u.rank}
                    </span>
                    <Medal className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        <div className={cn('relative hidden shrink-0 md:block', top.length === 0 ? 'mx-auto size-40' : 'size-44 lg:size-52')}>
          <Image src={jakoSrc('kazandi') || '/placeholder.svg'} alt="Kupa tutan Jako" fill sizes="208px" className="object-contain object-bottom" />
        </div>
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" aria-hidden="true" />

      <Link
        href="/siralama"
        className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary hover:underline"
      >
        Tam sıralamayı gör
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  )
}
