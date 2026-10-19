import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CircleCheck, CircleDot, Coins, Crown, Flame, Gamepad2, Gift, ListChecks, Send, ShoppingBag, Target, Trophy } from 'lucide-react'
import type { MarketProduct } from '@/lib/market'
import type { LeagueMatch } from '@/lib/community'
import type { CemberMe, CemberStatus } from '@/lib/cember-shared'
import { publicRankName } from '@/lib/kanka-puan-shared'
import type { PodiumRow } from '@/components/alkanka/top-three'
import { DEFAULT_SOCIAL_LINKS, DEFAULT_TELEGRAM_LINK, PLATFORM_LABEL, type SocialLinks } from '@/lib/social-shared'
import { SocialIcon } from '@/components/alkanka/social-icons'
import { Countdown } from './countdown'
import { Marquee } from './marquee'

type MyRank = { rank: number; points: number } | null

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
  match: LeagueMatch | null
  exactReward: number
}

const fmt = (n: number) => n.toLocaleString('tr-TR')

function kickoffLabel(iso: string) {
  const d = new Date(iso)
  const tz = 'Europe/Istanbul'
  const day = (x: Date) => x.toLocaleDateString('tr-TR', { timeZone: tz })
  const now = new Date()
  const time = d.toLocaleTimeString('tr-TR', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  if (day(d) === day(now)) return `Bugün ${time}`
  if (day(d) === day(new Date(now.getTime() + 864e5))) return `Yarın ${time}`
  return `${d.toLocaleDateString('tr-TR', { timeZone: tz, day: 'numeric', month: 'short' })} ${time}`
}

function Crest({ name, src }: { name: string; src: string | null }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground/5 ring-1 ring-border md:size-8">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${name} logosu`} width={28} height={28} loading="lazy" className="size-5 object-contain md:size-6" />
      ) : (
        <span className="font-display text-[10px] font-bold text-muted-foreground">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  )
}

function PredictionTile({ match, reward }: { match: LeagueMatch | null; reward: number }) {
  return (
    <Tile href="/tahminler" label="Skor tahminine git" icon={Trophy} title="Skor tahmini" delay="-8s">
      {match ? (
        <>
          <div className="flex items-center gap-1.5">
            <Crest name={match.home} src={match.homeLogo} />
            {match.myPick ? (
              <span className="flex-1 text-center font-display text-base font-bold leading-none text-primary tabular-nums md:text-lg">
                {match.myPick.home}
                <span className="px-0.5 text-muted-foreground">-</span>
                {match.myPick.away}
              </span>
            ) : (
              <span className="flex-1 text-center font-display text-[11px] font-bold tracking-widest text-muted-foreground">VS</span>
            )}
            <Crest name={match.away} src={match.awayLogo} />
          </div>
          <p className="truncate text-center text-[11px] font-semibold text-foreground">
            {match.home} <span className="text-muted-foreground">-</span> {match.away}
          </p>
          <p className="mt-auto flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
            <span className="truncate tabular-nums">{kickoffLabel(match.kickoff)}</span>
            {match.myPick ? (
              <span className="shrink-0 font-semibold text-live">Tahmin verildi</span>
            ) : (
              <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 font-bold text-primary ring-1 ring-primary/30">
                +{fmt(reward)} KC
              </span>
            )}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Yeni maçlar yakında, ligi incele.</p>
      )}
    </Tile>
  )
}

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
  'glass-card border-flow group relative flex h-full min-w-0 flex-col gap-2 overflow-hidden rounded-xl p-2.5 transition-transform duration-300 md:p-3'

function Tile({
  href,
  children,
  label,
  icon: Icon,
  title,
  delay,
  className = '',
}: {
  href?: string
  children: React.ReactNode
  label: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  delay: string
  className?: string
}) {
  const inner = (
    <>
      <Icon className="pointer-events-none absolute -right-2 -bottom-3 size-14 text-primary/[0.07] transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110" aria-hidden="true" />
      <span className="relative flex items-center justify-between gap-1.5">
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30 shadow-[0_0_14px_-4px_var(--primary)]">
            <Icon className="size-3" aria-hidden="true" />
          </span>
          <span className="truncate">{title}</span>
        </span>
        {href && (
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
        )}
      </span>
      <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">{children}</div>
    </>
  )
  const style = { '--flow-delay': delay, '--flow-opacity': 0.45 } as React.CSSProperties
  if (!href)
    return (
      <div aria-label={label} className={`${tileClass} ${className}`} style={style}>
        {inner}
      </div>
    )
  return (
    <Link href={href} aria-label={label} className={`${tileClass} ${className} hover:-translate-y-0.5`} style={style}>
      {inner}
    </Link>
  )
}

const MEDAL = {
  1: 'bg-primary text-primary-foreground ring-primary/40 shadow-[0_0_18px_-4px_var(--primary)]',
  2: 'bg-foreground/85 text-background ring-foreground/20',
  3: 'bg-bronze text-background ring-bronze/30',
} as const

function RankTile({ podium, me }: { podium: PodiumRow[]; me: MyRank }) {
  const top = podium
    .filter((r) => r.points > 0)
    .slice(0, 3)
    .map((r, i) => ({ ...r, rank: (i + 1) as 1 | 2 | 3, name: publicRankName(r.name) }))
  return (
    <Tile href="/siralama" label="Sıralamaya git" icon={Crown} title="Sıralama" delay="-6s" className="col-span-2 md:col-span-4 lg:col-span-1">
      {top.length ? (
        <ol className="grid grid-cols-3 gap-1.5 lg:grid-cols-1 lg:gap-1" aria-label="İlk üç">
          {top.map((u) => (
            <li key={u.userId} className="flex min-w-0 items-center gap-1.5 text-xs">
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full font-display text-[10px] font-black ring-2 ${MEDAL[u.rank]}`}
              >
                {u.rank}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{u.name}</span>
              <span className="hidden shrink-0 text-[11px] font-bold text-primary tabular-nums lg:inline">{fmt(u.points)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">Sıralama yakında başlıyor.</p>
      )}
      <p className="mt-auto flex items-center justify-between gap-2 rounded-md bg-primary/10 px-2 py-1 text-[11px] ring-1 ring-primary/25">
        {me ? (
          <>
            <span className="text-foreground">
              Sen <span className="font-display font-bold text-primary tabular-nums">{fmt(me.rank)}.</span> sıradasın
            </span>
            <span className="font-semibold text-foreground tabular-nums">{fmt(me.points)} KP</span>
          </>
        ) : (
          <span className="text-muted-foreground">İlk oyununu oyna, sıralamaya gir.</span>
        )}
      </p>
    </Tile>
  )
}

const SOCIAL_ORDER = ['telegram', 'instagram', 'youtube', 'x'] as const

function HubSocials({ links }: { links: SocialLinks }) {
  const href = (p: (typeof SOCIAL_ORDER)[number]) =>
    p === 'telegram' ? links.telegram || DEFAULT_TELEGRAM_LINK : links[p] || DEFAULT_SOCIAL_LINKS[p]
  const join = links.join || links.telegram || DEFAULT_TELEGRAM_LINK
  const external = /^https?:\/\//i.test(join)
  return (
    <nav aria-label="AL KANKA topluluk hesapları" className="flex items-center gap-1 rounded-full border border-primary/25 bg-background/40 p-1 backdrop-blur">
      <ul className="flex items-center gap-1">
        {SOCIAL_ORDER.map((p) => (
          <li key={p}>
            <a
              href={href(p)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`AL KANKA ${p === 'telegram' ? 'Telegram' : PLATFORM_LABEL[p]} hesabı`}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-all hover:-translate-y-0.5 hover:bg-primary/15 hover:text-primary md:size-8"
            >
              {p === 'telegram' ? <Send className="size-3.5 md:size-4" aria-hidden="true" /> : <SocialIcon platform={p} className="size-3.5 md:size-4" />}
            </a>
          </li>
        ))}
      </ul>
      <a
        href={join}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="flex h-7 items-center gap-1 rounded-full bg-gradient-to-b from-primary to-bronze px-3 text-xs font-bold text-primary-foreground shadow-[0_0_18px_-6px_var(--primary)] transition-transform hover:scale-[1.04] md:h-8 md:px-3.5 md:text-sm"
      >
        Katıl
      </a>
    </nav>
  )
}

export function MemberHub({
  data,
  podium = [],
  me = null,
  links = {},
}: {
  data: HubData
  podium?: PodiumRow[]
  me?: MyRank
  links?: SocialLinks
}) {
  const { cember, cemberMe, goal } = data
  const taskPct = data.tasksTotal ? (data.tasksDone / data.tasksTotal) * 100 : 0
  const missing = cemberMe?.progress.filter((p) => !p.done) ?? []
  const goalLeft = goal ? Math.max(0, goal.price - data.balance) : 0

  return (
    <section
      aria-labelledby="hub-title"
      className="hub-surface border-flow relative flex flex-col gap-3 overflow-hidden rounded-2xl p-3.5 md:gap-4 md:p-5"
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
          <h2 id="hub-title" className="truncate font-display text-xl font-bold text-foreground md:text-2xl">
            Hoş geldin <span className="bg-gradient-to-r from-primary to-bronze bg-clip-text text-transparent">{data.name}</span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HubSocials links={links} />
          <Link
            href="/gorevler"
            className="glass-card flex items-center gap-1.5 rounded-full px-3 py-1 text-xs md:text-sm font-semibold text-foreground transition-colors hover:text-primary"
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

      <div className="relative grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-2.5 lg:grid-cols-5">
        <RankTile podium={podium} me={me} />
        <Tile href="/gorevler" label="Günlük görevlere git" icon={ListChecks} title="Günlük görevler" delay="0s">
          {data.tasksTotal > 0 ? (
            <>
              <p className="font-display text-xl font-bold leading-none text-foreground tabular-nums md:text-2xl">
                {data.tasksDone}
                <span className="text-sm text-muted-foreground">/{data.tasksTotal}</span>
              </p>
              <Bar value={taskPct} />
              <p className="truncate text-[11px] text-muted-foreground">
                {data.tasksDone >= data.tasksTotal ? 'Hepsi tamam kanka' : `${data.tasksTotal - data.tasksDone} görev bekliyor`}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Tüm görevleri gör.</p>
          )}
        </Tile>

        <Tile label="Jako Çemberi durumu" icon={CircleDot} title={cember?.title || 'Jako Çemberi'} delay="-2s">
          {cember?.enabled && cember.nextSlot ? (
            <>
              <p className="flex items-baseline gap-2 font-display text-xl font-bold leading-none text-foreground tabular-nums md:text-2xl">
                <Countdown target={cember.nextSlot} />
                {cember.prizeText && <span className="truncate font-sans text-[11px] font-semibold text-primary">{cember.prizeText}</span>}
              </p>
              {cemberMe?.eligible ? (
                <p className="flex min-w-0 items-center gap-1 text-[11px] text-foreground">
                  <CircleCheck className="size-3 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">Çemberdesin</span>
                </p>
              ) : missing.length > 0 ? (
                <p className="truncate text-[11px] text-muted-foreground">Kaldı: {missing[0].label}</p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Yakında duyurulacak.</p>
          )}
        </Tile>

        <Tile href="/market" label="Market hedefine git" icon={Target} title="Market hedefin" delay="-4s">
          {goal ? (
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="relative size-8 shrink-0 overflow-hidden rounded-lg ring-1 ring-primary/30">
                  <Image src={goal.image || '/images/tile-market.png'} alt="" fill sizes="32px" className="object-cover" />
                </span>
                <p className="line-clamp-2 min-w-0 text-xs font-semibold leading-snug text-foreground">{goal.name}</p>
              </div>
              <div className="mt-auto flex flex-col gap-1">
                <Bar value={(data.balance / Math.max(1, goal.price)) * 100} />
                <p className="truncate text-[11px] text-muted-foreground">
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
            <p className="text-xs text-muted-foreground">Marketteki ödüllere göz at.</p>
          )}
        </Tile>

        <PredictionTile match={data.match} reward={data.exactReward} />
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
      <Marquee label="Market ödülleri" duration={55} itemClassName="w-36 sm:w-40 lg:w-44">
        {products.map((p) => {
          const affordable = balance !== null && balance >= p.price
          return (
              <Link key={p.id} href="/market" className="panel-gold group flex h-full flex-col overflow-hidden rounded-xl">
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
          )
        })}
      </Marquee>
    </section>
  )
}
