'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function TelegramTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id)
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Telegram bölümleri" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tg-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`tg-panel-${t.id}`}
            onClick={() => setActive(t.id)}
            className={cn(
              'shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              active === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`tg-panel-${t.id}`} aria-labelledby={`tg-tab-${t.id}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  )
}
