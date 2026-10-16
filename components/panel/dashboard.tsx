import type { AuditRow, MemberStatus } from '@/lib/members-admin'

type Props = {
  counts: Record<MemberStatus | 'tumu', number> | null
  marketPending: number
  recent: AuditRow[]
}

const STAT_LABELS: { key: MemberStatus | 'tumu'; label: string }[] = [
  { key: 'tumu', label: 'Toplam üye' },
  { key: 'aktif', label: 'Aktif' },
  { key: 'donduruldu', label: 'Dondurulan' },
  { key: 'banli', label: 'Banlı' },
  { key: 'supheli', label: 'Şüpheli' },
]

export function PanelDashboard({ counts, marketPending, recent }: Props) {
  return (
    <section aria-labelledby="dash-title" className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id="dash-title" className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
          Dashboard
        </h2>
        <p className="text-sm text-muted-foreground">Sitenin genel durumu ve bekleyen işler.</p>
      </div>

      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STAT_LABELS.map((s) => (
            <div key={s.key} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className="font-display text-2xl font-bold text-foreground">{counts[s.key].toLocaleString('tr-TR')}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:col-span-5">
          <h3 className="text-sm font-semibold text-foreground">Bekleyen işler</h3>
          <a href="#market" className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm text-foreground hover:bg-secondary/70">
            Market onayları
            <span className={marketPending > 0 ? 'rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground' : 'text-xs text-muted-foreground'}>
              {marketPending}
            </span>
          </a>
          {counts && counts.supheli > 0 && (
            <a href="#users" className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm text-foreground hover:bg-secondary/70">
              Şüpheli hesaplar
              <span className="rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">{counts.supheli}</span>
            </a>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">Bağlantılara tıklayınca ilgili bölüm açılır.</p>
        </div>

        <div className="col-span-12 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:col-span-7">
          <h3 className="text-sm font-semibold text-foreground">Son yönetici işlemleri</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recent.map((r) => (
                <li key={r.id} className="flex flex-col gap-0.5 py-2 text-sm">
                  <span className="text-foreground">
                    <span className="font-semibold">{r.actor}</span> · {r.action}
                    {r.target ? ` · ${r.target}` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString('tr-TR')}
                    {r.detail ? ` — ${r.detail}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
