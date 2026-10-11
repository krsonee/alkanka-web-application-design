'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check, Clock, Copy, LayoutGrid, List, Search, Star, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BONUSES,
  CAMPAIGNS,
  SPECIAL_ODDS,
  SPONSORS,
  TIER_INFO,
  sponsorById,
  type Campaign,
  type Sponsor,
  type SponsorTier,
} from './data'
import { JakoTip } from './jako'
import { TeamLogo, splitMatch, useLogos } from './logo-context'
import { SectionHeading } from './section-heading'

const payoutMinutes = (s: Sponsor) => Number.parseInt(s.payout, 10) || 99

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span className={cn('rounded px-1 text-[10px] tabular-nums', active ? 'bg-primary-foreground/15' : 'bg-secondary')}>{n}</span>
  )
}

function LoadMore({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  if (remaining <= 0) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto flex h-11 items-center gap-2 rounded-lg border border-primary/40 px-6 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
    >
      Daha fazla göster
      <span className="rounded bg-primary/15 px-1.5 py-0.5 tabular-nums">{remaining}</span>
    </button>
  )
}

function SponsorBadge({ sponsor, size = 'md' }: { sponsor: Sponsor; size?: 'sm' | 'md' | 'lg' }) {
  const logo = useLogos().sponsors[sponsor.id]
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/30 bg-background font-display font-bold text-primary',
        size === 'lg' ? 'size-16 text-xl' : size === 'sm' ? 'size-9 text-xs' : 'size-11 text-sm',
      )}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos can come from any https host set in the panel
        <img src={logo || '/placeholder.svg'} alt={`${sponsor.name} logosu`} className="size-full object-contain p-1" />
      ) : (
        sponsor.initials
      )}
    </span>
  )
}

export function SponsorLogoPlate({ sponsor, className }: { sponsor: Sponsor; className?: string }) {
  const logo = useLogos().sponsors[sponsor.id]
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logos and GIF banners can come from any https host set in the panel
      <img
        src={logo}
        alt={`${sponsor.name} logosu`}
        className={cn('max-h-full w-auto max-w-[80%] object-contain transition-transform duration-300 group-hover:scale-105', className)}
      />
    )
  }
  return (
    <span className={cn('flex flex-col items-center gap-1 text-center', className)}>
      <span className="font-display text-4xl font-bold tracking-tight text-primary">{sponsor.initials}</span>
      <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-foreground">{sponsor.name}</span>
    </span>
  )
}

function Meta({ sponsor }: { sponsor: Sponsor }) {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
      {sponsor.rating.toFixed(1)}
      <span aria-hidden="true">·</span>
      <Zap className="size-3" aria-hidden="true" />
      {sponsor.payout} çekim
    </span>
  )
}

function GoButton({ label = 'Siteye git', className }: { label?: string; className?: string }) {
  return (
    <a
      href="#kayit"
      className={cn(
        'flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90',
        className,
      )}
    >
      {label}
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </a>
  )
}

function TierTag({ tier }: { tier: SponsorTier }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        tier === 'vip' ? 'bg-primary/15 text-primary' : tier === 'ana' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
      )}
    >
      {tier === 'vip' ? 'VIP' : tier === 'ana' ? 'Ana' : 'Güvenilir'}
    </span>
  )
}

export function MainSponsor({ sponsor = SPONSORS.find((s) => s.tier === 'ana')! }: { sponsor?: Sponsor }) {
  return (
    <article className="panel-gold group flex flex-col overflow-hidden rounded-xl md:flex-row md:items-stretch">
      <div className="relative flex aspect-[16/7] items-center justify-center border-b border-border bg-background p-6 md:aspect-auto md:w-80 md:border-r md:border-b-0">
        <SponsorLogoPlate sponsor={sponsor} className="md:max-h-28" />
        <span className="absolute top-3 left-3">
          <TierTag tier="ana" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-xl font-bold text-foreground">{sponsor.name}</span>
          <Meta sponsor={sponsor} />
        </div>
        <p className="font-display text-2xl font-bold text-primary text-balance">{sponsor.welcome}</p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {sponsor.perks.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
        <GoButton label="Hemen kayıt ol" className="mt-2 h-12 sm:self-start sm:px-8" />
      </div>
    </article>
  )
}

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <li className="panel-gold group flex flex-col overflow-hidden rounded-xl transition-colors hover:border-primary/60">
      <div className="relative flex aspect-[16/8] items-center justify-center border-b border-border bg-background p-4">
        <SponsorLogoPlate sponsor={sponsor} />
        <span className="absolute top-3 right-3">
          <TierTag tier={sponsor.tier} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold text-foreground">{sponsor.name}</span>
          <Meta sponsor={sponsor} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-display text-lg font-bold text-primary">{sponsor.welcome}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{sponsor.perks.join(' · ')}</p>
        </div>
        <GoButton className="mt-auto" />
      </div>
    </li>
  )
}

function SponsorRow({ sponsor, rank }: { sponsor: Sponsor; rank: number }) {
  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-secondary/40">
      <span className="w-6 shrink-0 text-center font-display text-sm font-bold text-muted-foreground tabular-nums">{rank}</span>
      <SponsorBadge sponsor={sponsor} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col sm:w-48 sm:flex-none">
        <span className="flex items-center gap-2 truncate font-semibold text-foreground">
          {sponsor.name}
          <TierTag tier={sponsor.tier} />
        </span>
        <span className="text-xs text-muted-foreground sm:hidden">{sponsor.welcome}</span>
      </div>
      <span className="hidden flex-1 text-sm font-semibold text-primary sm:block">{sponsor.welcome}</span>
      <span className="hidden w-16 items-center gap-1 text-sm text-foreground md:flex">
        <Star className="size-3.5 fill-primary text-primary" aria-hidden="true" />
        {sponsor.rating.toFixed(1)}
      </span>
      <span className="hidden w-20 text-sm text-muted-foreground tabular-nums lg:block">{sponsor.payout}</span>
      <GoButton label="Git" className="h-9 px-3" />
    </li>
  )
}

const TIER_FILTERS: { id: 'all' | SponsorTier; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'vip', label: 'VIP' },
  { id: 'guvenilir', label: 'Güvenilir' },
]

const SORTS = [
  { id: 'onerilen', label: 'Önerilen' },
  { id: 'puan', label: 'En yüksek puan' },
  { id: 'cekim', label: 'En hızlı çekim' },
  { id: 'az', label: 'A → Z' },
] as const

const PAGE = 12

export function SponsorDirectory() {
  const [tier, setTier] = useState<'all' | SponsorTier>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<(typeof SORTS)[number]['id']>('onerilen')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [visible, setVisible] = useState(PAGE)

  const pool = SPONSORS.filter((s) => s.tier !== 'ana')
  const counts = {
    all: pool.length,
    vip: pool.filter((s) => s.tier === 'vip').length,
    guvenilir: pool.filter((s) => s.tier === 'guvenilir').length,
    ana: 0,
  }

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr')
    const filtered = pool.filter(
      (s) =>
        (tier === 'all' || s.tier === tier) &&
        (!q || s.name.toLocaleLowerCase('tr').includes(q) || s.welcome.toLocaleLowerCase('tr').includes(q)),
    )
    if (sort === 'puan') return [...filtered].sort((a, b) => b.rating - a.rating)
    if (sort === 'cekim') return [...filtered].sort((a, b) => payoutMinutes(a) - payoutMinutes(b))
    if (sort === 'az') return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    return filtered
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, query, sort])

  const shown = list.slice(0, visible)

  function update<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setVisible(PAGE)
    }
  }

  return (
    <section aria-labelledby="dizin-title" className="flex flex-col gap-4">
      <SectionHeading
        id="dizin-title"
        title="Tüm sponsorlar"
        description={`${pool.length} sponsor, her gün kontrol ediliyor. Kategoriye göre filtrele, ara veya sırala.`}
      />

      <div className="sticky top-16 z-20 -mx-1 flex flex-col gap-3 rounded-xl border border-border bg-surface/95 p-3 backdrop-blur-md lg:flex-row lg:items-center">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {TIER_FILTERS.map((f) => (
            <Chip key={f.id} active={tier === f.id} onClick={() => update(setTier)(f.id)}>
              {f.label}
              <Count n={counts[f.id]} active={tier === f.id} />
            </Chip>
          ))}
        </div>
        <label className="relative flex-1">
          <span className="sr-only">Sponsor ara</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => update(setQuery)(e.target.value)}
            placeholder="Site adı veya bonus ara…"
            className="h-9 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
        </label>
        <div className="flex items-center gap-2">
          <label className="flex-1 lg:flex-none">
            <span className="sr-only">Sırala</span>
            <select
              value={sort}
              onChange={(e) => update(setSort)(e.target.value as typeof sort)}
              className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Görünüm">
            {(['grid', 'list'] as const).map((v) => {
              const Icon = v === 'grid' ? LayoutGrid : List
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  aria-label={v === 'grid' ? 'Kart görünümü' : 'Liste görünümü'}
                  onClick={() => setView(v)}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-md transition-colors',
                    view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {tier !== 'all' && <p className="text-sm leading-relaxed text-muted-foreground">{TIER_INFO[tier].description}</p>}

      {list.length === 0 ? (
        <JakoTip pose="uzgun" title="Bulamadım kanka">
          “{query}” ile eşleşen sponsor yok. Başka bir isim dene veya filtreyi temizle.
        </JakoTip>
      ) : view === 'grid' ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map((s) => (
            <SponsorCard key={s.id} sponsor={s} />
          ))}
        </ul>
      ) : (
        <ul className="panel-gold overflow-hidden rounded-xl">
          {shown.map((s, i) => (
            <SponsorRow key={s.id} sponsor={s} rank={i + 1} />
          ))}
        </ul>
      )}

      <p className="text-center text-xs text-muted-foreground tabular-nums">
        {list.length} sponsordan {shown.length} tanesi gösteriliyor
      </p>
      <LoadMore remaining={list.length - shown.length} onClick={() => setVisible((v) => v + PAGE)} />
    </section>
  )
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="flex h-9 items-center justify-between gap-2 rounded-lg border border-dashed border-primary/50 bg-background px-3 font-mono text-xs font-bold tracking-wider text-primary"
      aria-label={`${code} kodunu kopyala`}
    >
      {code}
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
    </button>
  )
}

export function BonusBoard() {
  const types = ['Tümü', ...Array.from(new Set(BONUSES.map((b) => b.type)))]
  const [type, setType] = useState('Tümü')
  const list = BONUSES.filter((b) => type === 'Tümü' || b.type === type)

  return (
    <section aria-label="Bonus listesi" className="flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {types.map((t) => (
          <Chip key={t} active={type === t} onClick={() => setType(t)}>
            {t}
            <Count n={t === 'Tümü' ? BONUSES.length : BONUSES.filter((b) => b.type === t).length} active={type === t} />
          </Chip>
        ))}
      </div>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((b) => {
          const s = sponsorById(b.sponsorId)
          return (
            <li key={b.id} className="panel-gold group flex flex-col overflow-hidden rounded-xl">
              <div className="relative flex aspect-[16/7] items-center justify-center border-b border-border bg-background p-4">
                {s && <SponsorLogoPlate sponsor={s} />}
                <span className="absolute top-3 left-3 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  {b.type}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-muted-foreground">{s?.name}</span>
                  <h3 className="font-display text-lg font-bold text-foreground">{b.title}</h3>
                </div>
                <dl className="flex gap-6 text-xs text-muted-foreground">
                  <div className="flex flex-col">
                    <dt>Tutar</dt>
                    <dd className="font-semibold text-foreground">{b.amount}</dd>
                  </div>
                  <div className="flex flex-col">
                    <dt>Şart</dt>
                    <dd className="font-semibold text-foreground">{b.wager}</dd>
                  </div>
                </dl>
                <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                  {b.code && (
                    <div className="sm:flex-1">
                      <CopyCode code={b.code} />
                    </div>
                  )}
                  <GoButton label="Bonusu al" className="h-9 sm:flex-1" />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function OddsBoard() {
  const leagues = Array.from(new Set(SPECIAL_ODDS.map((o) => o.league)))
  return (
    <section aria-label="Özel oranlar" className="flex flex-col gap-6">
      {leagues.map((league) => (
        <div key={league} className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-accent">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            {league}
          </h2>
          <ul className="panel-gold overflow-hidden rounded-xl">
            {SPECIAL_ODDS.filter((o) => o.league === league).map((o) => {
              const s = sponsorById(o.sponsorId)
              const boost = Math.round((o.newOdd / o.oldOdd - 1) * 100)
              return (
                <li key={o.id} className="flex flex-col gap-4 border-b border-border p-4 last:border-0 md:flex-row md:items-center">
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex shrink-0 -space-x-2">
                        {splitMatch(o.match)
                          .filter(Boolean)
                          .map((team) => (
                            <TeamLogo key={team} name={team} className="ring-2 ring-card" />
                          ))}
                      </span>
                      <span className="font-display text-lg font-bold text-foreground text-pretty">{o.match}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <Clock className="size-3" aria-hidden="true" />
                      {o.kickoff}
                      <span aria-hidden="true">·</span>
                      {o.limit}
                      <span aria-hidden="true">·</span>
                      {s?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-background px-3 py-2">
                    <span className="text-sm text-muted-foreground">{o.market}</span>
                    <span className="text-sm text-muted-foreground line-through tabular-nums">{o.oldOdd.toFixed(2)}</span>
                    <ArrowRight className="size-4 text-primary" aria-hidden="true" />
                    <span className="rounded-md bg-primary px-2.5 py-1 font-display text-lg font-bold text-primary-foreground tabular-nums">
                      {o.newOdd.toFixed(2)}
                    </span>
                    <span className="text-xs font-bold text-live tabular-nums">+%{boost}</span>
                  </div>
                  <GoButton label="Oyna" className="md:w-28" />
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}

function CampaignCard({ c }: { c: Campaign }) {
  const s = sponsorById(c.sponsorId)
  const urgent = c.hoursLeft <= 24
  return (
    <li className="panel-gold group flex flex-col overflow-hidden rounded-xl">
      <div className="relative aspect-[16/9] overflow-hidden">
        <Image
          src={c.image || '/placeholder.svg'}
          alt=""
          fill
          sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute top-3 left-3 rounded-md bg-background/90 px-2 py-0.5 text-xs font-semibold text-primary">{c.tag}</span>
        <span
          className={cn(
            'absolute top-3 right-3 flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold',
            urgent ? 'bg-destructive text-foreground' : 'bg-background/90 text-foreground',
          )}
        >
          <Clock className="size-3" aria-hidden="true" />
          {c.ends}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold text-foreground">{c.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{c.description}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-xs text-muted-foreground">{s?.name}</span>
          <a href="#kayit" className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary hover:underline">
            Katıl
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </li>
  )
}

const CAMPAIGN_PAGE = 6

export function CampaignBoard() {
  const tags = ['Tümü', ...Array.from(new Set(CAMPAIGNS.map((c) => c.tag)))]
  const [tag, setTag] = useState('Tümü')
  const [sort, setSort] = useState<'bitis' | 'uzun'>('bitis')
  const [todayOnly, setTodayOnly] = useState(false)
  const [visible, setVisible] = useState(CAMPAIGN_PAGE)

  const featured = CAMPAIGNS[0]
  const rest = CAMPAIGNS.slice(1)
    .filter((c) => (tag === 'Tümü' || c.tag === tag) && (!todayOnly || c.hoursLeft <= 24))
    .sort((a, b) => (sort === 'bitis' ? a.hoursLeft - b.hoursLeft : b.hoursLeft - a.hoursLeft))
  const shown = rest.slice(0, visible)
  const fs = sponsorById(featured.sponsorId)

  return (
    <section aria-label="Kampanyalar" className="flex flex-col gap-6">
      <article className="panel-gold relative isolate flex min-h-80 overflow-hidden rounded-2xl md:min-h-96">
  <div className="absolute inset-x-0 top-0 -z-20 h-56 md:inset-0 md:h-auto">
  <Image src={featured.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 1024px) 1100px, 100vw" className="object-cover object-[65%_center] md:object-center" />
  </div>
  <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-56 bg-gradient-to-t from-card to-transparent to-50% md:inset-0 md:h-auto md:bg-gradient-to-r md:from-card md:via-card/70 md:to-transparent md:to-100%" />
  <div className="flex max-w-xl flex-col justify-end gap-3 p-5 pt-48 sm:p-8 sm:pt-48 md:justify-center md:pt-8">
          <span className="self-start rounded-md bg-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-foreground">
            Haftanın kampanyası
          </span>
          <h2 className="font-display text-2xl font-bold text-foreground text-balance sm:text-3xl">{featured.title}</h2>
          <p className="leading-relaxed text-muted-foreground">{featured.description}</p>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4 text-primary" aria-hidden="true" />
            {featured.ends} · {fs?.name}
          </span>
          <GoButton label="Kampanyaya katıl" className="mt-auto h-12 self-start" />
        </div>
      </article>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 gap-2 overflow-x-auto no-scrollbar">
          {tags.map((t) => (
            <Chip
              key={t}
              active={tag === t}
              onClick={() => {
                setTag(t)
                setVisible(CAMPAIGN_PAGE)
              }}
            >
              {t}
              <Count n={t === 'Tümü' ? CAMPAIGNS.length - 1 : CAMPAIGNS.slice(1).filter((c) => c.tag === t).length} active={tag === t} />
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Chip active={todayOnly} onClick={() => setTodayOnly((v) => !v)}>
            <Clock className="size-3.5" aria-hidden="true" />
            Bugün bitenler
          </Chip>
          <label>
            <span className="sr-only">Sırala</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-8 rounded-lg border border-border bg-card px-3 text-xs text-foreground focus:border-primary/50 focus:outline-none"
            >
              <option value="bitis">Bitmek üzere</option>
              <option value="uzun">En uzun süreli</option>
            </select>
          </label>
        </div>
      </div>

      {shown.length === 0 ? (
        <JakoTip pose="uzgun" title="Şimdilik yok kanka">
          Bu filtreye uyan kampanya kalmadı. Yenileri ilk Telegram’a düşüyor, takipte kal.
        </JakoTip>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <CampaignCard key={c.id} c={c} />
          ))}
        </ul>
      )}
      <LoadMore remaining={rest.length - shown.length} onClick={() => setVisible((v) => v + CAMPAIGN_PAGE)} />
    </section>
  )
}

function SeeAllLink({ href, label = 'Tümünü gör' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 self-start rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary sm:self-auto"
    >
      {label}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  )
}

export function FeaturedSponsors() {
  const vip = SPONSORS.filter((s) => s.tier === 'vip')
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4)
  return (
    <section aria-labelledby="one-cikan-title" className="flex flex-col gap-4">
      <SectionHeading
        id="one-cikan-title"
        title="Öne çıkan sponsorlar"
        description={`Ana sponsor ve en yüksek puanlı VIP siteler. Toplam ${SPONSORS.length} sponsor var.`}
        action={<SeeAllLink href="/sponsorlar" label={`${SPONSORS.length} sponsorun tümü`} />}
      />
      <MainSponsor />
      <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {vip.map((s) => (
          <SponsorCard key={s.id} sponsor={s} />
        ))}
      </ul>
    </section>
  )
}

export function EndingCampaigns() {
  const list = [...CAMPAIGNS].sort((a, b) => a.hoursLeft - b.hoursLeft).slice(0, 3)
  return (
    <section aria-labelledby="biten-title" className="flex flex-col gap-4">
      <SectionHeading
        id="biten-title"
        title="Bitmek üzere"
        description="Süresi dolmadan yetiş kanka."
        action={<SeeAllLink href="/kampanyalar" label={`${CAMPAIGNS.length} kampanyanın tümü`} />}
      />
      <ul className="grid gap-4 md:grid-cols-3">
        {list.map((c) => (
          <CampaignCard key={c.id} c={c} />
        ))}
      </ul>
    </section>
  )
}
