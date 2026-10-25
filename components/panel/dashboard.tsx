'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, Download, Minus, RefreshCw, X } from 'lucide-react'
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

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR')
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const clock = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

const PRESETS: { value: Exclude<DashPreset, 'custom'>; label: string }[] = [
  { value: 'today', label: 'Bugün' },
  { value: 'yesterday', label: 'Dün' },
  { value: '7', label: '7 gün' },
  { value: '30', label: '30 gün' },
  { value: 'month', label: 'Bu ay' },
  { value: 'lastmonth', label: 'Geçen ay' },
]

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

  return (
    <section aria-label="Genel bakış" className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-xl font-semibold text-foreground">{stats?.title ?? 'Genel bakış'}</h2>
          {stats && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{stats.hasPrev ? `Rakamlar ${stats.compare} ile karşılaştırılıyor.` : 'Bu aralık için karşılaştırılacak önceki veri yok.'}</span>
              <span aria-hidden="true">·</span>
              <span>
                {`Son güncelleme ${clock(stats.generatedAt)}`}
                {stats.live && ', her dakika yenilenir'}
              </span>
            </p>
          )}
        </div>
        {stats && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing || loading}
              aria-label="Yenile"
              title="Şimdi yenile"
              className="flex size-9 items-center justify-center rounded-lg bg-card text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground disabled:opacity-60"
            >
              <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(stats)}
              className="flex h-9 items-center gap-2 rounded-lg bg-card px-3 text-sm font-medium text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground"
            >
              <Download className="size-4" aria-hidden="true" />
              {"Excel'e indir"}
            </button>
          </div>
        )}
      </header>

      {stats && (
        <div className="flex items-center gap-3">
          <div role="tablist" aria-label="Zaman aralığı" className="flex items-center gap-1 rounded-lg bg-card p-1 ring-1 ring-border">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="tab"
                aria-selected={stats.query.preset === p.value}
                onClick={() => stats.query.preset !== p.value && load({ r: p.value })}
                className={cn(
                  'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
                  stats.query.preset === p.value ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
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

      <div aria-busy={loading} className={cn('flex flex-col gap-6 transition-opacity duration-200', loading && 'pointer-events-none opacity-50')}>
        {stats && <KpiRow stats={stats} />}

        <div className="grid grid-cols-12 gap-6">
          {stats && (
            <div className="col-span-8">
              <TrendCard stats={stats} onPick={pickDay} />
            </div>
          )}
          <div className={cn('flex flex-col gap-6', stats ? 'col-span-4' : 'col-span-12')}>
            <JobsCard counts={counts} pending={pending} />
            {stats && <HealthCard items={stats.health} />}
          </div>
        </div>

        {stats && (
          <>
            <div className="grid grid-cols-3 gap-6">
              <TopSponsorsCard stats={stats} />
              <OriginsCard stats={stats} />
              <GamesCard stats={stats} />
            </div>
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-5">
                <EconomyCard stats={stats} />
              </div>
              <div className="col-span-7 flex flex-col gap-6">
                <HeatmapCard stats={stats} />
                <RetentionCard stats={stats} />
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-12 gap-6">
          {stats && (
            <div className={counts ? 'col-span-8' : 'col-span-12'}>
              <SignupsCard stats={stats} />
            </div>
          )}
          {counts && (
            <div className={stats ? 'col-span-4' : 'col-span-12'}>
              <MembersCard counts={counts} />
            </div>
          )}
        </div>

        <AuditCard recent={recent} />
      </div>
    </section>
  )
}

function toParams(s: DashStats): Params {
  return s.query.preset === 'custom' ? { r: 'custom', from: s.from, to: s.to } : { r: s.query.preset }
}

function RangePicker({ stats, onApply }: { stats: DashStats; onApply: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(stats.from)
  const [to, setTo] = useState(stats.to)
  const custom = stats.query.preset === 'custom'
  const tr = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`
  const valid = Boolean(from && to && from <= to)

  const toggle = () => {
    if (!open) {
      setFrom(stats.from)
      setTo(stats.to)
    }
    setOpen(!open)
  }

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
        {custom ? (stats.from === stats.to ? tr(stats.from) : `${tr(stats.from)} – ${tr(stats.to)}`) : 'Özel tarih'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-label="Tarih aralığı seç"
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            className="absolute left-0 top-full z-40 mt-2 flex w-80 flex-col gap-4 rounded-xl bg-popover p-4 shadow-xl ring-1 ring-border"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-popover-foreground">Tarih aralığı</span>
              <span className="text-xs text-muted-foreground">{`Tek gün için iki tarihi aynı seç. Veriler ${tr(stats.dataStart)} tarihinden itibaren var.`}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                Başlangıç
                <input
                  type="date"
                  value={from}
                  min={stats.dataStart}
                  max={stats.today}
                  onChange={(e) => {
                    setFrom(e.target.value)
                    if (e.target.value > to) setTo(e.target.value)
                  }}
                  className="h-9 rounded-md bg-secondary px-2 text-sm text-foreground ring-1 ring-border [color-scheme:dark] focus:outline-none focus:ring-primary"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                Bitiş
                <input
                  type="date"
                  value={to}
                  min={from || stats.dataStart}
                  max={stats.today}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9 rounded-md bg-secondary px-2 text-sm text-foreground ring-1 ring-border [color-scheme:dark] focus:outline-none focus:ring-primary"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground">
                Vazgeç
              </button>
              <button
                type="button"
                disabled={!valid}
                onClick={() => {
                  setOpen(false)
                  onApply(from, to)
                }}
                className="h-8 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
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

function Card({ title, sub, link, children, className }: { title: string; sub?: string; link?: { href: string; label: string }; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-full flex-col rounded-xl bg-card ring-1 ring-border', className)}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
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

function Delta({ cur, prev, compare, hasPrev }: { cur: number; prev: number; compare: string; hasPrev: boolean }) {
  if (!hasPrev) return <span className="text-xs text-muted-foreground">Karşılaştırma için veri yok</span>
  const up = cur > prev
  const same = cur === prev
  const change = prev === 0 ? `+${fmt(cur)}` : `%${Math.abs(Math.round(((cur - prev) / prev) * 100))}`
  const Icon = same ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="flex min-w-0 items-center gap-2 text-xs">
      <span
        className={cn(
          'flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums',
          same ? 'bg-secondary text-muted-foreground' : up ? 'bg-live/15 text-live' : 'bg-destructive/15 text-destructive',
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
        {same ? '0' : change}
      </span>
      <span className="truncate text-muted-foreground" title={`${compare}: ${fmt(prev)}`}>
        {`${compare}: ${fmt(prev)}`}
      </span>
    </span>
  )
}

function KpiRow({ stats }: { stats: DashStats }) {
  const oneDay = stats.days === 1
  const items = [
    { label: oneDay ? 'Kayıt olan' : 'Yeni üye', pair: stats.newUsers, href: '?b=users' },
    { label: 'İşlem yapan üye', pair: stats.activeMembers, href: '?b=users' },
    { label: 'Sponsor tıklaması', pair: stats.sponsorClicks, href: '?b=growth' },
    { label: 'Ödül olarak dağıtılan KC', pair: stats.kcOut, href: '?b=rewards' },
    { label: 'Oynanan maç', pair: stats.games, href: '?b=games' },
  ]
  return (
    <div className="grid grid-cols-6 gap-4">
      <a href="?b=users" className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-border transition-colors hover:bg-secondary">
        <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="relative flex size-2" aria-hidden="true">
            <span className={cn('absolute inline-flex size-full rounded-full bg-live opacity-60', stats.online > 0 && 'animate-ping')} />
            <span className="relative inline-flex size-2 rounded-full bg-live" />
          </span>
          Şu an çevrimiçi
        </span>
        <span className="font-display text-3xl font-semibold tabular-nums text-foreground">{fmt(stats.online)}</span>
        <span className="truncate text-xs text-muted-foreground">{`Son 1 saatte ${fmt(stats.onlineHour)} kişi`}</span>
      </a>
      {items.map((i) => (
        <a key={i.label} href={i.href} className="flex min-w-0 flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-border transition-colors hover:bg-secondary">
          <span className="truncate text-[13px] text-muted-foreground">{i.label}</span>
          <span className="font-display text-3xl font-semibold tabular-nums text-foreground">{fmt(i.pair.cur)}</span>
          <Delta {...i.pair} compare={stats.compare} hasPrev={stats.hasPrev} />
        </a>
      ))}
    </div>
  )
}

const METRICS = [
  { key: 'users', prev: 'pUsers', label: 'Yeni kayıt' },
  { key: 'clicks', prev: 'pClicks', label: 'Sponsor tıklaması' },
  { key: 'games', prev: 'pGames', label: 'Oynanan maç' },
] as const
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

const W = 1000
const H = 240

function TrendCard({ stats, onPick }: { stats: DashStats; onPick: (p: SeriesPoint) => void }) {
  const [metric, setMetric] = useState<Metric>(METRICS[0])
  const [hover, setHover] = useState<number | null>(null)
  const series = stats.series
  const unit = stats.seriesUnit
  const n = series.length
  const total = (m: Metric) => series.reduce((s, x) => s + x[m.key], 0)
  const prevTotal = (m: Metric) => series.reduce((s, x) => s + x[m.prev], 0)
  const showPrev = stats.hasPrev

  const values = series.filter((x) => !x.future).flatMap((x) => (showPrev ? [x[metric.key], x[metric.prev]] : [x[metric.key]]))
  const { top, ticks } = niceScale(Math.max(0, ...values))
  const xAt = (i: number) => ((i + 0.5) / Math.max(1, n)) * W
  const yAt = (v: number) => H - (v / top) * H
  const prevLine = series.map((x, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(x[metric.prev])}`).join(' ')
  const every = unit === 'hour' ? 3 : n > 31 ? 7 : n > 14 ? 3 : 1
  const active = hover !== null ? series[hover] : null
  const clickable = unit !== 'hour'
  const title = unit === 'hour' ? 'Saat saat' : unit === 'week' ? 'Hafta hafta' : 'Gün gün'

  return (
    <Card title={title} sub={clickable ? 'Detayını görmek için bir çubuğa tıkla.' : undefined}>
      <div role="tablist" aria-label="Grafik verisi" className="grid grid-cols-3 gap-3 px-5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={metric.key === m.key}
            onClick={() => setMetric(m)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-lg px-4 py-3 text-left ring-1 transition-colors',
              metric.key === m.key ? 'bg-primary/10 ring-primary/40' : 'ring-border hover:bg-secondary',
            )}
          >
            <span className={cn('text-xs font-medium', metric.key === m.key ? 'text-primary' : 'text-muted-foreground')}>{m.label}</span>
            <span className="flex items-baseline gap-2">
              <span className="font-display text-xl font-semibold tabular-nums text-foreground">{fmt(total(m))}</span>
              {showPrev && <span className="text-xs tabular-nums text-muted-foreground">{`önceki: ${fmt(prevTotal(m))}`}</span>}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 px-5 pt-4 text-xs text-muted-foreground" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" />
          Seçili dönem
        </span>
        {showPrev && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-muted-foreground" />
            Önceki dönem
          </span>
        )}
      </div>

      <div className="flex min-h-72 flex-1 gap-3 px-5 pb-5 pt-4">
        <div className="flex w-8 shrink-0 flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
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
                <div key={t} className={cn('h-px w-full', i === ticks.length - 1 ? 'bg-border' : 'border-t border-dashed border-border/70')} />
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
                  <span
                    className={cn(
                      'absolute bottom-0 left-1/2 w-[64%] max-w-10 -translate-x-1/2 rounded-t-[3px] transition-colors',
                      x.future ? 'bg-transparent' : hover === i ? 'bg-primary' : 'bg-primary/75',
                    )}
                    style={{ height: `${(x[metric.key] / top) * 100}%`, minHeight: x[metric.key] > 0 ? 2 : 0 }}
                  />
                </button>
              ))}
            </div>

            {showPrev && (
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible text-muted-foreground" aria-hidden="true">
                <path d={prevLine} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
            )}

            {active && hover !== null && (
              <div
                className={cn(
                  'pointer-events-none absolute top-2 z-10 flex flex-col gap-1 rounded-lg bg-popover px-3 py-2 shadow-lg ring-1 ring-border',
                  hover > n / 2 ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3',
                )}
                style={{ left: `${(xAt(hover) / W) * 100}%` }}
              >
                <span className="text-[11px] text-muted-foreground">
                  {unit === 'hour' ? `Saat ${active.label}` : unit === 'week' ? `${active.label} haftası` : active.label}
                </span>
                <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-popover-foreground">
                  {fmt(active[metric.key])} <span className="font-normal text-muted-foreground">{metric.label.toLowerCase()}</span>
                </span>
                {showPrev && <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{`Önceki dönem: ${fmt(active[metric.prev])}`}</span>}
                {clickable && !active.future && <span className="text-[11px] text-primary">Tıkla, detayına geç</span>}
              </div>
            )}
          </div>

          <div className="relative h-4 text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
            {series.map((x, i) =>
              i % every === 0 ? (
                <span key={x.key} className={cn('absolute -translate-x-1/2 whitespace-nowrap', x.future && 'opacity-50')} style={{ left: `${(xAt(i) / W) * 100}%` }}>
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
    <Card title="Yapılacaklar" className="h-auto">
      <div className="flex flex-col gap-1 px-3 pb-3">
        {open.length === 0 && suspects === 0 ? (
          <p className="flex items-center gap-2.5 rounded-lg px-2 py-3 text-sm text-muted-foreground">
            <CheckCircle2 className="size-5 text-live" aria-hidden="true" />
            Her şey temiz, bekleyen iş yok.
          </p>
        ) : (
          <>
            {total > 0 && <p className="px-2 pb-1 text-xs text-muted-foreground">{`${total} iş onayını bekliyor`}</p>}
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
    <Card title="Sistem durumu" className="flex-1">
      <p className={cn('px-5 pb-2 text-xs', errors ? 'text-destructive' : 'text-muted-foreground')}>
        {errors ? `${errors} sistemde hata var, kontrol et.` : 'Hata yok. Gri olanlar henüz kurulmamış.'}
      </p>
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

function RankList({ items, empty, unit }: { items: { name: string; value: number; sub?: string }[]; empty: string; unit?: string }) {
  if (items.length === 0) return <p className="px-5 pb-5 pt-1 text-sm text-muted-foreground">{empty}</p>
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ol className="flex flex-col gap-3.5 px-5 pb-5 pt-1">
      {items.map((i, idx) => (
        <li key={`${i.name}-${idx}`} className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-3 text-sm">
            <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{idx + 1}</span>
            <span className="min-w-0 flex-1 truncate text-foreground" title={i.name}>
              {i.name}
            </span>
            {i.sub && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{i.sub}</span>}
            <span className="shrink-0 font-semibold tabular-nums text-foreground">
              {fmt(i.value)}
              {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
            </span>
          </div>
          <div className="ml-7 h-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

function MiniStat({ label, value, tone, hint }: { label: string; value: string; tone?: 'bad' | 'good'; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-secondary/60 px-3 py-2.5" title={hint}>
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('font-display text-lg font-semibold tabular-nums', tone === 'bad' ? 'text-destructive' : tone === 'good' ? 'text-live' : 'text-foreground')}>{value}</span>
    </div>
  )
}

function TopSponsorsCard({ stats }: { stats: DashStats }) {
  const total = stats.topSponsors.reduce((s, x) => s + x.clicks, 0)
  return (
    <Card title="En çok tıklanan sponsorlar" link={{ href: '?b=growth', label: 'Trafik raporu' }}>
      <div className="grid grid-cols-2 gap-2 px-5 pb-4">
        <MiniStat label="Toplam yönlendirme" value={fmt(stats.sponsorClicks.cur)} />
        <MiniStat label="Tıklanan sponsor" value={fmt(stats.topSponsors.length)} />
      </div>
      <RankList
        items={stats.topSponsors.map((s) => ({ name: s.name, value: s.clicks, sub: total ? `%${pct(s.clicks, total)}` : undefined }))}
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
        <MiniStat label="Yeni üye" value={fmt(total)} />
        <MiniStat label="En çok getiren" value={top ? `%${pct(top.count, total)}` : '–'} hint={top?.label} />
      </div>
      <RankList
        items={stats.origins.map((o) => ({ name: o.label, value: o.count, sub: `%${pct(o.count, total)}` }))}
        empty="Bu aralıkta yeni üye yok."
        unit="üye"
      />
    </Card>
  )
}

function GamesCard({ stats }: { stats: DashStats }) {
  return (
    <Card title="Oyun hareketi" link={{ href: '?b=games', label: 'Oyun ayarları' }}>
      <div className="grid grid-cols-3 gap-2 px-5 pb-4">
        {stats.gameModes.map((m) => (
          <div key={m.mode} className="flex min-w-0 flex-col gap-1 rounded-lg bg-secondary/60 px-3 py-2.5">
            <span className="truncate text-[11px] text-muted-foreground">{m.mode}</span>
            <span className="font-display text-lg font-semibold tabular-nums text-foreground">{fmt(m.count)}</span>
            <span className="truncate text-[11px] tabular-nums text-muted-foreground">{`${fmt(m.stake)} KC bahis`}</span>
          </div>
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
        <MiniStat label="Dağıtılan" value={fmt(stats.kcOut.cur)} />
        <MiniStat label="Harcanan" value={fmt(stats.kcSpent)} />
        <MiniStat label="Kasa kazancı" value={fmt(stats.houseNet)} tone={stats.houseNet < 0 ? 'bad' : undefined} />
      </div>
      <div className="grid grid-cols-3 gap-2 px-5 pb-4">
        <MiniStat
          label="Piyasaya net giren"
          value={`${net > 0 ? '+' : ''}${fmt(net)}`}
          tone={net > 0 ? 'bad' : 'good'}
          hint="Dağıtılan + oyuncuların kasadan kazandığı − harcanan. Sürekli artıda olması ekonominin şiştiğini gösterir."
        />
        <MiniStat label="Dolaşımdaki KC" value={fmt(stats.circulation.total)} hint="Tüm cüzdanlardaki toplam bakiye (şu an)" />
        <MiniStat label="Üye başına" value={fmt(stats.circulation.holders ? stats.circulation.total / stats.circulation.holders : 0)} hint="Bakiyesi olan üyelerin ortalaması" />
      </div>

      {stats.anomalies.length > 0 && (
        <div className="flex flex-col gap-1.5 px-5 pb-4">
          <span className="text-xs font-medium text-muted-foreground">Bir saatte 2.000+ KC kazananlar</span>
          <ul className="flex flex-col gap-1">
            {stats.anomalies.map((a) => (
              <li key={`${a.name}-${a.at}`} className="flex items-center gap-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs">
                <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-foreground">{a.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{shortDateTime(a.at)}</span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">{fmt(a.amount)}</span>
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
    </Card>
  )
}

const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
const WEEKDAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

function HeatmapCard({ stats }: { stats: DashStats }) {
  const grid = stats.heatmap.grid
  const max = Math.max(0, ...grid.flat())
  let peak = { d: 0, h: 0, v: 0 }
  grid.forEach((row, d) => row.forEach((v, h) => v > peak.v && (peak = { d, h, v })))
  const quiet = grid.map((row) => row.reduce((s, v) => s + v, 0))
  const busiestDay = quiet.indexOf(Math.max(...quiet))

  return (
    <Card title="Site en çok ne zaman hareketli" sub={`${stats.heatmap.label} · oyun, ödül ve sponsor tıklamaları`}>
      <div className="flex gap-6 px-5 pb-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">En yoğun saat</span>
          <span className="text-sm font-semibold text-foreground">{peak.v ? `${WEEKDAYS[peak.d]} ${String(peak.h).padStart(2, '0')}:00` : '–'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">En yoğun gün</span>
          <span className="text-sm font-semibold text-foreground">{max ? WEEKDAYS[busiestDay] : '–'}</span>
        </div>
        <p className="ml-auto max-w-64 self-center text-right text-xs leading-relaxed text-muted-foreground">Telegram paylaşımlarını ve etkinlikleri koyu renkli saatlere planla.</p>
      </div>
      <div className="flex flex-col gap-1 px-5 pb-5">
        {grid.map((row, d) => (
          <div key={WEEKDAYS[d]} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[11px] text-muted-foreground">{WEEKDAY_SHORT[d]}</span>
            <div className="grid flex-1 grid-cols-24 gap-0.5">
              {row.map((v, h) => (
                <span
                  key={h}
                  title={`${WEEKDAYS[d]} ${String(h).padStart(2, '0')}:00 · ${fmt(v)} hareket`}
                  className={cn('h-7 rounded-[3px]', v ? 'bg-primary' : 'bg-secondary/70')}
                  style={v ? { opacity: 0.15 + 0.85 * (v / max) } : undefined}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1" aria-hidden="true">
          <span className="w-8 shrink-0" />
          <div className="grid flex-1 grid-cols-24 gap-0.5 text-[10px] tabular-nums text-muted-foreground">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h}>{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function RetentionCard({ stats }: { stats: DashStats }) {
  const r = stats.retention
  const rows = [
    { label: 'Ertesi gün geri döndü', hint: 'Kayıttan en az 1 gün sonra tekrar işlem yapan', got: r.d1, of: r.d1Eligible },
    { label: '7 gün sonra hâlâ aktif', hint: 'Kayıttan en az 7 gün sonra tekrar işlem yapan', got: r.d7, of: r.d7Eligible },
  ]
  return (
    <Card title="Geri dönen üyeler" sub={`Bu aralıkta kayıt olan ${fmt(r.cohort)} üye`} className="h-auto flex-1">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-5 pb-5 pt-1">
        {rows.map((x) => (
          <div key={x.label} className="flex flex-col gap-2" title={x.hint}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-foreground">{x.label}</span>
              {x.of > 0 ? (
                <span className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-semibold tabular-nums text-foreground">{`%${pct(x.got, x.of)}`}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{`${fmt(x.got)}/${fmt(x.of)}`}</span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Henüz ölçülemez</span>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct(x.got, x.of)}%` }} />
            </div>
          </div>
        ))}
        <p className="col-span-2 text-xs leading-relaxed text-muted-foreground">Oran düşükse yeni gelenler siteyi bir kere deneyip bırakıyor demek. Site turu ödülü ve ilk gün görevleri bunu yükseltir.</p>
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
        <ul className="grid grid-cols-2 gap-x-8 px-5 pb-3">
          {stats.signups.map((s, i) => (
            <li key={`${s.name}-${i}`} className="flex items-center gap-3 border-t border-border py-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-foreground" aria-hidden="true">
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
    <Card title="Üyeler" sub="Şu anki durum" link={{ href: '?b=users', label: 'Tüm üyeler' }}>
      <div className="flex items-baseline gap-2 px-5 pb-4">
        <span className="font-display text-3xl font-semibold tabular-nums text-foreground">{fmt(counts.tumu)}</span>
        <span className="text-sm text-muted-foreground">toplam üye</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 px-5 pb-5">
        {MEMBER_ROWS.map((r) => (
          <div key={r.key} className="flex flex-col gap-1 rounded-lg bg-secondary/60 px-3 py-2.5">
            <dt className="text-[11px] text-muted-foreground">{r.label}</dt>
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
        <ul className="grid grid-cols-2 gap-x-8 px-5 pb-3">
          {recent.map((r) => {
            const actor = r.actor.replace(/\s*\(@.*\)$/, '')
            return (
              <li key={r.id} className="flex items-center gap-3 border-t border-border py-2.5 text-sm">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-foreground" aria-hidden="true">
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
    [s.seriesUnit === 'hour' ? 'Saat' : s.seriesUnit === 'week' ? 'Hafta' : 'Gün', 'Yeni kayıt', 'Sponsor tıklaması', 'Oynanan maç'],
    ...s.series.filter((x) => !x.future).map((x) => [s.seriesUnit === 'hour' ? `${s.from} ${x.label}` : x.date, x.users, x.clicks, x.games]),
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
