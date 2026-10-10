'use client'

import { useState } from 'react'
import { ArrowUpRight, Crown, Flame, Rocket, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionHeading } from './section-heading'
import { CAMPAIGNS, CAMPAIGN_TABS, type Campaign, type CampaignCategory } from './data'

const CATEGORY_ICON: Record<CampaignCategory, typeof Sparkles> = {
  exclusive: Sparkles,
  traffic: Rocket,
  vip: Crown,
}

const CATEGORY_LABEL: Record<CampaignCategory, string> = {
  exclusive: 'Exclusive Bonus',
  traffic: 'Traffic Booster',
  vip: 'VIP Reward',
}

const TONE = {
  cyan: { text: 'text-primary', bg: 'bg-primary', soft: 'bg-primary/10', hover: 'hover:glow-cyan hover:border-primary/40', btn: 'bg-primary text-primary-foreground' },
  purple: { text: 'text-accent', bg: 'bg-accent', soft: 'bg-accent/15', hover: 'hover:glow-purple hover:border-accent/40', btn: 'bg-accent text-accent-foreground' },
  gold: { text: 'text-gold', bg: 'bg-gold', soft: 'bg-gold/10', hover: 'hover:glow-gold hover:border-gold/40', btn: 'bg-gold text-gold-foreground' },
}

function CampaignCard({ campaign, index }: { campaign: Campaign; index: number }) {
  const tone = TONE[campaign.tone]
  const Icon = CATEGORY_ICON[campaign.category]
  return (
    <article
      className={cn(
        'glass group relative flex flex-col gap-5 overflow-hidden rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 animate-rise',
        tone.hover,
      )}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div
        aria-hidden="true"
        className={cn('absolute -top-20 -right-20 size-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-30', tone.bg)}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn('flex size-11 items-center justify-center rounded-xl', tone.soft)}>
            <Icon className={cn('size-5', tone.text)} aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="font-display font-semibold text-foreground">{campaign.partner}</span>
            <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[campaign.category]}</span>
          </div>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 font-display text-sm font-bold', tone.soft, tone.text)}>
          {campaign.multiplier} Bonus
        </span>
      </div>

      <div className="relative flex flex-col gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          {campaign.title}
          {campaign.hot && (
            <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
              <Flame className="size-3" aria-hidden="true" />
              Hot
            </span>
          )}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{campaign.description}</p>
      </div>

      <div className="relative mt-auto flex flex-col gap-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Slots claimed</span>
          <span className="tabular-nums text-foreground">{campaign.claimed}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className={cn('h-full rounded-full', tone.bg)} style={{ width: `${campaign.claimed}%` }} />
        </div>
      </div>

      <a
        href="#partners"
        className={cn(
          'relative flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-transform group-hover:scale-[1.02]',
          tone.btn,
        )}
      >
        Claim offer
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </a>
    </article>
  )
}

export function Campaigns() {
  const [tab, setTab] = useState<(typeof CAMPAIGN_TABS)[number]['id']>('all')
  const filtered = tab === 'all' ? CAMPAIGNS : CAMPAIGNS.filter((c) => c.category === tab)

  return (
    <section id="campaigns" aria-labelledby="campaigns-title" className="relative scroll-mt-20 bg-surface/50">
      <div id="partners" className="mx-auto flex max-w-7xl scroll-mt-20 flex-col gap-10 px-4 py-20 sm:px-6">
        <SectionHeading
          id="campaigns-title"
          eyebrow="Featured Campaigns & Partners"
          title="Hand-picked partner offers with boosted multipliers"
          description="Every campaign is verified by the Alkanka team. Redeem your game points for higher multipliers."
        />

        <div role="tablist" aria-label="Campaign categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {CAMPAIGN_TABS.map((t) => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={active}
                aria-controls="campaign-grid"
                onClick={() => setTab(t.id)}
                className={cn(
                  'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all',
                  active
                    ? 'border-primary bg-primary text-primary-foreground glow-cyan'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <div id="campaign-grid" role="tabpanel" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => (
            <CampaignCard key={`${tab}-${c.id}`} campaign={c} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
