'use client'

import type { ChangeEvent } from 'react'
import useSWR from 'swr'
import { Download, Upload } from 'lucide-react'
import type { ConfigChange } from '@/lib/tg-resilience-shared'
import { askConfirm } from '@/components/panel/confirm-dialog'
import { Card, btnGhost, fmt, useAction, useFirstShown } from '@/components/panel/tg-hub-ui'
import { exportConfigAction, importConfigAction, loadConfigHistoryAction, restoreConfigAction } from '@/app/panel/tg-hub-actions'

const LINES_SHOWN = 6

function ChangeItem({ change, onDone }: { change: ConfigChange; onDone: () => void }) {
  const a = useAction()
  const extra = change.changes.length - LINES_SHOWN

  const restore = async () => {
    const sure = await askConfirm(
      `Ayarlar, ${fmt(change.at)} tarihli "${change.what}" değişikliğinden önceki hâline dönsün mü? O günden sonra yapılan ayar değişiklikleri geri alınır. Bot ve sohbet bağlantılarına dokunulmaz.`,
    )
    if (!sure) return
    a.run(async () => {
      const r = await restoreConfigAction(change.id)
      if (r.ok) onDone()
      return r
    })
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{change.what}</span>
          <span className="text-xs text-muted-foreground">
            {change.who || 'Panel'} · {fmt(change.at)}
          </span>
        </div>
        <button type="button" className={btnGhost} disabled={a.pending} onClick={restore}>
          {a.pending ? 'Dönülüyor…' : 'Bundan önceki hâle dön'}
        </button>
      </div>
      <ul className="flex list-disc flex-col gap-0.5 pl-5 text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]">
        {change.changes.slice(0, LINES_SHOWN).map((line) => (
          <li key={line}>{line}</li>
        ))}
        {extra > 0 && <li className="text-muted-foreground">ve {extra} değişiklik daha</li>}
      </ul>
      {a.note}
    </li>
  )
}

export function HistorySection() {
  const { ref, shown } = useFirstShown<HTMLDivElement>()
  const backup = useAction()
  const { data, error, isLoading, mutate } = useSWR(shown ? 'tg-config-history' : null, () => loadConfigHistoryAction(), { revalidateOnFocus: false })
  const reload = () => void mutate()

  const download = () =>
    backup.run(async () => {
      const r = await exportConfigAction()
      if (r.ok && r.json) {
        const url = URL.createObjectURL(new Blob([r.json], { type: 'application/json' }))
        const a = document.createElement('a')
        a.href = url
        a.download = `telegram-ayar-yedegi-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
      return { ok: r.ok, message: r.message }
    })

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Clearing the field lets the same file be picked again after a failed try.
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    if (!(await askConfirm(`"${file.name}" yedeğindeki ayarlar şu anki ayarların yerine geçsin mi? Bot ve sohbet bağlantılarına dokunulmaz; bu değişiklik de geçmişe yazılır ve geri alınabilir.`))) return
    backup.run(async () => {
      const r = await importConfigAction(text)
      if (r.ok) reload()
      return r
    })
  }

  return (
    <div ref={ref} className="flex flex-col gap-4">
      <Card
        title="Ayar yedeği"
        hint="Bekçi, Koruma, Destek, Oto Cevap ve Sayaç ayarlarının tamamı tek dosyaya iner. Yedek, bot ve sohbet bağlantılarını değiştirmez; yüklendiğinde sadece ayarlar o dosyadaki hâline döner."
      >
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={`${btnGhost} gap-2`} disabled={backup.pending} onClick={download}>
            <Download className="size-4" aria-hidden="true" />
            Yedeği indir
          </button>
          <label className={`${btnGhost} cursor-pointer gap-2 focus-within:ring-2 focus-within:ring-ring ${backup.pending ? 'pointer-events-none opacity-50' : ''}`}>
            <Upload className="size-4" aria-hidden="true" />
            Yedekten yükle
            <input type="file" accept="application/json,.json" className="sr-only" disabled={backup.pending} onChange={upload} />
          </label>
        </div>
        {backup.note}
      </Card>

      <Card
        title="Kim neyi değiştirdi"
        hint="Her kayıtta ayarların değişiklikten önceki hâli saklanır; istediğin kayda dönebilirsin. Son 200 değişiklik tutulur, hiçbir şey değiştirmeyen kayıtlar yazılmaz."
      >
        {error ? (
          <p className="text-sm text-foreground">
            Geçmiş okunamadı.{' '}
            <button type="button" className="font-semibold underline underline-offset-2" onClick={reload}>
              Tekrar dene
            </button>
          </p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">{isLoading || !shown ? 'Yükleniyor…' : 'Geçmiş yok.'}</p>
        ) : data.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {data.map((c) => (
              <ChangeItem key={c.id} change={c} onDone={reload} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Henüz kayıt yok. Bundan sonra kaydedilen her ayar değişikliği burada görünür.</p>
        )}
      </Card>
    </div>
  )
}
