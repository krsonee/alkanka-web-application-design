'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Minus } from 'lucide-react'
import { loadDashStats } from '@/app/panel/dash-actions'
import type { AuditRow, MemberStatus } from '@/lib/members-admin'
import type { PendingDetail } from '@/lib/panel-pending'
import type { DashStats, HealthItem } from '@/lib/panel-stats'
import { cn } from '@/lib/utils'

type Props = {
  counts: Record<MemberStatus | 'tumu', number> | null
  pending: PendingDetail
  recent: AuditRow[]
  stats: DashStats | null
}

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR')
const RANGES = [
  { value: 1, label: 'Bugün', title: 'Bugünün özeti', compare: 'dün bu saate' },
  { value: 7, label: '7 gün', title: 'Son 7 günün özeti', compare: 'önceki 7 gün' },
  { value: 30, label: '30 gün', title: 'Son 30 günün özeti', compare: 'önceki 30 gün' },
] as const

export function PanelDashboard({ counts, pending, recent, stats: initial }: Props) {
  const [stats, setStats] = useState(initial)
  const [range, setRange] = useState<number>(initial?.range ?? 1)
  const [loading, startTransition] = useTransition()

  const changeRange = (next: number) => {
    if (next === range) return
    setRange(next)
    startTransition(async () => {
      const fresh = await loadDashStats(next)
      if (fresh) setStats(fresh)
      const url = new URL(window.location.href)
      if (next === 1) url.searchParams.delete('r')
      else url.searchParams.set('r', String(next))
      window.history.replaceState(null, '', url)
    })
  }

  const meta = RANGES.find((r) => r.value === range) ?? RANGES[0]

  return (
    <section aria-label="Genel bakış" className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-semibold text-foreground">{meta.title}</h2>
          <p className="text-sm text-muted-foreground">Rakamlar {meta.compare} ile karşılaştırılıyor. Kartlara tıklayınca ilgili bölüme gidersin.</p>
        </div>
        {stats && (
          <div role="tablist" aria-label="Zaman aralığı" className="flex shrink-0 items-center gap-1 rounded-lg bg-card p-1 ring-1 ring-border">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="tab"
                aria-selected={range === r.value}
                onClick={() => changeRange(r.value)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  range === r.value ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div aria-busy={loading} className={cn('flex flex-col gap-6 transition-opacity duration-200', loading && 'pointer-events-none opacity-50')}>
        {stats && <KpiRow stats={stats} compare={meta.compare} />}

        <div className="grid grid-cols-12 gap-6">
          {stats && (
            <div className="col-span-8">
              <TrendCard stats={stats} />
            </div>
          )}
          <div className={cn('flex flex-col gap-6', stats ? 'col-span-4' : 'col-span-12')}>
            <JobsCard counts={counts} pending={pending} />
            {stats && <HealthCard items={stats.health} />}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-6">
            <TopSponsorsCard stats={stats} />
            <EconomyCard stats={stats} />
            <GamesCard stats={stats} />
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {counts && (
            <div className="col-span-4">
              <MembersCard counts={counts} />
            </div>
          )}
          <div className={counts ? 'col-span-8' : 'col-span-12'}>
            <AuditCard recent={recent} />
          </div>
        </div>
      </div>
    </section>
  )
}

function Card({ title, link, children, className }: { title: string; link?: { href: string; label: string }; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-full flex-col rounded-xl bg-card ring-1 ring-border', className)}>
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        {link && (
          <a href={link.href} className="group flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
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
  const pct = prev === 0 ? null : Math.round(((cur - prev) / prev) * 100)
  const Icon = same ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums',
          same ? 'bg-secondary text-muted-foreground' : up ? 'bg-live/15 text-live' : 'bg-destructive/15 text-destructive',
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
        {same ? '0' : pct === null ? 'yeni' : `%${Math.abs(pct)}`}
      </span>
      <span className="truncate text-muted-foreground">
        {compare}: {fmt(prev)}
      </span>
    </span>
  )
}

function KpiRow({ stats, compare }: { stats: DashStats; compare: string }) {
  const today = stats.range === 1
  const items = [
    { label: today ? 'Bugün kayıt olan' : 'Yeni üye', pair: stats.newUsers, href: '?b=users' },
    { label: today ? 'Bugün aktif üye' : 'İşlem yapan üye', pair: stats.activeMembers, href: '?b=users' },
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
        <span className="text-xs text-muted-foreground">Son 5 dakikada sitede</span>
      </a>
      {items.map((i) => (
        <a key={i.label} href={i.href} className="flex min-w-0 flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-border transition-colors hover:bg-secondary">
          <span className="truncate text-[13px] text-muted-foreground">{i.label}</span>
          <span className="font-display text-3xl font-semibold tabular-nums text-foreground">{fmt(i.pair.cur)}</span>
          <Delta {...i.pair} compare={compare} />
        </a>
      ))}
    </div>
  )
}

const METRICS = [
  { key: 'users', label: 'Yeni kayıt' },
  { key: 'clicks', label: 'Sponsor tıklaması' },
  { key: 'games', label: 'Oynanan maç' },
] as const
type MetricKey = (typeof METRICS)[number]['key']

function niceMax(v: number) {
  if (v <= 4) return 4
  const p = 10 ** Math.floor(Math.log10(v))
  const f = v / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}

function smoothPath(pts: [number, number][]) {
  if (pts.length === 0) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const mx = (x0 + x1) / 2
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`
  }
  return d
}

const W = 1000
const H = 240

function TrendCard({ stats }: { stats: DashStats }) {
  const [metric, setMetric] = useState<MetricKey>('users')
  const [hover, setHover] = useState<number | null>(null)
  const series = stats.series
  const hourly = stats.seriesUnit === 'hour'
  const n = series.length
  const total = (k: MetricKey) => series.reduce((s, x) => s + x[k], 0)

  const past = series.filter((x) => !x.future)
  const max = niceMax(Math.max(0, ...past.map((x) => x[metric])))
  const xAt = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const yAt = (v: number) => H - (v / max) * H
  const pts = series.map((x, i) => [xAt(i), yAt(x[metric])] as [number, number]).filter((_, i) => !series[i].future)
  const line = smoothPath(pts)
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z` : ''
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(max * f))
  const every = hourly ? 3 : n > 14 ? 5 : 1
  const active = hover !== null && !series[hover]?.future ? series[hover] : null

  return (
    <Card title={hourly ? 'Bugün saat saat' : `Son ${n} gün`}>
      <div role="tablist" aria-label="Grafik verisi" className="grid grid-cols-3 gap-3 px-5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={metric === m.key}
            onClick={() => setMetric(m.key)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-lg px-4 py-3 text-left ring-1 transition-colors',
              metric === m.key ? 'bg-primary/10 ring-primary/40' : 'ring-border hover:bg-secondary',
            )}
          >
            <span className={cn('text-xs font-medium', metric === m.key ? 'text-primary' : 'text-muted-foreground')}>{m.label}</span>
            <span className="font-display text-xl font-semibold tabular-nums text-foreground">{fmt(total(m.key))}</span>
          </button>
        ))}
      </div>

      <div className="flex min-h-72 flex-1 gap-3 px-5 pb-5 pt-6">
        <div className="relative flex w-8 shrink-0 flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
          {ticks.map((t, i) => (
            <span key={i} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {fmt(t)}
            </span>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative flex-1" onMouseLeave={() => setHover(null)}>
            <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
              {ticks.map((_, i) => (
                <div key={i} className={cn('h-px w-full', i === ticks.length - 1 ? 'bg-border' : 'border-t border-dashed border-border')} />
              ))}
            </div>

            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible text-primary"
              role="img"
              aria-label={`${METRICS.find((m) => m.key === metric)?.label}: ${past.map((x) => `${x.label} ${x[metric]}`).join(', ')}`}
            >
              <defs>
                <linearGradient id="dash-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              {area && <path d={area} fill="url(#dash-area)" />}
              <path d={line} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>

            {active && hover !== null && (
              <>
                <div className="pointer-events-none absolute inset-y-0 w-px bg-foreground/20" style={{ left: `${(xAt(hover) / W) * 100}%` }} aria-hidden="true" />
                <div
                  className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
                  style={{ left: `${(xAt(hover) / W) * 100}%`, top: `${(yAt(active[metric]) / H) * 100}%` }}
                  aria-hidden="true"
                />
                <div
                  className={cn(
                    'pointer-events-none absolute top-2 flex flex-col gap-0.5 rounded-lg bg-popover px-3 py-2 shadow-lg ring-1 ring-border',
                    hover > n / 2 ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3',
                  )}
                  style={{ left: `${(xAt(hover) / W) * 100}%` }}
                >
                  <span className="text-[11px] text-muted-foreground">{hourly ? `Saat ${active.label}` : active.label}</span>
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-popover-foreground">
                    {fmt(active[metric])} <span className="font-normal text-muted-foreground">{METRICS.find((m) => m.key === metric)?.label.toLowerCase()}</span>
                  </span>
                </div>
              </>
            )}

            <div className="absolute inset-0 flex" aria-hidden="true">
              {series.map((x, i) => (
                <div key={x.key} className="h-full flex-1" onMouseEnter={() => setHover(i)} />
              ))}
            </div>
          </div>

          <div className="relative h-4 text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
            {series.map((x, i) =>
              i % every === 0 || i === n - 1 ? (
                <span
                  key={x.key}
                  className={cn('absolute -translate-x-1/2 whitespace-nowrap', i === 0 && 'translate-x-0', i === n - 1 && '-translate-x-full', x.future && 'opacity-50')}
                  style={{ left: `${(xAt(i) / W) * 100}%` }}
                >
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
  if (items.length === 0) return <p className="px-5 py-4 text-sm text-muted-foreground">{empty}</p>
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

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-secondary/60 px-3 py-2.5">
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('font-display text-lg font-semibold tabular-nums', tone === 'bad' ? 'text-destructive' : 'text-foreground')}>{value}</span>
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
        items={stats.topSponsors.map((s) => ({ name: s.name, value: s.clicks, sub: total ? `%${Math.round((s.clicks / total) * 100)}` : undefined }))}
        empty="Bu aralıkta sponsor tıklaması yok."
        unit="tık"
      />
    </Card>
  )
}

function EconomyCard({ stats }: { stats: DashStats }) {
  const [tab, setTab] = useState<'odul' | 'oyun'>('odul')
  const list = tab === 'odul' ? stats.rewardEarners : stats.gameWinners
  return (
    <Card title="KC ekonomisi" link={{ href: '?b=rewards', label: 'Ödül ayarları' }}>
      <div className="grid grid-cols-3 gap-2 px-5 pb-4">
        <MiniStat label="Dağıtılan" value={fmt(stats.kcOut.cur)} />
        <MiniStat label="Harcanan" value={fmt(stats.kcSpent)} />
        <MiniStat label="Kasa kazancı" value={fmt(stats.houseNet)} tone={stats.houseNet < 0 ? 'bad' : undefined} />
      </div>

      {stats.anomalies.length > 0 && (
        <div className="flex flex-col gap-1.5 px-5 pb-4">
          <span className="text-xs font-medium text-muted-foreground">Bir saatte 2.000+ KC kazananlar</span>
          <ul className="flex flex-col gap-1">
            {stats.anomalies.map((a) => (
              <li key={`${a.name}-${a.at}`} className="flex items-center gap-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs">
                <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-foreground">{a.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {new Date(a.at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}
                </span>
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

function GamesCard({ stats }: { stats: DashStats }) {
  return (
    <Card title="Oyun hareketi" link={{ href: '?b=games', label: 'Oyun ayarları' }}>
      <div className="grid grid-cols-3 gap-2 px-5 pb-4">
        {stats.gameModes.map((m) => (
          <div key={m.mode} className="flex flex-col gap-1 rounded-lg bg-secondary/60 px-3 py-2.5">
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

const MEMBER_ROWS: { key: MemberStatus | 'tumu'; label: string }[] = [
  { key: 'aktif', label: 'Aktif hesap' },
  { key: 'donduruldu', label: 'Dondurulan' },
  { key: 'banli', label: 'Banlı' },
  { key: 'supheli', label: 'Şüpheli' },
]

function MembersCard({ counts }: { counts: NonNullable<Props['counts']> }) {
  return (
    <Card title="Üyeler" link={{ href: '?b=users', label: 'Tüm üyeler' }}>
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
        <ul className="flex flex-col px-5 pb-3">
          {recent.map((r) => {
            const actor = r.actor.replace(/\s*\(@.*\)$/, '')
            return (
              <li key={r.id} className="flex items-center gap-3 border-t border-border py-2.5 text-sm first:border-t-0">
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
                  {new Date(r.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}
                </time>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
