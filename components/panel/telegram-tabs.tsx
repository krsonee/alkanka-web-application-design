'use client'

import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type TabStatus = 'on' | 'off' | null

type Tab = { id: string; label: string; group?: string; status?: TabStatus; content: ReactNode }

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

export function TelegramTabs({ tabs, label = 'Telegram bölümleri' }: { tabs: Tab[]; label?: string }) {
  const [active, setActive] = useState(tabs[0]?.id)
  const uid = useId()
  const hasStatus = tabs.some((t) => t.status)

  const groups = Array.from(new Set(tabs.map((t) => t.group).filter((g): g is string => Boolean(g))))
  const grouped = groups.length > 1
  const activeGroup = tabs.find((t) => t.id === active)?.group ?? groups[0]
  const visibleTabs = grouped ? tabs.filter((t) => t.group === activeGroup) : tabs

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-14 z-10 flex flex-col gap-2 rounded-xl border border-border bg-card p-1 shadow-sm">
        {grouped ? (
          <div role="group" aria-label={`${label} grupları`} className="flex gap-1 overflow-x-auto border-b border-border pb-1">
            {groups.map((g) => {
              const groupTabs = tabs.filter((t) => t.group === g)
              const offCount = groupTabs.filter((t) => t.status === 'off').length
              const isActive = g === activeGroup
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActive(groupTabs[0]?.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors',
                    isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {g}
                  <span className={cn('rounded-full px-1.5 text-xs font-semibold tabular-nums', isActive ? 'bg-background/20' : 'bg-secondary')}>
                    {groupTabs.length}
                  </span>
                  {offCount > 0 ? <span className="sr-only">{`(${offCount} kurulmamış)`}</span> : null}
                  {offCount > 0 ? <span className="size-2 rounded-full bg-destructive" aria-hidden="true" /> : null}
                </button>
              )
            })}
          </div>
        ) : null}
        <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto">
          {visibleTabs.map((t) => (
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
