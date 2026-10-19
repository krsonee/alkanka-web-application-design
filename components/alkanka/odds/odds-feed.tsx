'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Clock, Send, X } from 'lucide-react'
import { TeamLogo, splitMatch } from '@/components/alkanka/logo-context'
import { ODD_RESULT_LABELS, fillMinutes, shiftDay, type OddsDayStats, type SpecialOdd } from '@/lib/special-odds-shared'
import { cn } from '@/lib/utils'

type DayData = { day: string; odds: SpecialOdd[]; stats: OddsDayStats }
type Range = 'today' | 'yesterday' | 'date'
type Filter = 'all' | 'open' | 'filled' | 'won' | 'lost'

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<DayData>)

function minutesSince(iso: string) {
  return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
}

function StateBadge({ odd }: { odd: SpecialOdd }) {
  if (odd.result) {
    const won = odd.result === 'won'
    const lost = odd.result === 'lost'
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider', won ? 'bg-live/15 text-live' : lost ? 'bg-destructive/15 text-destructive' : 'bg-secondary text-muted-foreground')}>
        {won ? <Check className="size-3" aria-hidden="true" /> : lost ? <X className="size-3" aria-hidden="true" /> : null}
        {ODD_RESULT_LABELS[odd.result]}
      </span>
    )
  }
  if (odd.status === 'open') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-live/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-live">
        <span className="relative flex size-1.5" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-70" />
          <span className="relative inline-flex size-1.5 rounded-full bg-live" />
        </span>
        Açık
      </span>
    )
  }
  const mins = fillMinutes(odd)
  return (
    <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {odd.status === 'filled' ? (mins ? `${mins} dk'da doldu` : 'Limit doldu') : 'Kapandı'}
    </span>
  )
}

function OddCard({ odd }: { odd: SpecialOdd }) {
  const open = odd.status === 'open' && !odd.result
  const teams = splitMatch(odd.match).filter(Boolean)
  const boost = odd.oldOdd && odd.newOdd ? Math.round((odd.newOdd / odd.oldOdd - 1) * 100) : null
  const ago = minutesSince(odd.openedAt)
  return (
    <li className={cn('flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:items-center md:gap-4 md:p-4', open ? 'border-primary/40' : 'border-border')}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <StateBadge odd={odd} />
          <span className="truncate font-semibold uppercase tracking-wider text-accent">{odd.siteName}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1 tabular-nums">
            <Clock className="size-3" aria-hidden="true" />
            {open ? `${ago} dk önce` : clock(odd.openedAt)}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2.5">
          {teams.length > 1 && (
            <span className="flex shrink-0 -space-x-2">
              {teams.map((t) => (
                <TeamLogo key={t} name={t} className="size-7 ring-2 ring-card" />
              ))}
            </span>
          )}
          <span className={cn('truncate font-display text-base font-bold leading-tight md:text-lg', open ? 'text-foreground' : 'text-muted-foreground')}>{odd.match}</span>
        </div>
        {(odd.league || odd.kickoff || odd.limit) && (
          <span className="truncate text-xs text-muted-foreground">{[odd.league, odd.kickoff, odd.limit].filter(Boolean).join(' · ')}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-background px-3 py-2 md:flex-none">
          {odd.market && <span className="truncate text-sm text-muted-foreground">{odd.market}</span>}
          {odd.oldOdd != null && (
            <>
              <span className="text-sm text-muted-foreground line-through tabular-nums">{odd.oldOdd.toFixed(2)}</span>
              <ArrowRight className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            </>
          )}
          {odd.newOdd != null && (
            <span className={cn('rounded-md px-2 py-0.5 font-display text-base font-bold tabular-nums', open ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground')}>
              {odd.newOdd.toFixed(2)}
            </span>
          )}
          {boost != null && boost > 0 && <span className="text-xs font-bold text-live tabular-nums">+%{boost}</span>}
        </div>
        {open ? (
          <a
            href={odd.link}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 md:w-28"
          >
            Oyna
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        ) : (
          <span className="flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground md:w-28">
            {odd.result ? 'Sonuçlandı' : 'Kapandı'}
          </span>
        )}
      </div>
    </li>
  )
}

function Summary({ stats, isToday }: { stats: OddsDayStats; isToday: boolean }) {
  const settled = stats.won + stats.lost
  const parts = [
    `${stats.total} oran`,
    isToday && stats.open ? `${stats.open} açık` : null,
    settled ? `${stats.won}/${settled} kazandı` : null,
    stats.avgFillMinutes ? `ort. ${stats.avgFillMinutes} dk'da doldu` : null,
  ].filter(Boolean)
  return <p className="text-xs text-muted-foreground">{parts.join(' · ')}</p>
}

function EmptyState({ isToday, channelUrl }: { isToday: boolean; channelUrl: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center">
      <p className="text-sm font-semibold text-foreground">{isToday ? 'Şu an açık özel oran yok' : 'Bu tarihte paylaşılmış oran yok'}</p>
      <p className="max-w-sm text-pretty text-xs leading-relaxed text-muted-foreground">
        {isToday ? 'Oranlar genelde 15 dakika içinde doluyor. Yeni oran düştüğü an haberin olsun diye kanal bildirimini aç.' : 'Başka bir gün seçebilirsin.'}
      </p>
      {isToday && channelUrl && (
        <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90">
          <Send className="size-3.5" aria-hidden="true" />
          Bildirimleri aç
        </a>
      )}
    </div>
  )
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'open', label: 'Açık' },
  { id: 'filled', label: 'Doldu' },
  { id: 'won', label: 'Kazandı' },
  { id: 'lost', label: 'Kaybetti' },
]

function applyFilter(odds: SpecialOdd[], filter: Filter) {
  switch (filter) {
    case 'open':
      return odds.filter((o) => o.status === 'open' && !o.result)
    case 'filled':
      return odds.filter((o) => o.status !== 'open' && !o.result)
    case 'won':
    case 'lost':
      return odds.filter((o) => o.result === filter)
    default:
      return odds
  }
}

export function OddsFeed({ initial, today, channelUrl }: { initial: DayData; today: string; channelUrl: string | null }) {
  const [range, setRange] = useState<Range>('today')
  const [picked, setPicked] = useState(shiftDay(today, -2))
  const [filter, setFilter] = useState<Filter>('all')
  const day = range === 'today' ? today : range === 'yesterday' ? shiftDay(today, -1) : picked
  const isToday = day === today

  const { data, isLoading } = useSWR<DayData>(`/api/ozel-oranlar?day=${day}`, fetcher, {
    fallbackData: day === initial.day ? initial : undefined,
    refreshInterval: isToday ? 20_000 : 0,
    revalidateOnFocus: isToday,
    keepPreviousData: true,
  })
  const odds = data?.odds ?? []
  const open = odds.filter((o) => o.status === 'open' && !o.result)
  const rest = odds.filter((o) => !(o.status === 'open' && !o.result))
  const filtered = applyFilter(odds, filter)
  const grouped = filter === 'all' && isToday

  const tabs: { id: Range; label: string }[] = [
    { id: 'today', label: 'Bugün' },
    { id: 'yesterday', label: 'Dün' },
    { id: 'date', label: 'Tarih' },
  ]

  return (
    <section aria-labelledby="odds-feed-title" className="flex flex-col gap-4">
      <h2 id="odds-feed-title" className="sr-only">Özel oran akışı</h2>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Gün seç" className="flex flex-1 rounded-xl border border-border bg-card p-1 md:flex-none">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={range === t.id}
                onClick={() => setRange(t.id)}
                className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors md:flex-none', range === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {t.id === 'date' && <CalendarDays className="size-3.5" aria-hidden="true" />}
                {t.label}
              </button>
            ))}
          </div>
          {range === 'date' && (
            <label className="shrink-0">
              <span className="sr-only">Tarih</span>
              <input
                type="date"
                value={picked}
                max={today}
                onChange={(e) => e.target.value && setPicked(e.target.value)}
                className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </label>
          )}
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Duruma göre filtrele">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn('shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', filter === f.id ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {data && <Summary stats={data.stats} isToday={isToday} />}

      {isLoading && !data ? (
        <ul className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-28 animate-pulse rounded-xl bg-card md:h-20" />
          ))}
        </ul>
      ) : grouped ? (
        <>
          {open.length ? (
            <ul className="flex flex-col gap-2">{open.map((o) => <OddCard key={o.id} odd={o} />)}</ul>
          ) : (
            <EmptyState isToday channelUrl={channelUrl} />
          )}
          {rest.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Bugün kapananlar</h3>
              <ul className="flex flex-col gap-2">{rest.map((o) => <OddCard key={o.id} odd={o} />)}</ul>
            </div>
          )}
        </>
      ) : filtered.length ? (
        <ul className="flex flex-col gap-2">{filtered.map((o) => <OddCard key={o.id} odd={o} />)}</ul>
      ) : (
        <EmptyState isToday={isToday && filter === 'open'} channelUrl={channelUrl} />
      )}
    </section>
  )
}
