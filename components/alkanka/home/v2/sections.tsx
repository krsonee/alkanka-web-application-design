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
  Star,
  Swords,
  Target,
  Ticket,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TourButton } from '@/components/alkanka/app/site-tour'
import { HOME_GAME_LABEL, type DailyTile, type FreeTile, type PromoCard, type RailLink } from '@/lib/home-v2-shared'
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
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 pb-1">
        <h2 className="font-display text-base font-bold text-foreground">{title}</h2>
        {compact ? (
          <Link href="/siralama" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Tümü
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : (
          note && <span className="text-xs text-muted-foreground">{note}</span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Bu hafta henüz puan yok. İlk sen ol.</p>
      ) : (
        <ol className="flex flex-col">
          {rows.map((r, i) => (
            <LbRow key={r.userId} rank={i + 1} name={r.name} points={r.points} mine={r.userId === meId} />
          ))}
          {showMe && <LbRow rank={me.rank} name="Sen" points={me.points} mine />}
        </ol>
      )}
      {!compact && (
        <Link href="/siralama" className="mt-1 inline-flex h-9 items-center justify-center rounded-lg border border-border text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
          Tüm sıralama
        </Link>
      )}
    </section>
  )
}

function LbRow({ rank, name, points, mine }: { rank: number; name: string; points: number; mine?: boolean }) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 border-b border-border py-2.5 last:border-b-0',
        mine && 'rounded-lg border border-primary/40 bg-primary/10 px-2',
      )}
    >
      <span className="w-6 text-sm font-semibold text-muted-foreground">{rank}</span>
      <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-[11px] font-bold uppercase text-foreground">
        {name.charAt(0)}
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-sm', mine ? 'font-semibold text-primary' : 'text-foreground')}>{name}</span>
      <span className={cn('text-sm font-bold', mine ? 'text-primary' : 'text-foreground')}>{fmt(points)} KP</span>
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
                  {used ? (
                    <>
                      <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
                      <span className="text-muted-foreground">Yarın</span>
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
    <section aria-label="Bakiyen" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Bakiyen</p>
        <p className="flex items-center gap-2.5 font-display text-4xl font-bold text-foreground">
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
            KC
          </span>
          {fmt(balance)}
          <span className="sr-only">Kanka Coin</span>
        </p>
        {kp !== null && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{fmt(kp)} KP</span>
            {weeklyRank ? ` · Haftalık sıralamada ${weeklyRank}.` : ''}
          </p>
        )}
      </div>

      {goal && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-3">
          <div className="flex items-center gap-3">
            {goal.image && (
              <span className="relative size-11 shrink-0 overflow-hidden rounded-lg">
                <Image src={goal.image} alt="" fill sizes="44px" className="object-cover" />
              </span>
            )}
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
          <p className="text-xs font-semibold text-muted-foreground">Şimdi alabileceklerin</p>
          <ul className="grid grid-cols-3 gap-2">
            {picks.map((p) => (
              <li key={p.id}>
                <Link href="/market" className="relative flex aspect-square items-end overflow-hidden rounded-lg border border-border bg-background" title={p.name}>
                  {p.image && <Image src={p.image} alt={p.name} fill sizes="90px" className="object-cover" />}
                  <span className="relative m-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-bold text-foreground">{fmt(p.price)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href={marketHref} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
        {"Market'e git"}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  )
}
