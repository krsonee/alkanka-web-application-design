'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { ChevronDown, ChevronRight, ExternalLink, Flag, Percent, Radio, Search, Send, Trophy, Tv, Volume1, Volume2, VolumeX, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHero } from '../page-hero'
import { MatchEngage, WatchBar, useTvEngage } from './engage'
import { useTvDock } from './tv-dock'
import {
  CHANNEL_GROUPS,
  SPORTS,
  type Channel,
  type ChannelGroup,
  type Competition,
  type DayOffset,
  type Match,
  type MatchDetail,
  type ScoreBoard,
  type SportSlug,
} from '@/lib/kankatv'

const fetcher = <T,>(url: string) => fetch(url).then((r) => r.json() as Promise<T>)
const timeFormat = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })
const DAYS: { offset: DayOffset; label: string }[] = [
  { offset: -1, label: 'Dün' },
  { offset: 0, label: 'Bugün' },
  { offset: 1, label: 'Yarın' },
]
const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'in', label: 'Canlı' },
  { key: 'pre', label: 'Başlamamış' },
  { key: 'post', label: 'Bitti' },
] as const
type Filter = (typeof FILTERS)[number]['key']
const PAGE = 25

function TeamCrest({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- remote crest CDN, small fixed size
  return <img src={src} alt="" loading="lazy" className="size-6 shrink-0 object-contain" />
}

function StatusBadge({ match }: { match: Match }) {
  if (match.state === 'in') {
    return (
      <span className="flex items-center gap-1.5 rounded-md bg-live/15 px-2 py-1 text-xs font-bold text-live tabular-nums">
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-live" aria-hidden="true" />
        <span className="truncate">{match.clock || match.status || 'Canlı'}</span>
      </span>
    )
  }
  if (match.state === 'post') {
    return (
      <span className="block truncate rounded-md bg-muted px-2 py-1 text-center text-xs font-bold text-muted-foreground">
        {!match.status || /^sonu/i.test(match.status) ? 'MS' : match.status}
      </span>
    )
  }
  return (
    <span className="block rounded-md bg-background px-2 py-1 text-center text-xs font-bold text-foreground tabular-nums">
      {timeFormat.format(new Date(match.start))}
    </span>
  )
}

function MatchDetails({ match, sport }: { match: Match; sport: SportSlug }) {
  const { data, isLoading } = useSWR<MatchDetail>(`/api/kankatv/game?id=${match.id}`, fetcher, {
    refreshInterval: match.state === 'in' ? 30_000 : 0,
  })
  const showEvents = sport === 'futbol'

  return (
    <div className="flex flex-col gap-4 bg-background/60 px-4 py-4">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : showEvents && data?.events.length ? (
        <ol className="flex flex-col gap-2">
          {data.events.map((e, i) => (
            <li
              key={`${e.minute}-${e.player}-${i}`}
              className={cn('flex items-center gap-2 text-sm', e.side === 'away' && 'flex-row-reverse text-right')}
            >
              <span className="w-10 shrink-0 text-xs font-bold text-muted-foreground tabular-nums">{e.minute}</span>
              <span
                role="img"
                aria-label={e.kind === 'goal' ? 'Gol' : e.kind === 'red' ? 'Kırmızı kart' : 'Sarı kart'}
                className={cn(
                  'shrink-0',
                  e.kind === 'goal' && 'size-2.5 rounded-full bg-primary',
                  e.kind === 'yellow' && 'h-3.5 w-2.5 rounded-sm bg-primary/60',
                  e.kind === 'red' && 'h-3.5 w-2.5 rounded-sm bg-live',
                )}
              />
              <span className="text-foreground">{e.player || (e.kind === 'goal' ? 'Gol' : 'Kart')}</span>
            </li>
          ))}
        </ol>
      ) : !showEvents && data?.periods.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-4 text-left font-semibold">
                  <span className="sr-only">Takım</span>
                </th>
                {data.periods.map((p) => (
                  <th key={p.name} scope="col" className="px-2 py-1 text-center font-semibold">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['home', 'away'] as const).map((side) => (
                <tr key={side} className="border-t border-border">
                  <th scope="row" className="py-1.5 pr-4 text-left font-medium text-foreground">
                    {match[side].name}
                  </th>
                  {data.periods.map((p) => (
                    <td key={p.name} className="px-2 py-1.5 text-center text-foreground">
                      {p[side]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {match.state === 'pre'
            ? showEvents
              ? 'Maç henüz başlamadı. Goller ve kartlar burada canlı akacak.'
              : 'Maç henüz başlamadı. Periyot skorları burada canlı akacak.'
            : showEvents
              ? 'Henüz gol ya da kart yok.'
              : 'Periyot skoru henüz yok.'}
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
      <MatchEngage match={match} football={sport === 'futbol'} />
    </div>
  )
}

function MatchRow({ match, sport }: { match: Match; sport: SportSlug }) {
  const [open, setOpen] = useState(false)
  const scored = match.home.score !== null && match.away.score !== null
  const homeWin = scored && match.state === 'post' && match.home.score! > match.away.score!
  const awayWin = scored && match.state === 'post' && match.away.score! > match.home.score!

  return (
    <li className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className="w-16 shrink-0">
          <StatusBadge match={match} />
        </span>
        <span className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className={cn('flex min-w-0 items-center justify-end gap-2 text-sm', homeWin ? 'font-bold' : 'font-medium')}>
            <span className="truncate text-right text-foreground">{match.home.name}</span>
            <TeamCrest src={match.home.logo} />
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
            <TeamCrest src={match.away.logo} />
            <span className="truncate text-foreground">{match.away.name}</span>
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && <MatchDetails match={match} sport={sport} />}
    </li>
  )
}

function CompetitionList({ competitions, sport }: { competitions: Competition[]; sport: SportSlug }) {
  const [limit, setLimit] = useState(PAGE)
  const visible = competitions.slice(0, limit)
  return (
    <div className="flex flex-col gap-4">
      {visible.map((c) => (
        <section key={c.id} aria-labelledby={`cmp-${c.id}`} className="overflow-hidden rounded-xl border border-border bg-card">
          <h2
            id={`cmp-${c.id}`}
            className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
          >
            <span className="truncate text-foreground">{c.name}</span>
            <span className="shrink-0 text-muted-foreground">{c.country}</span>
          </h2>
          <ul>
            {c.matches.map((m) => (
              <MatchRow key={m.id} match={m} sport={sport} />
            ))}
          </ul>
        </section>
      ))}
      {competitions.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="h-11 rounded-xl border border-border text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          Daha fazla lig göster ({competitions.length - limit})
        </button>
      )}
    </div>
  )
}

function MatchesTab({
  initialBoard,
  liveChannel,
  onWatch,
}: {
  initialBoard: ScoreBoard
  liveChannel?: Channel
  onWatch: (slug: string) => void
}) {
  const [sport, setSport] = useState<SportSlug>('futbol')
  const [day, setDay] = useState<DayOffset>(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const isInitial = sport === initialBoard.sport && day === initialBoard.day

  const { data, isLoading } = useSWR<ScoreBoard>(`/api/kankatv?sport=${sport}&day=${day}`, fetcher, {
    fallbackData: isInitial ? initialBoard : undefined,
    keepPreviousData: true,
    refreshInterval: day === 0 ? 30_000 : 0,
    revalidateOnFocus: true,
  })
  const board = data ?? initialBoard
  const liveCounts = board.liveCounts

  const competitions = useMemo(() => {
    const q = deferredQuery.trim().toLocaleLowerCase('tr')
    return board.competitions
      .map((c) => {
        const compHit = q && `${c.name} ${c.country}`.toLocaleLowerCase('tr').includes(q)
        const matches = c.matches.filter(
          (m) =>
            (filter === 'all' || m.state === filter) &&
            (!q || compHit || `${m.home.name} ${m.away.name}`.toLocaleLowerCase('tr').includes(q)),
        )
        return { ...c, matches }
      })
      .filter((c) => c.matches.length)
  }, [board, filter, deferredQuery])

  const total = board.competitions.reduce((n, c) => n + c.matches.length, 0)
  const liveHere = board.competitions.reduce((n, c) => n + c.matches.filter((m) => m.state === 'in').length, 0)

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

      <div role="tablist" aria-label="Spor" className="grid grid-cols-3 gap-2">
        {SPORTS.map((s) => (
          <button
            key={s.slug}
            role="tab"
            type="button"
            aria-selected={sport === s.slug}
            onClick={() => setSport(s.slug)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition-colors',
              sport === s.slug
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            {s.name}
            {liveCounts[s.slug] > 0 && (
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                  sport === s.slug ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-live text-live-foreground',
                )}
              >
                {liveCounts[s.slug]}
                <span className="sr-only"> canlı</span>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="Gün" className="flex gap-1 rounded-lg bg-muted p-1">
          {DAYS.map((d) => (
            <button
              key={d.offset}
              role="tab"
              type="button"
              aria-selected={day === d.offset}
              onClick={() => setDay(d.offset)}
              className={cn(
                'flex-1 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors md:flex-none',
                day === d.offset ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <label className="relative flex md:w-72">
          <span className="sr-only">Takım ya da lig ara</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Takım ya da lig ara"
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              filter === f.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {f.key === 'in' && <span className="size-1.5 animate-pulse rounded-full bg-live" aria-hidden="true" />}
            {f.label}
            {f.key === 'in' && liveHere > 0 && <span className="tabular-nums">({liveHere})</span>}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {isLoading && !data ? 'Yükleniyor…' : `${total} maç · ${board.competitions.length} lig`}
        </span>
      </div>

      {board.failed ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Skorlar şu an alınamadı. Birkaç saniye içinde tekrar denenecek.
        </p>
      ) : competitions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {filter === 'in' ? 'Şu an canlı maç yok.' : 'Bu seçime uygun maç bulunamadı.'}
        </p>
      ) : (
        <CompetitionList key={`${sport}-${day}-${filter}-${deferredQuery}`} competitions={competitions} sport={sport} />
      )}

      <p className="text-xs text-muted-foreground">Son güncelleme: {timeFormat.format(new Date(board.updatedAt))}</p>
    </div>
  )
}

const noopSubscribe = () => () => {}

/** Twitch embeds must name the embedding hostname, which is only known in the browser. */
function usePlayerSrc(embedUrl: string | null) {
  const host = useSyncExternalStore(noopSubscribe, () => window.location.hostname, () => null)
  if (!embedUrl || !embedUrl.startsWith('https://player.twitch.tv/')) return embedUrl
  return host ? `${embedUrl}&parent=${encodeURIComponent(host)}` : null
}

/**
 * YouTube reports unplayable videos (ended, region-locked, embedding off) only through the
 * IFrame API's postMessage channel, so we subscribe to it and fall back to the offline screen.
 */
function useYouTubeFailure(frame: React.RefObject<HTMLIFrameElement | null>, src: string | null) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!src?.startsWith('https://www.youtube.com/embed/')) return
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || typeof event.data !== 'string') return
      try {
        const data = JSON.parse(event.data) as { event?: string }
        if (data.event === 'onError') setFailedSrc(src)
      } catch {}
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [frame, src])
  return failedSrc !== null && failedSrc === src
}

function withMuted(src: string, muted: boolean) {
  const url = new URL(src)
  if (url.hostname === 'www.youtube.com') url.searchParams.set('mute', muted ? '1' : '0')
  else url.searchParams.set('muted', muted ? 'true' : 'false')
  return url.toString()
}

function postYouTube(frame: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
}

function SoundControls({
  muted,
  volume,
  isYouTube,
  onToggle,
  onVolume,
}: {
  muted: boolean
  volume: number
  isYouTube: boolean
  onToggle: () => void
  onVolume: (v: number) => void
}) {
  const Icon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={!muted}
        className={cn(
          'flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors',
          muted ? 'bg-primary text-primary-foreground motion-safe:animate-pulse' : 'bg-secondary text-foreground hover:bg-muted',
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
        {muted ? 'Sesi aç' : 'Sesi kapat'}
      </button>
      {isYouTube ? (
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="sr-only">Ses seviyesi</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={muted ? 0 : volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="h-2 min-w-0 flex-1 cursor-pointer accent-primary"
          />
          <span className="w-9 text-right text-xs font-semibold tabular-nums text-muted-foreground">{muted ? 0 : volume}</span>
        </label>
      ) : (
        <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
          Ses seviyesini yayının içindeki hoparlör simgesinden de ayarlayabilirsin.
        </p>
      )}
    </div>
  )
}

function ChannelsTab({ channels, selected, onSelect }: { channels: Channel[]; selected: string; onSelect: (slug: string) => void }) {
  const current = channels.find((c) => c.slug === selected) ?? channels[0]
  const rawSrc = usePlayerSrc(current.embedUrl)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(80)
  const isYouTube = Boolean(rawSrc?.startsWith('https://www.youtube.com/embed/'))
  // YouTube is controlled live over postMessage; other players only honour the muted flag on load.
  const playerSrc = rawSrc && !isYouTube ? withMuted(rawSrc, muted) : rawSrc
  const frameRef = useRef<HTMLIFrameElement>(null)
  const toggleSound = () => {
    const next = !muted
    setMuted(next)
    if (isYouTube) {
      postYouTube(frameRef.current, next ? 'mute' : 'unMute')
      if (!next) postYouTube(frameRef.current, 'setVolume', [volume || 50])
    }
  }
  const changeVolume = (v: number) => {
    setVolume(v)
    setMuted(v === 0)
    postYouTube(frameRef.current, 'setVolume', [v])
    postYouTube(frameRef.current, v === 0 ? 'mute' : 'unMute')
  }
  const playerFailed = useYouTubeFailure(frameRef, playerSrc)
  const showPlayer = Boolean(current.embedUrl) && !playerFailed
  const { data: engage } = useTvEngage(10_000)
  const slotRef = useRef<HTMLDivElement>(null)
  const [slotVisible, setSlotVisible] = useState(true)
  const [miniDismissed, setMiniDismissed] = useState(false)
  useEffect(() => {
    const el = slotRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setSlotVisible(entry.isIntersecting), { threshold: 0.25 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => setMiniDismissed(false), [current.slug])
  const miniEnabled = Boolean(engage?.config.miniPlayer)
  const floating = miniEnabled && showPlayer && !slotVisible && !miniDismissed
  const dock = useTvDock()
  const { open: dockOpen, close: dockClose } = dock
  const dockChannels = useMemo(() => channels.filter((c) => c.live && c.embedUrl), [channels])
  const watchOn = Boolean(engage?.config.watch.enabled && engage.config.watch.coin > 0 && engage.member)
  useEffect(() => {
    if (miniEnabled && showPlayer && !miniDismissed) dockOpen(current, dockChannels, watchOn)
    else dockClose()
  }, [current, dockChannels, miniEnabled, showPlayer, miniDismissed, watchOn, dockOpen, dockClose])
  const [group, setGroup] = useState<ChannelGroup>(current.group)
  const groupCounts = useMemo(() => {
    const counts = {} as Record<ChannelGroup, number>
    for (const g of CHANNEL_GROUPS) counts[g.key] = channels.filter((c) => c.group === g.key && c.live).length
    return counts
  }, [channels])
  const visible = channels.filter((c) => c.group === group)
  const isKick = current.slug.startsWith('kick-')
  const liveAlternatives = channels.filter((c) => c.live && c.slug !== current.slug).slice(0, 3)
  const note =
    current.group === 'uye'
      ? 'Kanka yayıncılar, kanallarını profillerinden bağlayan üyelerimizdir. Yayın onların kendi Kick, Twitch, YouTube ya da Telegram kanalından açılır.'
      : isKick
        ? 'Yayınlar yayıncıların kendi Kick kanallarından açılır. Şans oyunları yayınları 18 yaş üstü içindir.'
        : 'Yayınlar kanalların kendi resmi YouTube canlı yayınıdır. Bazı yayınlar yalnızca Türkiye’den açılabilir.'

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Kanal türü" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {CHANNEL_GROUPS.map((g) => (
          <button
            key={g.key}
            role="tab"
            type="button"
            aria-selected={group === g.key}
            onClick={() => setGroup(g.key)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors',
              group === g.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            {g.label}
            {groupCounts[g.key] > 0 && (
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                  group === g.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-live text-live-foreground',
                )}
              >
                {groupCounts[g.key]}
                <span className="sr-only"> canlı</span>
              </span>
            )}
          </button>
        ))}
      </div>

    <div className="flex flex-col gap-5 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div ref={slotRef} className="relative aspect-video w-full">
        <div
          className={cn(
            'overflow-hidden rounded-xl border',
            floating ? 'fixed bottom-24 right-3 z-40 aspect-video w-60 shadow-2xl sm:w-80' : 'absolute inset-0',
            showPlayer ? 'border-border bg-foreground' : 'border-primary/30 bg-card',
          )}
        >
          {floating && (
            <button
              type="button"
              onClick={() => setMiniDismissed(true)}
              aria-label="Mini oynatıcıyı kapat"
              className="absolute right-1.5 top-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
          {showPlayer ? (
            playerSrc && (
              <iframe
                ref={frameRef}
                key={playerSrc}
                src={playerSrc}
                onLoad={(e) => e.currentTarget.contentWindow?.postMessage('{"event":"listening","id":1}', '*')}
                title={`${current.name} canlı yayın`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 size-full"
              />
            )
          ) : current.externalUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Send className="size-7" aria-hidden="true" />
              </span>
              <div className="flex max-w-md flex-col gap-1.5">
                <span className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-live">
                  <span className="size-1.5 rounded-full bg-live motion-safe:animate-pulse" aria-hidden="true" />
                  Telegram&apos;da canlı
                </span>
                <p className="font-display text-xl font-bold leading-snug text-foreground text-balance sm:text-2xl">{current.name}</p>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  Telegram yayınları siteye gömülemiyor. Tek tıkla Telegram&apos;da yayına katılabilirsin.
                </p>
              </div>
              <a
                href={current.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Yayına katıl
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            </div>
          ) : (
  <div className="absolute inset-0 flex items-end overflow-hidden sm:items-center">
  <Image
  src="/images/kankatv-offline.png"
  alt="Jako kanepede oturmuş, kapalı televizyona omuz silkiyor"
  fill
  sizes="(min-width: 1024px) 66vw, 100vw"
  className="object-cover object-[70%_center]"
  />
  <div
  className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent sm:bg-gradient-to-r sm:from-background/95 sm:via-background/50 sm:to-transparent"
  aria-hidden="true"
  />
  <div className="relative flex max-w-sm flex-col gap-2 p-4 sm:gap-3 sm:p-8">
                <span className="flex items-center gap-1.5 self-start rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Tv className="size-3" aria-hidden="true" />
                  {current.name} · Kapalı
                </span>
                <p className="font-display text-base font-bold leading-snug text-foreground text-balance sm:text-2xl">
                  Şu anda yayın yapılmıyor, başka kanalları dene kanka
                </p>
                {liveAlternatives.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {liveAlternatives.map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => {
                          setGroup(c.group)
                          onSelect(c.slug)
                        }}
                        className="flex items-center gap-1 rounded-md border border-primary/40 bg-background px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        <span className="size-1.5 rounded-full bg-live motion-safe:animate-pulse" aria-hidden="true" />
                        {c.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="hidden text-xs leading-relaxed text-muted-foreground sm:block">
                    Yayın başladığında burada otomatik açılır.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
        {showPlayer && playerSrc && (
          <SoundControls muted={muted} volume={volume} isYouTube={isYouTube} onToggle={toggleSound} onVolume={changeVolume} />
        )}
        <WatchBar playing={showPlayer && Boolean(playerSrc)} />
        {current.title && (
          <p className="line-clamp-2 text-sm font-semibold text-foreground text-pretty">
            {current.name} · <span className="font-normal text-muted-foreground">{current.title}</span>
          </p>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>
      </div>

      <ul className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto pr-1 lg:w-80">
        {visible.length === 0 && (
          <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {group === 'uye' ? (
              <>
                Henüz kanal bağlayan kanka yok.{' '}
                <Link href="/profil?tab=hesaplar" className="font-semibold text-primary underline-offset-2 hover:underline">
                  Kanalını profilinden bağla
                </Link>
                , yayına geçince burada görünsün.
              </>
            ) : (
              'Şu an bu bölümde canlı yayın yok.'
            )}
          </li>
        )}
        {visible.map((c) => (
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
              {c.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.avatar} alt="" className="size-10 shrink-0 rounded-lg object-cover" loading="lazy" />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background px-1 text-center font-display text-[10px] font-bold leading-tight text-foreground">
                  {c.name}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {c.viewers != null ? `${c.viewers.toLocaleString('tr-TR')} izleyici` : c.tag}
                </span>
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
    </div>
  )
}

export function KankaTvBoard({ initialBoard, initialChannels }: { initialBoard: ScoreBoard; initialChannels: Channel[] }) {
  const { data: channels = initialChannels } = useSWR<Channel[]>('/api/kankatv/channels', fetcher, {
    fallbackData: initialChannels,
    refreshInterval: 120_000,
  })
  const { channel: docked } = useTvDock()
  const [tab, setTab] = useState<'matches' | 'channels'>(() => (docked ? 'channels' : 'matches'))
  const [channel, setChannel] = useState<string>(
    () => docked?.slug ?? initialChannels.find((c) => c.live)?.slug ?? initialChannels[0].slug,
  )
  const totalLive = Object.values(initialBoard.liveCounts).reduce((a, b) => a + b, 0)

  const watch = (slug: string) => {
    setChannel(slug)
    setTab('channels')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHero
        eyebrow="KankaTV"
        title="KankaTV"
        description="Futbol, basketbol ve voleybolda tüm liglerin canlı skorları kendiliğinden güncellenir. E-spor, şans oyunları, TV ve spor yayınlarını buradan ücretsiz izle."
        image="/images/heroes/kankatv.png"
  tone="live"
  compact
  stats={[
          { label: 'Canlı maç', value: String(totalLive) },
          { label: 'Yayındaki kanal', value: String(channels.filter((c) => c.live).length) },
          { label: 'Kanal', value: String(channels.length) },
        ]}
      >
        <div role="tablist" aria-label="KankaTV" className="flex w-full gap-2 sm:w-fit">
          {(
            [
              ['matches', 'Maçlar', Trophy],
              ['channels', 'Canlı kanallar', Tv],
            ] as const
          ).map(([key, label, TabIcon]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 text-sm font-bold transition-colors md:flex-none',
                tab === key
                  ? 'border-primary bg-primary text-primary-foreground shadow-md'
                  : 'tab-attention border-primary/60 bg-card text-foreground hover:bg-muted',
              )}
            >
              <TabIcon className="size-4 shrink-0" aria-hidden="true" />
              {label}
              {tab !== key && <ChevronRight className="size-4 shrink-0 text-primary" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </PageHero>

      {tab === 'matches' ? (
        <MatchesTab initialBoard={initialBoard} liveChannel={channels.find((c) => c.group === 'spor' && c.live)} onWatch={watch} />
      ) : (
        <ChannelsTab channels={channels} selected={channel} onSelect={setChannel} />
      )}
    </div>
  )
}
