import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Gift, Play } from 'lucide-react'
import type { HubData } from '@/components/alkanka/home/home-hub'
import type { HomeV2Config } from '@/lib/home-v2-shared'
import type { MarketProduct } from '@/lib/market'

const fmt = (n: number) => n.toLocaleString('tr-TR')

type Row = { userId: string; name: string; points: number }

function Coin() {
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground" aria-hidden="true">
      KC
    </span>
  )
}

export function MemberHomeV2({
  data,
  config,
  podium,
  me,
  products,
  bonus = 500,
}: {
  data: HubData | null
  config: HomeV2Config
  podium: Row[]
  me: { rank: number; points: number } | null
  products: MarketProduct[]
  bonus?: number
}) {
  const guest = !data
  const withBonus = (s: string) => s.replaceAll('{bonus}', fmt(bonus))
  const eyebrow = guest ? withBonus(config.guestEyebrow) : config.eyebrow.replace('{ad}', data.name)
  const title = guest ? withBonus(config.guestTitle) : config.title
  const primaryCta = guest ? withBonus(config.guestPrimaryCta) : config.primaryCta
  const primaryHref = guest ? config.guestPrimaryHref : config.primaryHref
  const secondaryCta = guest ? config.guestSecondaryCta : config.secondaryCta
  const secondaryHref = guest ? config.guestSecondaryHref : config.secondaryHref
  const balance = data?.balance ?? 0
  const goal = data?.goal ?? null
  const goalPct = goal && goal.price > 0 ? Math.min(100, Math.round((balance / goal.price) * 100)) : 0
  const affordable = guest
    ? []
    : [...products]
        .filter((p) => p.price <= balance)
        .sort((a, b) => a.price - b.price)
        .slice(-3)
  const showSide = config.showWallet || config.showLeaderboard

  return (
    <div className={showSide ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]' : 'flex flex-col gap-6'}>
      <div className="flex min-w-0 flex-col gap-7">
        <section aria-label="Kaldığın yerden" className="relative isolate overflow-hidden rounded-3xl border border-border bg-card">
          {config.heroImage && (
            <Image src={config.heroImage || '/placeholder.svg'} alt="" fill priority sizes="(min-width: 1024px) 70vw, 100vw" className="-z-10 object-cover opacity-60" />
          )}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-card via-card/85 to-card/10" aria-hidden="true" />
          <div className="flex max-w-lg flex-col gap-4 p-6 sm:p-9">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">{eyebrow}</span>
            <h2 className="text-balance text-3xl font-black leading-tight text-foreground sm:text-4xl">{title}</h2>
            {!guest && config.pills.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Masa ayarları">
                {config.pills.map((p) => (
                  <li key={p} className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur">
                    {p}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href={primaryHref} className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
                {guest ? <Gift className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
                {primaryCta}
              </Link>
              {secondaryCta && (
                <Link href={secondaryHref} className="inline-flex h-12 items-center rounded-xl border border-border bg-background/70 px-5 text-sm font-bold text-foreground backdrop-blur transition-colors hover:bg-secondary">
                  {secondaryCta}
                </Link>
              )}
            </div>
          </div>
        </section>

        {config.daily.length > 0 && (
          <section aria-labelledby="daily-h" className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id="daily-h" className="text-lg font-bold text-foreground">{config.dailyTitle}</h2>
              {config.dailySub && <p className="text-sm text-muted-foreground">{config.dailySub}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {config.daily.map((t) => (
                <Link key={t.title + t.href} href={t.href} className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/50">
                  <div className="relative aspect-[4/3] bg-secondary">
                    {t.image && <Image src={t.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 1024px) 220px, 33vw" className="object-cover transition-transform group-hover:scale-105" />}
                  </div>
                  <div className="flex flex-col gap-2 p-3">
                    <b className="truncate text-sm text-foreground">{t.title}</b>
                    <span className="inline-flex h-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">{t.action}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {showSide && (
        <aside className="flex flex-col gap-4">
          {config.showWallet && guest && (
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <Coin />
                <div className="flex min-w-0 flex-col">
                  <small className="text-xs text-muted-foreground">{config.guestCardTitle}</small>
                  <b className="text-2xl font-black tabular-nums text-foreground">{`${fmt(bonus)} KC hediye`}</b>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <a href={config.guestPrimaryHref} className="inline-flex h-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90">
                  Ücretsiz kayıt ol
                </a>
                <a href="#giris" className="inline-flex h-10 items-center justify-center rounded-lg border border-border text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
                  Giriş yap
                </a>
              </div>
            </div>
          )}
          {config.showWallet && data && (
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-1">
                <small className="text-xs text-muted-foreground">Bakiyen</small>
                <span className="flex items-center gap-2 text-3xl font-black tabular-nums text-foreground">
                  <Coin />
                  {fmt(data.balance)}
                </span>
                {me && (
                  <span className="text-xs text-muted-foreground">
                    <b className="text-foreground">{`${fmt(me.points)} KP`}</b>
                    {` · Sıralamada ${me.rank}.`}
                  </span>
                )}
              </div>
              {goal && (
                <div className="flex flex-col gap-2 rounded-xl bg-secondary/60 p-3">
                  <div className="flex items-center gap-3">
                    {goal.image && (
                      <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-background">
                        <Image src={goal.image || '/placeholder.svg'} alt="" fill sizes="40px" className="object-cover" />
                      </span>
                    )}
                    <div className="flex min-w-0 flex-col">
                      <small className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sıradaki hedefin</small>
                      <b className="truncate text-sm text-foreground">{goal.name}</b>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100} aria-label="Hedef ilerlemesi">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${goalPct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="tabular-nums text-muted-foreground">{`${fmt(data.balance)} / ${fmt(goal.price)} KC`}</span>
                    <b className="tabular-nums text-foreground">{goal.price > data.balance ? `${fmt(goal.price - data.balance)} KC kaldı` : 'Alabilirsin'}</b>
                  </div>
                </div>
              )}
              {affordable.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Şimdi alabileceklerin</span>
                  <div className="grid grid-cols-3 gap-2">
                    {affordable.map((p) => (
                      <Link key={p.id} href={config.marketHref} title={p.name} className="flex flex-col items-center gap-1 rounded-xl bg-secondary/60 p-2 text-center transition-colors hover:bg-secondary">
                        <span className="relative size-12 overflow-hidden rounded-lg bg-background">
                          {p.image && <Image src={p.image || '/placeholder.svg'} alt={p.name} fill sizes="48px" className="object-cover" />}
                        </span>
                        <span className="text-[11px] font-bold tabular-nums text-foreground">{`${fmt(p.price)} KC`}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <Link href={config.marketHref} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
                {"Market'e git"}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}
          {config.showLeaderboard && podium.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground">Sıralama</h3>
                <Link href="/siralama" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  Tümü
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
              <ol className="flex flex-col gap-1">
                {podium.map((r, i) => (
                  <li key={r.userId} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm">
                    <span className="w-5 text-center font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                    <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">{r.name.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate text-foreground">{r.name}</span>
                    <span className="font-semibold tabular-nums text-foreground">{`${fmt(r.points)} KP`}</span>
                  </li>
                ))}
                {me && me.rank > podium.length && (
                  <li className="flex items-center gap-3 rounded-lg bg-primary/10 px-2 py-1.5 text-sm">
                    <span className="w-5 text-center font-bold tabular-nums text-primary">{me.rank}</span>
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">S</span>
                    <span className="flex-1 font-semibold text-foreground">Sen</span>
                    <span className="font-semibold tabular-nums text-foreground">{`${fmt(me.points)} KP`}</span>
                  </li>
                )}
              </ol>
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
