import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { publicRankName } from '@/lib/kanka-puan-shared'
import { jakoSrc } from './jako'

export type PodiumRow = { userId: string; name: string; points: number }

const RANK = {
  1: {
    label: 'Altın',
    card: 'border-primary/50 bg-gradient-to-br from-primary/15 via-primary/[0.04] to-transparent hover:border-primary/80',
    avatar: 'bg-primary text-primary-foreground ring-primary/30',
    chip: 'bg-primary text-primary-foreground',
    ghost: 'text-primary/15',
    accent: 'text-primary',
    bar: 'bg-primary',
  },
  2: {
    label: 'Gümüş',
    card: 'border-foreground/10 bg-foreground/[0.025] hover:border-foreground/25',
    avatar: 'bg-foreground/85 text-background ring-foreground/15',
    chip: 'bg-foreground/85 text-background',
    ghost: 'text-foreground/[0.07]',
    accent: 'text-foreground',
    bar: 'bg-foreground/60',
  },
  3: {
    label: 'Bronz',
    card: 'border-bronze/25 bg-bronze/[0.04] hover:border-bronze/50',
    avatar: 'bg-bronze text-background ring-bronze/25',
    chip: 'bg-bronze text-background',
    ghost: 'text-bronze/15',
    accent: 'text-bronze',
    bar: 'bg-bronze',
  },
} as const

function MyRank({ me, signedIn }: { me: { rank: number; points: number } | null; signedIn: boolean }) {
  if (!signedIn) {
    return (
      <a href="#kayit" className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 px-3.5 py-2.5 text-sm transition-colors hover:border-primary">
        <span className="text-muted-foreground">Sen de sıralamaya gir</span>
        <span className="font-semibold text-primary">Kayıt ol</span>
      </a>
    )
  }
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] px-3.5 py-2.5 text-sm">
      {me ? (
        <>
          <span className="text-foreground">
            Sen <span className="font-display font-bold text-primary tabular-nums">{me.rank.toLocaleString('tr-TR')}.</span> sıradasın
          </span>
          <span className="font-semibold text-foreground tabular-nums">{me.points.toLocaleString('tr-TR')} KP</span>
        </>
      ) : (
        <span className="text-muted-foreground">Henüz puanın yok. İlk oyununu oyna, sıralamaya gir.</span>
      )}
    </div>
  )
}

export function TopThree({
  rows,
  me = null,
  signedIn = false,
}: {
  rows: PodiumRow[]
  me?: { rank: number; points: number } | null
  signedIn?: boolean
}) {
  const top = rows
    .filter((row) => row.points > 0)
    .slice(0, 3)
    .map((row, index) => ({ ...row, rank: (index + 1) as 1 | 2 | 3, name: publicRankName(row.name) }))
  const leader = top[0]?.points || 1

  return (
    <section aria-labelledby="zirve-title" className="panel-gold relative overflow-hidden rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden="true">
            <Crown className="size-4" />
          </span>
          <div className="flex flex-col">
            <h2 id="zirve-title" className="font-display text-base font-bold leading-tight tracking-tight text-foreground sm:text-lg">
              Sıralamanın zirvesi
            </h2>
            <p className="text-xs leading-tight text-muted-foreground">En çok kanka puanı toplayanlar</p>
          </div>
        </div>
        <Link
          href="/siralama"
          className="group inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          Tam sıralama
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>

      {top.length === 0 ? (
        <div className="mt-4 flex items-center gap-4 rounded-xl border border-border/60 bg-background/40 p-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg">
            <Image src={jakoSrc('kazandi') || '/placeholder.svg'} alt="" fill sizes="56px" className="object-cover" />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">Sıralama yakında başlıyor. İlk puanı alan zirveye çıkar.</p>
        </div>
      ) : (
        <ol className="mt-4 grid gap-2.5 sm:grid-cols-3" aria-label="İlk üç">
          {top.map((u) => {
            const r = RANK[u.rank]
            const pct = Math.max(6, Math.round((u.points / leader) * 100))
            return (
              <li
                key={u.userId}
                className={cn(
                  'group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3.5 pb-4 pt-3 transition-all duration-300 hover:-translate-y-0.5 motion-safe:animate-[rise_0.5s_ease-out_both]',
                  r.card,
                )}
                style={{ animationDelay: `${(u.rank - 1) * 90}ms` }}
              >
                {u.rank === 1 && <span className="tier-shine pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />}

                <span
                  className={cn(
                    'pointer-events-none absolute -bottom-6 right-2 select-none font-display text-8xl font-black leading-none tabular-nums',
                    r.ghost,
                    u.rank === 1 && 'lg:right-16',
                  )}
                  aria-hidden="true"
                >
                  {u.rank}
                </span>

                <span className="relative shrink-0">
                  <span
                    className={cn(
                      'flex size-11 items-center justify-center rounded-full font-display text-base font-bold ring-4',
                      r.avatar,
                    )}
                    aria-hidden="true"
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </span>
                  <span
                    className={cn(
                      'absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full font-display text-[11px] font-black ring-2 ring-card',
                      r.chip,
                    )}
                  >
                    <span className="sr-only">{r.label} · </span>
                    {u.rank}
                  </span>
                </span>

                <div className="relative flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground">{u.name}</span>
                  <span className="flex items-baseline gap-1">
                    <span className={cn('font-display text-xl font-bold leading-tight tabular-nums', r.accent)}>
                      {u.points.toLocaleString('tr-TR')}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">KP</span>
                  </span>
                </div>

                {u.rank === 1 && (
                  <div className="relative -my-3 -mr-3.5 -mb-4 hidden h-[4.5rem] w-16 shrink-0 self-stretch lg:block">
                    <Image
                      src={jakoSrc('kazandi') || '/placeholder.svg'}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover object-center [mask-image:linear-gradient(to_right,transparent,black_35%)]"
                    />
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 h-1 bg-foreground/[0.06]" aria-hidden="true">
                  <div className={cn('h-full rounded-r-full', r.bar)} style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {!(me && me.rank <= 3) && <MyRank me={me} signedIn={signedIn} />}
    </section>
  )
}
