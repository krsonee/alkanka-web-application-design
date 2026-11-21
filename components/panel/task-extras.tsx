'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { TaskRecord } from '@/lib/tasks'
import { trDay } from '@/lib/task-period'
import {
  gameParamOptions, KIND_META, MAX_TASK_PARTS, PART_KINDS, partLabel, TASK_PLATFORMS, type TaskKind, type TaskPart,
} from '@/lib/task-kinds'
import { cn } from '@/lib/utils'

const field = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-primary'

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00+03:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short', timeZone: 'Europe/Istanbul' })

const nextDay = (day: string, n = 1) => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** The dates a task is shown on. No date means "every day inside its start and end". */
export function DaysField({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [day, setDay] = useState('')
  const add = () => {
    if (!day || value.includes(day)) return
    onChange([...value, day].sort())
    setDay('')
  }
  return (
    <fieldset className="flex flex-col gap-2 md:col-span-2">
      <legend className="text-xs font-semibold text-foreground">Sadece şu günlerde göster (boş = her gün)</legend>
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" aria-label="Gün ekle" value={day} onChange={(event) => setDay(event.target.value)} className={cn(field, 'w-44')} />
        <button type="button" onClick={add} disabled={!day} className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground disabled:opacity-50">
          <Plus className="size-4" aria-hidden="true" />
          Günü ekle
        </button>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="h-10 rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:text-foreground">
            Hepsini kaldır
          </button>
        )}
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((d) => (
            <li key={d} className="flex items-center gap-1 rounded-full border border-border bg-background py-1 pl-2.5 pr-1 text-xs text-foreground">
              {dayLabel(d)}
              <button type="button" aria-label={`${dayLabel(d)} gününü kaldır`} onClick={() => onChange(value.filter((x) => x !== d))} className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Günün oyunu gibi belli günlere özel görevler için. Görev seçtiğin günlerde, Türkiye saatiyle gece yarısından gece yarısına görünür.
      </p>
    </fieldset>
  )
}

const partOptions = (kind: TaskPart['kind']) => {
  if (kind === 'task') return []
  const type = KIND_META[kind].param
  return type === 'game' || type === 'games' ? gameParamOptions(type) : type === 'platform' ? TASK_PLATFORMS : []
}

/** A super task's own conditions. With none, the super task keeps its old meaning: every other task of the period. */
export function PartsField({ value, onChange, tasks, selfId }: { value: TaskPart[]; onChange: (next: TaskPart[]) => void; tasks: TaskRecord[]; selfId: number | null }) {
  const others = tasks.filter((t) => t.id !== selfId && t.kind !== 'bundle' && !t.archived)
  const set = (index: number, patch: Partial<TaskPart>) => onChange(value.map((part, i) => (i === index ? { ...part, ...patch } : part)))
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3 md:col-span-2">
      <legend className="px-1 text-xs font-semibold text-foreground">Şartlar</legend>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Şart eklemezsen süper görev, aynı dönem ve kategorideki diğer görevlerin hepsi bitince açılır. Şart eklersen sadece bu şartların hepsi tamamlanınca açılır;
        üye her şartta nerede olduğunu görev kartında görür.
      </p>
      {value.map((part, index) => {
        const meta = part.kind === 'task' ? null : KIND_META[part.kind]
        const options = partOptions(part.kind)
        return (
          <div key={index} className="grid gap-2 rounded-lg bg-secondary/50 p-2 sm:grid-cols-12 sm:items-end">
            <label className="flex flex-col gap-1 text-xs font-semibold text-foreground sm:col-span-4">
              Şart
              <select
                value={part.kind}
                onChange={(event) => set(index, { kind: event.target.value as TaskKind | 'task', param: null, target: 1 })}
                className={field}
              >
                {PART_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
                <option value="task">Başka bir görevi tamamla</option>
              </select>
            </label>
            {part.kind === 'task' ? (
              <label className="flex flex-col gap-1 text-xs font-semibold text-foreground sm:col-span-7">
                Görev
                <select value={part.param ?? ''} onChange={(event) => set(index, { param: event.target.value || null })} className={field}>
                  <option value="">Görev seç</option>
                  {others.map((t) => (
                    <option key={t.id} value={String(t.id)}>{t.title}{t.active ? '' : ' (gizli)'}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className={cn('flex flex-col gap-1 text-xs font-semibold text-foreground sm:col-span-4', !options.length && 'invisible max-sm:hidden')}>
                  {meta?.param === 'platform' ? 'Platform' : 'Oyun'}
                  <select value={part.param ?? ''} onChange={(event) => set(index, { param: event.target.value || null })} className={field} disabled={!options.length}>
                    <option value="">{meta?.param === 'platform' ? 'Herhangi bir platform' : 'Herhangi bir oyun'}</option>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className={cn('flex flex-col gap-1 text-xs font-semibold text-foreground sm:col-span-3', !meta?.counted && 'invisible max-sm:hidden')}>
                  Hedef
                  <input inputMode="numeric" value={String(part.target)} disabled={!meta?.counted} onChange={(event) => set(index, { target: Math.max(1, Math.floor(Number(event.target.value) || 1)) })} className={field} />
                </label>
              </>
            )}
            <button type="button" aria-label={`${index + 1}. şartı kaldır`} onClick={() => onChange(value.filter((_, i) => i !== index))} className="flex h-10 items-center justify-center rounded-lg border border-border px-3 text-muted-foreground hover:text-foreground sm:col-span-1">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
      <div>
        <button
          type="button"
          disabled={value.length >= MAX_TASK_PARTS}
          onClick={() => onChange([...value, { kind: 'game_play', param: null, target: 1 }])}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Şart ekle
        </button>
      </div>
    </fieldset>
  )
}

export function partsSummary(parts: TaskPart[], tasks: TaskRecord[]) {
  return parts
    .map((part) => {
      if (part.kind === 'task') return tasks.find((t) => String(t.id) === part.param)?.title ?? 'Görev'
      return `${partLabel(part)}${part.target > 1 ? ` ${part.target.toLocaleString('tr-TR')}` : ''}`
    })
    .join(' + ')
}

/** Whether the task is on the site at some point of that Turkey day, going by its switch, window and day list. */
function onThatDay(task: TaskRecord, day: string) {
  if (!task.active || task.archived) return false
  const from = Date.parse(`${day}T00:00:00+03:00`)
  const to = Date.parse(`${nextDay(day)}T00:00:00+03:00`)
  if (task.startsAt && Date.parse(task.startsAt) >= to) return false
  if (task.endsAt && Date.parse(task.endsAt) <= from) return false
  return !task.days || task.days.includes(day)
}

const CALENDAR_DAYS = 14

/** The next two weeks, day by day: which daily tasks every member will see. Rotating pool tasks are left out, they differ per member. */
export function TaskCalendar({ tasks }: { tasks: TaskRecord[] }) {
  const [from, setFrom] = useState(() => trDay())
  const fixed = tasks.filter((t) => t.period === 'daily' && !t.pool && !t.chain)
  const days = Array.from({ length: CALENDAR_DAYS }, (_, i) => nextDay(from, i))
  const rows = days.map((day) => ({ day, items: fixed.filter((t) => onThatDay(t, day)) }))
  const today = trDay()
  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="cursor-pointer p-3 text-sm font-semibold text-foreground">Günlük görev takvimi</summary>
      <div className="flex flex-col gap-3 border-t border-border p-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Her günün herkese açık günlük görevleri. Havuzdan dönen görevler burada yok: onlar üyeden üyeye değişir. Bir günü değiştirmek için görevi listeden açıp günlerini düzenle.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFrom(nextDay(from, -CALENDAR_DAYS))} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold text-foreground">Önceki 14 gün</button>
          <button type="button" onClick={() => setFrom(today)} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold text-foreground">Bugün</button>
          <button type="button" onClick={() => setFrom(nextDay(from, CALENDAR_DAYS))} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold text-foreground">Sonraki 14 gün</button>
        </div>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {rows.map(({ day, items }) => (
            <li key={day} className={cn('flex flex-col gap-1 p-2.5 sm:flex-row sm:gap-3', day === today && 'bg-primary/10')}>
              <span className="w-32 shrink-0 text-xs font-bold text-foreground">
                {dayLabel(day)}
                {day === today ? <span className="ml-1.5 font-semibold text-primary">bugün</span> : null}
              </span>
              {items.length ? (
                <span className="min-w-0 flex-1 text-xs leading-relaxed text-foreground">
                  {items.map((t) => `${t.title} (+${t.points})`).join(' · ')}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Bu güne özel günlük görev yok.</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
