import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { StatusItem, StatusLevel } from '@/lib/system-status'

const DOT: Record<StatusLevel, string> = { ok: 'bg-primary', warn: 'bg-gold', off: 'bg-destructive' }
const WORD: Record<StatusLevel, string> = { ok: 'Çalışıyor', warn: 'Dikkat', off: 'Kurulmadı' }

export function SystemStatus({ items }: { items: StatusItem[] }) {
  const groups = Array.from(new Set(items.map((i) => i.group)))
  const problems = items.filter((i) => i.level !== 'ok').length

  return (
    <section aria-labelledby="system-status-title" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="system-status-title" className="font-display text-lg font-bold text-foreground">Sistem durumu</h2>
          <p className="text-sm text-muted-foreground">Botlar, cron&apos;lar, doğrulamalar ve takip kodları tek bakışta.</p>
        </div>
        <span
          className={cn(
            'rounded-full px-3 py-1 text-sm font-semibold',
            problems === 0 ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive',
          )}
        >
          {problems === 0 ? 'Her şey yolunda' : `${problems} kalem ilgi bekliyor`}
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((g) => (
          <div key={g} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g}</h3>
            <ul className="flex flex-col gap-1">
              {items
                .filter((i) => i.group === g)
                .map((i) => (
                  <li key={i.id}>
                    <Link href={i.href} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-secondary">
                      <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', DOT[i.level])} aria-hidden="true" />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-semibold text-foreground">
                          {i.label}
                          <span className="sr-only">{` — ${WORD[i.level]}`}</span>
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{i.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
