'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Keyboard,
  Minus,
  RefreshCw,
  X,
} from 'lucide-react'
import { loadDashStats } from '@/app/panel/dash-actions'
import type { AuditRow, MemberStatus } from '@/lib/members-admin'
import type { PendingDetail } from '@/lib/panel-pending'
import type { DashPreset, DashStats, HealthItem, SeriesPoint } from '@/lib/panel-stats'
import { cn } from '@/lib/utils'

type Props = {
  counts: Record<MemberStatus | 'tumu', number> | null
  pending: PendingDetail
  recent: AuditRow[]
  stats: DashStats | null
}
type Params = { r?: string; from?: string; to?: string }
type Preset = Exclude<DashPreset, 'custom'>

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR')
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const clock = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const trDate = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`
const DELETED_SPONSORS = 'Silinmiş sponsorlar'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Bugün' },
  { value: 'yesterday', label: 'Dün' },
  { value: '7', label: '7 gün' },
  { value: '30', label: '30 gün' },
  { value: 'month', label: 'Bu ay' },
  { value: 'lastmonth', label: 'Geçen ay' },
]

/** A preset is disabled when its whole range ends before the site's first data day. */
function presetEnd(p: Preset, today: string) {
  if (p === 'yesterday') return addDays(today, -1)
  if (p === 'lastmonth') return addDays(`${today.slice(0, 8)}01`, -1)
  return today
}

function useTween(value: number) {
  const [shown, setShown] = useState(value)
  const current = useRef(value)
  useEffect(() => {
    const start = current.current
    if (start === value) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = value
      setShown(value)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 600)
      const v = start + (value - start) * (1 - (1 - k) ** 3)
      current.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return shown
}

function Num({ value, signed }: { value: number; signed?: boolean }) {
  const v = useTween(value)
  return (
    <>
      {signed && Math.round(v) > 0 ? '+' : ''}
      {fmt(v)}
    </>
  )
}

const rise = (ms: number) => ({ className: 'dash-rise', style: { '--d': `${ms}ms` } as React.CSSProperties })

export function PanelDashboard({ counts, pending, recent, stats: initial }: Props) {
  const [stats, setStats] = useState(initial)
  const [loading, startTransition] = useTransition()
  const [refreshing, setRefreshing] = useState(false)
  const paramsRef = useRef<Params>(initial ? toParams(initial) : {})

  const load = (params: Params) => {
    paramsRef.current = params
    startTransition(async () => {
      const fresh = await loadDashStats(params)
      if (fresh) setStats(fresh)
      const url = new URL(window.location.href)
      for (const k of ['r', 'from', 'to']) url.searchParams.delete(k)
      if (params.r && params.r !== 'today') url.searchParams.set('r', params.r)
      if (params.from) url.searchParams.set('from', params.from)
      if (params.to) url.searchParams.set('to', params.to)
      window.history.replaceState(null, '', url)
    })
  }

  const refresh = async () => {
    setRefreshing(true)
    const fresh = await loadDashStats(paramsRef.current)
    if (fresh) setStats(fresh)
    setRefreshing(false)
  }

  const isDisabled = (p: Preset) => Boolean(stats && presetEnd(p, stats.today) < stats.dataStart)

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e) => {
    if (!stats || e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target as HTMLElement | null
    if (t?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault()
      if (!refreshing && !loading) refresh()
      return
    }
    const idx = Number(e.key) - 1
    const p = PRESETS[idx]
    if (p && !isDisabled(p.value) && stats.query.preset !== p.value) {
      e.preventDefault()
      load({ r: p.value })
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const live = stats?.live ?? false
  useEffect(() => {
    if (!live) return
    const id = window.setInterval(async () => {
      if (document.hidden) return
      const fresh = await loadDashStats(paramsRef.current)
      if (fresh) setStats(fresh)
    }, 60_000)
    return () => window.clearInterval(id)
  }, [live])

  const pickDay = (p: SeriesPoint) => {
    if (!stats || stats.seriesUnit === 'hour' || p.future) return
    const to = stats.seriesUnit === 'week' ? [addDays(p.date, 6), stats.to].sort()[0] : p.date
    load({ r: 'custom', from: p.date, to })
  }

  const empty = Boolean(stats && stats.to < stats.dataStart)

  return (
    <section aria-label="Genel bakış" className="@container flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-2xl font-semibold text-foreground text-balance">{stats?.title ?? 'Genel bakış'}</h2>
          {stats && (
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              {!empty && <span>{stats.hasPrev ? `Rakamlar ${stats.compare} ile karşılaştırılıyor.` : 'Bu aralık için karşılaştırılacak önceki veri yok.'}</span>}
              {!empty && <span aria-hidden="true">·</span>}
              <span>
                {`Son güncelleme ${clock(stats.generatedAt)}`}
                {stats.live && ', her dakika yenilenir'}
              </span>
            </p>
          )}
        </div>
        {stats && (
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="hidden items-center gap-1.5 text-xs text-muted-foreground @4xl:flex"
              title="R: yenile · 1–6: hazır tarih aralıkları"
            >
              <Keyboard className="size-3.5" aria-hidden="true" />
              <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">R</kbd>
              <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">1–6</kbd>
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing || loading}
              aria-label="Yenile (R)"
              title="Şimdi yenile (R)"
              className="flex size-9 items-center justify-center rounded-lg bg-card text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground disabled:opacity-60"
            >
              <RefreshCw className={cn('size-4', (refreshing || loading) && 'animate-spin')} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(stats)}
              disabled={empty}
              className="flex h-9 items-center gap-2 rounded-lg bg-card px-3 text-sm font-medium text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground disabled:opacity-50"
            >
              <Download className="size-4" aria-hidden="true" />
              {"Excel'e indir"}
            </button>
          </div>
        )}
      </header>

      {stats && (
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Zaman aralığı" className="flex items-center gap-1 rounded-lg bg-card p-1 ring-1 ring-border">
            {PRESETS.map((p, i) => {
              const disabled = isDisabled(p.value)
              return (
                <button
                  key={p.value}
                  type="button"
                  role="tab"
                  aria-selected={stats.query.preset === p.value}
                  disabled={disabled}
                  title={disabled ? `Veriler ${trDate(stats.dataStart)} tarihinden başlıyor` : `Kısayol: ${i + 1}`}
                  onClick={() => stats.query.preset !== p.value && load({ r: p.value })}
                  className={cn(
                    'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    stats.query.preset === p.value ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground enabled:hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          <RangePicker stats={stats} onApply={(from, to) => load({ r: 'custom', from, to })} />
          {stats.query.preset === 'custom' && (
            <button type="button" onClick={() => load({ r: 'today' })} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <X className="size-3.5" aria-hidden="true" />
              Temizle
            </button>
          )}
        </div>
      )}

      <div aria-busy={loading} className={cn('flex flex-col gap-6 transition-opacity duration-300', loading && 'pointer-events-none opacity-60')}>
        {stats && empty ? (
          <EmptyRange stats={stats} onGo={() => load({ r: 'month' })} />
        ) : (
          <>
            {stats && <KpiRow stats={stats} />}

            <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-12">
              {stats && (
                <div {...rise(160)} className="dash-rise @5xl:col-span-8">
                  <TrendCard stats={stats} onPick={pickDay} />
                </div>
              )}
              <div {...rise(200)} className={cn('dash-rise flex flex-col gap-6', stats ? '@5xl:col-span-4' : '@5xl:col-span-12')}>
                <JobsCard counts={counts} pending={pending} />
                {stats && <HealthCard items={stats.health} />}
              </div>
            </div>

            {stats && (
              <>
                <div {...rise(240)} className="dash-rise grid grid-cols-1 gap-6 @3xl:grid-cols-2 @6xl:grid-cols-3">
                  <TopSponsorsCard stats={stats} />
                  <OriginsCard stats={stats} />
                  <GamesCard stats={stats} />
                </div>

                <div {...rise(280)}>
                  <HeatmapCard stats={stats} />
                </div>

                <div {...rise(320)} className="dash-rise grid grid-cols-1 items-start gap-6 @5xl:grid-cols-12">
                  <div className="@5xl:col-span-7">
                    <EconomyCard stats={stats} />
                  </div>
                  <div className="flex flex-col gap-6 @5xl:col-span-5">
                    <RetentionCard stats={stats} />
                    {counts && <MembersCard counts={counts} />}
                  </div>
                </div>

                <div {...rise(360)}>
                  <SignupsCard stats={stats} />
                </div>
              </>
            )}

            {!stats && counts && <MembersCard counts={counts} />}
            <div {...rise(400)}>
              <AuditCard recent={recent} />
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function toParams(s: DashStats): Params {
  return s.query.preset === 'custom' ? { r: 'custom', from: s.from, to: s.to } : { r: s.query.preset }
}

function EmptyRange({ stats, onGo }: { stats: DashStats; onGo: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-card px-6 py-20 text-center ring-1 ring-border">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <CalendarDays className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-semibold text-foreground">Bu aralıkta veri yok</h3>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground text-pretty">
          {`Site verileri ${trDate(stats.dataStart)} tarihinden başlıyor. Daha yeni bir aralık seç ya da bu ayın özetine geç.`}
        </p>
      </div>
      <button type="button" onClick={onGo} className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
        Bu aya git
      </button>
    </div>
  )
}

const WEEKDAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

function RangePicker({ stats, onApply }: { stats: DashStats; onApply: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(stats.to.slice(0, 7))
  const [start, setStart] = useState<string | null>(stats.from)
  const [end, setEnd] = useState<string | null>(stats.to)
  const [hover, setHover] = useState<string | null>(null)
  const custom = stats.query.preset === 'custom'

  const toggle = () => {
    if (!open) {
      setStart(stats.from)
      setEnd(stats.to)
      setMonth(stats.to.slice(0, 7))
    }
    setOpen(!open)
  }

  const pick = (d: string) => {
    if (!start || end) {
      setStart(d)
      setEnd(null)
    } else if (d < start) {
      setEnd(start)
      setStart(d)
    } else setEnd(d)
  }

  const [y, m] = month.split('-').map(Number)
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells = [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)]
  const title = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const lo = start && (end ?? hover) ? [start, end ?? hover!].sort()[0] : start
  const hi = start && (end ?? hover) ? [start, end ?? hover!].sort()[1] : start
  const canPrev = month > stats.dataStart.slice(0, 7)
  const canNext = month < stats.today.slice(0, 7)
  const label = start ? (end && end !== start ? `${trDate(start)} – ${trDate(end)}` : trDate(start)) : 'Bir gün seç'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium ring-1 transition-colors',
          custom ? 'bg-primary/10 text-primary ring-primary/40' : 'bg-card text-muted-foreground ring-border hover:text-foreground',
        )}
      >
        <CalendarDays className="size-4" aria-hidden="true" />
        {custom ? (stats.from === stats.to ? trDate(stats.from) : `${trDate(stats.from)} – ${trDate(stats.to)}`) : 'Özel tarih'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-label="Tarih aralığı seç"
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            className="absolute left-0 top-full z-40 mt-2 flex w-80 flex-col gap-4 rounded-xl bg-popover p-4 shadow-2xl ring-1 ring-border"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMonth(shiftMonth(month, -1))}
                disabled={!canPrev}
                aria-label="Önceki ay"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <span className="text-sm font-semibold capitalize text-popover-foreground">{title}</span>
              <button
                type="button"
                onClick={() => setMonth(shiftMonth(month, 1))}
                disabled={!canNext}
                aria-label="Sonraki ay"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center" onMouseLeave={() => setHover(null)}>
              {WEEKDAY_SHORT.map((d) => (
                <span key={d} className="pb-1 text-xs font-medium text-muted-foreground">
                  {d}
                </span>
              ))}
              {cells.map((d, i) => {
                if (!d) return <span key={`b${i}`} />
                const disabled = d < stats.dataStart || d > stats.today
                const edge = d === lo || d === hi
                const within = Boolean(lo && hi && d > lo && d < hi)
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(d)}
                    onMouseEnter={() => setHover(d)}
                    aria-pressed={edge}
                    aria-label={trDate(d)}
                    className={cn(
                      'relative h-9 text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-muted-foreground/30',
                      within && 'bg-primary/15 text-foreground',
                      d === lo && hi !== lo && 'rounded-l-lg bg-primary/15',
                      d === hi && hi !== lo && 'rounded-r-lg bg-primary/15',
                      !within && !edge && 'rounded-lg text-popover-foreground enabled:hover:bg-secondary',
                    )}
                  >
                    <span
                      className={cn(
                        'mx-auto flex size-9 items-center justify-center rounded-lg',
                        edge && 'bg-primary font-semibold text-primary-foreground',
                        d === stats.today && !edge && 'ring-1 ring-primary/60',
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium tabular-nums text-popover-foreground">{label}</span>
                <span className="text-xs text-muted-foreground">{start && !end ? 'Bitiş gününü seç ya da tek gün uygula' : `Veriler ${trDate(stats.dataStart)} itibarıyla`}</span>
              </span>
              <button
                type="button"
                disabled={!start}
                onClick={() => {
                  if (!start) return
                  setOpen(false)
                  onApply(start, end ?? start)
                }}
                className="h-8 shrink-0 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Uygula
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Card({
  title,
  sub,
  link,
  action,
  children,
  className,
}: {
  title: string
  sub?: string
  link?: { href: string; label: string }
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex h-full flex-col rounded-2xl bg-card ring-1 ring-border', className)}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        {action}
        {link && (
          <a href={link.href} className="group flex shrink-0 items-center gap-1 pt-0.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            {link.label}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        )}
      </div>
      {children}
    </div>
  )
}

function Delta({ cur, prev, compare }: { cur: number; prev: number; compare: string }) {
  const up = cur > prev
  const same = cur === prev
  const change = prev === 0 ? `+${fmt(cur)}` : `%${Math.abs(Math.round(((cur - prev) / prev) * 100))}`
  const Icon = same ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      title={`${compare}: ${fmt(prev)}`}
      className={cn(
        'flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
        same ? 'bg-secondary text-muted-foreground' : up ? 'bg-live/15 text-live' : 'bg-destructive/15 text-destructive',
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {same ? '0' : change}
      <span className="sr-only">{`, ${compare}: ${fmt(prev)}`}</span>
    </span>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-8" aria-hidden="true" />
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 30 - (v / max) * 26] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full overflow-visible text-primary" aria-hidden="true">
      <path d={`${line} L100,32 L0,32 Z`} fill="currentColor" opacity="0.1" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

type SeriesKey = 'users' | 'active' | 'clicks' | 'kc' | 'games'

function KpiRow({ stats }: { stats: DashStats }) {
  const oneDay = stats.days === 1
  const points = stats.series.filter((x) => !x.future)
  const items: { label: string; pair: { cur: number; prev: number }; href: string; key: SeriesKey }[] = [
    { label: oneDay ? 'Kayıt olan' : 'Yeni üye', pair: stats.newUsers, href: '?b=users', key: 'users' },
    { label: 'İşlem yapan üye', pair: stats.activeMembers, href: '?b=users', key: 'active' },
    { label: 'Sponsor tıklaması', pair: stats.sponsorClicks, href: '?b=growth', key: 'clicks' },
    { label: 'Ödül olarak dağıtılan KC', pair: stats.kcOut, href: '?b=rewards', key: 'kc' },
    { label: 'Oynanan maç', pair: stats.games, href: '?b=games', key: 'games' },
  ]
  const tile = 'flex min-w-0 flex-col gap-2 rounded-2xl bg-card p-5 ring-1 ring-border transition-colors hover:bg-secondary/70'
  return (
    <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-3 @6xl:grid-cols-6">
      <a href="?b=users" {...rise(0)} className={cn('dash-rise', tile)}>
        <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="relative flex size-2" aria-hidden="true">
            <span className={cn('absolute inline-flex size-full rounded-full bg-live opacity-60', stats.online > 0 && 'animate-ping')} />
            <span className="relative inline-flex size-2 rounded-full bg-live" />
          </span>
          Şu an çevrimiçi
        </span>
        <span className="font-display text-3xl font-semibold tabular-nums text-foreground">
          <Num value={stats.online} />
        </span>
        <span className="mt-auto flex flex-col text-xs leading-relaxed text-muted-foreground">
          <span className="truncate">{`Son 1 saatte ${fmt(stats.onlineHour)} kişi`}</span>
          <span className="truncate" title="Son 5 dakikada sitede sayfa açık olan üyeler. Panel ziyaretleri sayılmaz.">
            Son 5 dk · panel sayılmaz
          </span>
        </span>
      </a>
      {items.map((i, idx) => (
        <a key={i.label} href={i.href} {...rise(40 * (idx + 1))} className={cn('dash-rise', tile)}>
          <span className="truncate text-[13px] text-muted-foreground">{i.label}</span>
          <span className="flex items-center justify-between gap-2">
            <span className="font-display text-3xl font-semibold tabular-nums text-foreground">
              <Num value={i.pair.cur} />
            </span>
            {stats.hasPrev && <Delta {...i.pair} compare={stats.compare} />}
          </span>
          <div className="mt-auto">
            <Sparkline values={points.map((p) => p[i.key])} />
          </div>
        </a>
      ))}
    </div>
  )
}

const METRICS = [
  { key: 'users', prev: 'pUsers', label: 'Kayıt' },
  { key: 'clicks', prev: 'pClicks', label: 'Sponsor' },
  { key: 'games', prev: 'pGames', label: 'Maç' },
] as const
const METRIC_NAMES: Record<(typeof METRICS)[number]['key'], string> = { users: 'yeni kayıt', clicks: 'sponsor tıklaması', games: 'maç' }
type Metric = (typeof METRICS)[number]

function niceScale(max: number) {
  if (max <= 0) return { top: 4, ticks: [4, 3, 2, 1, 0] }
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = Math.max(1, ([1, 2, 5, 10].find((f) => f * mag >= raw) ?? 10) * mag)
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = top; v >= 0; v -= step) ticks.push(v)
  return { top, ticks }
}

function TrendCard({ stats, onPick }: { stats: DashStats; onPick: (p: SeriesPoint) => void }) {
  const [metric, setMetric] = useState<Metric>(METRICS[0])
  const [hover, setHover] = useState<number | null>(null)
  const series = stats.series
  const unit = stats.seriesUnit
  const n = series.length
  const showPrev = stats.hasPrev
  const total = series.reduce((s, x) => s + x[metric.key], 0)
  const prevTotal = series.reduce((s, x) => s + x[metric.prev], 0)

  const values = series.filter((x) => !x.future).flatMap((x) => (showPrev ? [x[metric.key], x[metric.prev]] : [x[metric.key]]))
  const { top, ticks } = niceScale(Math.max(0, ...values))
  const every = unit === 'hour' ? 3 : n > 31 ? 7 : n > 14 ? 3 : 1
  const active = hover !== null ? series[hover] : null
  const clickable = unit !== 'hour'
  const title = unit === 'hour' ? 'Saat saat' : unit === 'week' ? 'Hafta hafta' : 'Gün gün'
  const h = (v: number) => `${(v / top) * 100}%`

  return (
    <Card
      title={title}
      sub={clickable ? 'Detayını görmek için bir çubuğa tıkla.' : undefined}
      action={
        <div role="tablist" aria-label="Grafik verisi" className="flex shrink-0 items-center gap-1 rounded-lg bg-secondary/70 p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={metric.key === m.key}
              onClick={() => setMetric(m)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                metric.key === m.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5">
        <span className="font-display text-3xl font-semibold tabular-nums text-foreground">
          <Num value={total} />
        </span>
        <span className="text-sm text-muted-foreground">{`toplam ${METRIC_NAMES[metric.key]}`}</span>
        {showPrev && <Delta cur={total} prev={prevTotal} compare="önceki dönem" />}
        <span className="ml-auto flex items-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" />
            Seçili dönem
          </span>
          {showPrev && (
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-foreground/15" />
              Önceki dönem
            </span>
          )}
        </span>
      </div>

      <div className="flex min-h-72 flex-1 gap-3 px-5 pb-5 pt-5">
        <div className="flex w-8 shrink-0 flex-col justify-between pb-6 text-right text-xs tabular-nums text-muted-foreground" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="leading-none">
              {fmt(t)}
            </span>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative flex-1" onMouseLeave={() => setHover(null)}>
            <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
              {ticks.map((t, i) => (
                <div key={t} className={cn('h-px w-full', i === ticks.length - 1 ? 'bg-border' : 'border-t border-dashed border-border/60')} />
              ))}
            </div>

            <div className="absolute inset-0 flex" role="img" aria-label={`${metric.label}: ${series.map((x) => `${x.label} ${x[metric.key]}`).join(', ')}`}>
              {series.map((x, i) => (
                <button
                  key={x.key}
                  type="button"
                  tabIndex={clickable && !x.future ? 0 : -1}
                  aria-label={`${x.label}: ${x[metric.key]}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onClick={() => clickable && onPick(x)}
                  className={cn('relative h-full flex-1', clickable && !x.future ? 'cursor-pointer' : 'cursor-default')}
                >
                  {hover === i && <span className="absolute inset-y-0 left-0.5 right-0.5 rounded-md bg-foreground/[0.04]" aria-hidden="true" />}
                  {showPrev && (
                    <span
                      className="absolute bottom-0 left-1/2 w-[70%] max-w-11 -translate-x-1/2 rounded-t-[4px] bg-foreground/10 transition-[height] duration-500"
                      style={{ height: h(x[metric.prev]) }}
                    />
                  )}
                  <span
                    className={cn(
                      'absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-[4px] transition-[height,background-color] duration-500',
                      showPrev ? 'w-[42%] max-w-6' : 'w-[62%] max-w-10',
                      x.future ? 'bg-transparent' : hover === i ? 'bg-primary' : 'bg-primary/80',
                    )}
                    style={{ height: h(x[metric.key]), minHeight: x[metric.key] > 0 ? 2 : 0 }}
                  />
                </button>
              ))}
            </div>

            {active && hover !== null && (
              <div
                className={cn(
                  'pointer-events-none absolute top-2 z-10 flex flex-col gap-1 rounded-lg bg-popover px-3 py-2 shadow-lg ring-1 ring-border',
                  hover > n / 2 ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3',
                )}
                style={{ left: `${((hover + 0.5) / n) * 100}%` }}
              >
                <span className="text-xs text-muted-foreground">
                  {unit === 'hour' ? `Saat ${active.label}` : unit === 'week' ? `${active.label} haftası` : active.label}
                </span>
                <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-popover-foreground">
                  {fmt(active[metric.key])} <span className="font-normal text-muted-foreground">{METRIC_NAMES[metric.key]}</span>
                </span>
                {showPrev && <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{`Önceki dönem: ${fmt(active[metric.prev])}`}</span>}
                {clickable && !active.future && <span className="text-xs text-primary">Tıkla, detayına geç</span>}
              </div>
            )}
          </div>

          <div className="relative h-4 text-xs tabular-nums text-muted-foreground" aria-hidden="true">
            {series.map((x, i) =>
              i % every === 0 ? (
                <span key={x.key} className={cn('absolute -translate-x-1/2 whitespace-nowrap', x.future && 'opacity-50')} style={{ left: `${((i + 0.5) / n) * 100}%` }}>
                  {x.label}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

function JobsCard({ counts, pending }: { counts: Props['counts']; pending: PendingDetail }) {
  const jobs = [
    { label: 'Para çekme kanıtları', hint: 'Topluluk › Çekim talepleri', count: pending.withdrawals, href: '?b=community' },
    { label: 'Onay bekleyen yorumlar', hint: 'Topluluk › Yorumlar', count: pending.reviews, href: '?b=community' },
    { label: 'Açık şikâyetler', hint: 'Topluluk › Şikâyetler', count: pending.complaints, href: '?b=community' },
    { label: 'Görev onayları', hint: 'Üyeler › Görevler', count: pending.claims, href: '?b=tasks' },
    { label: 'Market talepleri', hint: 'Üyeler › Market', count: pending.market, href: '?b=market' },
  ]
  const open = jobs.filter((j) => j.count > 0).sort((a, b) => b.count - a.count)
  const total = open.reduce((s, j) => s + j.count, 0)
  const suspects = counts?.supheli ?? 0

  return (
    <Card title="Yapılacaklar" sub={total > 0 ? `${total} iş onayını bekliyor` : undefined} className="h-auto">
      <div className="flex flex-col gap-1 px-3 pb-3">
        {open.length === 0 && suspects === 0 ? (
          <p className="flex items-center gap-2.5 rounded-lg px-2 py-3 text-sm text-muted-foreground">
            <CheckCircle2 className="size-5 text-live" aria-hidden="true" />
            Her şey temiz, bekleyen iş yok.
          </p>
        ) : (
          <>
            {open.map((j) => (
              <a key={j.label} href={j.href} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-semibold tabular-nums text-primary">{j.count}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{j.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{j.hint}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </a>
            ))}
            {suspects > 0 && (
              <a href="?b=users" className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{`${suspects} şüpheli hesap`}</span>
                  <span className="truncate text-xs text-muted-foreground">Aynı IP ya da işaretli kayıt</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </a>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

const STATE: Record<HealthItem['state'], { dot: string; text: string; label: string }> = {
  ok: { dot: 'bg-live', text: 'text-live', label: 'Çalışıyor' },
  off: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'Ayarlı değil' },
  warn: { dot: 'bg-destructive', text: 'text-destructive', label: 'Hata' },
}

function HealthCard({ items }: { items: HealthItem[] }) {
  const errors = items.filter((i) => i.state === 'warn').length
  return (
    <Card title="Sistem durumu" sub={errors ? `${errors} sistemde hata var, kontrol et.` : 'Hata yok. Gri olanlar henüz kurulmamış.'} className="flex-1">
      <ul className="flex flex-col px-5 pb-4">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0">
            <span className={cn('size-2 shrink-0 rounded-full', STATE[i.state].dot)} aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm text-foreground">{i.label}</span>
              <span className="truncate text-xs text-muted-foreground" title={i.note}>
                {i.note}
              </span>
            </span>
            <span className={cn('shrink-0 text-xs font-medium', STATE[i.state].text)}>{STATE[i.state].label}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

type RankItem = { name: string; value: number; sub?: string; muted?: boolean }

function RankList({ items, empty, unit }: { items: RankItem[]; empty: string; unit?: string }) {
  if (items.length === 0) return <p className="px-5 pb-5 pt-1 text-sm text-muted-foreground">{empty}</p>
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ol className="flex flex-col gap-3.5 px-5 pb-5 pt-1">
      {items.map((i, idx) => (
        <li key={`${i.name}-${idx}`} className={cn('flex flex-col gap-1.5', i.muted && 'opacity-60')}>
          <div className="flex items-baseline gap-3 text-sm">
            <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{idx + 1}</span>
            <span className={cn('min-w-0 flex-1 truncate', i.muted ? 'italic text-muted-foreground' : 'text-foreground')} title={i.name}>
              {i.name}
            </span>
            {i.sub && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{i.sub}</span>}
            <span className="shrink-0 font-semibold tabular-nums text-foreground">
              {fmt(i.value)}
              {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
            </span>
          </div>
          <div className="ml-7 h-1 overflow-hidden rounded-full bg-secondary">
            <div className={cn('h-full rounded-full transition-[width] duration-500', i.muted ? 'bg-muted-foreground/50' : 'bg-primary/70')} style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

function MiniStat({ label, value, tone, hint, note }: { label: string; value: React.ReactNode; tone?: 'bad' | 'good'; hint?: string; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-secondary/60 px-3 py-2.5" title={hint}>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className={cn('font-display text-lg font-semibold tabular-nums', tone === 'bad' ? 'text-destructive' : tone === 'good' ? 'text-live' : 'text-foreground')}>{value}</span>
      {note && <span className="truncate text-xs text-muted-foreground">{note}</span>}
    </div>
  )
}

function TopSponsorsCard({ stats }: { stats: DashStats }) {
  const total = stats.topSponsors.reduce((s, x) => s + x.clicks, 0)
  const sorted = [...stats.topSponsors].sort((a, b) => Number(a.name === DELETED_SPONSORS) - Number(b.name === DELETED_SPONSORS) || b.clicks - a.clicks)
  const live = stats.topSponsors.filter((s) => s.name !== DELETED_SPONSORS).length
  return (
    <Card title="En çok tıklanan sponsorlar" link={{ href: '?b=growth', label: 'Trafik raporu' }}>
      <div className="grid grid-cols-2 gap-2 px-5 pb-4">
        <MiniStat label="Toplam yönlendirme" value={<Num value={stats.sponsorClicks.cur} />} />
        <MiniStat label="Tıklanan sponsor" value={fmt(live)} />
      </div>
      <RankList
        items={sorted.map((s) => ({ name: s.name, value: s.clicks, sub: total ? `%${pct(s.clicks, total)}` : undefined, muted: s.name === DELETED_SPONSORS }))}
        empty="Bu aralıkta sponsor tıklaması yok."
        unit="tık"
      />
    </Card>
  )
}

function OriginsCard({ stats }: { stats: DashStats }) {
  const total = stats.origins.reduce((s, x) => s + x.count, 0)
  const top = stats.origins[0]
  return (
    <Card title="Üyeler nereden geliyor" link={{ href: '?b=growth', label: 'Davet sistemi' }}>
      <div className="grid grid-cols-2 gap-2 px-5 pb-4">
        <MiniStat label="Yeni üye" value={<Num value={total} />} />
        <MiniStat label="En çok getiren" value={top ? `%${pct(top.count, total)}` : '–'} note={top?.label} />
      </div>
      <RankList items={stats.origins.map((o) => ({ name: o.label, value: o.count, sub: `%${pct(o.count, total)}` }))} empty="Bu aralıkta yeni üye yok." unit="üye" />
    </Card>
  )
}

function GamesCard({ stats }: { stats: DashStats }) {
  return (
    <Card title="Oyun hareketi" link={{ href: '?b=games', label: 'Oyun ayarları' }}>
      <div className="grid grid-cols-3 gap-2 px-5 pb-4">
        {stats.gameModes.map((m) => (
          <MiniStat key={m.mode} label={m.mode} value={<Num value={m.count} />} note={`${fmt(m.stake)} KC bahis`} />
        ))}
      </div>
      <h4 className="px-5 pb-2 text-xs font-medium text-muted-foreground">En popüler oyunlar</h4>
      <RankList items={stats.topGames.map((g) => ({ name: g.game, value: g.count }))} empty="Bu aralıkta maç oynanmadı." unit="maç" />
    </Card>
  )
}

function EconomyCard({ stats }: { stats: DashStats }) {
  const [tab, setTab] = useState<'odul' | 'oyun'>('odul')
  const list = tab === 'odul' ? stats.rewardEarners : stats.gameWinners
  // Net supply change: rewards paid out plus what players won from the house, minus what they spent in the market.
  const net = stats.kcOut.cur - stats.houseNet - stats.kcSpent
  return (
    <Card title="KC ekonomisi" link={{ href: '?b=rewards', label: 'Ödül ayarları' }}>
      <div className="grid grid-cols-3 gap-2 px-5 pb-2">
        <MiniStat label="Dağıtılan" value={<Num value={stats.kcOut.cur} />} />
        <MiniStat label="Harcanan" value={<Num value={stats.kcSpent} />} />
        <MiniStat label="Kasa kazancı" value={<Num value={stats.houseNet} />} tone={stats.houseNet < 0 ? 'bad' : undefined} />
      </div>
      <div className="grid grid-cols-3 gap-2 px-5 pb-4">
        <MiniStat
          label="Piyasaya net giren"
          value={<Num value={net} signed />}
          note={net > 0 ? 'Ekonomi büyüyor' : net < 0 ? 'Ekonomi daralıyor' : 'Dengede'}
          hint="Dağıtılan + oyuncuların kasadan kazandığı − harcanan. Uzun süre hep artıda kalırsa KC'nin değeri düşer."
        />
        <MiniStat label="Dolaşımdaki KC" value={<Num value={stats.circulation.total} />} note="Tüm cüzdanlar, şu an" />
        <MiniStat label="Üye başına" value={<Num value={stats.circulation.holders ? stats.circulation.total / stats.circulation.holders : 0} />} note="Bakiyesi olanlar" />
      </div>

      {stats.anomalies.length > 0 && (
        <div className="flex flex-col gap-2 px-5 pb-4">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <AlertTriangle className="size-3.5 text-destructive" aria-hidden="true" />
            Bir saatte 2.000+ KC kazananlar
          </span>
          <ul className="flex flex-col overflow-hidden rounded-xl ring-1 ring-destructive/20">
            {stats.anomalies.map((a) => (
              <li key={a.name} className="border-t border-destructive/10 first:border-t-0">
                <a href="?b=users" title="Üye sayfasında incele" className="group flex items-center gap-3 bg-destructive/[0.06] px-3 py-2 text-xs transition-colors hover:bg-destructive/10">
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{a.name}</span>
                  {a.hours > 1 && <span className="shrink-0 rounded-full bg-destructive/15 px-1.5 py-0.5 font-medium text-destructive">{`${a.hours} kez`}</span>}
                  <span className="shrink-0 tabular-nums text-muted-foreground">{shortDateTime(a.at)}</span>
                  <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-foreground">{fmt(a.amount)}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div role="tablist" aria-label="Kazanan listesi" className="mx-5 mb-2 flex gap-1 rounded-lg bg-secondary/60 p-1">
        {[
          { k: 'odul' as const, label: 'Ödülle kazananlar' },
          { k: 'oyun' as const, label: 'Oyunda net kazananlar' },
        ].map((t) => (
          <button
            key={t.k}
            type="button"
            role="tab"
            aria-selected={tab === t.k}
            onClick={() => setTab(t.k)}
            className={cn('flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors', tab === t.k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <RankList items={list.map((e) => ({ name: e.name, value: e.amount }))} empty={tab === 'odul' ? 'Bu aralıkta ödül alan yok.' : 'Bu aralıkta oyundan kârla çıkan yok.'} unit="KC" />
      {list.length >= 5 && (
        <a href="?b=users" className="group mx-5 mb-5 -mt-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground">
          Tümünü gör
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </a>
      )}
    </Card>
  )
}

const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

function HeatmapCard({ stats }: { stats: DashStats }) {
  const grid = stats.heatmap.grid
  const max = Math.max(0, ...grid.flat())
  let peak = { d: 0, h: 0, v: 0 }
  grid.forEach((row, d) => row.forEach((v, h) => v > peak.v && (peak = { d, h, v })))
  const perDay = grid.map((row) => row.reduce((s, v) => s + v, 0))
  const busiestDay = perDay.indexOf(Math.max(...perDay))
  const perHour = Array.from({ length: 24 }, (_, h) => grid.reduce((s, row) => s + row[h], 0))
  const busiestHour = perHour.indexOf(Math.max(...perHour))
  const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

  return (
    <Card title="Site en çok ne zaman hareketli" sub={`${stats.heatmap.label} · oyun, ödül ve sponsor tıklamaları · Türkiye saati`}>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 pb-4">
        {[
          { label: 'En yoğun an', value: peak.v ? `${WEEKDAYS[peak.d]} ${hh(peak.h)}` : '–' },
          { label: 'En yoğun gün', value: max ? WEEKDAYS[busiestDay] : '–' },
          { label: 'En yoğun saat', value: max ? `${hh(busiestHour)} – ${hh((busiestHour + 1) % 24)}` : '–' },
        ].map((x) => (
          <div key={x.label} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{x.label}</span>
            <span className="text-sm font-semibold text-foreground">{x.value}</span>
          </div>
        ))}
        <p className="ml-auto max-w-72 text-right text-xs leading-relaxed text-muted-foreground text-pretty">
          Telegram paylaşımlarını ve etkinlikleri koyu renkli saatlere planla.
        </p>
      </div>
      <div className="overflow-x-auto px-5 pb-5">
        <div className="flex min-w-[720px] flex-col gap-1">
          {grid.map((row, d) => (
            <div key={WEEKDAYS[d]} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">{WEEKDAYS[d]}</span>
              <div className="grid flex-1 grid-cols-24 gap-1">
                {row.map((v, h) => (
                  <span
                    key={h}
                    title={`${WEEKDAYS[d]} ${hh(h)} · ${fmt(v)} hareket`}
                    className={cn('h-8 rounded-md transition-opacity', v ? 'bg-primary' : 'bg-secondary/70')}
                    style={v ? { opacity: 0.12 + 0.88 * (v / max) } : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1" aria-hidden="true">
            <span className="w-20 shrink-0" />
            <div className="grid flex-1 grid-cols-24 gap-1 text-center text-xs tabular-nums text-muted-foreground">
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h}>{String(h).padStart(2, '0')}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 text-xs text-muted-foreground" aria-hidden="true">
            Sakin
            {[0.12, 0.34, 0.56, 0.78, 1].map((o) => (
              <span key={o} className="size-3 rounded-sm bg-primary" style={{ opacity: o }} />
            ))}
            Yoğun
          </div>
        </div>
      </div>
    </Card>
  )
}

function RetentionCard({ stats }: { stats: DashStats }) {
  const r = stats.retention
  const rows = [
    { label: 'Ertesi gün döndü', hint: 'Kayıttan en az 1 gün sonra tekrar işlem yapan', got: r.d1, of: r.d1Eligible },
    { label: '7 gün sonra aktif', hint: 'Kayıttan en az 7 gün sonra tekrar işlem yapan', got: r.d7, of: r.d7Eligible },
  ]
  return (
    <Card title="Geri dönen üyeler" sub={`Bu aralıkta kayıt olan ${fmt(r.cohort)} üye`} className="h-auto">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 pb-5 pt-1">
        {rows.map((x) => (
          <div key={x.label} className="flex flex-col gap-2" title={x.hint}>
            <span className="text-xs text-muted-foreground">{x.label}</span>
            {x.of > 0 ? (
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-semibold tabular-nums text-foreground">{`%${pct(x.got, x.of)}`}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{`${fmt(x.got)}/${fmt(x.of)}`}</span>
              </span>
            ) : (
              <span className="text-sm leading-relaxed text-muted-foreground text-pretty">
                {r.cohort === 0
                  ? 'Bu aralıkta yeni kayıt yok'
                  : `Kayıt olanlar henüz ${x.label.startsWith('7') ? '7 günlük' : '1 günlük'} olmadı, daha geniş aralık seç`}
              </span>
            )}
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct(x.got, x.of)}%` }} />
            </div>
          </div>
        ))}
        <p className="col-span-2 text-xs leading-relaxed text-muted-foreground text-pretty">
          Oran düşükse yeni gelenler siteyi bir kere deneyip bırakıyor demek. Site turu ödülü ve ilk gün görevleri bunu yükseltir.
        </p>
      </div>
    </Card>
  )
}

function SignupsCard({ stats }: { stats: DashStats }) {
  return (
    <Card title="Yeni kayıtlar" sub="Son kayıt olanlar ve şimdiye kadar kazandıkları KC" link={{ href: '?b=users', label: 'Tüm üyeler' }}>
      {stats.signups.length === 0 ? (
        <p className="px-5 pb-5 pt-1 text-sm text-muted-foreground">Bu aralıkta kayıt yok.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-8 px-5 pb-3 @3xl:grid-cols-2">
          {stats.signups.map((s, i) => (
            <li key={`${s.name}-${i}`} className="flex items-center gap-3 border-t border-border py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-foreground" aria-hidden="true">
                {s.name.slice(0, 1)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-foreground">{s.name}</span>
                <span className="truncate text-xs text-muted-foreground">{`${s.src} · ${shortDateTime(s.at)}`}</span>
              </span>
              <span className={cn('shrink-0 text-sm font-semibold tabular-nums', s.earned >= 1000 ? 'text-destructive' : 'text-foreground')}>
                {fmt(s.earned)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">KC</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const MEMBER_ROWS: { key: MemberStatus | 'tumu'; label: string }[] = [
  { key: 'aktif', label: 'Aktif hesap' },
  { key: 'donduruldu', label: 'Dondurulan' },
  { key: 'banli', label: 'Banlı' },
  { key: 'supheli', label: 'Şüpheli' },
]

function MembersCard({ counts }: { counts: NonNullable<Props['counts']> }) {
  return (
    <Card title="Üyeler" sub="Şu anki durum" link={{ href: '?b=users', label: 'Tüm üyeler' }} className="h-auto">
      <div className="flex items-baseline gap-2 px-5 pb-4">
        <span className="font-display text-3xl font-semibold tabular-nums text-foreground">
          <Num value={counts.tumu} />
        </span>
        <span className="text-sm text-muted-foreground">toplam üye</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 px-5 pb-5 @6xl:grid-cols-4 @5xl:grid-cols-2">
        {MEMBER_ROWS.map((r) => (
          <div key={r.key} className="flex flex-col gap-1 rounded-xl bg-secondary/60 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className={cn('font-display text-lg font-semibold tabular-nums', r.key === 'supheli' && counts[r.key] > 0 ? 'text-destructive' : 'text-foreground')}>
              {fmt(counts[r.key])}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function AuditCard({ recent }: { recent: AuditRow[] }) {
  return (
    <Card title="Son yönetici işlemleri" link={{ href: '?b=audit', label: 'Tümünü gör' }}>
      {recent.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">Henüz kayıt yok.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-8 px-5 pb-3 @3xl:grid-cols-2">
          {recent.map((r) => {
            const actor = r.actor.replace(/\s*\(@.*\)$/, '')
            return (
              <li key={r.id} className="flex items-center gap-3 border-t border-border py-2.5 text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-foreground" aria-hidden="true">
                  {actor.slice(0, 1)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-foreground">
                    <span className="font-semibold">{actor}</span>
                    <span className="text-muted-foreground"> · </span>
                    {r.action}
                    {r.detail && <span className="font-semibold text-primary"> {r.detail.split(' · ')[0]}</span>}
                  </span>
                  {r.target && (
                    <span className="truncate text-xs text-muted-foreground" title={r.target}>
                      {r.target}
                    </span>
                  )}
                </span>
                <time dateTime={r.createdAt} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {shortDateTime(r.createdAt)}
                </time>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function downloadCsv(s: DashStats) {
  const cell = (v: string | number) => {
    const t = String(v)
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const lines: (string | number)[][] = [
    ['Alkanka panel raporu', s.title],
    ['Aralık', `${s.from} – ${s.to}`],
    [],
    ['Özet', 'Seçili dönem', 'Önceki dönem'],
    ['Yeni üye', s.newUsers.cur, s.newUsers.prev],
    ['İşlem yapan üye', s.activeMembers.cur, s.activeMembers.prev],
    ['Sponsor tıklaması', s.sponsorClicks.cur, s.sponsorClicks.prev],
    ['Dağıtılan KC', s.kcOut.cur, s.kcOut.prev],
    ['Oynanan maç', s.games.cur, s.games.prev],
    ['Harcanan KC', s.kcSpent],
    ['Kasa kazancı', s.houseNet],
    [],
    [s.seriesUnit === 'hour' ? 'Saat' : s.seriesUnit === 'week' ? 'Hafta' : 'Gün', 'Yeni kayıt', 'İşlem yapan', 'Sponsor tıklaması', 'Dağıtılan KC', 'Oynanan maç'],
    ...s.series.filter((x) => !x.future).map((x) => [s.seriesUnit === 'hour' ? `${s.from} ${x.label}` : x.date, x.users, x.active, x.clicks, x.kc, x.games]),
    [],
    ['Sponsor', 'Tıklama'],
    ...s.topSponsors.map((x) => [x.name, x.clicks]),
    [],
    ['Üye kaynağı', 'Üye'],
    ...s.origins.map((x) => [x.label, x.count]),
  ]
  const csv = '\uFEFF' + lines.map((l) => l.map(cell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `alkanka-rapor-${s.from}_${s.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
