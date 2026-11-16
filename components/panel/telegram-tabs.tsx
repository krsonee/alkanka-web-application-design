'use client'

import { createContext, useContext, useId, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** on: working · off: switched on but failing · idle: switched off or never set up, which is not a fault. */
export type TabStatus = 'on' | 'off' | 'idle' | null

type Tab = { id: string; label: string; group?: string; status?: TabStatus; issue?: string | null; content: ReactNode }

export type TabInfo = { id: string; label: string; group: string | null; status: TabStatus; issue: string | null }

const TabsContext = createContext<{ tabs: TabInfo[]; open: (id: string) => void } | null>(null)

/** Lets a tab's content read its siblings' status lights and jump to one of them; null outside a tab set. */
export function useSiblingTabs() {
  return useContext(TabsContext)
}

const STATUS_TEXT: Record<Exclude<TabStatus, null>, string> = { on: '(çalışıyor)', off: '(hata var)', idle: '(kapalı)' }

export function StatusLight({ status }: { status: TabStatus }) {
  if (!status) return null
  if (status === 'idle') return <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />
  const on = status === 'on'
  return (
    <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
      <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', on ? 'bg-emerald' : 'bg-destructive')} />
      <span className={cn('relative inline-flex size-2.5 rounded-full', on ? 'bg-emerald' : 'bg-destructive')} />
    </span>
  )
}

export function TelegramTabs({
  tabs,
  label = 'Telegram bölümleri',
  legend = true,
  issues = 'box',
}: {
  tabs: Tab[]
  label?: string
  legend?: boolean
  /** 'none' when one of the tabs is a status screen that already lists every failing section. */
  issues?: 'box' | 'none'
}) {
  const [active, setActive] = useState(tabs[0]?.id)
  const uid = useId()
  const hasStatus = tabs.some((t) => t.status)

  const groups = Array.from(new Set(tabs.map((t) => t.group).filter((g): g is string => Boolean(g))))
  const grouped = groups.length > 1
  const activeGroup = tabs.find((t) => t.id === active)?.group ?? groups[0]
  const visibleTabs = grouped ? tabs.filter((t) => t.group === activeGroup) : tabs
  const broken = issues === 'box' ? tabs.filter((t) => t.status === 'off') : []
  const shared = useMemo(
    () => ({
      tabs: tabs.map((t): TabInfo => ({ id: t.id, label: t.label, group: t.group ?? null, status: t.status ?? null, issue: t.issue ?? null })),
      open: (id: string) => setActive(id),
    }),
    [tabs],
  )

  return (
    <TabsContext.Provider value={shared}>
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-1 shadow-sm">
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
                  {offCount > 0 ? <span className="sr-only">{`(${offCount} bölümde hata var)`}</span> : null}
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
              title={t.status !== 'on' && t.issue ? t.issue : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                active === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <StatusLight status={t.status ?? null} />
              {t.label}
              {t.status ? <span className="sr-only">{STATUS_TEXT[t.status]}</span> : null}
            </button>
          ))}
        </div>
      </div>
      {hasStatus && legend ? (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><StatusLight status="on" /> Çalışıyor</span>
          <span className="flex items-center gap-1.5"><StatusLight status="off" /> Açık ama hata var</span>
          <span className="flex items-center gap-1.5"><StatusLight status="idle" /> Kapalı ya da kurulmadı</span>
        </p>
      ) : null}
      {broken.length > 0 ? (
        <details className="group rounded-xl border border-destructive/30 bg-destructive/5">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
            <span className="shrink-0 font-semibold text-foreground">{`${broken.length} bölümde hata var`}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{broken.map((t) => t.label).join(', ')}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="flex flex-col gap-1.5 px-1 pb-2">
            {broken.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setActive(t.id)}
                  className="flex w-full flex-wrap items-baseline gap-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-destructive/10"
                >
                  <span className="font-semibold text-foreground">
                    {t.group ? `${t.group} · ${t.label}` : t.label}
                  </span>
                  <span className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">{t.issue ?? 'Kurulum tamamlanmamış'}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${uid}-panel-${t.id}`} aria-labelledby={`${uid}-tab-${t.id}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
    </TabsContext.Provider>
  )
}
