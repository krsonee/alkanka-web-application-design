import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CircleCheck, CircleDot, Coins, Flame, Gamepad2, Gift, ListChecks, ShoppingBag, Target } from 'lucide-react'
import type { MarketProduct } from '@/lib/market'
import type { CemberMe, CemberStatus } from '@/lib/cember-shared'
import { Countdown } from './countdown'

export type HubData = {
  name: string
  balance: number
  streak: number
  checkedToday: boolean
  tasksDone: number
  tasksTotal: number
  cember: CemberStatus | null
  cemberMe: CemberMe | null
  goal: MarketProduct | null
}

const fmt = (n: number) => n.toLocaleString('tr-TR')

function Bar({ value }: { value: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
      <div
        className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-bronze via-primary to-primary shadow-[0_0_12px_-2px_var(--primary)]"
        style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
      >
        <span className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-foreground/50 to-transparent motion-safe:animate-[hub-shimmer_2.4s_ease-in-out_infinite]" />
      </div>
    </div>
  )
}

const tileClass =
  'glass-card border-flow group relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl p-4 transition-transform duration-300'

function Tile({
  href,
  children,
  label,
  icon: Icon,
  title,
  delay,
}: {
  href?: string
  children: React.ReactNode
  label: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  delay: string
}) {
  const inner = (
    <>
      <Icon className="pointer-events-none absolute -right-4 -bottom-5 size-24 text-primary/[0.07] transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110" aria-hidden="true" />
      <span className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30 shadow-[0_0_16px_-4px_var(--primary)]">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          {title}
        </span>
        {href && (
          <ArrowRight className="size-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
        )}
      </span>
      <div className="relative flex flex-col gap-2.5">{children}</div>
    </>
  )
  const style = { '--flow-delay': delay, '--flow-opacity': 0.45 } as React.CSSProperties
  if (!href)
    return (
      <div aria-label={label} className={tileClass} style={style}>
        {inner}
      </div>
    )
  return (
    <Link href={href} aria-label={label} className={`${tileClass} hover:-translate-y-0.5`} style={style}>
      {inner}
    </Link>
  )
}

export function MemberHub({ data }: { data: HubData }) {
  const { cember, cemberMe, goal } = data
  const taskPct = data.tasksTotal ? (data.tasksDone / data.tasksTotal) * 100 : 0
  const missing = cemberMe?.progress.filter((p) => !p.done) ?? []
  const goalLeft = goal ? Math.max(0, goal.price - data.balance) : 0

  return (
    <section
      aria-labelledby="hub-title"
      className="hub-surface border-flow relative flex flex-col gap-4 overflow-hidden rounded-2xl p-4 md:gap-5 md:p-6"
      style={{ '--flow-speed': '9s', '--flow-opacity': 0.9 } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-primary/[0.06] to-transparent motion-safe:animate-[hub-sheen_7s_ease-in-out_infinite]"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full rounded-full bg-live opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-live" />
            </span>
            Bugünkü durumun
          </p>
          <h2 id="hub-title" className="truncate font-display text-2xl font-bold text-foreground md:text-3xl">
            Hoş geldin <span className="bg-gradient-to-r from-primary to-bronze bg-clip-text text-transparent">{data.name}</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-b from-primary to-bronze px-3.5 py-1.5 text-sm font-bold text-primary-foreground shadow-[0_0_20px_-6px_var(--primary)] ring-1 ring-primary/40">
            <Coins className="size-4" aria-hidden="true" />
            <span className="tabular-nums">{fmt(data.balance)}</span> KC
          </span>
          <Link
            href="/gorevler"
            className="glass-card flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold text-foreground transition-colors hover:text-primary"
          >
            <Flame
              className={
                data.checkedToday
                  ? 'size-4 text-primary motion-safe:animate-[hub-flicker_1.6s_ease-in-out_infinite]'
                  : 'size-4 text-muted-foreground'
              }
              aria-hidden="true"
            />
            {data.streak > 0 ? `${data.streak}. gün serisi` : 'Seriyi başlat'}
          </Link>
        </div>
      </div>

      <div className="relative grid gap-3 md:grid-cols-3">
        <Tile href="/gorevler" label="Günlük görevlere git" icon={ListChecks} title="Günlük görevler" delay="0s">
          {data.tasksTotal > 0 ? (
            <>
              <p className="font-display text-3xl font-bold text-foreground tabular-nums">
                {data.tasksDone}
                <span className="text-lg text-muted-foreground">/{data.tasksTotal}</span>
              </p>
              <Bar value={taskPct} />
              <p className="text-xs text-muted-foreground">
                {data.tasksDone >= data.tasksTotal ? 'Bugünkü görevler tamam kanka.' : `${data.tasksTotal - data.tasksDone} görev seni bekliyor`}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Görevler sayfasında tüm görevleri gör.</p>
          )}
        </Tile>

        <Tile label="Jako Çemberi durumu" icon={CircleDot} title={cember?.title || 'Jako Çemberi'} delay="-2s">
          {cember?.enabled && cember.nextSlot ? (
            <>
              <p className="font-display text-3xl font-bold text-foreground tabular-nums">
                <Countdown target={cember.nextSlot} />
              </p>
              {cember.prizeText && <p className="truncate text-xs font-semibold text-primary">{cember.prizeText}</p>}
              {cemberMe?.eligible ? (
                <p className="flex items-center gap-1 text-xs text-foreground">
                  <CircleCheck className="size-3.5 text-primary" aria-hidden="true" />
                  Çemberdesin, şans seninle
                </p>
              ) : missing.length > 0 ? (
                <p className="truncate text-xs text-muted-foreground">Kaldı: {missing[0].label}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sıradaki çember yakında duyurulacak.</p>
          )}
        </Tile>

        <Tile href="/market" label="Market hedefine git" icon={Target} title="Market hedefin" delay="-4s">
          {goal ? (
            <div className="flex items-center gap-3">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-primary/30">
                <Image src={goal.image || '/images/tile-market.png'} alt="" fill sizes="48px" className="object-cover" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="truncate text-sm font-semibold text-foreground">{goal.name}</p>
                <Bar value={(data.balance / Math.max(1, goal.price)) * 100} />
                <p className="text-xs text-muted-foreground">
                  {goalLeft > 0 ? (
                    <>
                      <span className="font-bold text-primary tabular-nums">{fmt(goalLeft)} KC</span> kaldı
                    </>
                  ) : (
                    <span className="font-bold text-primary">Almaya yetiyor</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Marketteki ödüllere göz at.</p>
          )}
        </Tile>
      </div>
    </section>
  )
}

const STEPS = [
  { icon: Gamepad2, title: 'Oyna, görev yap', text: 'Mini oyunlar ve günlük görevler tamamen ücretsiz.' },
  { icon: Coins, title: 'Kanka Coin topla', text: 'Her oyun, görev ve seri gününde KC kazanırsın.' },
  { icon: ShoppingBag, title: 'Ödüle çevir', text: 'Market’te KC’ni sponsor ödülleriyle takas et.' },
]

export function GuestHero({ bonus }: { bonus: number }) {
  return (
    <section aria-labelledby="guest-title" className="panel-gold flex flex-col gap-5 rounded-2xl p-5 md:p-7">
      <div className="flex flex-col gap-3 md:max-w-2xl">
        <h2 id="guest-title" className="font-display text-2xl font-bold leading-tight text-foreground text-balance md:text-4xl">
          Ücretsiz oyna, Kanka Coin topla, <span className="text-primary">sponsor ödüllerini kap</span>
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty md:text-base">
          Kayıt ol, cüzdanına hemen {fmt(bonus)} KC hediye yüklensin. Kart bilgisi yok, ödeme yok.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="#kayit"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Gift className="size-4" aria-hidden="true" />
            Kayıt ol, {fmt(bonus)} KC al
          </a>
          <a href="#giris" className="text-sm font-semibold text-foreground underline-offset-4 hover:underline">
            Zaten üyeyim
          </a>
        </div>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3" aria-label="Nasıl çalışır">
        {STEPS.map((step) => (
          <li key={step.title} className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/50 p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary" aria-hidden="true">
              <step.icon className="size-4" />
            </span>
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function MarketShowcase({ products, balance }: { products: MarketProduct[]; balance: number | null }) {
  if (!products.length) return null
  return (
    <section aria-labelledby="vitrin-title" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <h2 id="vitrin-title" className="font-display text-lg font-bold text-foreground md:text-xl">
            Bunları kazanabilirsin
          </h2>
          <p className="text-xs text-muted-foreground">Market’teki ödüller, Kanka Coin ile</p>
        </div>
        <Link href="/market" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
          Tüm market
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 no-scrollbar md:mx-0 md:grid md:grid-cols-3 md:px-0 xl:grid-cols-6">
        {products.map((p) => {
          const affordable = balance !== null && balance >= p.price
          return (
            <li key={p.id} className="w-36 shrink-0 snap-start md:w-auto">
              <Link href="/market" className="panel-gold group flex h-full flex-col overflow-hidden rounded-xl">
                <span className="relative block aspect-square overflow-hidden">
                  <Image
                    src={p.image || '/images/tile-market.png'}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 160px, (min-width: 768px) 30vw, 144px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {p.sponsorName && (
                    <span className="absolute top-2 left-2 max-w-[80%] truncate rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
                      {p.sponsorName}
                    </span>
                  )}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-2.5">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{p.name}</span>
                  <span className="mt-auto text-sm font-bold text-primary tabular-nums">
                    {fmt(p.price)} KC{affordable && <span className="ml-1 text-[11px] font-semibold text-foreground">· yetiyor</span>}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
