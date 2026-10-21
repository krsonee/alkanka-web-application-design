import { Trophy } from 'lucide-react'
import { getTvConfig, weeklyWatchers } from '@/lib/kankatv-engage'

export async function WeeklyWatchers() {
  const [cfg, { list }] = await Promise.all([getTvConfig(), weeklyWatchers(0, 10)]).catch(() => [null, { list: [] }] as const)
  if (!cfg?.weekly.enabled || !list.length) return null
  const prizes = cfg.weekly.prizes

  return (
    <section aria-labelledby="tv-weekly-title" className="mx-auto mt-6 flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="tv-weekly-title" className="flex items-center gap-2 text-base font-bold text-foreground">
          <Trophy className="size-4 text-primary" aria-hidden="true" />
          Haftanın İzleyicisi
        </h2>
        <span className="text-xs text-muted-foreground">Ödüller pazartesi dağıtılır</span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {list.map((r, i) => (
          <li key={r.userId} className="flex items-center justify-between gap-3 rounded-lg bg-background p-2.5 text-sm">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="w-6 shrink-0 text-center font-bold tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="truncate font-medium text-foreground">{r.name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3 tabular-nums">
              <span className="text-muted-foreground">{r.minutes.toLocaleString('tr-TR')} dk</span>
              {prizes[i] ? <strong className="text-primary">+{prizes[i]} coin</strong> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
