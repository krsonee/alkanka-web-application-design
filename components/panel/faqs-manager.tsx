'use client'

import { useState, useTransition } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { saveFaqAction } from '@/app/panel/faq-actions'
import type { FaqInput, FaqRecord } from '@/lib/faqs'
import { cn } from '@/lib/utils'

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary'
const EMPTY: FaqInput = { id: null, question: '', answer: '', category: 'Genel', sortOrder: 0, active: true }

export function FaqsManager({ faqs }: { faqs: FaqRecord[] }) {
  const [editing, setEditing] = useState<FaqInput | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

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
      {faqs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Henüz soru yok.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {faqs.map((faq) => (
            <li key={faq.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">{faq.sortOrder}</span>
              <span className={cn('min-w-0 flex-1 font-medium text-foreground', !faq.active && 'opacity-50')}>
                {faq.question}
                <span className="ml-2 font-normal text-muted-foreground">{faq.category}</span>
              </span>
              {!faq.active && <span className="text-[10px] font-bold uppercase text-muted-foreground">Pasif</span>}
              <button
                type="button"
                aria-label={`${faq.question} düzenle`}
                onClick={() => setEditing({ id: faq.id, question: faq.question, answer: faq.answer, category: faq.category, sortOrder: faq.sortOrder, active: faq.active })}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
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
