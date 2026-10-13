'use client'

import { useState, useTransition } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { approveClaimAction, rejectClaimAction, saveTaskAction } from '@/app/panel/task-actions'
import type { PendingClaim, TaskInput, TaskRecord } from '@/lib/tasks'
import { cn } from '@/lib/utils'

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary'
const EMPTY: TaskInput = { id: null, title: '', detail: '', points: 10, link: '', needsApproval: true, active: true, sort: 0 }
const LINK_ERROR = 'Bağlantı https:// ile başlamalı.'

export function TasksManager({ tasks, claims }: { tasks: TaskRecord[]; claims: PendingClaim[] }) {
  const [editing, setEditing] = useState<TaskInput | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  function save(input: TaskInput) {
    const link = input.link.trim()
    if (link && !link.startsWith('https://')) {
      setMsg({ ok: false, text: LINK_ERROR })
      return
    }
    start(async () => {
      const res = await saveTaskAction(input)
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaydedildi.' } : { ok: false, text: res.error })
      if (res.ok) setEditing(null)
    })
  }

  function decide(kind: 'approve' | 'reject', id: number) {
    start(async () => {
      const res = kind === 'approve' ? await approveClaimAction(id) : await rejectClaimAction(id)
      setMsg(res.ok ? { ok: true, text: res.message ?? 'Kaydedildi.' } : { ok: false, text: res.error })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
        Görev adı, kısa açıklama ve puan burada durur. Kayıt silinmez; yayından çıkarmak için aktif kutusunu kapat.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing({ ...EMPTY, sort: tasks.length })}
          className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          Yeni görev
        </button>
        {msg && <p className={cn('text-sm', msg.ok ? 'text-success' : 'text-destructive')} aria-live="polite">{msg.text}</p>}
      </div>
      {editing && <TaskForm value={editing} pending={pending} onCancel={() => setEditing(null)} onSave={save} />}
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Henüz görev yok.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">{task.sort}</span>
              <span className={cn('min-w-0 flex-1 font-medium text-foreground', !task.active && 'opacity-50')}>
                {task.title}
                <span className="ml-2 font-normal text-muted-foreground">+{task.points}</span>
                {task.needsApproval ? <span className="ml-2 text-xs font-normal text-muted-foreground">Onay gerekir</span> : null}
              </span>
              {!task.active && <span className="text-[10px] font-bold uppercase text-muted-foreground">Pasif</span>}
              <button type="button" aria-label={`${task.title} düzenle`} onClick={() => setEditing({ ...task, link: task.link ?? '' })} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                <Pencil className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-3" aria-label="Bekleyen talepler">
        <h3 className="font-display text-base font-bold text-foreground">Bekleyen talepler</h3>
        {claims.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Bekleyen talep yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {claims.map((claim) => (
              <li key={claim.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{claim.userName}{claim.email ? ` · ${claim.email}` : ''}</span>
                  <span className="block text-muted-foreground">{claim.taskTitle} · {new Date(claim.createdAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </span>
                <button type="button" disabled={pending} onClick={() => decide('approve', claim.id)} className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                  Onayla
                </button>
                <button type="button" disabled={pending} onClick={() => decide('reject', claim.id)} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold text-foreground disabled:opacity-50">
                  Reddet
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function TaskForm({ value, pending, onSave, onCancel }: { value: TaskInput; pending: boolean; onSave: (value: TaskInput) => void; onCancel: () => void }) {
  const [v, setV] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof TaskInput>(key: K, next: TaskInput[K]) => setV((prev) => ({ ...prev, [key]: next }))
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const link = v.link.trim()
        if (link && !link.startsWith('https://')) {
          setError(LINK_ERROR)
          return
        }
        setError(null)
        onSave({ ...v, link, points: Number(v.points), sort: Number(v.sort) })
      }}
      className="grid gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-2"
    >
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground md:col-span-2">
        Görev adı
        <input required value={v.title} onChange={(event) => set('title', event.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground md:col-span-2">
        Kısa açıklama
        <input value={v.detail} onChange={(event) => set('detail', event.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground md:col-span-2">
        Bağlantı
        <input value={v.link} inputMode="url" placeholder="https://" onChange={(event) => set('link', event.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
        Puan
        <input required inputMode="numeric" value={String(v.points)} onChange={(event) => set('points', Number(event.target.value))} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
        Sıra
        <input required inputMode="numeric" value={String(v.sort)} onChange={(event) => set('sort', Number(event.target.value))} className={field} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <input type="checkbox" checked={v.needsApproval} onChange={(event) => set('needsApproval', event.target.checked)} className="size-4 accent-primary" />
        Onay beklesin
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <input type="checkbox" checked={v.active} onChange={(event) => set('active', event.target.checked)} className="size-4 accent-primary" />
        Aktif
      </label>
      {error ? <p className="text-sm text-destructive md:col-span-2" role="alert">{error}</p> : null}
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
