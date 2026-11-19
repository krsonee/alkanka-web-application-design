'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, Loader2, Search, Star } from 'lucide-react'
import { loadFeedCountries, loadFeedLeagues } from '@/app/panel/community-actions'
import type { FeedLeague } from '@/lib/kankatv'
import type { LeaguePin } from '@/lib/prediction-book-shared'
import type { Sport } from '@/lib/predictions-shared'
import { cn } from '@/lib/utils'

const quiet = { revalidateOnFocus: false, shouldRetryOnError: false }

function Waiting({ text }: { text: string }) {
  return (
    <p role="status" className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      {text}
    </p>
  )
}

function Failed({ text, retry }: { text: string; retry: () => void }) {
  return (
    <p role="alert" className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs text-destructive">
      {text}
      <button type="button" onClick={retry} className="font-bold underline underline-offset-2">
        Tekrar dene
      </button>
    </p>
  )
}

function CountryLeagues({
  sport,
  countryId,
  chosen,
  onToggle,
  pins,
  onPin,
  single,
}: {
  sport: Sport
  countryId: number
  chosen: (id: number) => boolean
  onToggle: (league: FeedLeague) => void
  pins: LeaguePin[]
  onPin?: (league: FeedLeague, on: boolean) => void
  single: boolean
}) {
  const { data, error, isLoading, mutate } = useSWR(['feed-leagues', sport, countryId], () => loadFeedLeagues(sport, countryId), quiet)
  if (isLoading) return <Waiting text="Ligler yükleniyor..." />
  if (error || !data || !data.ok) return <Failed text={data && !data.ok ? data.error : 'Ligler yüklenemedi.'} retry={() => void mutate()} />
  if (!data.leagues.length) return <p className="px-3 py-2 text-xs text-muted-foreground">Bu ülkede kayıtlı lig yok.</p>
  return (
    <ul className="flex flex-col gap-1 py-1 pl-3">
      {data.leagues.map((l) => {
        const pinned = pins.some((p) => p.id === l.id)
        const on = chosen(l.id)
        return (
          <li key={l.id} className={cn('flex items-center gap-1 rounded-lg border pr-1', on ? 'border-primary bg-primary/10' : 'border-border bg-background')}>
            {single ? (
              <button type="button" onClick={() => onToggle(l)} className="flex min-h-10 min-w-0 flex-1 items-center px-3 text-left text-sm font-semibold text-foreground hover:text-primary">
                <span className="truncate">{l.name}</span>
              </button>
            ) : (
              <label className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-3 text-sm font-semibold text-foreground">
                <input type="checkbox" checked={on} onChange={() => onToggle(l)} className="size-4 shrink-0 accent-primary" />
                <span className="truncate">{l.name}</span>
              </label>
            )}
            {onPin && (
              <button
                type="button"
                aria-pressed={pinned}
                aria-label={pinned ? `${l.name} sabitlerden çıkar` : `${l.name} ligini sabitle`}
                title={pinned ? 'Sabitlerden çıkar' : 'Sabitle'}
                onClick={() => onPin(l, !pinned)}
                className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', pinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                <Star className="size-4" fill={pinned ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Country, then league: the feed's own directory, opened one country at a time. */
export function LeagueBrowser({
  sport,
  chosen,
  onToggle,
  pins,
  onPin,
  single = false,
}: {
  sport: Sport
  chosen: (id: number) => boolean
  onToggle: (league: FeedLeague) => void
  /** The pinned leagues of this sport. */
  pins: LeaguePin[]
  onPin?: (league: FeedLeague, on: boolean) => void
  /** One league is picked and the browser is done, instead of ticking several. */
  single?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const { data, error, isLoading, mutate } = useSWR(['feed-countries', sport], () => loadFeedCountries(sport), quiet)
  const q = query.trim().toLocaleLowerCase('tr')
  const countries = data?.ok ? data.countries.filter((c) => !q || c.name.toLocaleLowerCase('tr').includes(q)) : []

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <label className="relative flex items-center">
        <span className="sr-only">Ülke ara</span>
        <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ülke ara: Türkiye, İngiltere, Avrupa..."
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      {isLoading ? (
        <Waiting text="Ülkeler yükleniyor..." />
      ) : error || !data || !data.ok ? (
        <Failed text={data && !data.ok ? data.error : 'Ülkeler yüklenemedi.'} retry={() => void mutate()} />
      ) : !countries.length ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">Bu adla ülke bulunamadı.</p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1">
          {countries.map((c) => (
            <li key={c.id} className="flex flex-col">
              <button
                type="button"
                aria-expanded={open === c.id}
                onClick={() => setOpen(open === c.id ? null : c.id)}
                className={cn('flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-secondary', open === c.id ? 'bg-secondary text-foreground' : 'text-foreground')}
              >
                <span className="truncate">{c.name}</span>
                <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open === c.id && 'rotate-180')} aria-hidden="true" />
              </button>
              {open === c.id && <CountryLeagues sport={sport} countryId={c.id} chosen={chosen} onToggle={onToggle} pins={pins} onPin={onPin} single={single} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
