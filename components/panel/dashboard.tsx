import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Minus } from 'lucide-react'
import type { AuditRow, MemberStatus } from '@/lib/members-admin'
import type { PendingDetail } from '@/lib/panel-pending'
import { DASH_RANGES, type DashStats, type HealthItem } from '@/lib/panel-stats'
import { cn } from '@/lib/utils'

type Props = {
  counts: Record<MemberStatus | 'tumu', number> | null
  pending: PendingDetail
  recent: AuditRow[]
  stats: DashStats | null
}

const fmt = (n: number) => n.toLocaleString('tr-TR')
const RANGE_NOUN: Record<number, string> = { 1: 'dün bu saate kadar', 7: 'önceki 7 gün', 30: 'önceki 30 gün' }

export function PanelDashboard({ counts, pending, recent, stats }: Props) {
  return (
    <section aria-label="Genel bakış" className="flex flex-col gap-5">
      {stats && <TopBar stats={stats} />}
      {stats && <KpiRow stats={stats} />}
      {counts && <MemberStrip counts={counts} />}

      <div className="grid grid-cols-12 items-start gap-5">
        {stats && (
          <div className="col-span-8">
            <TrendCard stats={stats} />
          </div>
        )}
        <div className={stats ? 'col-span-4' : 'col-span-12'}>
          <JobsCard counts={counts} pending={pending} />
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 items-start gap-5">
          <TopSponsorsCard stats={stats} />
          <EconomyCard stats={stats} />
          <GamesCard stats={stats} />
        </div>
      )}

      <AuditCard recent={recent} />
    </section>
  )
}

function Card({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col rounded-lg border border-border bg-card', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {aside}
      </div>
      {children}
    </div>
  )
}

function TopBar({ stats }: { stats: DashStats }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <nav aria-label="Zaman aralığı" className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-card p-1">
        {DASH_RANGES.map((r) => (
          <a
            key={r.value}
            href={r.value === 1 ? '/panel' : `/panel?r=${r.value}`}
            aria-current={stats.range === r.value ? 'page' : undefined}
            className={cn(
              'rounded px-3 py-1.5 text-[13px] font-medium',
              stats.range === r.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {r.label}
          </a>
        ))}
      </nav>
      <HealthStrip items={stats.health} />
    </div>
  )
}

const DOT: Record<HealthItem['state'], string> = { ok: 'bg-live', off: 'bg-primary', warn: 'bg-destructive' }
const LEGEND: { state: HealthItem['state']; label: string }[] = [
  { state: 'ok', label: 'Çalışıyor' },
  { state: 'off', label: 'Ayarlı değil' },
  { state: 'warn', label: 'Hata' },
]

function HealthStrip({ items }: { items: HealthItem[] }) {
  const errors = items.filter((i) => i.state === 'warn').length
  const unset = items.filter((i) => i.state === 'off').length
  const headline = errors
    ? `${errors} sistemde hata var`
    : unset
      ? `${unset} sistem ayarlı değil`
      : 'Tüm sistemler çalışıyor'
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-md border border-border bg-card px-4 py-2">
      <span className={cn('shrink-0 text-xs font-semibold', errors ? 'text-destructive' : unset ? 'text-primary' : 'text-live')}>{headline}</span>
      <ul className="flex min-w-0 items-center gap-4 overflow-x-auto" aria-label="Sistem durumu">
        {items.map((i) => (
          <li key={i.label} title={`${i.label}: ${i.note}`} className="flex shrink-0 cursor-help items-center gap-1.5 text-xs">
            <span className={cn('size-2 rounded-full', DOT[i.state])} aria-hidden="true" />
            <span className="text-foreground">{i.label}</span>
            <span className="sr-only">
              {' '}
              ({LEGEND.find((l) => l.state === i.state)?.label}): {i.note}
            </span>
          </li>
        ))}
      </ul>
      <span className="flex shrink-0 items-center gap-3 border-l border-border pl-4 text-[11px] text-muted-foreground" aria-hidden="true">
        {LEGEND.map((l) => (
          <span key={l.state} className="flex items-center gap-1">
            <span className={cn('size-1.5 rounded-full', DOT[l.state])} />
            {l.label}
          </span>
        ))}
      </span>
    </div>
  )
}

function Delta({ cur, prev, range }: { cur: number; prev: number; range: number }) {
  const label = `${RANGE_NOUN[range]}: ${fmt(prev)}`
  if (cur === prev) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3" aria-hidden="true" />
        {label}
      </span>
    )
  }
  const up = cur > prev
  const pct = prev === 0 ? null : Math.round(((cur - prev) / prev) * 100)
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('flex items-center gap-1 text-xs', up ? 'text-live' : 'text-destructive')}>
      <Icon className="size-3" aria-hidden="true" />
      {pct === null ? 'yeni' : `%${Math.abs(pct)}`}
      <span className="text-muted-foreground">· {label}</span>
    </span>
  )
}

function KpiRow({ stats }: { stats: DashStats }) {
  const today = stats.range === 1
  const items = [
    { label: 'Şu an çevrimiçi', value: stats.online, note: 'Sitede son 5 dakikada açık olan üye' as React.ReactNode, href: '?b=users' },
    { label: today ? 'Bugün kayıt olan' : 'Yeni üye', value: stats.newUsers.cur, note: <Delta {...stats.newUsers} range={stats.range} />, href: '?b=users' },
    { label: today ? 'Bugün aktif' : 'İşlem yapan üye', value: stats.activeMembers.cur, note: <Delta {...stats.activeMembers} range={stats.range} />, href: '?b=users' },
    { label: 'Sponsor tıklaması', value: stats.sponsorClicks.cur, note: <Delta {...stats.sponsorClicks} range={stats.range} />, href: '?b=growth' },
    { label: 'Ödül olarak dağıtılan KC', value: stats.kcOut.cur, note: <Delta {...stats.kcOut} range={stats.range} />, href: '?b=rewards' },
    { label: 'Oynanan maç', value: stats.games.cur, note: <Delta {...stats.games} range={stats.range} />, href: '?b=games' },
  ]
  return (
    <div className="grid grid-cols-6 divide-x divide-border rounded-lg border border-border bg-card">
      {items.map((i) => (
        <a key={i.label} href={i.href} className="flex flex-col gap-1 px-4 py-3.5 hover:bg-secondary">
          <span className="text-xs text-muted-foreground">{i.label}</span>
          <span className="text-2xl font-semibold tabular-nums text-foreground">{fmt(i.value)}</span>
          <span className="text-xs text-muted-foreground">{i.note}</span>
        </a>
      ))}
    </div>
  )
}

const MEMBER_LABELS: { key: MemberStatus | 'tumu'; label: string }[] = [
  { key: 'tumu', label: 'Toplam üye' },
  { key: 'aktif', label: 'Aktif hesap' },
  { key: 'donduruldu', label: 'Dondurulan' },
  { key: 'banli', label: 'Banlı' },
  { key: 'supheli', label: 'Şüpheli' },
]

function MemberStrip({ counts }: { counts: NonNullable<Props['counts']> }) {
  return (
    <a
      href="?b=users"
      className="flex items-center gap-6 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px] hover:bg-secondary"
      aria-label="Üye durumu, tüm üyelere git"
    >
      <span className="text-xs font-semibold text-muted-foreground">Üye durumu</span>
      <dl className="flex flex-1 items-center gap-6">
        {MEMBER_LABELS.map((s) => (
          <div key={s.key} className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{s.label}</dt>
            <dd className={cn('font-semibold tabular-nums', s.key === 'supheli' && counts[s.key] > 0 ? 'text-destructive' : 'text-foreground')}>
              {fmt(counts[s.key])}
            </dd>
          </div>
        ))}
      </dl>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        Tüm üyeler
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </span>
    </a>
  )
}

type Point = { key: string; label: string; v: number }

function Bars({ title, data, total, every }: { title: string; data: Point[]; total: number; every: number }) {
  const max = Math.max(1, ...data.map((d) => d.v))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        <span className="text-xs tabular-nums text-foreground">Toplam {fmt(total)}</span>
      </div>
      <div className="flex h-16 items-end gap-1" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${d.v}`).join(', ')}`}>
        {data.map((d) => (
          <div key={d.key} className="group flex h-full flex-1 items-end" title={`${d.label}: ${fmt(d.v)}`}>
            <div className={cn('w-full rounded-sm', d.v ? 'bg-primary group-hover:bg-foreground' : 'bg-border')} style={{ height: `${Math.max(4, (d.v / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center text-[10px] tabular-nums text-muted-foreground">
            {i % every === 0 || i === data.length - 1 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function TrendCard({ stats }: { stats: DashStats }) {
  const s = stats.series
  const pick = (k: 'users' | 'clicks' | 'games') => s.map((x) => ({ key: x.key, label: x.label, v: x[k] }))
  const sum = (k: 'users' | 'clicks' | 'games') => s.reduce((n, x) => n + x[k], 0)
  const hourly = stats.seriesUnit === 'hour'
  const every = hourly ? 3 : s.length > 14 ? 5 : 1
  const title = hourly ? 'Bugün saat saat' : `Son ${s.length} gün`
  return (
    <Card title={title} aside={<span className="text-xs text-muted-foreground">Ayrıntı için çubuğun üstüne gel</span>}>
      <div className="flex flex-col gap-5 px-4 py-4">
        <Bars title="Yeni kayıt" data={pick('users')} total={sum('users')} every={every} />
        <Bars title="Sponsor tıklaması" data={pick('clicks')} total={sum('clicks')} every={every} />
        <Bars title="Oynanan maç" data={pick('games')} total={sum('games')} every={every} />
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
  const total = open.reduce((n, j) => n + j.count, 0)
  const suspects = counts?.supheli ?? 0
  return (
    <Card title="Bugün yapılacaklar" aside={<span className="text-xs text-muted-foreground">{total ? `${total} iş bekliyor` : 'Hepsi temiz'}</span>}>
      {open.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-live" aria-hidden="true" />
          Her şey temiz, onay bekleyen iş yok.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {open.map((j) => (
            <li key={j.label}>
              <a href={j.href} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-secondary">
                <span className="min-w-8 rounded-md bg-destructive px-2 py-0.5 text-center text-sm font-bold tabular-nums text-destructive-foreground">{j.count}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground">{j.label}</span>
                  <span className="text-xs text-muted-foreground">{j.hint}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {suspects > 0 && (
        <a href="?b=users" className="group flex items-center gap-3 border-t border-border px-4 py-2.5 hover:bg-secondary">
          <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium text-foreground">{`${suspects} şüpheli hesap`}</span>
            <span className="text-xs text-muted-foreground">Aynı IP ya da işaretli kayıt. Göz atman yeterli.</span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
        </a>
      )}
    </Card>
  )
}

function RankList({ items, empty, unit }: { items: { name: string; value: number; sub?: string }[]; empty: string; unit?: string }) {
  if (items.length === 0) return <p className="px-4 py-3 text-sm text-muted-foreground">{empty}</p>
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ol className="flex flex-col gap-2.5 px-4 py-3">
      {items.map((i) => (
        <li key={`${i.name}-${i.sub ?? ''}`} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-foreground" title={i.name}>
              {i.name}
              {i.sub && <span className="text-muted-foreground"> · {i.sub}</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">
              {fmt(i.value)}
              {unit && <span className="font-normal text-muted-foreground"> {unit}</span>}
            </span>
          </div>
          <div className="h-1 rounded-full bg-secondary">
            <div className="h-1 rounded-full bg-primary" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

function TopSponsorsCard({ stats }: { stats: DashStats }) {
  const total = stats.topSponsors.reduce((n, s) => n + s.clicks, 0)
  return (
    <Card title="En çok tıklanan sponsorlar" aside={<a href="?b=growth" className="text-xs text-muted-foreground hover:text-foreground">Trafik raporu</a>}>
      <RankList items={stats.topSponsors.map((s) => ({ name: s.name, value: s.clicks, sub: total ? `%${Math.round((s.clicks / total) * 100)}` : undefined }))} empty="Bu aralıkta sponsor tıklaması yok." unit="tık" />
    </Card>
  )
}

function EconomyCard({ stats }: { stats: DashStats }) {
  return (
    <Card title="KC ekonomisi" aside={<a href="?b=rewards" className="text-xs text-muted-foreground hover:text-foreground">Ödül ayarları</a>}>
      <dl className="grid grid-cols-3 divide-x divide-border border-b border-border">
        {[
          { k: 'Ödül dağıtılan', v: stats.kcOut.cur },
          { k: 'Markette harcanan', v: stats.kcSpent },
          { k: 'Kasa kazancı', v: stats.houseNet },
        ].map((x) => (
          <div key={x.k} className="flex flex-col gap-0.5 px-4 py-2.5">
            <dt className="text-[11px] text-muted-foreground">{x.k}</dt>
            <dd className={cn('text-base font-semibold tabular-nums', x.v < 0 ? 'text-destructive' : 'text-foreground')}>{fmt(x.v)}</dd>
          </div>
        ))}
      </dl>
      {stats.anomalies.length > 0 && (
        <div className="flex flex-col gap-1.5 border-b border-border bg-destructive/10 px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Bir saatte 2.000+ KC kazananlar
          </span>
          <ul className="flex flex-col gap-0.5">
            {stats.anomalies.map((a) => (
              <li key={`${a.name}-${a.at}`} className="flex justify-between gap-3 text-xs text-foreground">
                <span className="truncate">
                  {a.name} <span className="text-muted-foreground">· {new Date(a.at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{fmt(a.amount)} KC</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <h3 className="px-4 pt-3 text-xs font-medium text-muted-foreground">Ödülle en çok kazananlar</h3>
      <RankList items={stats.rewardEarners.map((e) => ({ name: e.name, value: e.amount }))} empty="Bu aralıkta ödül alan yok." unit="KC" />
      <h3 className="border-t border-border px-4 pt-3 text-xs font-medium text-muted-foreground">Oyunda net en çok kazananlar</h3>
      <RankList items={stats.gameWinners.map((e) => ({ name: e.name, value: e.amount }))} empty="Bu aralıkta oyundan kârla çıkan yok." unit="KC" />
      {stats.kcSources.length > 0 && (
        <p className="border-t border-border px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {'Ödül kaynağı: '}
          {stats.kcSources.map((s) => `${s.label} ${fmt(s.amount)}`).join(' · ')}
        </p>
      )}
    </Card>
  )
}

function GamesCard({ stats }: { stats: DashStats }) {
  return (
    <Card title="Oyun hareketi" aside={<a href="?b=games" className="text-xs text-muted-foreground hover:text-foreground">Oyun ayarları</a>}>
      <table className="w-full text-[13px]">
        <caption className="sr-only">Oyun moduna göre maç ve bahis</caption>
        <thead>
          <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
            <th scope="col" className="px-4 py-2 font-medium">Mod</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Maç</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Bahis (KC)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {stats.gameModes.map((m) => (
            <tr key={m.mode}>
              <th scope="row" className="px-4 py-2 text-left font-normal text-foreground">{m.mode}</th>
              <td className="px-4 py-2 text-right tabular-nums text-foreground">{fmt(m.count)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-foreground">{fmt(m.stake)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="border-t border-border px-4 pt-3 text-xs font-medium text-muted-foreground">En popüler oyunlar</h3>
      <RankList items={stats.topGames.map((g) => ({ name: g.game, value: g.count }))} empty="Bu aralıkta maç oynanmadı." unit="maç" />
    </Card>
  )
}

function AuditCard({ recent }: { recent: AuditRow[] }) {
  return (
    <Card title="Son yönetici işlemleri" aside={<a href="?b=audit" className="text-xs text-muted-foreground hover:text-foreground">Tümünü gör</a>}>
      {recent.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">Henüz kayıt yok.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {recent.map((r) => (
            <li key={r.id} className="grid grid-cols-12 items-baseline gap-3 px-4 py-2 text-[13px]">
              <span className="col-span-2 truncate font-semibold text-foreground" title={r.actor}>
                {r.actor.replace(/\s*\(@.*\)$/, '')}
              </span>
              <span className="col-span-4 text-foreground">
                {r.action}
                {r.detail && <span className="font-semibold"> · {r.detail.split(' · ')[0]}</span>}
              </span>
              <span className="col-span-4 truncate text-muted-foreground" title={r.target ?? undefined}>
                {r.target}
              </span>
              <time dateTime={r.createdAt} className="col-span-2 text-right text-xs tabular-nums text-muted-foreground">
                {new Date(r.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
