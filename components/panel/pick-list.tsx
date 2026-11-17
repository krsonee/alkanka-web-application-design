'use client'

import { useId, useState } from 'react'
import useSWR from 'swr'
import { ChevronDown, Loader2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PickRow = { userId: string; name: string; pick: string; note?: string; at?: string }
export type PickListData = { ok: true; total: number; rows: PickRow[]; summary?: string; closed?: boolean } | { ok: false; error: string }

const when = (iso?: string) =>
  iso ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '-'

/** Who took part and what they picked or scored. Loaded only when opened, so a long list stays cheap. */
export function PickList({
  cacheKey,
  load,
  count,
  pickLabel = 'Tahmini',
  title = 'Katılımcılar ve tahminleri',
  empty = 'Henüz kimse tahmin yapmadı.',
  whenLabel = 'Ne zaman',
  onData,
}: {
  onData?: (data: PickListData) => void
  cacheKey: string
  load: () => Promise<PickListData>
  count?: number
  pickLabel?: string
  title?: string
  empty?: string
  whenLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const panelId = useId()
  const { data, error, isLoading } = useSWR(open ? cacheKey : null, load, { revalidateOnFocus: false, onSuccess: onData })
  const rows = data?.ok ? data.rows : []
  const needle = q.trim().toLocaleLowerCase('tr')
  const shown = needle ? rows.filter((r) => r.name.toLocaleLowerCase('tr').includes(needle) || r.pick.toLocaleLowerCase('tr').includes(needle)) : rows
  const failed = error ? 'Liste yüklenemedi. Sayfayı yenileyip tekrar dene.' : data && !data.ok ? data.error : null

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 self-start rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
      >
        <Users className="size-3.5" aria-hidden="true" />
        {count === undefined ? title : `${title} (${count})`}
        <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
          {isLoading && (
            <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Katılımcılar yükleniyor...
            </p>
          )}
          {failed && (
            <p role="alert" className="text-xs text-destructive">
              {failed}
            </p>
          )}
          {data?.ok && data.total === 0 && <p className="text-xs leading-relaxed text-muted-foreground">{data.summary ? `${data.summary} ${empty}` : empty}</p>}
          {data?.ok && data.total > 0 && (
            <>
              {data.summary && <p className="text-xs leading-relaxed text-foreground">{data.summary}</p>}
              {rows.length > 8 && (
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Üye ya da tahmin ara" aria-label="Katılımcılarda ara" className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-64" />
              )}
              <div className="max-h-80 overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-card text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Üye</th>
                      <th scope="col" className="px-3 py-2 font-semibold">{pickLabel}</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Sonuç</th>
                      <th scope="col" className="px-3 py-2 font-semibold">{whenLabel}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shown.map((r) => (
                      <tr key={r.userId}>
                        <td className="px-3 py-2 font-semibold text-foreground">{r.name}</td>
                        <td className="px-3 py-2 tabular-nums text-foreground">{r.pick}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.note ?? '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{when(r.at)}</td>
                      </tr>
                    ))}
                    {shown.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Aramaya uyan katılımcı yok.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {data.total > rows.length && <p className="text-xs text-muted-foreground">{`İlk ${rows.length} katılımcı gösteriliyor, toplam ${data.total}.`}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
