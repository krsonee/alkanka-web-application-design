'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BadgePercent, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BonusBoard, CampaignBoard } from './partner-sites'
import { Events } from './events'
import { JakoTip } from './jako'
import { BONUSES, CAMPAIGNS, EVENTS, type Bonus, type Campaign, type Sponsor } from './data'

export type HubEvent = { id: string; title: string; detail: string; href: string }

type TabId = 'etkinlikler' | 'bonuslar'

export function CampaignHub({
  sponsors,
  bonuses,
  campaigns,
  events,
}: {
  sponsors?: Sponsor[]
  bonuses?: Bonus[]
  campaigns?: Campaign[]
  events?: HubEvent[]
} = {}) {
  const usingDb = bonuses !== undefined || campaigns !== undefined || events !== undefined
  const tabs = [
    { id: 'etkinlikler' as const, label: 'AL KANKA etkinlikleri', icon: PartyPopper, count: events?.length ?? EVENTS.length },
    { id: 'bonuslar' as const, label: 'Sponsor site bonusları', icon: BadgePercent, count: (bonuses?.length ?? BONUSES.length) + (campaigns?.length ?? CAMPAIGNS.length) },
  ]
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
        {tabs.map((t) => {
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
                'flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors sm:text-sm',
                active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t.label}</span>
              <span className={cn('hidden rounded px-1.5 text-[10px] tabular-nums sm:inline', active ? 'bg-primary-foreground/20' : 'bg-secondary')}>
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {tab === 'etkinlikler' ? (
        <div id="kampanya-etkinlikler" role="tabpanel">
          {usingDb ? (
            events?.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {events.map((event) => (
                  <li key={event.id} className="panel-gold flex flex-col gap-2 rounded-xl p-4">
                    <h3 className="font-display text-lg font-bold text-foreground">{event.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{event.detail}</p>
                    <a href={event.href} className="text-xs font-bold uppercase tracking-wider text-primary hover:underline">İncele</a>
                  </li>
                ))}
              </ul>
            ) : (
              <JakoTip pose="uzgun" title="Etkinlik yok">
                Turnuvalar paneldeki Turnuvalar menüsünden açılır.
              </JakoTip>
            )
          ) : (
            <Events view="biletler" />
          )}
        </div>
      ) : (
        <div id="kampanya-bonuslar" role="tabpanel" className="flex flex-col gap-10">
          <BonusBoard bonuses={bonuses} sponsors={sponsors} />
          <CampaignBoard campaigns={campaigns} sponsors={sponsors} />
        </div>
      )}
    </div>
  )
}
