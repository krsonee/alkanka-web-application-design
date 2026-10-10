'use client'

import { useState } from 'react'
import { ArrowUpRight, Flame, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PARTNER_SITES, SITE_TABS, type SiteCategory } from './data'
import { SectionHeading } from './section-heading'

const CATEGORY_LABEL: Record<SiteCategory, string> = {
  ozel: 'Özel bonus',
  trafik: 'Trafik boost',
  vip: 'VIP ödül',
  oran: 'Özel oran',
}

export function PartnerSites() {
  const [tab, setTab] = useState<(typeof SITE_TABS)[number]['id']>('all')
  const list = tab === 'all' ? PARTNER_SITES : PARTNER_SITES.filter((s) => s.category === tab)

  return (
    <section id="siteler" aria-labelledby="siteler-title" className="flex scroll-mt-20 flex-col gap-5">
      <SectionHeading
        id="siteler-title"
        title="Siteler & Kampanyalar"
        description="Her gün kontrol edilen partner siteler. Sadece AL KANKA linkiyle gelenlere özel bonus, boost ve oranlar."
      />

      <div role="tablist" aria-label="Kampanya kategorileri" className="flex gap-2 overflow-x-auto no-scrollbar">
        {SITE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
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

      <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {list.map((site) => (
          <li key={site.id} className="panel-gold group flex flex-col gap-4 rounded-xl p-4 transition-colors hover:border-primary/60">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-background font-display text-sm font-bold text-primary">
                {site.initials}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  {site.name}
                  {site.hot && <Flame className="size-3.5 text-destructive" aria-label="Popüler" />}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
                  {site.rating.toFixed(1)}
                  <span aria-hidden="true">·</span>
                  {CATEGORY_LABEL[site.category]}
                </span>
              </div>
              <span className="rounded-md border border-primary/40 px-2 py-1 font-display text-sm font-bold text-primary">
                {site.multiplier}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">{site.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{site.description}</p>
            </div>

            <div className="mt-auto flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Kontenjan</span>
                <span className="tabular-nums">%{site.claimed} doldu</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-background" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${site.claimed}%` }} />
              </div>
            </div>

            <a
              href="#kayit"
              className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
            >
              Siteye git
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
