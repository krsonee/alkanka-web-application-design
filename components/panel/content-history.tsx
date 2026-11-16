'use client'

import { useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Undo2 } from 'lucide-react'
import { listHistoryAction, restoreHistoryAction } from '@/app/panel/audit-actions'
import { askConfirm, notify } from '@/components/panel/confirm-dialog'
import { areaLabel, type HistoryPage, type HistoryRow } from '@/lib/panel-log-shared'

const pager = 'flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40'

const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })

export function ContentHistory({ initial }: { initial: HistoryPage }) {
  const [data, setData] = useState(initial)
  const [open, setOpen] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))

  const load = (page: number) =>
    startTransition(async () => {
      const result = await listHistoryAction(page)
      if (result) setData(result)
      else notify(false, 'Geçmiş yüklenemedi. Oturumun düşmüş olabilir, sayfayı yenile.')
    })

  const restore = async (row: HistoryRow) => {
    const ok = await askConfirm(
      `"${row.label}" ayarı ${when(row.createdAt)} tarihli değişiklikten ÖNCEKİ haline dönsün mü? Sitede hemen geçerli olur. Bu geri dönüş de geçmişe yazılır, istersen onu da geri alabilirsin.`,
    )
    if (!ok) return
    startTransition(async () => {
      const result = await restoreHistoryAction(row.id)
      notify(result.ok, result.ok ? result.message : result.error)
      if (!result.ok) return
      const fresh = await listHistoryAction(0)
      if (fresh) setData(fresh)
      setOpen(null)
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-bold text-foreground">Ayar geçmişi</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Slider, sayfa başlıkları, site yazıları, logolar, reklam alanları, oyun ayarları, mini oyun ödülleri ve içerik takviminde yapılan her kayıt burada durur. Bir satırı açıp neyin
          değiştiğine bakabilir, o kayıttan önceki hale dönebilirsin. Her ayar için son 40 değişiklik saklanır.
        </p>
      </header>
      <ol className={`flex flex-col divide-y divide-border rounded-xl border border-border bg-card transition-opacity ${pending ? 'opacity-60' : ''}`} aria-busy={pending}>
        {data.rows.map((row) => {
          const expanded = open === row.id
          return (
            <li key={row.id} className="flex flex-col gap-3 px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <time dateTime={row.createdAt} className="shrink-0 text-sm tabular-nums text-muted-foreground sm:w-36">
                  {when(row.createdAt)}
                </time>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{row.label}</span>
                    <span className="text-muted-foreground"> · {areaLabel(row.area)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {row.actor} · {row.changes.length + row.moreChanges} alan değişti
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : row.id)}
                    aria-expanded={expanded}
                    className="min-h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground hover:bg-secondary"
                  >
                    {expanded ? 'Kapat' : 'Ne değişti?'}
                  </button>
                  <button
                    type="button"
                    onClick={() => restore(row)}
                    disabled={pending}
                    className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    <Undo2 className="size-4" aria-hidden="true" /> Öncesine dön
                  </button>
                </div>
              </div>
              {expanded && (
                <div className="flex flex-col gap-2 rounded-lg bg-secondary p-3">
                  {!row.hadBefore && <p className="text-sm text-muted-foreground">Bu ayar ilk kez bu kayıtla özelleştirildi. Öncesine dönmek varsayılan hale getirir.</p>}
                  <ul className="flex flex-col gap-2">
                    {row.changes.map((c) => (
                      <li key={c.path} className="flex flex-col gap-0.5 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{c.path}</span>
                        <span className="break-words text-foreground">
                          <span className="text-muted-foreground line-through">{c.before}</span>
                          <span aria-hidden="true"> → </span>
                          <span className="sr-only"> yerine </span>
                          {c.after}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {row.moreChanges > 0 && <p className="text-sm text-muted-foreground">ve {row.moreChanges} alan daha.</p>}
                </div>
              )}
            </li>
          )
        })}
        {data.rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">Henüz kayıtlı değişiklik yok. Bir ayarı kaydettiğinde burada görünür.</li>}
      </ol>
      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Geçmiş sayfaları">
          <button type="button" onClick={() => load(data.page - 1)} disabled={data.page === 0 || pending} className={pager}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">Önceki sayfa</span>
          </button>
          <p className="text-sm tabular-nums text-muted-foreground">
            Sayfa {data.page + 1} / {pages}
          </p>
          <button type="button" onClick={() => load(data.page + 1)} disabled={data.page + 1 >= pages || pending} className={pager}>
            <ChevronRight className="size-4" aria-hidden="true" />
            <span className="sr-only">Sonraki sayfa</span>
          </button>
        </nav>
      )}
    </section>
  )
}
