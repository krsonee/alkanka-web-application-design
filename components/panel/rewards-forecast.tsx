'use client'

import { Coins } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RewardConfig } from '@/lib/rewards-shared'
import { forecastRewards, MINI_GAME_IDS, MINI_GAME_LABEL, STATS_DAYS, type MiniPlayStats } from '@/lib/rewards-forecast'

const kc = (n: number) => Math.round(n).toLocaleString('tr-TR')
const range = (low: number, high: number) => (Math.round(low) === Math.round(high) ? `${kc(low)} KC` : `${kc(low)} - ${kc(high)} KC`)
const plays = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('tr-TR', { maximumFractionDigits: 1 }))

/** Recomputed on every keystroke, so the admin sees what a change costs before saving it. */
export function RewardsForecast({ config, winRate, hidden, stats }: { config: RewardConfig; winRate: number; hidden: string[]; stats: MiniPlayStats | null }) {
  const forecast = forecastRewards(config, winRate)
  const lines = MINI_GAME_IDS.map((id) => {
    const f = forecast[id]
    const off = hidden.includes(id)
    const perDay = stats ? stats[id].plays / STATS_DAYS : 0
    return {
      id,
      off,
      perPlay: f.perPlay,
      freePlays: f.freePlays,
      member: { low: f.perPlay.low * f.freePlays, high: f.perPlay.high * f.freePlays },
      perDay,
      total: off ? { low: 0, high: 0 } : { low: f.perPlay.low * perDay, high: f.perPlay.high * perDay },
      paid: stats ? stats[id].paid / STATS_DAYS : 0,
    }
  })
  const open = lines.filter((l) => !l.off)
  const sum = (pick: (l: (typeof lines)[number]) => number) => open.reduce((a, l) => a + pick(l), 0)
  const cell = 'px-3 py-2 text-right tabular-nums'

  return (
    <section aria-labelledby="rewards-forecast" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <header className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Coins className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id="rewards-forecast" className="text-sm font-semibold text-foreground">Beklenen günlük coin çıkışı</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {`Aşağıdaki ayarları değiştirdikçe bu tablo kendiliğinden yeniden hesaplanır; kaydetmeden önce değişikliğin ne kadar coin dağıtacağını görürsün. Kasa oranı %${winRate} (Oyun ayarları'ndan değişir).`}
          </p>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-secondary/50 text-xs text-muted-foreground">
              <th scope="col" className="px-3 py-2 text-left font-semibold">Oyun</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Bir oynamada ortalama</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Üyenin günlük ücretsiz hakkı</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Tüm hakkını kullanan üye, günde</th>
              {stats && <th scope="col" className="px-3 py-2 text-right font-semibold">{`Günlük oynama (son ${STATS_DAYS} gün)`}</th>}
              {stats && <th scope="col" className="px-3 py-2 text-right font-semibold">Bu ayarla günlük çıkış</th>}
              {stats && <th scope="col" className="px-3 py-2 text-right font-semibold">{`Gerçekte ödenen (günlük, son ${STATS_DAYS} gün)`}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((l) => (
              <tr key={l.id} className={cn(l.off && 'text-muted-foreground')}>
                <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                  {MINI_GAME_LABEL[l.id]}
                  {l.off && <span className="ml-2 text-xs font-bold uppercase text-muted-foreground">Siteden gizli</span>}
                </th>
                <td className={cell}>{range(l.perPlay.low, l.perPlay.high)}</td>
                <td className={cell}>{plays(l.freePlays)}</td>
                <td className={cell}>{range(l.member.low, l.member.high)}</td>
                {stats && <td className={cell}>{plays(Math.round(l.perDay * 10) / 10)}</td>}
                {stats && <td className={cn(cell, 'font-semibold text-foreground')}>{l.off ? '0 KC' : range(l.total.low, l.total.high)}</td>}
                {stats && <td className={cell}>{`${kc(l.paid)} KC`}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-secondary/50 font-semibold text-foreground">
              <th scope="row" className="px-3 py-2 text-left">Toplam (açık oyunlar)</th>
              <td className={cell} />
              <td className={cell} />
              <td className={cell}>{range(sum((l) => l.member.low), sum((l) => l.member.high))}</td>
              {stats && <td className={cell}>{plays(Math.round(sum((l) => l.perDay) * 10) / 10)}</td>}
              {stats && <td className={cell}>{range(sum((l) => l.total.low), sum((l) => l.total.high))}</td>}
              {stats && <td className={cell}>{`${kc(lines.reduce((a, l) => a + l.paid, 0))} KC`}</td>}
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-muted-foreground">
        <li>Bu bir ortalamadır; tek bir gün şansa göre altında ya da üstünde kalabilir.</li>
        <li>Sandıkta ödül üyenin seçtiği sandığa göre değişir, bu yüzden en düşük ve en yüksek sandık aralık olarak gösterilir.</li>
        <li>
          {stats
            ? `"Bu ayarla günlük çıkış", son ${STATS_DAYS} günün oynama sayısı aynı kalırsa ne ödeneceğini gösterir. Hak sayısını ya da çark süresini değiştirirsen oynama sayısı da değişir; o durumda "Tüm hakkını kullanan üye" sütununa bak.`
            : 'Son günlerin oynama sayısı okunamadı; günlük toplam bu yüzden gösterilmiyor.'}
        </li>
        <li>Günlük oynama sayısına coinle satın alınan ek haklar da dahildir.</li>
      </ul>
    </section>
  )
}
