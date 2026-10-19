'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type TabStatus = 'on' | 'off' | null

function StatusLight({ status }: { status: TabStatus }) {
  if (!status) return null
  const on = status === 'on'
  return (
    <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
      <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', on ? 'bg-success' : 'bg-destructive')} />
      <span className={cn('relative inline-flex size-2.5 rounded-full', on ? 'bg-success' : 'bg-destructive')} />
    </span>
  )
}

export function TelegramTabs({ tabs, label = 'Telegram bölümleri' }: { tabs: { id: string; label: string; status?: TabStatus; content: ReactNode }[]; label?: string }) {
  const [active, setActive] = useState(tabs[0]?.id)
  const uid = useId()
  const hasStatus = tabs.some((t) => t.status)
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={label} className="sticky top-14 z-10 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${uid}-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${uid}-panel-${t.id}`}
            onClick={() => setActive(t.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              active === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <StatusLight status={t.status ?? null} />
            {t.label}
            {t.status ? <span className="sr-only">{t.status === 'on' ? '(bağlı)' : '(bağlı değil)'}</span> : null}
          </button>
        ))}
      </div>
      {hasStatus ? (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><StatusLight status="on" /> Bağlı ve çalışıyor</span>
          <span className="flex items-center gap-1.5"><StatusLight status="off" /> Kurulmadı veya hata var</span>
        </p>
      ) : null}
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${uid}-panel-${t.id}`} aria-labelledby={`${uid}-tab-${t.id}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  )
}
