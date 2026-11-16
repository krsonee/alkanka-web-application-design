'use client'

import { HideButton } from '@/components/panel/hide-button'
import { useState, useTransition } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { reorderFaqsAction, saveFaqAction } from '@/app/panel/faq-actions'
import { SortableList, mergeOrder, useOrder } from '@/components/panel/sortable-list'
import type { FaqInput, FaqRecord } from '@/lib/faqs'
import { cn } from '@/lib/utils'

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary'
const EMPTY: FaqInput = { id: null, question: '', answer: '', category: 'Genel', sortOrder: 0, active: true }

export function FaqsManager({ faqs }: { faqs: FaqRecord[] }) {
  const [editing, setEditing] = useState<FaqInput | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const order = useOrder(faqs, (faq) => String(faq.id))
  const [sorting, startSort] = useTransition()
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')

  const categories = Array.from(new Set(faqs.map((faq) => faq.category)))
  const q = query.trim().toLocaleLowerCase('tr')
  const shown = order.ordered.filter(
    (faq) => (!category || faq.category === category) && (!q || `${faq.question} ${faq.answer}`.toLocaleLowerCase('tr').includes(q)),
  )
  const filtered = shown.length !== order.ordered.length

  function move(visible: string[]) {
    const ids = mergeOrder(order.ordered.map((faq) => String(faq.id)), visible)
    order.set(ids)
    startSort(async () => {
      const res = await reorderFaqsAction(ids.map(Number))
      if (!res.ok) order.reset()
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Sıra kaydedildi.' } : { ok: false, text: res.error })
    })
  }

  function save(input: FaqInput) {
    start(async () => {
      const res = await saveFaqAction(input)
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaydedildi.' } : { ok: false, text: res.error })
      if (res.ok) setEditing(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
        Soru, cevap, kategori ve sıra burada durur. Kayıt silinmez; yayından çıkarmak için aktif kutusunu kapat.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing({ ...EMPTY, sortOrder: faqs.length })}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Yeni soru
        </button>
        {msg && <p className={cn('text-sm', msg.ok ? 'text-success' : 'text-destructive')} aria-live="polite">{msg.text}</p>}
      </div>
      {editing && <FaqForm value={editing} pending={pending} onCancel={() => setEditing(null)} onSave={save} />}
      {faqs.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Soru ya da cevapta ara
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="çekim, bonus, davet…" className={cn(field, 'pl-9')} />
            </span>
          </label>
          <div role="group" aria-label="Kategoriye göre süz" className="flex flex-wrap gap-2">
            {['', ...categories].map((name) => (
              <button
                key={name || 'tumu'}
                type="button"
                aria-pressed={category === name}
                onClick={() => setCategory(name)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold',
                  category === name ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-secondary',
                )}
              >
                {name || 'Tümü'}
                <span className="ml-1.5 font-normal tabular-nums">{name ? faqs.filter((faq) => faq.category === name).length : faqs.length}</span>
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {filtered
              ? `${shown.length} soru gösteriliyor. Sürüklediğin sorular sadece kendi aralarında yer değiştirir; gizlenen soruların yeri bozulmaz.`
              : 'Sırayı değiştirmek için soldaki tutamağı sürükle; bıraktığın an kaydedilir. Sitede kategoriler, ilk sorularının sırasına göre dizilir.'}
          </p>
        </div>
      )}
      {faqs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Henüz soru yok.</p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Bu aramaya uyan soru yok.</p>
      ) : (
        <SortableList
          items={shown}
          idOf={(faq) => String(faq.id)}
          nameOf={(faq) => faq.question}
          onMove={move}
          disabled={sorting}
          className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card"
          itemClassName="bg-card first:rounded-t-xl last:rounded-b-xl"
        >
          {(faq, handle, i) => (
            <div data-find={`faq-${faq.id}`} className="flex flex-wrap items-center gap-2 p-2 pr-3 text-sm">
              {handle}
              <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <span className={cn('min-w-0 flex-1 basis-40 font-medium text-foreground', !faq.active && 'opacity-50')}>
                {faq.question}
                <span className="ml-2 font-normal text-muted-foreground">{faq.category}</span>
              </span>
              {!faq.active && <span className="text-xs font-bold uppercase text-muted-foreground">Gizli</span>}
              <HideButton key={`${faq.id}-${faq.active}`} kind="faq" id={faq.id} hidden={!faq.active} label={faq.question} />
              <button
                type="button"
                aria-label={`${faq.question} düzenle`}
                onClick={() => setEditing({ id: faq.id, question: faq.question, answer: faq.answer, category: faq.category, sortOrder: faq.sortOrder, active: faq.active })}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </SortableList>
      )}
    </div>
  )
}

function FaqForm({ value, pending, onSave, onCancel }: { value: FaqInput; pending: boolean; onSave: (value: FaqInput) => void; onCancel: () => void }) {
  const [v, setV] = useState(value)
  const set = <K extends keyof FaqInput>(key: K, next: FaqInput[K]) => setV((prev) => ({ ...prev, [key]: next }))
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSave({ ...v, sortOrder: Number(v.sortOrder) })
      }}
      className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-2"
    >
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground md:col-span-2">
        Soru
        <input required minLength={5} maxLength={200} value={v.question} onChange={(event) => set('question', event.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground md:col-span-2">
        Cevap
        <textarea required minLength={5} maxLength={2000} value={v.answer} onChange={(event) => set('answer', event.target.value)} className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:border-primary" />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
        Kategori
        <input required maxLength={40} value={v.category} onChange={(event) => set('category', event.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
        Sıra
        <input required inputMode="numeric" value={String(v.sortOrder)} onChange={(event) => set('sortOrder', Number(event.target.value))} className={field} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-foreground md:col-span-2">
        <input type="checkbox" checked={v.active} onChange={(event) => set('active', event.target.checked)} className="size-4 accent-primary" />
        Aktif
      </label>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <button type="submit" disabled={pending} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {pending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-foreground">
          Vazgeç
        </button>
      </div>
    </form>
  )
}
