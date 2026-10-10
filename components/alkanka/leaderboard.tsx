import { Crown, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LEADERBOARD, LIVE_WINS } from './data'
import { SectionHeading } from './section-heading'

const formatAC = (n: number) => n.toLocaleString('tr-TR')

export function Leaderboard() {
  return (
    <section id="siralama" aria-labelledby="siralama-title" className="flex scroll-mt-20 flex-col gap-5">
      <SectionHeading
        id="siralama-title"
        title="Sıralama"
        description="Haftalık AlkaCoin liderleri ve son kazananlar. Her pazartesi sıfırlanır, ilk 3 VIP sandık kazanır."
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="panel-gold overflow-hidden rounded-xl xl:col-span-3">
          <table className="w-full text-sm">
            <caption className="sr-only">Haftalık sıralama</caption>
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-semibold">#</th>
                <th scope="col" className="px-2 py-3 font-semibold">Kullanıcı</th>
                <th scope="col" className="hidden px-2 py-3 font-semibold sm:table-cell">Seri</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">AlkaCoin</th>
              </tr>
            </thead>
            <tbody>
              {LEADERBOARD.map((u) => (
                <tr key={u.rank} className={cn('border-b border-border last:border-0', u.rank <= 3 && 'bg-primary/5')}>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'flex size-7 items-center justify-center rounded-md font-display text-xs font-bold',
                        u.rank === 1 ? 'bg-primary text-primary-foreground' : u.rank <= 3 ? 'border border-primary/50 text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {u.rank === 1 ? <Crown className="size-3.5" aria-label="1." /> : u.rank}
                    </span>
                  </td>
                  <td className="px-2 py-3 font-semibold text-foreground">{u.name}</td>
                  <td className="hidden px-2 py-3 text-muted-foreground sm:table-cell">
                    <span className="flex items-center gap-1">
                      <Flame className="size-3.5 text-primary" aria-hidden="true" />
                      {u.streak} gün
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-display font-bold text-foreground tabular-nums">{formatAC(u.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel-gold flex flex-col overflow-hidden rounded-xl xl:col-span-2">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="size-2 animate-glow rounded-full bg-live" aria-hidden="true" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Son kazananlar</h3>
          </div>
          <ul className="flex flex-col">
            {LIVE_WINS.map((w) => (
              <li key={w.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0">
                <span className="w-14 shrink-0 rounded bg-background px-1.5 py-0.5 text-center text-[11px] font-semibold text-muted-foreground">
                  {w.game}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{w.user}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{w.time}</span>
                <span className="w-20 shrink-0 text-right font-semibold text-live">{w.reward}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
