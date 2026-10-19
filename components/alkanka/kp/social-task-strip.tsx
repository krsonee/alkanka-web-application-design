import Link from 'next/link'
import { Check, ChevronRight, Clock } from 'lucide-react'
import { SocialIcon, PLATFORM_TINT } from '@/components/alkanka/social-icons'
import { isPlatform } from '@/lib/social-shared'
import { cn } from '@/lib/utils'

export type SocialTaskItem = {
  id: number
  title: string
  param: string | null
  points: number
  state: 'open' | 'pending' | 'done'
}

const STATE_TEXT = { open: 'Tek seferlik', pending: 'Onay bekliyor', done: 'Tamamlandı' } as const

export function SocialTaskStrip({ items }: { items: SocialTaskItem[] }) {
  if (!items.length) return null
  return (
    <ul className="kp-stagger grid grid-cols-2 gap-2 lg:grid-cols-3">
      {items.map((t, idx) => {
        const platform = t.param && isPlatform(t.param) ? t.param : null
        const done = t.state === 'done'
        return (
          <li key={t.id} style={{ '--i': idx } as React.CSSProperties}>
            <Link
              href="/gorevler"
              className={cn(
                'kp-card group flex h-full flex-col gap-2 rounded-xl border bg-card p-3 hover:border-gold/50',
                done ? 'border-primary/40' : 'border-border',
              )}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'kp-icon flex size-8 shrink-0 items-center justify-center rounded-lg',
                    done ? 'bg-primary/15 text-primary' : platform ? PLATFORM_TINT[platform] : 'bg-secondary text-muted-foreground',
                  )}
                >
                  {done ? <Check className="size-4" aria-hidden /> : platform ? <SocialIcon platform={platform} className="size-4" /> : null}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold leading-tight text-foreground text-pretty">{t.title}</span>
              </span>
              <span className="mt-auto flex items-center justify-between gap-2">
                <span className={cn('inline-flex items-center gap-1 text-[11px]', t.state === 'pending' ? 'text-gold' : 'text-muted-foreground')}>
                  {t.state === 'pending' ? <Clock className="size-3" aria-hidden /> : null}
                  {STATE_TEXT[t.state]}
                </span>
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gold/15 px-2 py-0.5 font-display text-xs font-bold tabular-nums text-gold">
                  +{t.points}
                  {!done ? <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden /> : null}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
