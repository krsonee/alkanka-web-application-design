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
      <div role="tablist" aria-label="Kampanya türü" className="seg-switch grid grid-cols-2 rounded-2xl border border-border p-1.5">
        <span
          aria-hidden="true"
          className="seg-thumb pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-xl"
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
                'seg-tab relative z-10 flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold leading-tight transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-14 sm:gap-2.5 sm:px-3 sm:text-sm sm:uppercase sm:tracking-wider',
                active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'seg-icon flex size-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-300',
                  active ? 'bg-primary-foreground/15' : 'bg-secondary',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="text-balance text-center sm:truncate">{t.label}</span>
              <span
                className={cn(
                  'seg-count hidden min-w-6 rounded-full px-1.5 py-0.5 text-center text-[10px] tabular-nums sm:inline',
                  active ? 'bg-primary-foreground text-primary' : 'bg-secondary text-muted-foreground',
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
