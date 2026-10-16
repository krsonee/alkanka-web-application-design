'use client'

import useSWR from 'swr'
import { Check, Lock, Radio, Timer, Zap } from 'lucide-react'
import { usePoints } from '@/components/alkanka/points-context'
import { formatDuration, type OnlineStatus } from '@/lib/online-rewards-shared'
import { RewardChips } from './reward-chips'
import { cn } from '@/lib/utils'

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw new Error('online')
  return r.json() as Promise<OnlineStatus>
}

const STEPS = [
  { title: 'Sitede kal', text: 'Sekme açık ve aktifken süren işler. Oyun, sohbet, tahmin fark etmez.' },
  { title: 'Kopma', text: 'Kısa molalar sorun değil, ama belirli süreyi aşan ara sayacı sıfırlar.' },
  { title: 'Her saat büyür', text: 'Her saat ayrı ödül açılır; Kanka Coin ve Kanka Puan sırayla gelir.' },
]

export function OnlineRewards() {
  const { member, requireLogin } = usePoints()
  const { data } = useSWR('/api/kp/online', fetcher, { refreshInterval: 60_000 })

  if (!data || !data.enabled || !data.tiers.length) return null
  const hours = Math.floor(data.minutes / 60)
  const totals = data.tiers.reduce((acc, t) => ({ coin: acc.coin + t.coin, kp: acc.kp + t.kp }), { coin: 0, kp: 0 })
  const pct = Math.round((data.next?.progress ?? 1) * 100)

  return (
    <section id="online-odul" aria-labelledby="online-odul-baslik" className="flex scroll-mt-24 flex-col gap-5">
      <header className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
          <Radio className="size-3.5" aria-hidden="true" /> Kesintisiz online ödülü
        </span>
        <h2 id="online-odul-baslik" className="text-balance font-display text-2xl font-bold text-foreground">Ne kadar uzun kalırsan o kadar kazanırsın</h2>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Sitede kopmadan geçirdiğin her saat yeni bir ödül açar. İlk {data.tiers.at(-1)?.hour} saatte toplam{' '}
          <span className="font-semibold text-primary">{totals.coin.toLocaleString('tr-TR')} KC</span> ve{' '}
          <span className="font-semibold text-accent">{totals.kp.toLocaleString('tr-TR')} KP</span> seni bekliyor; sonrasında her saat maraton bonusu düşer.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-5">
        <article className="panel-gold flex flex-col gap-5 rounded-2xl p-5 lg:col-span-2">
          {member ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bu oturum</span>
                  <span className="font-display text-4xl font-bold tabular-nums text-foreground">{formatDuration(data.minutes)}</span>
                </div>
                <span className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', data.active ? 'bg-live/15 text-live' : 'bg-secondary text-muted-foreground')}>
                  <span className={cn('size-1.5 rounded-full', data.active ? 'bg-live' : 'bg-muted-foreground')} />
                  {data.active ? 'Sayaç çalışıyor' : 'Sayaç beklemede'}
                </span>
              </div>
              {data.next ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      Sıradaki: <span className="font-semibold text-foreground">{data.next.tier.hour}. saat · {data.next.tier.label}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-primary">{formatDuration(data.next.minutesLeft)} kaldı</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Sıradaki ödüle ilerleme">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <RewardChips coin={data.next.tier.coin} kp={data.next.tier.kp} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Tüm saat ödüllerini topladın, efsanesin kanka.</p>
              )}
              <p className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-xs leading-relaxed text-muted-foreground">
                <Timer className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                Sekmeyi {data.graceMinutes} dakikadan uzun kapatırsan veya bağlantın koparsa sayaç sıfırdan başlar.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Zap className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">Sayacı başlatmak için giriş yap</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">Üye olduğun an sayaç işlemeye başlar, ilk saatin sonunda ilk ödülün gelir.</p>
              <button onClick={() => requireLogin()} className="h-10 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90">
                Giriş yap
              </button>
            </div>
          )}
          <ol className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-1">
            {STEPS.map((s) => (
              <li key={s.title} className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{s.title}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{s.text}</span>
              </li>
            ))}
          </ol>
        </article>

        <ol aria-label="Saatlik ödüller" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:col-span-3 lg:grid-cols-4">
          {data.tiers.map((t) => {
            const done = member && data.active && hours >= t.hour
            const current = member && data.active && data.next?.tier.hour === t.hour
            return (
              <li
                key={t.hour}
                className={cn(
                  'relative flex flex-col gap-2 rounded-xl border p-3 transition-colors',
                  done ? 'border-primary/40 bg-primary/10' : current ? 'border-primary bg-card ring-2 ring-primary/30' : 'border-border bg-card',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl font-bold tabular-nums text-foreground">
                    {t.hour}
                    <span className="ml-0.5 text-xs font-semibold text-muted-foreground">sa</span>
                  </span>
                  {done ? (
                    <Check className="size-4 text-primary" aria-label="Alındı" />
                  ) : current ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Sırada</span>
                  ) : (
                    <Lock className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
                  )}
                </div>
                <span className="truncate text-xs font-semibold text-foreground/90">{t.label}</span>
                <RewardChips coin={t.coin} kp={t.kp} size="xs" />
              </li>
            )
          })}
          {(data.extra.coin > 0 || data.extra.kp > 0) && (
            <li className="col-span-2 flex flex-col justify-center gap-2 rounded-xl border border-dashed border-primary/40 p-3 sm:col-span-3 lg:col-span-4">
              <span className="text-xs font-semibold text-foreground">
                {(data.tiers.at(-1)?.hour ?? 0) + 1}. saatten sonra her saat maraton bonusu
              </span>
              <RewardChips coin={data.extra.coin} kp={data.extra.kp} size="xs" />
            </li>
          )}
        </ol>
      </div>
    </section>
  )
}
