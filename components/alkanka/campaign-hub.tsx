'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BadgePercent, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BonusBoard, CampaignBoard } from './partner-sites'
import { Events } from './events'
import { useCatalog } from './catalog-context'

const TABS = [
  { id: 'etkinlikler', label: 'AL KANKA etkinlikleri', icon: PartyPopper },
  { id: 'bonuslar', label: 'Sponsor site bonusları', icon: BadgePercent },
] as const

type TabId = (typeof TABS)[number]['id']

export function CampaignHub() {
  const catalog = useCatalog()
  const counts = {
    etkinlikler: catalog.events.length,
    bonuslar: catalog.bonuses.length + catalog.campaigns.length,
  }
  const params = useSearchParams()
  const router = useRouter()
  const initial: TabId = params.get('sekme') === 'bonuslar' ? 'bonuslar' : 'etkinlikler'
  const [tab, setTab] = useState<TabId>(initial)

  const select = (id: TabId) => {
    setTab(id)
    router.replace(id === 'etkinlikler' ? '/kampanyalar' : `/kampanyalar?sekme=${id}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Kampanya türü"
        className="seg-switch grid grid-cols-2 rounded-full border border-border/70 bg-card p-1"
      >
        <span
          aria-hidden="true"
          className="seg-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary"
          style={{ transform: `translateX(${tab === 'bonuslar' ? '100%' : '0%'})` }}
        />
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`kampanya-${t.id}`}
              onClick={() => select(t.id)}
              className={cn(
                'seg-tab flex h-11 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-[13px] font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-12 sm:text-sm',
                active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="seg-icon size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t.label}</span>
              <span
                className={cn(
                  'hidden text-xs tabular-nums transition-opacity duration-300 sm:inline',
                  active ? 'opacity-60' : 'opacity-50',
                )}
              >
                {counts[t.id]}
              </span>
            </button>
          )
        })}
      </div>

      {tab === 'etkinlikler' ? (
        <div id="kampanya-etkinlikler" role="tabpanel">
          <Events view="biletler" />
        </div>
      ) : (
        <div id="kampanya-bonuslar" role="tabpanel" className="flex flex-col gap-10">
          <BonusBoard />
          <CampaignBoard />
        </div>
      )}
    </div>
  )
}
