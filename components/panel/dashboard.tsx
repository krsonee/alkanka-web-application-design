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
const RANGE_NOUN: Record<number, string> = { 1: 'dün', 7: 'önceki 7 gün', 30: 'önceki 30 gün' }

export function PanelDashboard({ counts, pending, recent, stats }: Props) {
  return (
    <section aria-label="Genel bakış" className="flex flex-col gap-5">
      {stats && <TopBar stats={stats} />}
      {stats && <KpiRow stats={stats} />}

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-8">{stats ? <TrendCard stats={stats} /> : <MemberRow counts={counts} />}</div>
        <div className="col-span-4">
          <JobsCard counts={counts} pending={pending} />
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-5">
          <TopSponsorsCard stats={stats} />
          <EconomyCard stats={stats} />
          <GamesCard stats={stats} />
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-5">{counts && stats && <MemberRow counts={counts} vertical />}</div>
        <div className="col-span-7">
          <AuditCard recent={recent} />
        </div>
      </div>
    </section>
  )
}

function Card({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-full flex-col rounded-lg border border-border bg-card', className)}>
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
      <nav aria-label="Zaman aralığı" className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
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

const DOT: Record<HealthItem['state'], string> = { ok: 'bg-primary', warn: 'bg-destructive', off: 'bg-muted-foreground/50' }

function HealthStrip({ items }: { items: HealthItem[] }) {
  const warn = items.filter((i) => i.state === 'warn').length
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-md border border-border bg-card px-4 py-2">
      <span className={cn('shrink-0 text-xs font-semibold', warn ? 'text-destructive' : 'text-foreground')}>
        {warn ? `${warn} sistemde sorun var` : 'Sistemler çalışıyor'}
      </span>
      <ul className="flex min-w-0 items-center gap-4 overflow-x-auto">
        {items.map((i) => (
          <li key={i.label} title={i.note} className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('size-2 rounded-full', DOT[i.state])} aria-hidden="true" />
            <span className="text-foreground">{i.label}</span>
            <span className="sr-only">: {i.note}</span>
          </li>
        ))}
      </ul>
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
    <span className={cn('flex items-center gap-1 text-xs', up ? 'text-primary' : 'text-destructive')}>
      <Icon className="size-3" aria-hidden="true" />
      {pct === null ? 'yeni' : `%${Math.abs(pct)}`}
      <span className="text-muted-foreground">· {label}</span>
    </span>
  )
}

function KpiRow({ stats }: { stats: DashStats }) {
  const items = [
    { label: 'Şu an çevrimiçi', value: stats.online, note: 'Son 5 dakikada aktif' as React.ReactNode, href: '?b=users' },
    { label: 'Yeni üye', value: stats.newUsers.cur, note: <Delta {...stats.newUsers} range={stats.range} />, href: '?b=users' },
    { label: 'Aktif üye', value: stats.activeMembers.cur, note: <Delta {...stats.activeMembers} range={stats.range} />, href: '?b=users' },
    { label: 'Sponsor tıklaması', value: stats.sponsorClicks.cur, note: <Delta {...stats.sponsorClicks} range={stats.range} />, href: '?b=growth' },
    { label: 'Dağıtılan KC', value: stats.kcOut.cur, note: <Delta {...stats.kcOut} range={stats.range} />, href: '?b=rewards' },
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

function Bars({ title, data, total }: { title: string; data: { day: string; v: number }[]; total: number }) {
  const max = Math.max(1, ...data.map((d) => d.v))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        <span className="text-xs tabular-nums text-foreground">Toplam {fmt(total)}</span>
      </div>
      <div className="flex h-16 items-end gap-1" role="img" aria-label={`${title}: günlük ${data.map((d) => d.v).join(', ')}`}>
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end" title={`${d.day.slice(8, 10)}.${d.day.slice(5, 7)}: ${fmt(d.v)}`}>
            <div className={cn('w-full rounded-sm', d.v ? 'bg-primary group-hover:bg-foreground' : 'bg-border')} style={{ height: `${Math.max(4, (d.v / max) * 100)}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendCard({ stats }: { stats: DashStats }) {
  const s = stats.series
  const pick = (k: 'users' | 'clicks' | 'games') => s.map((x) => ({ day: x.day, v: x[k] }))
  const sum = (k: 'users' | 'clicks' | 'games') => s.reduce((n, x) => n + x[k], 0)
  const first = s[0]?.day
  const last = s[s.length - 1]?.day
  const d = (v?: string) => (v ? `${v.slice(8, 10)}.${v.slice(5, 7)}` : '')
  return (
    <Card title={`Son ${s.length} gün`} aside={<span className="text-xs text-muted-foreground">{`${d(first)} – ${d(last)} · çubuğun üstüne gel`}</span>}>
      <div className="flex flex-col gap-5 px-4 py-4">
        <Bars title="Yeni kayıt" data={pick('users')} total={sum('users')} />
        <Bars title="Sponsor tıklaması" data={pick('clicks')} total={sum('clicks')} />
        <Bars title="Oynanan maç" data={pick('games')} total={sum('games')} />
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
        <div className="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
          Onay bekleyen iş yok.
        </div>
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
        <a href="?b=users" className="group mt-auto flex items-center gap-3 border-t border-border px-4 py-2.5 hover:bg-secondary">
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
  if (items.length === 0) return <p className="px-4 py-4 text-sm text-muted-foreground">{empty}</p>
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
  return (
    <Card title="En çok tıklanan sponsorlar" aside={<a href="?b=growth" className="text-xs text-muted-foreground hover:text-foreground">Trafik raporu</a>}>
      <RankList items={stats.topSponsors.map((s) => ({ name: s.name, value: s.clicks }))} empty="Bu aralıkta sponsor tıklaması yok." unit="tık" />
    </Card>
  )
}

function EconomyCard({ stats }: { stats: DashStats }) {
  return (
    <Card title="KC ekonomisi" aside={<a href="?b=rewards" className="text-xs text-muted-foreground hover:text-foreground">Ödül ayarları</a>}>
      <dl className="grid grid-cols-3 divide-x divide-border border-b border-border">
        {[
          { k: 'Dağıtılan', v: stats.kcOut.cur },
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
                  {a.name} <span className="text-muted-foreground">· {new Date(a.at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{fmt(a.amount)} KC</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <h3 className="px-4 pt-3 text-xs font-medium text-muted-foreground">En çok kazananlar</h3>
      <RankList items={stats.topEarners.map((e) => ({ name: e.name, value: e.amount }))} empty="Bu aralıkta KC kazanan yok." unit="KC" />
      {stats.kcSources.length > 0 && (
        <p className="mt-auto border-t border-border px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {'Kaynak: '}
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

const STAT_LABELS: { key: MemberStatus | 'tumu'; label: string }[] = [
  { key: 'tumu', label: 'Toplam üye' },
  { key: 'aktif', label: 'Aktif' },
  { key: 'donduruldu', label: 'Dondurulan' },
  { key: 'banli', label: 'Banlı' },
  { key: 'supheli', label: 'Şüpheli' },
]

function MemberRow({ counts, vertical }: { counts: Props['counts']; vertical?: boolean }) {
  if (!counts) return null
  if (vertical) {
    return (
      <Card title="Üye durumu" aside={<a href="?b=users" className="text-xs text-muted-foreground hover:text-foreground">Tüm üyeler</a>}>
        <dl className="grid grid-cols-5 divide-x divide-border">
          {STAT_LABELS.map((s) => (
            <div key={s.key} className="flex flex-col gap-0.5 px-4 py-3">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className={cn('text-xl font-semibold tabular-nums', s.key === 'supheli' && counts[s.key] > 0 ? 'text-destructive' : 'text-foreground')}>{fmt(counts[s.key])}</dd>
            </div>
          ))}
        </dl>
      </Card>
    )
  }
  return (
    <div className="grid grid-cols-5 divide-x divide-border rounded-lg border border-border bg-card">
      {STAT_LABELS.map((s) => (
        <a key={s.key} href="?b=users" className="flex flex-col gap-0.5 px-4 py-3 hover:bg-secondary">
          <span className="text-xs text-muted-foreground">{s.label}</span>
          <span className="text-xl font-semibold tabular-nums text-foreground">{fmt(counts[s.key])}</span>
        </a>
      ))}
    </div>
  )
}

function AuditCard({ recent }: { recent: AuditRow[] }) {
  return (
    <Card title="Son yönetici işlemleri" aside={<a href="?b=audit" className="text-xs text-muted-foreground hover:text-foreground">Tümünü gör</a>}>
      {recent.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted-foreground">Henüz kayıt yok.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {recent.map((r) => (
            <li key={r.id} className="grid grid-cols-12 items-baseline gap-3 px-4 py-2 text-[13px]">
              <span className="col-span-3 truncate font-semibold text-foreground" title={r.actor}>
                {r.actor.replace(/\s*\(@.*\)$/, '')}
              </span>
              <span className="col-span-6 flex min-w-0 flex-col">
                <span className="text-foreground">
                  {r.action}
                  {r.detail && <span className="font-semibold"> · {r.detail.split(' · ')[0]}</span>}
                </span>
                {r.target && (
                  <span className="truncate text-xs text-muted-foreground" title={r.target}>
                    {r.target}
                  </span>
                )}
              </span>
              <time dateTime={r.createdAt} className="col-span-3 text-right text-xs tabular-nums text-muted-foreground">
                {new Date(r.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
