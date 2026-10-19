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
    <section aria-label="Genel bakış" className="flex flex-1 flex-col gap-5">
      {counts && (
        <div className="grid grid-cols-5 divide-x divide-border rounded-lg border border-border bg-card">
          {STAT_LABELS.map((s) => (
            <div key={s.key} className="flex flex-col gap-0.5 px-4 py-3">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className="text-xl font-semibold tabular-nums text-foreground">{counts[s.key].toLocaleString('tr-TR')}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-5 flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
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

        <div className="col-span-7 flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
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
