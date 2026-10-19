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
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10" aria-hidden="true">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
    </div>
  )
}

const tileClass = 'group flex min-w-0 flex-col gap-2.5 rounded-xl border border-border/70 bg-background/50 p-3.5 transition-colors'

function Tile({ href, children, label }: { href?: string; children: React.ReactNode; label: string }) {
  if (!href) return <div aria-label={label} className={tileClass}>{children}</div>
  return (
    <Link href={href} aria-label={label} className={`${tileClass} hover:border-primary/50`}>
      {children}
    </Link>
  )
}

export function MemberHub({ data }: { data: HubData }) {
  const { cember, cemberMe, goal } = data
  const taskPct = data.tasksTotal ? (data.tasksDone / data.tasksTotal) * 100 : 0
  const missing = cemberMe?.progress.filter((p) => !p.done) ?? []
  const goalLeft = goal ? Math.max(0, goal.price - data.balance) : 0

  return (
    <section aria-labelledby="hub-title" className="panel-gold flex flex-col gap-4 rounded-2xl p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Bugünkü durumun</p>
          <h2 id="hub-title" className="font-display text-xl font-bold text-foreground text-balance md:text-2xl">
            Hoş geldin {data.name}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-sm font-bold text-primary">
            <Coins className="size-4" aria-hidden="true" />
            <span className="tabular-nums">{fmt(data.balance)}</span> KC
          </span>
          <Link
            href="/gorevler"
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/50"
          >
            <Flame className={data.checkedToday ? 'size-4 text-primary' : 'size-4 text-muted-foreground'} aria-hidden="true" />
            {data.streak > 0 ? `${data.streak}. gün serisi` : 'Seriyi başlat'}
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Tile href="/gorevler" label="Günlük görevlere git">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ListChecks className="size-4 text-primary" aria-hidden="true" />
            Günlük görevler
          </span>
          {data.tasksTotal > 0 ? (
            <>
              <p className="font-display text-2xl font-bold text-foreground tabular-nums">
                {data.tasksDone}/{data.tasksTotal}
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

        <Tile label="Jako Çemberi durumu">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CircleDot className="size-4 text-primary" aria-hidden="true" />
            {cember?.title || 'Jako Çemberi'}
          </span>
          {cember?.enabled && cember.nextSlot ? (
            <>
              <p className="font-display text-2xl font-bold text-foreground">
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

        <Tile href="/market" label="Market hedefine git">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Target className="size-4 text-primary" aria-hidden="true" />
            Market hedefin
          </span>
          {goal ? (
            <div className="flex items-center gap-3">
              <span className="relative size-12 shrink-0 overflow-hidden rounded-lg">
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
