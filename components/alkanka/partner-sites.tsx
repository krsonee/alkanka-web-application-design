'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check, CircleSlash, Clock, Copy, Crown, Gem, LayoutGrid, List, ScrollText, Search, ShieldCheck, SlidersHorizontal, Star, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCatalog } from './catalog-context'
import {
  SPECIAL_ODDS,
  TIER_INFO,
  sponsorById,
  tierRank,
  type Bonus,
  type Campaign,
  type Sponsor,
  type SponsorTier,
} from './data'
import { DetailModal, type DetailContent } from './detail-modal'
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

function sponsorLogo(sponsor: Sponsor, mapped?: string) {
  return sponsor.logoUrl?.trim() || mapped || ''
}

function SponsorBadge({ sponsor, size = 'md' }: { sponsor: Sponsor; size?: 'sm' | 'md' | 'lg' }) {
  const logo = sponsorLogo(sponsor, useLogos().sponsors[sponsor.id])
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

export function SponsorLogoPlate({ sponsor, className, compact }: { sponsor: Sponsor; className?: string; compact?: boolean }) {
  const logo = sponsorLogo(sponsor, useLogos().sponsors[sponsor.id])
  if (!logo && compact) {
    return (
      <span className={cn('flex items-center justify-center rounded-lg bg-background font-display text-2xl font-bold tracking-tight text-primary', className)}>
        {sponsor.initials}
      </span>
    )
  }
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

const validPayout = (payout: string) => /\d/.test(payout) ? payout.trim() : ''

function Meta({ sponsor }: { sponsor: Sponsor }) {
  const payout = validPayout(sponsor.payout)
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
      <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
      {sponsor.rating.toFixed(1)}
      {payout && (
        <>
          <span aria-hidden="true">·</span>
          <Zap className="size-3" aria-hidden="true" />
          {payout} çekim
        </>
      )}
    </span>
  )
}

const TIER_FRAME: Partial<Record<SponsorTier, string>> = {
  ana: 'border-primary/60 shadow-[0_0_24px_-12px] shadow-primary/70',
  elit: 'border-foreground/25',
}

function GoButton({ label = 'Siteye git', className, site }: { label?: string; className?: string; site?: string }) {
  return (
    <a
      href={site ? `/git/${site}` : '#kayit'}
      rel={site ? 'nofollow sponsored' : undefined}
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

const TIER_TAG: Record<SponsorTier, { label: string; Icon: typeof Star; className: string }> = {
  ana: {
    label: 'Ana sponsor',
    Icon: Crown,
    className: 'tier-shine bg-primary text-primary-foreground shadow-[0_0_18px_-2px] shadow-primary/70 ring-1 ring-primary',
  },
  elit: {
    label: 'Elit sponsor',
    Icon: Gem,
    className: 'bg-primary/25 text-primary ring-1 ring-primary/80 shadow-[0_0_12px_-3px] shadow-primary/60 motion-safe:animate-glow',
  },
  vip: { label: 'VIP sponsor', Icon: Star, className: 'bg-primary/12 text-primary ring-1 ring-primary/40' },
  guvenilir: { label: 'Güvenilir', Icon: ShieldCheck, className: 'bg-secondary text-foreground/80 ring-1 ring-border' },
  degil: { label: 'Sponsor değil', Icon: CircleSlash, className: 'bg-transparent text-muted-foreground ring-1 ring-dashed ring-border' },
}

export function TierTag({ tier, className }: { tier: SponsorTier; className?: string }) {
  const { label, Icon, className: tone } = TIER_TAG[tier]
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center gap-1 overflow-hidden rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap',
        tone,
        className,
      )}
    >
      <Icon className={cn('size-3', (tier === 'ana' || tier === 'vip') && 'fill-current')} aria-hidden="true" />
      {label}
    </span>
  )
}

function MainSponsorCompact({ sponsor }: { sponsor: Sponsor }) {
  return (
    <article className="bonus-aura rounded-xl p-px">
      <div className="relative isolate flex items-center gap-3 overflow-hidden rounded-[calc(var(--radius)*1.6)] p-3 sm:gap-5 sm:p-4">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full overflow-hidden sm:w-2/3">
          <Image
            src="/images/campaign-art/sponsor-strip.png"
            alt=""
            fill
            sizes="(min-width: 640px) 66vw, 100vw"
            className="sponsor-strip-art object-cover object-right opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/80 to-card/10" />
        </div>
        <span aria-hidden className="bonus-sheen" />

        <div className="sponsor-logo-plate relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl px-2 py-1.5 h-14 w-24 sm:h-20 sm:w-40 sm:px-4">
          <SponsorLogoPlate sponsor={sponsor} compact className="max-h-full max-w-full text-lg drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-display text-sm font-bold text-foreground sm:text-base">{sponsor.name}</span>
            <TierTag tier={sponsor.tier} className="px-1 text-[9px]" />
          </span>
          <p className="line-clamp-1 font-display text-base font-bold text-primary sm:text-xl">{sponsor.welcome}</p>
          <ul className="hidden min-w-0 flex-wrap gap-1.5 md:flex">
            {sponsor.perks.slice(0, 3).map((p) => (
              <li
                key={p}
                className="flex max-w-56 min-w-0 items-center gap-1 rounded-full border border-primary/25 bg-background/60 px-2 py-0.5 text-[11px] text-foreground/80 backdrop-blur"
              >
                <Check className="size-3 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <GoButton site={sponsor.id} label="Kayıt ol" className="h-9 shrink-0 px-3 shadow-[0_6px_20px_-8px] shadow-primary sm:h-11 sm:px-6" />
      </div>
    </article>
  )
}

export function MainSponsor({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="@container">
    <article className="panel-gold border-flow group flex flex-col overflow-hidden rounded-xl @2xl:flex-row @2xl:items-stretch">
      <div className="relative flex h-24 items-center justify-center border-b border-border bg-background p-3 sm:h-32 sm:p-5 @2xl:h-auto @2xl:w-56 @2xl:border-r @2xl:border-b-0 @5xl:w-72">
        <SponsorLogoPlate sponsor={sponsor} className="max-h-14 sm:max-h-20 md:max-h-24" />
        <span className="absolute top-2 left-2 sm:top-3 sm:left-3">
          <TierTag tier={sponsor.tier} />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4 sm:gap-2 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-lg font-bold text-foreground sm:text-xl">{sponsor.name}</span>
          <Meta sponsor={sponsor} />
        </div>
        <p className="font-display text-xl font-bold text-primary text-balance sm:text-2xl">{sponsor.welcome}</p>
        <ul className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2">
          {sponsor.perks.slice(0, 4).map((p) => (
            <li key={p} className="flex min-w-0 items-center gap-2 overflow-hidden text-sm text-muted-foreground">
              <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="block min-w-0 flex-1 truncate">{p}</span>
            </li>
          ))}
        </ul>
        <GoButton site={sponsor.id} label="Hemen kayıt ol" className="mt-1.5 h-11 sm:mt-2 sm:h-12 sm:self-start sm:px-8" />
      </div>
      <div className="relative hidden min-h-56 overflow-hidden bg-background @3xl:block @3xl:w-64 @5xl:w-96">
        <Image
          src="/images/mascots/jako-kazandi.png"
          alt=""
          fill
          sizes="384px"
          className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
        />
        <div aria-hidden className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-card to-transparent" />
        <p className="absolute right-4 bottom-4 max-w-52 rounded-xl rounded-br-sm border border-primary/40 bg-background/85 px-3 py-2 text-xs leading-relaxed text-foreground backdrop-blur">
          <b className="text-primary">Jako diyor ki:</b> Kanka, bu linkten gelen {sponsor.welcome.toLocaleLowerCase('tr-TR')} kapıyor!
        </p>
      </div>
    </article>
    </div>
  )
}

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <li className={cn('panel-gold group overflow-hidden rounded-xl transition-colors hover:border-primary/60', TIER_FRAME[sponsor.tier])}>
      <div className="flex items-center gap-3 p-3 sm:hidden">
        <Link
          href={`/siteler/${sponsor.id}`}
          aria-label={`${sponsor.name} detayları`}
          className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background p-1.5"
        >
          <SponsorLogoPlate sponsor={sponsor} compact className="max-w-full max-h-full text-base" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-semibold text-foreground">{sponsor.name}</span>
            <TierTag tier={sponsor.tier} className="px-1 text-[9px]" />
          </span>
          <span className="truncate text-sm font-bold text-primary">{sponsor.welcome}</span>
          <Meta sponsor={sponsor} />
        </div>
        <GoButton site={sponsor.id} label="Git" className="h-9 shrink-0 px-3" />
      </div>

      <div className="hidden h-full flex-col sm:flex">
      <div className="relative flex h-28 items-center justify-center border-b border-border bg-background p-4">
        <SponsorLogoPlate sponsor={sponsor} className="max-h-16" />
        <span className="absolute top-2.5 right-2.5">
          <TierTag tier={sponsor.tier} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold text-foreground">{sponsor.name}</span>
          <Meta sponsor={sponsor} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate font-display text-base font-bold text-primary">{sponsor.welcome}</p>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{sponsor.perks.join(' · ')}</p>
        </div>
        <div className="mt-auto flex gap-2">
          <Link
            href={`/siteler/${sponsor.id}`}
            className="flex h-10 items-center justify-center rounded-lg border border-border px-3 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-secondary"
          >
            İncele
          </Link>
          <GoButton site={sponsor.id} className="flex-1" />
        </div>
      </div>
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
          <Link href={`/siteler/${sponsor.id}`} className="hover:text-primary">{sponsor.name}</Link>
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
      <GoButton site={sponsor.id} label="Git" className="h-9 px-3" />
    </li>
  )
}

const TIER_FILTERS: { id: 'all' | SponsorTier; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'ana', label: 'Ana sponsor' },
  { id: 'elit', label: 'Elit' },
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

export function SponsorDirectory({ sponsors = [] }: { sponsors?: Sponsor[]; mainId?: string }) {
  const [tier, setTier] = useState<'all' | SponsorTier>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<(typeof SORTS)[number]['id']>('onerilen')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [visible, setVisible] = useState(PAGE)
  const [toolsOpen, setToolsOpen] = useState(false)

  const pool = useMemo(
    () => sponsors.filter((s) => s.tier !== 'degil').sort((a, b) => tierRank(a.tier) - tierRank(b.tier)),
    [sponsors],
  )
  const counts: Record<'all' | SponsorTier, number> = {
    all: pool.length,
    ana: pool.filter((s) => s.tier === 'ana').length,
    elit: pool.filter((s) => s.tier === 'elit').length,
    vip: pool.filter((s) => s.tier === 'vip').length,
    guvenilir: pool.filter((s) => s.tier === 'guvenilir').length,
    degil: 0,
  }
  const filters = TIER_FILTERS.filter((f) => f.id === 'all' || counts[f.id] > 0)

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
  }, [tier, query, sort, pool])

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

      <div className="-mx-1 flex flex-col gap-2 rounded-xl border border-border bg-surface/95 p-2 backdrop-blur-md lg:sticky lg:top-16 lg:z-20 lg:flex-row lg:items-center lg:gap-3 lg:p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto no-scrollbar">
            {filters.map((f) => (
              <Chip key={f.id} active={tier === f.id} onClick={() => update(setTier)(tier === f.id ? 'all' : f.id)}>
                {f.label}
                <Count n={counts[f.id]} active={tier === f.id} />
              </Chip>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setToolsOpen((o) => !o)}
            aria-expanded={toolsOpen}
            aria-controls="sponsor-tools"
            aria-label="Arama ve sıralama"
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors lg:hidden',
              toolsOpen || query ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card text-muted-foreground',
            )}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div id="sponsor-tools" className={cn('flex-col gap-2 lg:flex lg:flex-1 lg:flex-row lg:items-center lg:gap-3', toolsOpen ? 'flex' : 'hidden')}>
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
      </div>

      {tier !== 'all' && <p className="text-sm leading-relaxed text-muted-foreground">{TIER_INFO[tier].description}</p>}

      {sponsors.length === 0 ? (
        <JakoTip pose="uzgun" title="Henüz sponsor yok">
          Şu an listelenecek sponsor yok, yakında burada olacak.
        </JakoTip>
      ) : list.length === 0 ? (
        <JakoTip pose="uzgun" title={pool.length === 0 ? 'Liste burada bitiyor' : 'Bulamadım kanka'}>
          {pool.length === 0
            ? 'Listelenecek sponsor yok.'
            : `“${query}” ile eşleşen sponsor yok. Başka bir isim dene veya filtreyi temizle.`}
        </JakoTip>
      ) : view === 'grid' ? (
        <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
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

function ChipRail({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <div
        role="group"
        aria-label={label}
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:snap-start"
      >
        {children}
      </div>
      <div className="hidden flex-wrap gap-2 md:flex" role="group" aria-label={label}>
        {children}
      </div>
    </div>
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
      <span className="flex items-center gap-2">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kod</span>
        {code}
      </span>
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
    </button>
  )
}

const BONUS_TYPE_RULES: Record<Bonus['type'], { about: string; rules: string[] }> = {
  'Hoş geldin': {
    about: 'Sponsor sitede yeni hesap açan ve ilk yatırımını yapan üyelere tanımlanan hoş geldin bonusu.',
    rules: [
      'Sadece sponsor sitede ilk kez hesap açan yeni üyeler yararlanabilir.',
      'Bonus, ilk yatırım onaylandıktan sonra canlı destekten talep edilmelidir.',
      'Yatırım yapıldıktan sonra bonus alınmadan oyun oynanmamalıdır.',
      'Çevrim yalnızca slot oyunlarında tamamlanır; canlı casino ve spor çevrime sayılmaz.',
    ],
  },
  Yatırım: {
    about: 'Mevcut üyelerin yaptığı yatırımlara eklenen ekstra bakiye bonusu.',
    rules: [
      'Bonus her yatırımda bir kez talep edilebilir.',
      'Yatırım sonrası bakiye kullanılmadan canlı destekten talep edilmelidir.',
      'Aktif başka bir bonus varken yatırım bonusu tanımlanmaz.',
      'Çevrim tamamlanmadan yapılan çekim taleplerinde bonus ve kazancı silinir.',
    ],
  },
  Kayıp: {
    about: 'Belirlenen dönem içindeki net kayıplar üzerinden hesaplanan iade bonusu.',
    rules: [
      'Kayıp, ilgili dönemdeki toplam yatırım eksi toplam çekim üzerinden hesaplanır.',
      'Dönem içinde bonus kullanılan yatırımlar hesaplamaya dahil edilmez.',
      'Bonus, dönem bitiminden sonraki ilk iş günü canlı destekten talep edilir.',
      'Talep sırasında hesap bakiyesinin 5 ₺ altında olması gerekir.',
    ],
  },
  Freespin: {
    about: 'Seçili slot oyunlarında kullanılabilen ücretsiz dönüş hakları.',
    rules: [
      'Freespinler yalnızca sponsorun belirlediği slot oyunlarında geçerlidir.',
      'Haklar tanımlandıktan sonra 24 saat içinde kullanılmalıdır.',
      'Freespin kazançları bonus bakiyesi olarak tanımlanır ve çevrime tabidir.',
      'Tek hesap, tek IP ve tek cihaz kuralı geçerlidir.',
    ],
  },
  Deneme: {
    about: 'Yatırım yapmadan siteyi denemen için verilen ücretsiz başlangıç bakiyesi.',
    rules: [
      'Sadece yeni üyelere ve hesap başına bir kez verilir.',
      'Telefon numarası ve kimlik doğrulaması tamamlanmış olmalıdır.',
      'Deneme bonusundan elde edilebilecek maksimum çekim tutarı sponsor tarafından sınırlandırılır.',
      'Çekim talebinden önce en az bir yatırım yapılması istenebilir.',
    ],
  },
}

const BONUS_COMMON_RULES = [
  'Bonusu almak için siteye AL KANKA üzerindeki “Siteye git” butonuyla gitmelisin.',
  'Çoklu hesap veya kötüye kullanım tespit edilirse bonus ve kazançlar iptal edilir.',
  'Sponsor site, kampanya şartlarını önceden haber vermeksizin değiştirme hakkına sahiptir.',
]

function bonusDetail(b: Bonus, sponsorName?: string): DetailContent {
  const info = BONUS_TYPE_RULES[b.type] ?? { about: 'Sponsor siteye özel bonus.', rules: [] }
  return {
    eyebrow: `${b.type} bonusu · ${sponsorName ?? 'Sponsor'}`,
    title: b.title,
    description: info.about,
    facts: [
      { label: 'Tutar', value: b.amount },
      { label: 'Çevrim şartı', value: b.wager },
      ...(b.code ? [{ label: 'Bonus kodu', value: b.code }] : []),
      { label: 'Sponsor', value: sponsorName ?? '-' },
    ],
    steps: [
      '“Siteye git” butonuyla sponsor siteye geç ve hesabını oluştur.',
      b.code ? `Yatırım ekranında ${b.code} kodunu gir.` : 'Yatırımını yap ve bakiyeyi kullanmadan bekle.',
      'Canlı destekten bonusu talep et, tanımlandıktan sonra oyuna başla.',
    ],
    rules: [...info.rules, ...BONUS_COMMON_RULES],
    note: 'Bonusu talep etmeden oyun oynarsan hak kaybedebilirsin kanka, önce talep et.',
  }
}

function BonusCard({ b, onRules }: { b: Bonus; onRules: () => void }) {
  const s = sponsorById(b.sponsorId)
  return (
    <li className="bonus-aura flex flex-col gap-3 rounded-2xl p-4">
      <span aria-hidden="true" className="bonus-sheen" />
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-primary/30 bg-background">
          {s && <SponsorLogoPlate sponsor={s} compact className="size-full text-base" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              {b.type}
            </span>
            <span className="truncate text-xs font-semibold text-muted-foreground">{s?.name}</span>
          </span>
          <h3 className="font-display text-lg font-bold leading-tight text-foreground text-balance">{b.title}</h3>
        </div>
      </div>

      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-background/70 text-xs">
        <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Tutar</dt>
          <dd className="truncate font-display text-sm font-bold text-primary">{b.amount}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 border-l border-border px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Şart</dt>
          <dd className="truncate font-display text-sm font-bold text-foreground">{b.wager}</dd>
        </div>
      </dl>

      {b.code && <CopyCode code={b.code} />}

      <div className="mt-auto grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRules}
          className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-primary/45 bg-primary/10 px-3 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:border-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <ScrollText className="size-3.5" aria-hidden="true" />
          Kurallar
        </button>
        <GoButton site={b.sponsorId} label="Siteye git" />
      </div>
    </li>
  )
}

export function BonusBoard() {
  const { bonuses: BONUSES } = useCatalog()
  const types = ['Tümü', ...Array.from(new Set(BONUSES.map((b) => b.type)))]
  const [type, setType] = useState('Tümü')
  const [detail, setDetail] = useState<Bonus | null>(null)
  const list = BONUSES.filter((b) => type === 'Tümü' || b.type === type)
  const detailSponsor = detail ? sponsorById(detail.sponsorId) : undefined

  return (
    <section aria-label="Bonus listesi" className="flex flex-col gap-4">
      <ChipRail label="Bonus türleri">
        {types.map((t) => (
          <Chip key={t} active={type === t} onClick={() => setType(type === t ? 'Tümü' : t)}>
            {t}
            <Count n={t === 'Tümü' ? BONUSES.length : BONUSES.filter((b) => b.type === t).length} active={type === t} />
          </Chip>
        ))}
      </ChipRail>
      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {list.map((b) => (
          <BonusCard key={b.id} b={b} onRules={() => setDetail(b)} />
        ))}
      </ul>
      <DetailModal
        onClose={() => setDetail(null)}
        content={detail && bonusDetail(detail, detailSponsor?.name)}
        action={detail && <GoButton site={detail.sponsorId} label="Siteye git" className="h-11 w-full" />}
      />
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
                  <GoButton site={s?.id} label="Oyna" className="md:w-28" />
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}

const CAMPAIGN_TAG_ART: Record<string, string> = {
  Spor: '/images/campaign-art/spor.png',
  Turnuva: '/images/campaign-art/turnuva.png',
  İade: '/images/campaign-art/iade.png',
  Telegram: '/images/campaign-art/telegram.png',
  Yatırım: '/images/campaign-art/yatirim.png',
  Freespin: '/images/campaign-art/freespin.png',
  Çekiliş: '/images/campaign-art/cekilis.png',
}
// Stock placeholder art gets swapped for tag-specific art; custom panel uploads are kept as-is.
const STOCK_CAMPAIGN_ART = /^\/images\/(banner-|tile-|hero-chest)/

function campaignArt(c: Campaign) {
  const tagged = CAMPAIGN_TAG_ART[c.tag]
  if (tagged && (!c.image || STOCK_CAMPAIGN_ART.test(c.image))) return tagged
  return c.image || '/placeholder.svg'
}

function CampaignCard({ c, className }: { c: Campaign; className?: string }) {
  const s = sponsorById(c.sponsorId)
  const urgent = c.hoursLeft <= 24
  return (
    <li
      className={cn(
        'coupon-card group relative flex min-h-40 overflow-hidden rounded-2xl border border-border bg-card transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_16px_36px_-20px] hover:shadow-primary/50',
        className,
      )}
    >
      <div className="relative w-28 shrink-0 overflow-hidden bg-background sm:w-36">
        <div className="coupon-art absolute inset-0">
          <Image
            src={campaignArt(c)}
            alt=""
            fill
            sizes="144px"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
        </div>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-card/70" />
        <span aria-hidden="true" className="coupon-sheen" />
        <span className="absolute bottom-2 left-2 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary backdrop-blur-sm">
          {c.tag}
        </span>
      </div>

      <div aria-hidden="true" className="relative w-0">
        <span className="absolute -top-2 -left-2 size-4 rounded-full border border-border bg-background" />
        <span className="absolute -bottom-2 -left-2 size-4 rounded-full border border-border bg-background" />
        <span className="absolute inset-y-3 left-0 border-l border-dashed border-primary/30" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5 sm:p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background p-0.5">
            {s ? <SponsorLogoPlate sponsor={s} compact className="size-full text-[10px]" /> : null}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s?.name}</span>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
              urgent ? 'bg-destructive/15 text-destructive' : 'bg-secondary text-muted-foreground',
            )}
          >
            {urgent ? <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-destructive" /> : <Clock className="size-3" aria-hidden="true" />}
            {c.ends}
          </span>
        </div>
        <h3 className="line-clamp-2 font-display text-base font-bold leading-snug text-foreground text-pretty">{c.title}</h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
        <div className="mt-auto flex justify-end pt-1">
          <GoButton site={s?.id} label="Katıl" className="h-8 rounded-full px-4 text-[11px]" />
        </div>
      </div>
    </li>
  )
}

const CAMPAIGN_PAGE = 6

export function CampaignBoard() {
  const { campaigns: CAMPAIGNS } = useCatalog()
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
      <article className="panel-gold relative isolate flex overflow-hidden rounded-2xl md:min-h-72">
        <div className="absolute inset-x-0 top-0 -z-20 h-40 md:inset-0 md:h-auto">
          <Image src={featured.image || '/placeholder.svg'} alt="" fill sizes="(min-width: 1024px) 1100px, 100vw" className="object-cover object-[65%_center] md:object-center" />
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-t from-card to-transparent to-60% md:inset-0 md:h-auto md:bg-gradient-to-r md:from-card md:via-card/70 md:to-transparent md:to-100%" />
        <div className="flex max-w-xl flex-col justify-end gap-2.5 p-5 pt-32 sm:gap-3 sm:p-8 sm:pt-32 md:justify-center md:pt-8">
          <span className="self-start rounded-md bg-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-foreground">
            Haftanın kampanyası
          </span>
          <h2 className="font-display text-2xl font-bold text-foreground text-balance sm:text-3xl">{featured.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{featured.description}</p>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4 text-primary" aria-hidden="true" />
            {featured.ends} · {fs?.name}
          </span>
          <GoButton site={fs?.id} label="Kampanyaya katıl" className="mt-2 h-11 w-full sm:w-auto sm:self-start" />
        </div>
      </article>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <ChipRail label="Kampanya etiketleri" className="min-w-0 flex-1">
          {tags.map((t) => (
            <Chip
              key={t}
              active={tag === t}
              onClick={() => {
                setTag(tag === t ? 'Tümü' : t)
                setVisible(CAMPAIGN_PAGE)
              }}
            >
              {t}
              <Count n={t === 'Tümü' ? CAMPAIGNS.length - 1 : CAMPAIGNS.slice(1).filter((c) => c.tag === t).length} active={tag === t} />
            </Chip>
          ))}
        </ChipRail>
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
        <ul className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
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

export function MainSponsorRotator({ sponsors, compact = false }: { sponsors: Sponsor[]; compact?: boolean }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (sponsors.length < 2 || paused) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % sponsors.length), 6000)
    return () => window.clearInterval(timer)
  }, [sponsors.length, paused])

  if (sponsors.length === 0) return null
  const current = sponsors[index % sponsors.length]

  return (
    <div
      className="flex flex-col gap-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Ana sponsorlar"
    >
      <div key={current.id} className="motion-safe:animate-slide-in" aria-live={paused ? 'polite' : 'off'}>
        {compact ? <MainSponsorCompact sponsor={current} /> : <MainSponsor sponsor={current} />}
      </div>
      {sponsors.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {sponsors.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${s.name} sponsorunu göster`}
              aria-current={i === index % sponsors.length}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index % sponsors.length ? 'w-8 bg-primary' : 'w-3 bg-border hover:bg-primary/50',
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FeaturedSponsors({
  main = null,
  mains = [],
  cards = [],
  total = 0,
}: {
  main?: Sponsor | null
  mains?: Sponsor[]
  cards?: Sponsor[]
  total?: number
}) {
  if (!main) return null
  const rotation = mains.length ? mains : [main]
  const extra = cards.filter((s) => !rotation.some((r) => r.id === s.id))
  return (
    <section aria-labelledby="one-cikan-title" className="flex flex-col gap-4">
      <SectionHeading
        id="one-cikan-title"
        title="Öne çıkan sponsorlar"
        description={`Ana sponsor ve önerilen siteler. Toplam ${total} sponsor var.`}
        action={<SeeAllLink href="/sponsorlar" label={`${total} sponsorun tümü`} />}
      />
      <MainSponsorRotator sponsors={rotation} />
      {extra.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {extra.map((s) => (
            <SponsorCard key={s.id} sponsor={s} />
          ))}
        </ul>
      )}
    </section>
  )
}

const SLIDE_GAP = 12

const FALLBACK_IMAGES = ['/images/banner-events.png', '/images/banner-wheel.png', '/images/hero-chest.png', '/images/banner-telegram.png', '/images/wheel-stage.png']

function uniqueImages(list: Campaign[]): Campaign[] {
  const used = new Set<string>()
  return list.map((c) => {
    const image = !used.has(c.image) ? c.image : (FALLBACK_IMAGES.find((src) => !used.has(src)) ?? c.image)
    used.add(image)
    return image === c.image ? c : { ...c, image }
  })
}

export function EndingCampaigns({ showAll = true }: { showAll?: boolean }) {
  const { campaigns: CAMPAIGNS } = useCatalog()
  const list = uniqueImages([...CAMPAIGNS].sort((a, b) => a.hoursLeft - b.hoursLeft).slice(0, 3))
  const trackRef = useRef<HTMLUListElement>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: i * (el.clientWidth + SLIDE_GAP), behavior: 'smooth' })
  }

  useEffect(() => {
    if (paused || list.length < 2) return
    const mobile = window.matchMedia('(max-width: 767px)')
    if (!mobile.matches) return
    const timer = window.setInterval(() => {
      const el = trackRef.current
      if (!el) return
      const current = Math.round(el.scrollLeft / (el.clientWidth + SLIDE_GAP))
      const next = (current + 1) % list.length
      el.scrollTo({ left: next * (el.clientWidth + SLIDE_GAP), behavior: 'smooth' })
    }, 5000)
    return () => window.clearInterval(timer)
  }, [paused, list.length])

  return (
    <section aria-labelledby="biten-title" className="flex flex-col gap-4">
      <SectionHeading
        id="biten-title"
        title="Bitmek üzere"
        description="Süresi dolmadan yetiş kanka."
        action={showAll ? <SeeAllLink href="/kampanyalar?sekme=bonuslar" label={`${CAMPAIGNS.length} kampanyanın tümü`} /> : undefined}
      />
      <ul
        ref={trackRef}
        onScroll={(e) => {
          const el = e.currentTarget
          setActive(Math.round(el.scrollLeft / (el.clientWidth + SLIDE_GAP)))
        }}
        onTouchStart={() => setPaused(true)}
        aria-roledescription="carousel"
        aria-label="Bitmek üzere olan kampanyalar"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto no-scrollbar md:grid md:grid-cols-3 md:gap-4 md:overflow-visible"
      >
        {list.map((c) => (
          <CampaignCard key={c.id} c={c} className="w-full shrink-0 snap-center md:w-auto" />
        ))}
      </ul>
      {list.length > 1 && (
        <div className="flex items-center justify-center gap-2 md:hidden">
          {list.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setPaused(true)
                goTo(i)
              }}
              aria-label={`${i + 1}. kampanyayı göster`}
              aria-current={i === active}
              className={cn('h-1.5 rounded-full transition-all', i === active ? 'w-8 bg-primary' : 'w-3 bg-border')}
            />
          ))}
        </div>
      )}
    </section>
  )
}
