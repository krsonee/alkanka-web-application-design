'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BadgePercent, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BonusBoard, CampaignBoard } from './partner-sites'
import { Events } from './events'
import { BONUSES, CAMPAIGNS, EVENTS } from './data'

const TABS = [
  { id: 'etkinlikler', label: 'AL KANKA etkinlikleri', icon: PartyPopper, count: EVENTS.length },
  { id: 'bonuslar', label: 'Sponsor site bonusları', icon: BadgePercent, count: BONUSES.length + CAMPAIGNS.length },
] as const

type TabId = (typeof TABS)[number]['id']

export function CampaignHub() {
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
      <div role="tablist" aria-label="Kampanya türü" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-1">
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
                'flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold leading-tight transition-colors sm:gap-2 sm:px-3 sm:text-sm sm:uppercase sm:tracking-wider',
                active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="text-balance text-center sm:truncate">{t.label}</span>
              <span className={cn('hidden rounded px-1.5 text-[10px] tabular-nums sm:inline', active ? 'bg-primary-foreground/20' : 'bg-secondary')}>
                {t.count}
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
