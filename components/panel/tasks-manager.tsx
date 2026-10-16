'use client'

import { HideButton } from '@/components/panel/hide-button'
import { useState, useTransition } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { approveClaimAction, rejectClaimAction, saveTaskAction } from '@/app/panel/task-actions'
import type { PendingClaim, TaskInput, TaskRecord } from '@/lib/tasks'
import { PERIODS, type TaskPeriod } from '@/lib/task-period'
import { KIND_META, TASK_GAMES, TASK_KINDS, TASK_PLATFORMS, type TaskKind } from '@/lib/task-kinds'
import { cn } from '@/lib/utils'

/** ISO timestamp → `YYYY-MM-DDTHH:mm` in Turkey time for datetime-local inputs. */
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  return new Date(Date.parse(iso) + 3 * 3600000).toISOString().slice(0, 16)
}

const PERIOD_LABEL = Object.fromEntries(PERIODS.map((p) => [p.value, p.label])) as Record<TaskPeriod, string>

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary'
const EMPTY: TaskInput = { id: null, title: '', detail: '', points: 10, link: '', needsApproval: true, active: true, sort: 0, period: 'once', startsAt: '', endsAt: '', kind: 'manual', target: 1, param: '' }
const LINK_ERROR = 'Bağlantı https:// ile başlamalı.'

const TASK_TEMPLATES: Partial<TaskInput>[] = [
  { title: '3 Tavla maçı tamamla', detail: 'Bugün 3 tavla maçını sonuna kadar oyna.', points: 30, period: 'daily', kind: 'game_play', param: 'tavla', target: 3 },
  { title: '1 Okey masası kazan', detail: 'Bugün bir Okey masasında kazan.', points: 40, period: 'daily', kind: 'game_win', param: 'okey', target: 1 },
  { title: '101 Okey oyna', detail: 'Bir 101 Okey masasına otur ve oyunu bitir.', points: 25, period: 'daily', kind: 'game_play', param: 'okey101', target: 1 },
  { title: 'Batak ligi: 5 el kazan', detail: 'Bu hafta Batak masalarında 5 kez kazan.', points: 75, period: 'weekly', kind: 'game_win', param: 'batak', target: 5 },
  { title: 'Bilardo düellosu kazan', detail: 'Bu hafta bir Bilardo maçı kazan.', points: 50, period: 'weekly', kind: 'game_win', param: 'bilardo', target: 1 },
  { title: 'Herhangi 10 maç oyna', detail: 'Bu hafta istediğin oyunda 10 maç bitir.', points: 100, period: 'weekly', kind: 'game_play', param: '', target: 10 },
  { title: 'Sponsor siteyi ziyaret et', detail: 'Bugün sponsorlardan birine sitemizdeki Git butonuyla gir.', points: 15, period: 'daily', kind: 'sponsor_visit', param: '', target: 1 },
  { title: 'Sponsor hesabını bağla', detail: 'Sponsor sitedeki kullanıcı adını profilinden bağla, onaylanınca ödül senin.', points: 200, period: 'once', kind: 'sponsor_link', param: '', target: 1 },
  { title: '3 arkadaşını davet et', detail: 'Bu ay davet linkinle 3 arkadaşın kayıt olsun.', points: 300, period: 'monthly', kind: 'invite', target: 3 },
  { title: 'Telegram hesabını bağla', detail: 'Profilinden Telegram hesabını bağla.', points: 50, period: 'once', kind: 'telegram_link' },
  { title: 'Instagram hesabını doğrula', detail: 'Profilinden Instagram hesabını bağla ve doğrulat.', points: 50, period: 'once', kind: 'social_link', param: 'instagram' },
  { title: 'Maç davetini Telegram\u2019da paylaş', detail: 'Masa davet linkini bir Telegram grubunda paylaş, ekran görüntüsünü gönder.', points: 20, period: 'daily', kind: 'manual', needsApproval: true },
]

export function TasksManager({ tasks, claims, sites = [] }: { tasks: TaskRecord[]; claims: PendingClaim[]; sites?: { id: string; name: string }[] }) {
  const [editing, setEditingRaw] = useState<TaskInput | null>(null)
  const [formKey, setFormKey] = useState(0)
  const setEditing = (next: TaskInput | null) => {
    setEditingRaw(next)
    if (next) setFormKey((k) => k + 1)
  }
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
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-semibold text-muted-foreground">Hazır görevler: tıkla, form dolsun, düzenleyip kaydet. Oyun, sponsor, davet ve hesap görevleri otomatik kontrol edilir.</p>
        <div className="flex flex-wrap gap-2">
          {TASK_TEMPLATES.map((t) => (
            <button
              key={t.title}
              type="button"
              onClick={() => setEditing({ ...EMPTY, ...t, sort: tasks.length })}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary hover:text-primary"
            >
              {t.title}
            </button>
          ))}
        </div>
      </div>
      {editing && <TaskForm key={formKey} sites={sites} value={editing} pending={pending} onCancel={() => setEditing(null)} onSave={save} />}
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
                {task.kind !== 'manual' ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {KIND_META[task.kind].label}{task.param ? ` · ${paramLabel(task.kind, task.param, sites)}` : ''}{task.target > 1 ? ` · ${task.target} kez` : ''}
                  </span>
                ) : task.needsApproval ? <span className="ml-2 text-xs font-normal text-muted-foreground">Onay gerekir</span> : null}
                {task.period !== 'once' ? <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">{PERIOD_LABEL[task.period]}</span> : null}
                {task.endsAt && Date.parse(task.endsAt) < Date.now() ? <span className="ml-2 text-xs font-normal text-destructive">Süresi doldu</span> : null}
              </span>
              {!task.active && <span className="text-[10px] font-bold uppercase text-muted-foreground">Gizli</span>}
              <HideButton key={`${task.id}-${task.active}`} kind="task" id={task.id} hidden={!task.active} label={task.title} />
              <button type="button" aria-label={`${task.title} düzenle`} onClick={() => setEditing({ ...task, link: task.link ?? '', param: task.param ?? '', startsAt: toLocalInput(task.startsAt), endsAt: toLocalInput(task.endsAt) })} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
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

function paramLabel(kind: TaskKind, param: string, sites: { id: string; name: string }[]) {
  const type = KIND_META[kind].param
  const list = type === 'game' ? TASK_GAMES : type === 'platform' ? TASK_PLATFORMS : sites.map((x) => ({ value: x.id, label: x.name }))
  return list.find((x) => x.value === param)?.label ?? param
}

function TaskForm({ value, pending, onSave, onCancel, sites }: { value: TaskInput; pending: boolean; onSave: (value: TaskInput) => void; onCancel: () => void; sites: { id: string; name: string }[] }) {
  const [v, setV] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof TaskInput>(key: K, next: TaskInput[K]) => setV((prev) => ({ ...prev, [key]: next }))
  const meta = KIND_META[v.kind]
  const paramOptions = meta.param === 'game' ? TASK_GAMES : meta.param === 'platform' ? TASK_PLATFORMS : sites.map((x) => ({ value: x.id, label: x.name }))
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
        onSave({ ...v, link, points: Number(v.points), sort: Number(v.sort), target: Number(v.target) })
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
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
        Görev türü
        <select value={v.kind} onChange={(event) => setV((prev) => ({ ...prev, kind: event.target.value as TaskKind, param: '', target: 1 }))} className={field}>
          {TASK_KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </label>
      {meta.param ? (
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
          {meta.param === 'game' ? 'Oyun' : meta.param === 'platform' ? 'Platform' : 'Sponsor site'}
          <select value={v.param} onChange={(event) => set('param', event.target.value)} className={field}>
            <option value="">{meta.param === 'game' ? 'Herhangi bir oyun' : meta.param === 'platform' ? 'Herhangi bir platform' : 'Herhangi bir sponsor'}</option>
            {paramOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      ) : <span className="hidden md:block" />}
      {meta.counted ? (
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
          Hedef sayı (kaç kez)
          <input required inputMode="numeric" value={String(v.target)} onChange={(event) => set('target', Number(event.target.value))} className={field} />
        </label>
      ) : null}
      <p className={cn('self-end pb-2 text-xs leading-relaxed text-muted-foreground', !meta.counted && 'md:col-span-2')}>
        {meta.hint}{v.kind !== 'manual' ? ' Sayım, seçtiğin tekrar döneminin başından itibaren yapılır.' : ''}
      </p>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground md:col-span-2">
        Bağlantı {v.kind !== 'manual' ? '(boş bırak, üye otomatik doğru sayfaya gider)' : ''}
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
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
        Tekrar
        <select value={v.period} onChange={(event) => set('period', event.target.value as TaskPeriod)} className={field}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </label>
      <p className="self-end pb-2 text-xs leading-relaxed text-muted-foreground">
        Günlük görev her gün, haftalık her pazartesi, aylık her ayın 1&apos;inde yeniden yapılabilir.
      </p>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
        Başlangıç (boş = hemen)
        <input type="datetime-local" value={v.startsAt} onChange={(event) => set('startsAt', event.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
        Bitiş (boş = süresiz)
        <input type="datetime-local" value={v.endsAt} onChange={(event) => set('endsAt', event.target.value)} className={field} />
      </label>
      <label className={cn('flex items-center gap-2 text-sm font-semibold text-foreground', v.kind !== 'manual' && 'opacity-50')}>
        <input type="checkbox" disabled={v.kind !== 'manual'} checked={v.kind === 'manual' && v.needsApproval} onChange={(event) => set('needsApproval', event.target.checked)} className="size-4 accent-primary" />
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
