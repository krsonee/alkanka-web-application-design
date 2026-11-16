'use client'

import { useState, useTransition, type FormEvent } from 'react'
import useSWR from 'swr'
import { Download } from 'lucide-react'
import { LOG_KINDS, type HubLogRow, type KnownChat, type LogFilter, type LogPage } from '@/lib/tg-hub-shared'
import { Card, btn, btnGhost, fmt, input, useAction } from '@/components/panel/tg-hub-ui'
import { MemberName } from '@/components/panel/tg-member-card'
import { exportLogAction, searchLogAction, undoLogAction } from '@/app/panel/tg-hub-actions'

type Draft = { kind: string; chatId: string; q: string; from: string; to: string }
const EMPTY: Draft = { kind: '', chatId: '', q: '', from: '', to: '' }

const toFilter = (d: Draft): LogFilter => {
  const f: LogFilter = {}
  if (d.kind) f.kind = d.kind
  if (d.chatId) f.chatId = d.chatId
  if (d.q.trim()) f.q = d.q.trim()
  if (d.from) f.from = d.from
  if (d.to) f.to = d.to
  return f
}

function LogItem({ l, onChanged }: { l: HubLogRow; onChanged: () => void }) {
  const a = useAction()
  return (
    <li className="flex flex-col gap-0.5 py-2.5 text-sm">
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-foreground [overflow-wrap:anywhere]">
          <span className="font-semibold">{l.action}</span>
          {l.who ? (
            <>
              {' · '}
              <MemberName tgId={l.tgId}>{l.who}</MemberName>
            </>
          ) : null}
        </span>
        {l.canUndo && (
          <button
            type="button"
            className="shrink-0 text-xs text-primary hover:underline disabled:opacity-50"
            disabled={a.pending}
            onClick={() =>
              a.run(async () => {
                const r = await undoLogAction(l.id)
                if (r.ok) onChanged()
                return r
              })
            }
          >
            {a.pending ? 'Geri alınıyor…' : 'Geri al'}
          </button>
        )}
      </span>
      <span className="text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
        {l.chatTitle ? `${l.chatTitle} · ` : ''}
        {l.reason} · {fmt(l.createdAt)}
      </span>
      {a.note}
    </li>
  )
}

export function LogSection({ initial, groups }: { initial: LogPage; groups: KnownChat[] }) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [applied, setApplied] = useState<Draft>(EMPTY)
  const filter = toFilter(applied)
  const key = JSON.stringify(filter)
  const unfiltered = key === '{}'
  // The first unfiltered page comes with the panel itself; anything else is asked for when the filter changes.
  const { data, isLoading, mutate } = useSWR(['tg-log', key], () => searchLogAction(filter), {
    fallbackData: unfiltered ? initial : undefined,
    revalidateOnMount: !unfiltered,
    revalidateOnFocus: false,
  })
  const [more, setMore] = useState<{ key: string; rows: HubLogRow[]; hasMore: boolean } | null>(null)
  const [loadingMore, startMore] = useTransition()
  const exporter = useAction()

  const extra = more?.key === key ? more : null
  const list = [...(data?.rows ?? []), ...(extra?.rows ?? [])]
  const hasMore = extra ? extra.hasMore : Boolean(data?.hasMore)
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied)

  const apply = (e: FormEvent) => {
    e.preventDefault()
    setApplied(draft)
  }
  const refresh = () => {
    setMore(null)
    void mutate()
  }
  const loadMore = () =>
    startMore(async () => {
      const last = list[list.length - 1]
      if (!last) return
      const page = await searchLogAction(filter, last.id)
      setMore({ key, rows: [...(extra?.rows ?? []), ...page.rows], hasMore: page.hasMore })
    })
  const download = () =>
    exporter.run(async () => {
      const r = await exportLogAction(filter)
      if (r.ok && r.csv) {
        const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }))
        const a = document.createElement('a')
        a.href = url
        a.download = `telegram-kayitlar-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
      return { ok: r.ok, message: r.message }
    })

  return (
    <div className="flex flex-col gap-4">
      <Card title="Kayıtlarda ara" hint="Bekçi'nin ve panelin yaptığı her işlem burada. Bir kişinin adına basınca üye kartı açılır.">
        <form onSubmit={apply} className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              İşlem türü
              <select className={input} value={draft.kind} onChange={(e) => set({ kind: e.target.value })}>
                <option value="">Hepsi</option>
                {LOG_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
                <option value="other">Diğer</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Grup
              <select className={input} value={draft.chatId} onChange={(e) => set({ chatId: e.target.value })}>
                <option value="">Hepsi</option>
                {groups.map((g) => (
                  <option key={g.chatId} value={g.chatId}>
                    {g.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Kişi ya da kelime
              <input className={input} placeholder="@kullanıcı, ad, ID ya da neden" value={draft.q} onChange={(e) => set({ q: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Başlangıç günü
              <input type="date" className={input} value={draft.from} max={draft.to || undefined} onChange={(e) => set({ from: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Bitiş günü
              <input type="date" className={input} value={draft.to} min={draft.from || undefined} onChange={(e) => set({ to: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={btn} disabled={!dirty}>
              Filtrele
            </button>
            {!unfiltered && (
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  setDraft(EMPTY)
                  setApplied(EMPTY)
                }}
              >
                Filtreyi temizle
              </button>
            )}
            <button type="button" className={`${btnGhost} gap-1.5`} disabled={exporter.pending || list.length === 0} onClick={download}>
              <Download className="size-4" aria-hidden="true" />
              {exporter.pending ? 'Hazırlanıyor…' : 'CSV indir'}
            </button>
          </div>
          {exporter.note}
        </form>
      </Card>

      <Card
        title={unfiltered ? 'Son işlemler' : 'Bulunan kayıtlar'}
        hint={'"Geri al" uyarıyı siler, susturmayı ya da banı kaldırır ve düşen güven puanını geri verir. Silinen mesaj geri gelmez.'}
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Aranıyor…</p>
        ) : list.length ? (
          <>
            <ul aria-live="polite" className="flex flex-col divide-y divide-border">
              {list.map((l) => (
                <LogItem key={l.id} l={l} onChanged={refresh} />
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              {hasMore && (
                <button type="button" className={btnGhost} disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? 'Yükleniyor…' : 'Daha eski kayıtları göster'}
                </button>
              )}
              <span className="text-xs tabular-nums text-muted-foreground">{`${list.length} kayıt gösteriliyor${hasMore ? '' : ', hepsi bu'}`}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{unfiltered ? 'Henüz kayıt yok.' : 'Bu filtreyle kayıt bulunamadı.'}</p>
        )}
      </Card>
    </div>
  )
}
