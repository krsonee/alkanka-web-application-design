'use client'

import { useRef, useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Download, Loader2, Search } from 'lucide-react'
import { exportAuditAction, searchAuditAction } from '@/app/panel/audit-actions'
import { notify } from '@/components/panel/confirm-dialog'
import { AUDIT_EXPORT_LIMIT, areaLabel, type AuditPage, type AuditQuery } from '@/lib/panel-log-shared'

const field = 'rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary'
const pager = 'flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40'

type Filters = Required<Omit<AuditQuery, 'page'>>

const EMPTY: Filters = { q: '', actor: '', area: '', from: '', to: '' }

export function AuditLog({ initial }: { initial: AuditPage }) {
  const [data, setData] = useState(initial)
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [pending, startTransition] = useTransition()
  const [exporting, setExporting] = useState(false)
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(0)

  const load = (next: Filters, page = 0) => {
    const ticket = ++latest.current
    startTransition(async () => {
      const result = await searchAuditAction({ ...next, page })
      if (ticket !== latest.current) return
      if (result) setData(result)
      else notify(false, 'Loglar yüklenemedi. Oturumun düşmüş olabilir, sayfayı yenile.')
    })
  }

  const change = (patch: Partial<Filters>, debounce = false) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    if (typing.current) clearTimeout(typing.current)
    if (debounce) typing.current = setTimeout(() => load(next), 350)
    else load(next)
  }

  const filtered = Object.values(filters).some(Boolean)
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const first = data.total ? data.page * data.pageSize + 1 : 0
  const last = Math.min(data.total, (data.page + 1) * data.pageSize)

  const download = async () => {
    setExporting(true)
    const result = await exportAuditAction(filters)
    setExporting(false)
    if (!result.ok) return notify(false, result.error)
    const url = URL.createObjectURL(new Blob([`\uFEFF${result.csv}`], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `islem-loglari-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    notify(true, result.count >= AUDIT_EXPORT_LIMIT ? `İlk ${AUDIT_EXPORT_LIMIT} kayıt indirildi. Daha eskisi için tarih aralığını daralt.` : `${result.count} kayıt indirildi.`)
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-bold text-foreground">İşlem logları</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Panelde kimin, ne zaman, hangi bölümde ne yaptığını ve panele girişleri gösterir.{' '}
            {data.total ? `${data.total.toLocaleString('tr-TR')} kayıttan ${first}-${last} arası gösteriliyor.` : ''}
          </p>
        </div>
        <button type="button" onClick={download} disabled={!data.total || exporting} className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-50">
          {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />} CSV indir
        </button>
      </header>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative flex items-center lg:col-span-2">
          <span className="sr-only">Loglarda ara</span>
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
          <input value={filters.q} onChange={(e) => change({ q: e.target.value }, true)} placeholder="Yönetici, işlem, hedef, detay ya da adreste ara…" className={`${field} w-full pl-9`} />
        </label>
        <label className="flex flex-col">
          <span className="sr-only">Yönetici</span>
          <select value={filters.actor} onChange={(e) => change({ actor: e.target.value })} className={field}>
            <option value="">Tüm yöneticiler</option>
            {data.actors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="sr-only">Bölüm</span>
          <select value={filters.area} onChange={(e) => change({ area: e.target.value })} className={field}>
            <option value="">Tüm bölümler</option>
            {data.areas.map((a) => (
              <option key={a} value={a}>{areaLabel(a)}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <label className="flex flex-1 flex-col">
            <span className="sr-only">Başlangıç tarihi</span>
            <input type="date" value={filters.from} onChange={(e) => change({ from: e.target.value })} className={`${field} w-full`} />
          </label>
          <label className="flex flex-1 flex-col">
            <span className="sr-only">Bitiş tarihi</span>
            <input type="date" value={filters.to} onChange={(e) => change({ to: e.target.value })} className={`${field} w-full`} />
          </label>
        </div>
      </div>
      {filtered && (
        <button type="button" onClick={() => change(EMPTY)} className="self-start text-sm text-primary underline-offset-4 hover:underline">
          Filtreleri temizle
        </button>
      )}
      <ol className={`flex flex-col divide-y divide-border rounded-xl border border-border bg-card transition-opacity ${pending ? 'opacity-60' : ''}`} aria-busy={pending}>
        {data.rows.map((e) => (
          <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
            <time dateTime={e.createdAt} className="shrink-0 text-sm tabular-nums text-muted-foreground sm:w-36">
              {new Date(e.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
            </time>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm text-foreground">
                <span className="font-semibold">{e.actor}</span> · {e.action}
              </p>
              {e.target && <p className="break-words text-sm text-muted-foreground">Hedef: {e.target}</p>}
              {e.detail && <p className="break-words text-sm leading-relaxed text-muted-foreground">{e.detail}</p>}
            </div>
            <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground">{areaLabel(e.area)}</span>
              {e.ip && <span className="text-xs tabular-nums text-muted-foreground">{e.ip}</span>}
            </div>
          </li>
        ))}
        {data.rows.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">{filtered ? 'Bu filtreye uyan kayıt yok.' : 'Henüz kayıt yok.'}</li>
        )}
      </ol>
      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Log sayfaları">
          <button type="button" onClick={() => load(filters, data.page - 1)} disabled={data.page === 0 || pending} className={pager}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">Önceki sayfa</span>
          </button>
          <p className="text-sm tabular-nums text-muted-foreground">
            Sayfa {data.page + 1} / {pages}
          </p>
          <button type="button" onClick={() => load(filters, data.page + 1)} disabled={data.page + 1 >= pages || pending} className={pager}>
            <ChevronRight className="size-4" aria-hidden="true" />
            <span className="sr-only">Sonraki sayfa</span>
          </button>
        </nav>
      )}
    </section>
  )
}
