'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ChevronDown, Flag, Percent, Radio, Tv } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LEAGUES, type Channel, type KankaTvData, type LeagueSlug, type Match } from '@/lib/kankatv'

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<KankaTvData>)
const timeFormat = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
const DAY_LABELS = ['Dün', 'Bugün', 'Yarın']
const leagueName = (slug: LeagueSlug) => LEAGUES.find((l) => l.slug === slug)?.name ?? slug

function TeamCrest({ src, name }: { src: string | null; name: string }) {
  if (!src) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
        {name.slice(0, 2).toUpperCase()}
      </span>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element -- remote crest CDN, small fixed size
  return <img src={src} alt="" loading="lazy" className="size-7 shrink-0 object-contain" />
}

function StatusBadge({ match }: { match: Match }) {
  if (match.state === 'in') {
    return (
      <span className="flex items-center gap-1.5 rounded-md bg-live/15 px-2 py-1 text-xs font-bold text-live tabular-nums">
        <span className="size-1.5 animate-pulse rounded-full bg-live" aria-hidden="true" />
        {match.detail === 'İY' ? 'İY' : match.clock}
      </span>
    )
  }
  if (match.state === 'post') {
    return <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">MS</span>
  }
  return (
    <span className="rounded-md bg-background px-2 py-1 text-xs font-bold text-foreground tabular-nums">
      {timeFormat.format(new Date(match.date))}
    </span>
  )
}

function MatchRow({ match }: { match: Match }) {
  const [open, setOpen] = useState(false)
  const scored = match.state !== 'pre'
  const homeWin = scored && Number(match.home.score) > Number(match.away.score)
  const awayWin = scored && Number(match.away.score) > Number(match.home.score)

  return (
    <li className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className="w-14 shrink-0">
          <StatusBadge match={match} />
        </span>
        <span className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className={cn('flex min-w-0 items-center justify-end gap-2 text-sm', homeWin ? 'font-bold' : 'font-medium')}>
            <span className="truncate text-right text-foreground">{match.home.short}</span>
            <TeamCrest src={match.home.logo} name={match.home.short} />
          </span>
          <span
            className={cn(
              'min-w-16 rounded-md px-2 py-1 text-center font-display text-base font-bold tabular-nums',
              match.state === 'in' ? 'bg-live text-live-foreground' : 'bg-background text-foreground',
            )}
          >
            {scored ? `${match.home.score} - ${match.away.score}` : 'vs'}
          </span>
          <span className={cn('flex min-w-0 items-center gap-2 text-sm', awayWin ? 'font-bold' : 'font-medium')}>
            <TeamCrest src={match.away.logo} name={match.away.short} />
            <span className="truncate text-foreground">{match.away.short}</span>
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="flex flex-col gap-4 bg-background/60 px-4 py-4">
          {match.events.length > 0 ? (
            <ol className="flex flex-col gap-2">
              {match.events.map((e, i) => (
                <li
                  key={`${e.minute}-${e.player}-${i}`}
                  className={cn('flex items-center gap-2 text-sm', e.side === 'away' && 'flex-row-reverse text-right')}
                >
                  <span className="w-10 shrink-0 text-xs font-bold text-muted-foreground tabular-nums">{e.minute}</span>
                  <span
                    aria-label={e.kind === 'goal' ? 'Gol' : e.kind === 'red' ? 'Kırmızı kart' : 'Sarı kart'}
                    className={cn(
                      'shrink-0',
                      e.kind === 'goal' && 'size-2.5 rounded-full bg-primary',
                      e.kind === 'yellow' && 'h-3.5 w-2.5 rounded-sm bg-primary/60',
                      e.kind === 'red' && 'h-3.5 w-2.5 rounded-sm bg-live',
                    )}
                  />
                  <span className="text-foreground">
                    {e.player}
                    {e.note && <span className="ml-1 text-xs text-muted-foreground">({e.note})</span>}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              {match.state === 'pre' ? 'Maç henüz başlamadı. Goller ve kartlar burada canlı akacak.' : 'Henüz gol ya da kart yok.'}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/tahminler"
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Flag className="size-3.5" aria-hidden="true" />
              Tahmin et
            </Link>
            <Link
              href="/ozel-oranlar"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-muted"
            >
              <Percent className="size-3.5" aria-hidden="true" />
              Özel oranlar
            </Link>
          </div>
        </div>
      )}
    </li>
  )
}

function MatchesTab({ data, onWatch }: { data: KankaTvData; onWatch: (slug: string) => void }) {
  const [dayIndex, setDayIndex] = useState(1)
  const [league, setLeague] = useState<LeagueSlug | 'all'>('all')
  const liveChannel = data.channels.find((c) => c.live)

  const groups = useMemo(() => {
    const day = data.days[dayIndex]
    const list = data.matches.filter((m) => m.day === day && (league === 'all' || m.league === league))
    return LEAGUES.map((l) => ({ league: l, matches: list.filter((m) => m.league === l.slug) })).filter((g) => g.matches.length)
  }, [data, dayIndex, league])

  const liveNow = data.matches.filter((m) => m.state === 'in')

  return (
    <div className="flex flex-col gap-5">
      {liveChannel && (
        <button
          type="button"
          onClick={() => onWatch(liveChannel.slug)}
          className="flex items-center gap-3 rounded-xl border border-live/30 bg-live/10 px-4 py-3 text-left transition-colors hover:bg-live/15"
        >
          <Radio className="size-5 shrink-0 text-live" aria-hidden="true" />
          <span className="flex-1 text-sm text-foreground">
            <span className="font-bold">{liveChannel.name}</span> şu an canlı yayında. Ücretsiz izle.
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-live">İzle</span>
        </button>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Gün" className="flex gap-1 rounded-lg bg-muted p-1">
          {DAY_LABELS.map((label, i) => (
            <button
              key={label}
              role="tab"
              type="button"
              aria-selected={dayIndex === i}
              onClick={() => setDayIndex(i)}
              className={cn(
                'flex-1 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors sm:flex-none',
                dayIndex === i ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {liveNow.length > 0 && (
          <span className="flex items-center gap-2 text-sm font-semibold text-live">
            <span className="size-2 animate-pulse rounded-full bg-live" aria-hidden="true" />
            {liveNow.length} maç canlı
          </span>
        )}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {[{ slug: 'all' as const, name: 'Tümü' }, ...LEAGUES].map((l) => (
          <button
            key={l.slug}
            type="button"
            onClick={() => setLeague(l.slug)}
            aria-pressed={league === l.slug}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              league === l.slug
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {l.name}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Bu gün için seçili ligde maç yok.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.league.slug} aria-labelledby={`lg-${g.league.slug}`} className="overflow-hidden rounded-xl border border-border bg-card">
            <h2
              id={`lg-${g.league.slug}`}
              className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
            >
              <span className="text-foreground">{g.league.name}</span>
              <span className="text-muted-foreground">{g.league.country}</span>
            </h2>
            <ul>
              {g.matches.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

function ChannelsTab({ channels, selected, onSelect }: { channels: Channel[]; selected: string; onSelect: (slug: string) => void }) {
  const current = channels.find((c) => c.slug === selected) ?? channels[0]
  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-foreground">
          {current.videoId ? (
            <iframe
              key={current.videoId}
              src={`https://www.youtube.com/embed/${current.videoId}?autoplay=1&mute=1&playsinline=1`}
              title={`${current.name} canlı yayın`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <Tv className="size-8 text-background/60" aria-hidden="true" />
              <p className="text-sm font-semibold text-background">{current.name} şu an yayında değil</p>
              <p className="text-xs text-background/70">Yayın başladığında burada otomatik açılır.</p>
            </div>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Yayınlar kanalların kendi resmi YouTube canlı yayınıdır. Bazı yayınlar yalnızca Türkiye’den açılabilir.
        </p>
      </div>

      <ul className="flex flex-col gap-2 lg:w-72">
        {channels.map((c) => (
          <li key={c.slug}>
            <button
              type="button"
              onClick={() => onSelect(c.slug)}
              aria-pressed={current.slug === c.slug}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                current.slug === c.slug ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted',
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background font-display text-xs font-bold text-foreground">
                {c.name}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-foreground">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.tag}</span>
              </span>
              {c.live ? (
                <span className="flex items-center gap-1 rounded-md bg-live px-2 py-0.5 text-[10px] font-bold uppercase text-live-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-live-foreground" aria-hidden="true" />
                  Canlı
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Kapalı</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function KankaTvBoard({ initial }: { initial: KankaTvData }) {
  const { data = initial } = useSWR('/api/kankatv', fetcher, {
    fallbackData: initial,
    refreshInterval: (latest) => (latest?.matches.some((m) => m.state === 'in') ? 30_000 : 120_000),
    revalidateOnFocus: true,
  })
  const [tab, setTab] = useState<'matches' | 'channels'>('matches')
  const [channel, setChannel] = useState<string>(() => initial.channels.find((c) => c.live)?.slug ?? initial.channels[0].slug)
  const liveCount = data.matches.filter((m) => m.state === 'in').length

  const watch = (slug: string) => {
    setChannel(slug)
    setTab('channels')
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-end md:justify-between md:p-6">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Tv className="size-5" aria-hidden="true" />
            </span>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Kanka<span className="text-primary">TV</span>
            </h1>
            {liveCount > 0 && (
              <span className="rounded-md bg-live px-2 py-0.5 text-[10px] font-bold uppercase text-live-foreground">
                {liveCount} canlı
              </span>
            )}
          </span>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty">
            Avrupa’nın 6 büyük liginde günün maçları ve canlı skorlar kendiliğinden güncellenir. Açık kanallar yayındayken buradan ücretsiz izle.
          </p>
        </div>
        <div role="tablist" aria-label="KankaTV" className="flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              ['matches', 'Maçlar'],
              ['channels', 'Canlı kanallar'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors md:flex-none',
                tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'matches' ? (
        <MatchesTab data={data} onWatch={watch} />
      ) : (
        <ChannelsTab channels={data.channels} selected={channel} onSelect={setChannel} />
      )}

      <p className="text-xs text-muted-foreground">
        Son güncelleme: {timeFormat.format(new Date(data.updatedAt))} · Lig: {leagueName('eng.1')}, {leagueName('esp.1')},{' '}
        {leagueName('ita.1')}, {leagueName('ger.1')}, {leagueName('fra.1')}, {leagueName('por.1')}
      </p>
    </div>
  )
}
