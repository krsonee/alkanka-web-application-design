'use client'

import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import type { AuditRow } from '@/lib/members-admin'

const field = 'rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary'

function toCsv(rows: AuditRow[]) {
  const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`
  const head = 'tarih,yonetici,islem,hedef,detay'
  return [head, ...rows.map((r) => [r.createdAt, r.actor, r.action, r.target, r.detail].map(esc).join(','))].join('\n')
}

export function AuditLog({ entries }: { entries: AuditRow[] }) {
  const [q, setQ] = useState('')
  const [actor, setActor] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const actors = useMemo(() => [...new Set(entries.map((e) => e.actor))].sort((a, b) => a.localeCompare(b, 'tr')), [entries])
  const actions = useMemo(() => [...new Set(entries.map((e) => e.action))].sort((a, b) => a.localeCompare(b, 'tr')), [entries])

  const term = q.trim().toLocaleLowerCase('tr')
  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null
  const toMs = to ? new Date(`${to}T23:59:59`).getTime() : null
  const shown = entries.filter((e) => {
    if (actor && e.actor !== actor) return false
    if (action && e.action !== action) return false
    const t = new Date(e.createdAt).getTime()
    if (fromMs !== null && t < fromMs) return false
    if (toMs !== null && t > toMs) return false
    if (term && ![e.actor, e.action, e.target ?? '', e.detail ?? ''].some((v) => v.toLocaleLowerCase('tr').includes(term))) return false
    return true
  })
  const filtered = Boolean(term || actor || action || from || to)

  const download = () => {
    const blob = new Blob([`\uFEFF${toCsv(shown)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `islem-kaydi-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-bold text-foreground">İşlem logları</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Panelde kimin, ne zaman, hangi işlemi yaptığını gösterir. Son {entries.length} kayıttan {shown.length} tanesi gösteriliyor.
          </p>
        </div>
        <button type="button" onClick={download} disabled={!shown.length} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-50">
          <Download className="size-4" aria-hidden="true" /> CSV indir
        </button>
      </header>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative flex items-center lg:col-span-2">
          <span className="sr-only">Loglarda ara</span>
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hedef ya da detayda ara…" className={`${field} w-full pl-9`} />
        </label>
        <label className="flex flex-col">
          <span className="sr-only">Yönetici</span>
          <select value={actor} onChange={(e) => setActor(e.target.value)} className={field}>
            <option value="">Tüm yöneticiler</option>
            {actors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="sr-only">İşlem</span>
          <select value={action} onChange={(e) => setAction(e.target.value)} className={field}>
            <option value="">Tüm işlemler</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <label className="flex flex-1 flex-col">
            <span className="sr-only">Başlangıç tarihi</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${field} w-full`} />
          </label>
          <label className="flex flex-1 flex-col">
            <span className="sr-only">Bitiş tarihi</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${field} w-full`} />
          </label>
        </div>
      </div>
      {filtered && (
        <button
          type="button"
          onClick={() => (setQ(''), setActor(''), setAction(''), setFrom(''), setTo(''))}
          className="self-start text-sm text-primary underline-offset-4 hover:underline"
        >
          Filtreleri temizle
        </button>
      )}
      <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {shown.map((e) => (
          <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
            <time dateTime={e.createdAt} className="shrink-0 text-sm tabular-nums text-muted-foreground sm:w-36">
              {new Date(e.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
            </time>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm text-foreground">
                <span className="font-semibold">{e.actor}</span> · {e.action}
              </p>
              {e.target && <p className="truncate text-sm text-muted-foreground">Hedef: {e.target}</p>}
              {e.detail && <p className="text-sm leading-relaxed text-muted-foreground">{e.detail}</p>}
            </div>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">{filtered ? 'Bu filtreye uyan kayıt yok.' : 'Henüz kayıt yok.'}</li>
        )}
      </ol>
    </section>
  )
}
