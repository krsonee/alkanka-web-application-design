'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import type { AuditRow } from '@/lib/members-admin'

export function AuditLog({ entries }: { entries: AuditRow[] }) {
  const [q, setQ] = useState('')
  const term = q.trim().toLocaleLowerCase('tr')
  const shown = term
    ? entries.filter((e) => [e.actor, e.action, e.target ?? '', e.detail ?? ''].some((v) => v.toLocaleLowerCase('tr').includes(term)))
    : entries
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-bold text-foreground">İşlem logları</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">Panelde kimin, ne zaman, hangi işlemi yaptığını gösterir. Son 200 kayıt listelenir.</p>
      </header>
      <label className="relative flex items-center">
        <span className="sr-only">Loglarda ara</span>
        <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Yönetici, işlem ya da üye ara…"
          className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
        />
      </label>
      <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {shown.map((e) => (
          <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
            <time dateTime={e.createdAt} className="shrink-0 text-xs tabular-nums text-muted-foreground sm:w-36">
              {new Date(e.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
            </time>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm text-foreground">
                <span className="font-semibold">{e.actor}</span> · {e.action}
              </p>
              {e.target && <p className="truncate text-xs text-muted-foreground">Hedef: {e.target}</p>}
              {e.detail && <p className="text-xs leading-relaxed text-muted-foreground">{e.detail}</p>}
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">Henüz kayıt yok.</li>}
      </ol>
    </section>
  )
}
