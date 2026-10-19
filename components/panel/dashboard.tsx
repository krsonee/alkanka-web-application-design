import { ArrowRight, CheckCircle2 } from 'lucide-react'
import type { AuditRow, MemberStatus } from '@/lib/members-admin'
import type { PendingDetail } from '@/lib/panel-pending'

type Props = {
  counts: Record<MemberStatus | 'tumu', number> | null
  pending: PendingDetail
  recent: AuditRow[]
}

const STAT_LABELS: { key: MemberStatus | 'tumu'; label: string }[] = [
  { key: 'tumu', label: 'Toplam üye' },
  { key: 'aktif', label: 'Aktif' },
  { key: 'donduruldu', label: 'Dondurulan' },
  { key: 'banli', label: 'Banlı' },
  { key: 'supheli', label: 'Şüpheli' },
]

export function PanelDashboard({ counts, pending, recent }: Props) {
  const jobs = [
    { label: 'Para çekme kanıtları', hint: 'Topluluk › Çekim talepleri', count: pending.withdrawals, href: '?b=community' },
    { label: 'Onay bekleyen yorumlar', hint: 'Topluluk › Yorumlar', count: pending.reviews, href: '?b=community' },
    { label: 'Açık şikâyetler', hint: 'Topluluk › Şikâyetler', count: pending.complaints, href: '?b=community' },
    { label: 'Görev onayları', hint: 'Üyeler › Görevler', count: pending.claims, href: '?b=tasks' },
    { label: 'Market talepleri', hint: 'Ekonomi › Market', count: pending.market, href: '?b=market' },
    { label: 'Şüpheli hesaplar', hint: 'Üyeler › Tüm üyeler', count: counts?.supheli ?? 0, href: '?b=users' },
  ]
  const open = jobs.filter((j) => j.count > 0).sort((a, b) => b.count - a.count)

  return (
    <section aria-label="Genel bakış" className="flex flex-col gap-5">
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-7 flex flex-col rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Bugün yapılacaklar</h2>
            <span className="text-xs text-muted-foreground">{open.length ? `${open.reduce((n, j) => n + j.count, 0)} iş bekliyor` : 'Hepsi temiz'}</span>
          </div>
          {open.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              Bekleyen iş yok.
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {open.map((j) => (
                <li key={j.label}>
                  <a href={j.href} className="group flex items-center gap-4 px-4 py-3 hover:bg-secondary">
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
        </div>

        <div className="col-span-5 flex flex-col rounded-lg border border-border bg-card">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Son yönetici işlemleri</h2>
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Henüz kayıt yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recent.map((r) => (
                <li key={r.id} className="flex flex-col gap-0.5 px-4 py-2.5 text-[13px]">
                  <span className="truncate text-foreground">
                    <span className="font-semibold">{r.actor}</span> · {r.action}
                    {r.target ? ` · ${r.target}` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString('tr-TR')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {counts && (
        <div className="grid grid-cols-5 divide-x divide-border rounded-lg border border-border bg-card">
          {STAT_LABELS.map((s) => (
            <a key={s.key} href="?b=users" className="flex flex-col gap-0.5 px-4 py-3 hover:bg-secondary">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className="text-xl font-semibold tabular-nums text-foreground">{counts[s.key].toLocaleString('tr-TR')}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  )
}
