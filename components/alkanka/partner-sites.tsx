'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, Check, Clock, Copy, Star, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BONUSES,
  CAMPAIGNS,
  SPECIAL_ODDS,
  SPONSORS,
  TIER_INFO,
  sponsorById,
  type Sponsor,
  type SponsorTier,
} from './data'
import { SectionHeading } from './section-heading'

const TABS = [
  { id: 'sponsorlar', label: 'Sponsorlar' },
  { id: 'bonuslar', label: 'Bonuslar' },
  { id: 'oranlar', label: 'Özel Oranlar' },
  { id: 'kampanyalar', label: 'Kampanyalar' },
] as const

type TabId = (typeof TABS)[number]['id']

const TIER_ORDER: SponsorTier[] = ['ana', 'vip', 'guvenilir']

const HASH_TO_TAB: Record<string, TabId> = {
  siteler: 'sponsorlar',
  bonuslar: 'bonuslar',
  'ozel-oranlar': 'oranlar',
  kampanyalar: 'kampanyalar',
}

export function PartnerSites() {
  const [tab, setTab] = useState<TabId>('sponsorlar')

  useEffect(() => {
    const sync = () => {
      const next = HASH_TO_TAB[window.location.hash.slice(1)]
      if (next) setTab(next)
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return (
    <section id="siteler" aria-labelledby="siteler-title" className="relative flex scroll-mt-20 flex-col gap-5">
      {['bonuslar', 'ozel-oranlar', 'kampanyalar'].map((id) => (
        <span key={id} id={id} aria-hidden="true" className="absolute top-0 scroll-mt-20" />
      ))}
      <SectionHeading
        id="siteler-title"
        title="Sponsorlar & Kampanyalar"
        description="Her gün kontrol edilen sponsor siteler. Bonuslar, özel oranlar ve kampanyalar sadece AL KANKA linkiyle gelenlere."
      />

      <div role="tablist" aria-label="Sponsor kategorileri" className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 rounded-lg border px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
              tab === t.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'sponsorlar' && <SponsorTiers />}
        {tab === 'bonuslar' && <BonusList />}
        {tab === 'oranlar' && <OddsList />}
        {tab === 'kampanyalar' && <CampaignList />}
      </div>
    </section>
  )
}

function SponsorTiers() {
  return (
    <div className="flex flex-col gap-6">
      {TIER_ORDER.map((tier) => {
        const list = SPONSORS.filter((s) => s.tier === tier)
        return (
          <div key={tier} className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">{TIER_INFO[tier].label}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{TIER_INFO[tier].description}</p>
            </div>
            {tier === 'ana' ? (
              list.map((s) => <MainSponsor key={s.id} sponsor={s} />)
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                {list.map((s) => (
                  <SponsorCard key={s.id} sponsor={s} />
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SponsorBadge({ sponsor, size = 'md' }: { sponsor: Sponsor; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-background font-display font-bold text-primary',
        size === 'lg' ? 'size-16 text-xl' : 'size-11 text-sm',
      )}
    >
      {sponsor.initials}
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

function MainSponsor({ sponsor }: { sponsor: Sponsor }) {
  return (
    <article className="panel-gold flex flex-col gap-5 rounded-xl p-5 md:flex-row md:items-center">
      <div className="flex items-center gap-4 md:w-72">
        <SponsorBadge sponsor={sponsor} size="lg" />
        <div className="flex flex-col gap-1">
          <span className="font-display text-xl font-bold text-foreground">{sponsor.name}</span>
          <Meta sponsor={sponsor} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <p className="font-display text-2xl font-bold text-primary text-balance">{sponsor.welcome}</p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {sponsor.perks.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <GoButton label="Hemen kayıt ol" className="h-12 md:w-48" />
    </article>
  )
}

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <li className="panel-gold flex flex-col gap-4 rounded-xl p-4 transition-colors hover:border-primary/60">
      <div className="flex items-center gap-3">
        <SponsorBadge sponsor={sponsor} />
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold text-foreground">{sponsor.name}</span>
          <Meta sponsor={sponsor} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-primary">{sponsor.welcome}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{sponsor.perks.join(' · ')}</p>
      </div>
      <GoButton className="mt-auto" />
    </li>
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

function BonusList() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {BONUSES.map((b) => {
        const s = sponsorById(b.sponsorId)
        return (
          <li key={b.id} className="panel-gold flex flex-col gap-3 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{s?.name}</span>
              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{b.type}</span>
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">{b.title}</h3>
            <dl className="flex gap-4 text-xs text-muted-foreground">
              <div className="flex flex-col">
                <dt>Tutar</dt>
                <dd className="font-semibold text-foreground">{b.amount}</dd>
              </div>
              <div className="flex flex-col">
                <dt>Şart</dt>
                <dd className="font-semibold text-foreground">{b.wager}</dd>
              </div>
            </dl>
            <div className="mt-auto flex flex-col gap-2">
              {b.code && <CopyCode code={b.code} />}
              <GoButton label="Bonusu al" />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function OddsList() {
  return (
    <ul className="flex flex-col gap-3">
      {SPECIAL_ODDS.map((o) => {
        const s = sponsorById(o.sponsorId)
        return (
          <li key={o.id} className="panel-gold flex flex-col gap-4 rounded-xl p-4 md:flex-row md:items-center">
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {o.league} · {s?.name}
              </span>
              <span className="font-semibold text-foreground">{o.match}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" aria-hidden="true" />
                {o.kickoff} · {o.limit}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{o.market}</span>
              <span className="text-sm text-muted-foreground line-through tabular-nums">{o.oldOdd.toFixed(2)}</span>
              <ArrowRight className="size-4 text-primary" aria-hidden="true" />
              <span className="rounded-md bg-primary px-2.5 py-1 font-display text-lg font-bold text-primary-foreground tabular-nums">
                {o.newOdd.toFixed(2)}
              </span>
            </div>
            <GoButton label="Oyna" className="md:w-32" />
          </li>
        )
      })}
    </ul>
  )
}

function CampaignList() {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {CAMPAIGNS.map((c) => {
        const s = sponsorById(c.sponsorId)
        return (
          <li key={c.id} className="panel-gold flex overflow-hidden rounded-xl">
            <div className="relative w-32 shrink-0 sm:w-40">
              <Image src={c.image || '/placeholder.svg'} alt="" fill sizes="160px" className="object-cover" />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="rounded-md bg-primary/15 px-2 py-0.5 font-semibold text-primary">{c.tag}</span>
                <span className="text-muted-foreground">{c.ends}</span>
              </div>
              <h3 className="font-semibold text-foreground">{c.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{c.description}</p>
              <div className="mt-auto flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{s?.name}</span>
                <a href="#kayit" className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary hover:underline">
                  Katıl
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
