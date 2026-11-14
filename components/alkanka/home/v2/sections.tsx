import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Box,
  Check,
  Clock,
  Compass,
  Dices,
  Gift,
  Handshake,
  Megaphone,
  Percent,
  Play,
  RotateCw,
  Send,
  ShoppingBag,
  Star,
  Swords,
  Target,
  Ticket,
  Trophy,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TourButton } from '@/components/alkanka/app/site-tour'
import { HOME_GAME_LABEL, productImage, type DailyTile, type FreeTile, type PromoCard, type RailLink } from '@/lib/home-v2-shared'
import type { MarketProduct } from '@/lib/market'

const fmt = (n: number) => n.toLocaleString('tr-TR')

const RAIL_ICON: Record<string, LucideIcon> = {
  wheel: RotateCw,
  chest: Box,
  dice: Dices,
  target: Target,
  swords: Swords,
  megaphone: Megaphone,
  handshake: Handshake,
  percent: Percent,
  ticket: Ticket,
  gift: Gift,
  trophy: Trophy,
  star: Star,
}

const SPLIT_AFTER = 5

export function QuickRail({ links, ready }: { links: RailLink[]; ready?: Set<string> }) {
  if (!links.length) return null
  return (
    <nav aria-label="Hızlı erişim" className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
      <ul className="flex w-max items-center gap-2">
        {links.map((l, i) => {
          const Icon = RAIL_ICON[l.icon] ?? Star
          return (
            <li key={`${l.href}-${i}`} className="flex items-center gap-2">
              {i === SPLIT_AFTER && <span aria-hidden="true" className="mx-1 h-6 w-px bg-border" />}
              <Link
                href={l.href}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-secondary"
              >
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                {l.label}
                {ready?.has(l.href) && (
                  <span className="size-1.5 rounded-full bg-[oklch(0.72_0.17_150)]">
                    <span className="sr-only">hazır</span>
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function SectionHead({ title, sub, link }: { title: string; sub?: string; link?: { label: string; href: string } }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
      {link && (
        <Link href={link.href} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {link.label}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

export function NewbieCard({ title, text }: { title: string; text: string }) {
  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-dashed border-primary/35 bg-primary/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Compass className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
        </div>
      </div>
      <TourButton className="h-9 shrink-0 justify-center gap-2 rounded-lg border border-primary/50 px-3 py-0 font-semibold text-primary hover:bg-primary/10 hover:text-primary" />
    </aside>
  )
}

export function FreeGrid({ tiles }: { tiles: FreeTile[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <li key={t.title}>
          <Link href={t.href} className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card">
            {t.image && (
              <Image src={t.image} alt="" fill sizes="(min-width: 1024px) 190px, 45vw" className="-z-10 object-cover transition-transform duration-500 group-hover:scale-105" />
            )}
            <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/30 to-transparent" />
            <span className="flex min-w-0 flex-col gap-0.5 p-3">
              <span className="truncate font-display text-base font-bold text-foreground">{t.title}</span>
              <span className="truncate text-xs text-muted-foreground">{t.sub}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function GamesGrid({ games, compact }: { games: string[]; compact?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {games.map((key) => (
        <li key={key}>
          <Link
            href={`/oyunlar/${key}`}
            className={cn(
              'group relative isolate flex flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card',
              compact ? 'aspect-[4/3]' : 'aspect-[16/12]',
            )}
          >
            <Image src={`/images/games/${key}.png`} alt="" fill sizes="(min-width: 1024px) 280px, 50vw" className="-z-10 object-cover transition-transform duration-500 group-hover:scale-105" />
            <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
            <span className="flex items-center justify-between gap-2 p-3.5">
              <span className="font-display text-lg font-bold text-foreground">{HOME_GAME_LABEL[key] ?? key}</span>
              <span className="flex size-7 items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function PromoCards({ promos }: { promos: PromoCard[] }) {
  return (
    <div className="flex flex-col gap-4">
      {promos.map((p, i) => {
        const external = /^https?:\/\//.test(p.href)
        return (
          <Link
            key={i}
            href={p.href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="group relative isolate flex min-h-44 flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card"
          >
            {p.image && <Image src={p.image} alt="" fill sizes="(min-width: 1024px) 660px, 100vw" className="-z-10 object-cover transition-transform duration-700 group-hover:scale-105" />}
            <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/50 to-transparent" />
            <span className="flex items-end justify-between gap-4 p-5">
              <span className="flex flex-col gap-1">
                <span className="font-display text-lg font-bold text-foreground">{p.title}</span>
                <span className="text-sm text-muted-foreground">{p.text}</span>
              </span>
              {p.cta && (
                <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background/70 px-3 text-sm font-semibold text-foreground backdrop-blur">
                  {external && <Send className="size-3.5" aria-hidden="true" />}
                  {p.cta}
                </span>
              )}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

type Row = { userId: string; name: string; points: number }

export function Leaderboard({
  title,
  note,
  rows,
  me,
  meId,
  compact,
}: {
  title: string
  note?: string
  rows: Row[]
  me?: { rank: number; points: number } | null
  meId?: string | null
  compact?: boolean
}) {
  const showMe = me && meId && !rows.some((r) => r.userId === meId)
  const leader = Math.max(1, rows[0]?.points ?? 1)
  return (
    <section aria-label={title} className="relative isolate flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4">
      <span aria-hidden="true" className="absolute -right-16 -top-16 -z-10 size-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Trophy className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <h2 className="font-display text-base font-bold leading-tight text-foreground">{title}</h2>
            {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
          </div>
        </div>
        {compact && (
          <Link href="/siralama" className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
            Tümü
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Bu hafta henüz puan yok. İlk sen ol.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <LbRow key={r.userId} rank={i + 1} name={r.name} points={r.points} pct={(r.points / leader) * 100} mine={r.userId === meId} />
          ))}
          {showMe && (
            <>
              <li aria-hidden="true" className="flex justify-center py-0.5 text-xs leading-none text-muted-foreground">
                ···
              </li>
              <LbRow rank={me.rank} name="Sen" points={me.points} pct={(me.points / leader) * 100} mine />
            </>
          )}
        </ol>
      )}
      {!compact && (
        <Link
          href="/siralama"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background/40 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
        >
          Tüm sıralama
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  )
}

const MEDAL: Record<number, { ring: string; badge: string; bar: string }> = {
  1: { ring: 'ring-primary', badge: 'bg-primary text-primary-foreground', bar: 'bg-primary' },
  2: { ring: 'ring-foreground/60', badge: 'bg-foreground/80 text-background', bar: 'bg-foreground/60' },
  3: { ring: 'ring-[oklch(0.62_0.12_50)]', badge: 'bg-[oklch(0.62_0.12_50)] text-background', bar: 'bg-[oklch(0.62_0.12_50)]' },
}

function LbRow({ rank, name, points, pct, mine }: { rank: number; name: string; points: number; pct: number; mine?: boolean }) {
  const medal = MEDAL[rank]
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-xl border px-2.5 py-2 transition-colors',
        mine ? 'border-primary/50 bg-primary/10' : medal ? 'border-border bg-background/40' : 'border-transparent hover:bg-background/40',
      )}
    >
      <span className="relative shrink-0">
        <span
          className={cn(
            'flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-bold uppercase text-foreground',
            medal && `ring-2 ring-offset-2 ring-offset-card ${medal.ring}`,
          )}
        >
          {name.charAt(0)}
        </span>
        <span
          className={cn(
            'absolute -bottom-1 -right-1 flex size-4.5 min-w-[18px] items-center justify-center rounded-full border-2 border-card px-0.5 text-[9px] font-black',
            medal ? medal.badge : 'bg-secondary text-muted-foreground',
          )}
        >
          {rank}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center justify-between gap-2">
          <span className={cn('truncate text-sm', mine ? 'font-bold text-primary' : 'font-semibold text-foreground')}>{name}</span>
          <span className={cn('shrink-0 font-display text-sm font-bold tabular-nums', mine ? 'text-primary' : 'text-foreground')}>
            {fmt(points)} <span className="text-[10px] font-semibold text-muted-foreground">KP</span>
          </span>
        </span>
        <span className="h-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
          <span className={cn('block h-full rounded-full', mine ? 'bg-primary' : (medal?.bar ?? 'bg-muted-foreground/50'))} style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
        </span>
      </span>
    </li>
  )
}

export function MemberHero({
  eyebrow,
  title,
  image,
  pills,
  primary,
  secondary,
}: {
  eyebrow: string
  title: string
  image: string
  pills: string[]
  primary: { label: string; href: string }
  secondary: { label: string; href: string }
}) {
  return (
    <section aria-label="Kaldığın yer" className="relative isolate flex min-h-72 flex-col justify-center overflow-hidden rounded-2xl border border-border bg-card">
      {image && <Image src={image} alt="" fill priority sizes="(min-width: 1024px) 820px, 100vw" className="-z-10 object-cover" />}
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/75 to-transparent" />
      <div className="flex flex-col gap-4 p-6 sm:p-8">
        <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          <span aria-hidden="true" className="h-px w-6 bg-primary" />
          {eyebrow}
        </p>
        <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h2>
        {pills.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {pills.map((p) => (
              <li key={p} className="rounded-md border border-border bg-background/70 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">
                {p}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href={primary.href}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] transition-transform hover:-translate-y-0.5"
          >
            <Play className="size-4" aria-hidden="true" />
            {primary.label}
          </Link>
          <Link href={secondary.href} className="inline-flex h-12 items-center rounded-xl border border-border bg-background/60 px-6 text-sm font-bold text-foreground backdrop-blur transition-colors hover:bg-secondary">
            {secondary.label}
          </Link>
        </div>
      </div>
    </section>
  )
}

export type DailyState = { tile: DailyTile; nextAt: number | null }

function untilLabel(nextAt: number) {
  const mins = Math.max(1, Math.ceil((nextAt - Date.now()) / 60_000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h} sa${m ? ` ${m} dk` : ''} sonra` : `${m} dk sonra`
}

export function DailyGrid({ items }: { items: DailyState[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map(({ tile, nextAt }) => {
        const used = nextAt !== null
        return (
          <li key={tile.title}>
            <Link
              href={tile.href}
              className={cn(
                'group relative isolate flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-2xl border bg-card',
                used ? 'border-border' : 'border-primary/40',
              )}
            >
              {tile.image && (
                <Image
                  src={tile.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 270px, 100vw"
                  className={cn('-z-10 object-cover transition-transform duration-500 group-hover:scale-105', used && 'opacity-50 grayscale')}
                />
              )}
              <span aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/20 to-transparent" />
              <span className="p-3">
                <span className="inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-[11px] font-semibold backdrop-blur">
                  {nextAt !== null ? (
                    <>
                      <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
                      <span className="tabular-nums text-muted-foreground">{untilLabel(nextAt)}</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-3 text-[oklch(0.72_0.17_150)]" aria-hidden="true" />
                      <span className="text-[oklch(0.72_0.17_150)]">Hazır</span>
                    </>
                  )}
                </span>
              </span>
              <span className="flex items-center justify-between gap-2 p-3">
                <span className="font-display text-base font-bold text-foreground">{tile.title}</span>
                {used ? (
                  <span className="rounded-md border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground">Kullanıldı</span>
                ) : (
                  <span className="rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">{tile.action}</span>
                )}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function WalletCard({
  balance,
  kp,
  weeklyRank,
  goal,
  picks,
  marketHref,
}: {
  balance: number
  kp: number | null
  weeklyRank: number | null
  goal: MarketProduct | null
  picks: MarketProduct[]
  marketHref: string
}) {
  const pct = goal ? Math.min(100, Math.round((balance / Math.max(1, goal.price)) * 100)) : 0
  return (
    <section aria-label="Bakiyen" className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative isolate flex flex-col gap-3 border-b border-border p-5">
        <span aria-hidden="true" className="absolute -left-10 -top-20 -z-10 size-56 rounded-full bg-primary/20 blur-3xl" />
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(var(--primary)_1px,transparent_1px)] [background-size:14px_14px]"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bakiyen</p>
          <Wallet className="size-4 text-primary" aria-hidden="true" />
        </div>
        <p className="flex items-center gap-3 font-display text-4xl font-bold tabular-nums text-foreground">
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground shadow-[0_0_24px_-4px_var(--primary)] ring-4 ring-primary/20"
          >
            KC
          </span>
          {fmt(balance)}
          <span className="sr-only">Kanka Coin</span>
        </p>
        {kp !== null && (
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur">
              <Star className="size-3.5 text-primary" aria-hidden="true" />
              {fmt(kp)} KP
            </span>
            {weeklyRank && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <Trophy className="size-3.5" aria-hidden="true" />
                Haftalık {weeklyRank}.
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 px-5 pb-5">
      {goal && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-3">
          <div className="flex items-center gap-3">
            <span className="relative size-11 shrink-0 overflow-hidden rounded-lg">
              <Image src={productImage(goal)} alt="" fill sizes="44px" className="object-cover" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Sıradaki hedefin</span>
              <span className="truncate text-sm font-semibold text-foreground">{goal.name}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Hedefe ilerleme">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {fmt(balance)} / {fmt(goal.price)} KC
            </span>
            <span className="font-bold text-foreground">{balance >= goal.price ? 'Alabilirsin' : `${fmt(goal.price - balance)} KC kaldı`}</span>
          </div>
        </div>
      )}

      {picks.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-[oklch(0.72_0.17_150)]" aria-hidden="true" />
            Şimdi alabileceklerin
          </p>
          <ul className="flex flex-col gap-2">
            {picks.map((p) => (
              <li key={p.id}>
                <Link
                  href="/market"
                  className="group flex items-center gap-3 rounded-xl border border-border bg-background/40 p-2 pr-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-lg">
                    <Image src={productImage(p)} alt="" fill sizes="48px" className="object-cover transition-transform duration-500 group-hover:scale-110" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-foreground">{p.name}</span>
                    <span className="flex items-center gap-1 text-xs font-bold text-primary">
                      <span aria-hidden="true" className="flex size-3.5 items-center justify-center rounded-full bg-primary text-[6px] font-black text-primary-foreground">
                        KC
                      </span>
                      {fmt(p.price)}
                      <span className="sr-only">Kanka Coin</span>
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href={marketHref}
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-[0_10px_30px_-14px_var(--primary)] transition-transform hover:-translate-y-0.5"
      >
        <ShoppingBag className="size-4" aria-hidden="true" />
        {"Market'e git"}
      </Link>
      </div>
    </section>
  )
}
