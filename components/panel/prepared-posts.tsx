'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FilePlus2, Loader2 } from 'lucide-react'
import { applyPreparedAction } from '@/app/panel/seo-actions'
import { askConfirm } from '@/components/panel/confirm-dialog'
import type { PreparedRow } from '@/lib/blog-drafts/types'

const KIND_LABEL: Record<PreparedRow['kind'], string> = { new: 'Yeni yazı', update: 'Mevcut yazıya ek' }

export function PreparedPosts({ rows }: { rows: PreparedRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null)
  if (rows.length === 0) return null
  const waiting = rows.filter((r) => r.state === 'hazir').length

  async function apply(row: PreparedRow) {
    if (row.kind === 'update') {
      const ok = await askConfirm(
        `"${row.title}" yazısına ${row.words} kelimelik yeni bölümler eklensin mi? Mevcut metin silinmez. Yazı yayındaysa değişiklik sitede de görünür.`,
      )
      if (!ok) return
    }
    setBusy(row.slug)
    start(async () => {
      const result = await applyPreparedAction(row.slug)
      setNotice(result)
      setBusy('')
      if (result.ok) router.refresh()
    })
  }

  return (
    <section id="hazir-yazilar" data-find="hazir-yazilar" className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="hazir-yazilar-baslik">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FilePlus2 className="size-5 text-primary" aria-hidden />
          <h2 id="hazir-yazilar-baslik" className="font-display text-xl font-bold uppercase text-foreground">
            Hazır yazılar
          </h2>
        </div>
        <span className="text-sm text-muted-foreground">{waiting ? `${waiting} yazı bekliyor` : 'Hepsi eklendi'}</span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {'Senin için önceden yazılmış rehber metinleri. Düğmeye basmadan hiçbiri siteye çıkmaz. Yeni yazılar taslak olarak eklenir; aşağıdaki listeden açıp okur, uygun bulursan yayına alırsın. Mevcut yazıya ek olanlar, kısa kalan bir yazıyı uzatan yeni bölümlerdir.'}
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.slug} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted-foreground">{KIND_LABEL[row.kind]}</span>
                <span className="text-xs text-muted-foreground">{row.words} kelime</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{row.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{row.note}</span>
            </div>
            {row.state === 'eklendi' ? (
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-success">
                <CheckCircle2 className="size-4" aria-hidden />
                Eklendi
              </span>
            ) : row.state === 'yazi-yok' ? (
              <span className="shrink-0 text-xs text-muted-foreground">Yazı silinmiş, eklenemez</span>
            ) : (
              <button
                type="button"
                onClick={() => apply(row)}
                disabled={pending}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy === row.slug && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {row.kind === 'new' ? 'Taslak olarak ekle' : 'Bölümleri ekle'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {notice && (
        <p role="status" className={`text-sm font-semibold ${notice.ok ? 'text-success' : 'text-destructive'}`}>
          {notice.message}
        </p>
      )}
    </section>
  )
}
