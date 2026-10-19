'use client'

import { useEffect, useState, useTransition } from 'react'
import { Check, CalendarCheck, Flame, Info } from 'lucide-react'
import { checkInAction, completeTaskAction } from '@/app/actions/tasks'
import { PERIODS, STREAK_DAYS, type TaskPeriod } from '@/lib/task-period'
import { isSocialCheckKind, KIND_META, kindHref, type TaskKind } from '@/lib/task-kinds'
import { cn } from '@/lib/utils'
import { DetailModal } from './detail-modal'
import { JakoTip } from './jako'
import { DailyGames } from './daily-games'
import { formatAC, usePoints } from './points-context'

export type PublicTask = {
  id: number
  title: string
  detail: string
  points: number
  link: string | null
  needsApproval: boolean
  period: TaskPeriod
  kind: TaskKind
  target: number
  param: string | null
  progress: number
  claim: 'beklemede' | 'onaylandi' | 'reddedildi' | null
  done: boolean
}

const DAYS = STREAK_DAYS
const PERIOD_LABEL = Object.fromEntries(PERIODS.map((p) => [p.value, p.label])) as Record<TaskPeriod, string>
const PERIOD_RULE: Record<TaskPeriod, string> = {
  once: 'Aynı görev için puan bir kez yazılır.',
  daily: 'Bu görev her gün Türkiye saatiyle 00:00’da yenilenir.',
  weekly: 'Bu görev her pazartesi 00:00’da yenilenir.',
  monthly: 'Bu görev her ayın 1’inde yenilenir.',
}
const PERIOD_ORDER: TaskPeriod[] = ['daily', 'weekly', 'monthly', 'once']

const STREAK_RULES = [
  'Ödülü almak için her gün “Bugünü al” butonuna basman gerekir.',
  'Gün, Türkiye saatiyle 00:00’da yenilenir.',
  'Bir günü kaçırırsan seri 1. güne döner. Seri Kalkanı bunu bir kez engeller.',
  '7. günde VIP ödül sandığı açılır ve seri yeniden başlar.',
]

function statusOf(task: PublicTask, local: PublicTask['claim'] | undefined, done: boolean) {
  if (done || task.done || local === 'onaylandi' || task.claim === 'onaylandi') return 'done' as const
  const claim = local ?? task.claim
  if (claim === 'beklemede') return 'waiting' as const
  if (claim === 'reddedildi') return 'rejected' as const
  return 'open' as const
}

export function Tasks({ tasks: rawTasks, streak }: { tasks: PublicTask[]; streak: { streak: number; checkedToday: boolean } }) {
  const tasks = [...rawTasks].sort((a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period))
  const { requireLogin, setBalance, refresh } = usePoints()
  const [detail, setDetail] = useState<PublicTask | null>(null)
  const [streakInfo, setStreakInfo] = useState(false)
  const [streakDay, setStreakDay] = useState(streak.streak)
  const [checkedToday, setCheckedToday] = useState(streak.checkedToday)
  const [done, setDone] = useState<Record<number, boolean>>(() => Object.fromEntries(tasks.filter((task) => task.done).map((task) => [task.id, true])))
  const [claims, setClaims] = useState<Record<number, PublicTask['claim']>>(() => Object.fromEntries(tasks.filter((task) => task.claim).map((task) => [task.id, task.claim])))
  const [note, setNote] = useState<string | null>(null)
  const [visited, setVisited] = useState<Record<number, boolean>>({})
  const [pending, start] = useTransition()
  const [tab, setTab] = useState<TaskPeriod>('daily')
  const waiting = tasks.some((task) => statusOf(task, claims[task.id], Boolean(done[task.id])) === 'waiting')

  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => refresh(), 30000)
    return () => window.clearInterval(id)
  }, [waiting, refresh])

  function checkIn() {
    if (checkedToday || pending) return
    if (!requireLogin()) return
    start(async () => {
      const result = await checkInAction()
      if (!result.ok) {
        setNote(result.error)
        return
      }
      setStreakDay(result.streak)
      setCheckedToday(true)
      setBalance(result.balance)
      setNote(result.claimed ? `+${formatAC(result.reward)} KC yazıldı, seri ${result.streak}. gün.` : 'Bugünkü ödülü zaten aldın.')
    })
  }

  function complete(task: PublicTask) {
    if (statusOf(task, claims[task.id], Boolean(done[task.id])) !== 'open' || pending) return
    if (!requireLogin()) return
    start(async () => {
      const result = await completeTaskAction(task.id)
      if (!result.ok) {
        setNote(result.error)
        return
      }
      if (result.pending) {
        setClaims((current) => ({ ...current, [task.id]: 'beklemede' }))
        setNote(result.message)
        return
      }
      if (result.message === 'Bu görev reddedildi.') {
        setClaims((current) => ({ ...current, [task.id]: 'reddedildi' }))
        setNote(result.message)
        return
      }
      setDone((current) => ({ ...current, [task.id]: true }))
      if (typeof result.balance === 'number') setBalance(result.balance)
      setNote(result.message)
    })
  }

  function visitSocial(event: { preventDefault: () => void }, task: PublicTask) {
    if (!requireLogin()) {
      event.preventDefault()
      return
    }
    setVisited((current) => ({ ...current, [task.id]: true }))
    setNote('İşlemi bağladığın hesapla yap, sonra “Kontrol et”e bas.')
  }

  function openTask(event: { preventDefault: () => void }, task: PublicTask) {
    if (statusOf(task, claims[task.id], Boolean(done[task.id])) !== 'open') {
      event.preventDefault()
      return
    }
    if (!requireLogin()) event.preventDefault()
    complete(task)
  }

  const groups = PERIOD_ORDER.map((period) => {
    const items = tasks.filter((task) => task.period === period)
    return { period, items, done: items.filter((task) => statusOf(task, claims[task.id], Boolean(done[task.id])) === 'done').length }
  }).filter((group) => group.items.length > 0)
  const activeTab = groups.some((group) => group.period === tab) ? tab : groups[0]?.period
  const visibleTasks = groups.find((group) => group.period === activeTab)?.items ?? []

  const selected = detail ? tasks.find((task) => task.id === detail.id) ?? detail : null

  return (
    <section aria-label="Görevler" className="flex flex-col gap-5">
      <DailyGames />

      <article className="panel-gold flex flex-col gap-4 rounded-2xl p-4 sm:p-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Flame className="size-5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col">
              <h3 className="font-display text-lg font-bold text-foreground">Günlük giriş serisi</h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-primary">{streakDay} gün</span> üst üste
              </p>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setStreakInfo(true)}
              className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
            >
              <Info className="size-4" aria-hidden="true" />
              Kurallar
            </button>
            <button
              type="button"
              onClick={checkIn}
              disabled={checkedToday || pending}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-secondary disabled:text-muted-foreground sm:flex-none"
            >
              <CalendarCheck className="size-4" aria-hidden="true" />
              {checkedToday ? 'Bugün alındı' : 'Bugünü al'}
            </button>
          </div>
        </header>

        <ol className="grid grid-cols-7 gap-1 sm:gap-2">
          {DAYS.map((d, i) => {
            const claimed = i < streakDay
            const isToday = i === streakDay && !checkedToday
            return (
              <li
                key={d.day}
                className={cn(
                  'flex min-w-0 flex-col items-center gap-1 rounded-lg border px-0.5 py-2 text-center sm:py-3',
                  claimed && 'border-primary/50 bg-primary/10',
                  isToday && 'border-primary bg-primary/5 ring-1 ring-primary',
                  !claimed && !isToday && 'border-border bg-background',
                  d.vip && !claimed && 'border-accent/50',
                )}
              >
                <span className="text-[10px] font-semibold uppercase text-muted-foreground sm:tracking-wider">
                  {d.day}
                  <span className="hidden sm:inline">. gün</span>
                </span>
                {claimed ? (
                  <Check className="size-4 text-primary" aria-label="Alındı" />
                ) : (
                  <span className={cn('font-display text-xs font-bold tabular-nums sm:text-sm', d.vip ? 'text-accent' : 'text-foreground')}>
                    {d.vip ? 'VIP' : `+${d.reward}`}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        <JakoTip size="sm" pose={checkedToday ? 'kazandi' : 'dusunen'} title={checkedToday ? 'Helal kanka' : 'Unutma kanka'}>
          {checkedToday
            ? 'Bugünkü ödülü aldın, yarın da gel seriyi bozma!'
            : 'Bir günü kaçırırsan seri sıfırlanır. Marketten Seri Kalkanı alarak koruyabilirsin.'}
        </JakoTip>
      </article>

      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Şu an listelenecek görev yok, yakında burada olacak.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div
            role="tablist"
            aria-label="Görev türü"
            className="grid gap-1 rounded-2xl border border-border bg-card p-1 sm:max-w-xl"
            style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}
          >
            {groups.map((group) => {
              const active = group.period === activeTab
              const complete = group.items.length > 0 && group.done === group.items.length
              const progress = group.items.length ? (group.done / group.items.length) * 100 : 0
              return (
                <button
                  key={group.period}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(group.period)}
                  className={cn(
                    'flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <span className="truncate text-[13px] font-semibold leading-tight sm:text-sm">{PERIOD_LABEL[group.period]}</span>
                  <span className="flex items-center gap-1.5">
                    <span className={cn('text-[11px] font-bold tabular-nums leading-none', !active && complete && 'text-primary')}>
                      {group.done}/{group.items.length}
                    </span>
                    <span aria-hidden="true" className={cn('h-1 w-6 overflow-hidden rounded-full', active ? 'bg-primary-foreground/20' : 'bg-secondary')}>
                      <span
                        className={cn('block h-full rounded-full', active ? 'bg-primary-foreground' : 'bg-primary')}
                        style={{ width: `${progress}%` }}
                      />
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <ul role="tabpanel" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleTasks.map((task) => {
              const state = statusOf(task, claims[task.id], Boolean(done[task.id]))
              const label = state === 'done' ? 'Tamamlandı' : state === 'waiting' ? 'Onay bekliyor' : state === 'rejected' ? 'Reddedildi' : task.kind !== 'manual' ? 'Ödülü al' : 'Görevi yap'
              const locked = state !== 'open' || pending
              const className = 'flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100'
              return (
                <li key={task.id} className={cn('panel-gold flex min-w-0 flex-col gap-3 rounded-xl p-4', state === 'done' && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="min-w-0 text-sm font-semibold leading-snug text-foreground text-pretty">{task.title}</h4>
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold tabular-nums text-primary">
                      +{formatAC(task.points)} KC
                    </span>
                  </div>
                  {task.detail ? <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{task.detail}</p> : null}
                  {task.kind !== 'manual' && task.target > 1 && state === 'open' ? (
                    <span className="flex items-center gap-2" aria-label={`İlerleme ${task.progress}/${task.target}`}>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((task.progress / task.target) * 100))}%` }} />
                      </span>
                      <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{task.progress}/{task.target}</span>
                    </span>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setDetail(task)}
                      className="flex h-9 items-center gap-1.5 rounded-lg px-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
                    >
                      <Info className="size-3.5" aria-hidden="true" />
                      Nasıl yapılır?
                    </button>
                    {state === 'open' && isSocialCheckKind(task.kind) ? (
                      visited[task.id] || !task.link ? (
                        <button type="button" onClick={() => complete(task)} disabled={pending} className={className}>
                          Kontrol et
                        </button>
                      ) : (
                        <a href={task.link} target="_blank" rel="noopener noreferrer" onClick={(event) => visitSocial(event, task)} className={className}>
                          {task.kind === 'social_like' ? 'Beğen' : task.param === 'youtube' ? 'Abone ol' : 'Takip et'}
                        </a>
                      )
                    ) : state === 'open' && task.kind !== 'manual' && task.progress < task.target ? (
                      <GoButton task={task} className={className} onBlocked={() => requireLogin()} />
                    ) : task.link && state === 'open' ? (
                      <a href={task.link} target="_blank" rel="noopener noreferrer" onClick={(event) => openTask(event, task)} className={className}>
                        {label}
                      </a>
                    ) : (
                      <button type="button" onClick={() => complete(task)} disabled={locked} className={className}>
                        {state === 'done' ? <Check className="size-4" aria-hidden="true" /> : null}
                        {label}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {note ? <p className="text-sm text-muted-foreground" aria-live="polite">{note}</p> : null}
      <DetailModal
        onClose={() => setDetail(null)}
        content={
          selected
            ? {
                eyebrow: 'Görev',
                title: selected.title,
                description: selected.detail || 'Bu görevin açıklaması yakında burada olacak.',
                facts: [
                  { label: 'Ödül', value: `+${formatAC(selected.points)} KC` },
                  { label: 'Tekrar', value: PERIOD_LABEL[selected.period] },
                  ...(selected.kind !== 'manual' ? [{ label: 'İlerleme', value: `${selected.progress}/${selected.target}` }] : []),
                  {
                    label: 'Durum',
                    value: statusOf(selected, claims[selected.id], Boolean(done[selected.id])) === 'done'
                      ? 'Tamamlandı'
                      : statusOf(selected, claims[selected.id], Boolean(done[selected.id])) === 'waiting'
                        ? 'Onay bekliyor'
                        : statusOf(selected, claims[selected.id], Boolean(done[selected.id])) === 'rejected'
                          ? 'Reddedildi'
                          : 'Bekliyor',
                  },
                ],
                steps: selected.detail ? [selected.detail] : undefined,
                rules: [
                  selected.kind !== 'manual'
                    ? `Otomatik kontrol edilir. ${KIND_META[selected.kind].hint}`
                    : selected.needsApproval ? 'Puan, kontrol tamamlanınca yazılır.' : 'Puan görevi tamamlayınca yazılır.',
                  ...(selected.link ? ['Bağlantı yeni sekmede açılır.'] : []),
                  PERIOD_RULE[selected.period],
                ],
              }
            : null
        }
        action={
          selected && statusOf(selected, claims[selected.id], Boolean(done[selected.id])) === 'open' ? (
            <button
              type="button"
              onClick={() => {
                const go = selected.kind !== 'manual' && selected.progress < selected.target ? kindHref(selected.kind, selected.param) : null
                if (go) {
                  if (!requireLogin()) return
                  if (go.external) window.open(go.href, '_blank', 'noopener')
                  else window.location.assign(go.href)
                  return
                }
                if (isSocialCheckKind(selected.kind) && selected.link && !visited[selected.id]) {
                  if (!requireLogin()) return
                  window.open(selected.link, '_blank', 'noopener,noreferrer')
                  visitSocial({ preventDefault() {} }, selected)
                  return
                }
                if (selected.link && !isSocialCheckKind(selected.kind)) window.open(selected.link, '_blank', 'noopener,noreferrer')
                complete(selected)
              }}
              className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              {isSocialCheckKind(selected.kind)
                ? visited[selected.id] || !selected.link ? `Kontrol et, +${formatAC(selected.points)} KC` : `Görevi yap, +${formatAC(selected.points)} KC`
                : selected.kind !== 'manual' && selected.progress >= selected.target ? `Ödülü al, +${formatAC(selected.points)} KC` : `Görevi yap, +${formatAC(selected.points)} KC`}
            </button>
          ) : null
        }
      />
      <DetailModal
        onClose={() => setStreakInfo(false)}
        content={
          streakInfo
            ? {
                eyebrow: 'Günlük giriş',
                title: 'Giriş serisi nasıl çalışır?',
                description: 'Her gün giriş yapıp ödülünü alarak seriyi büyüt. Ödüller her gün artar, 7. gün VIP sandık açılır.',
                prizes: DAYS.map((d) => ({ place: `${d.day}. gün`, prize: d.vip ? 'VIP sandık' : `+${d.reward} KC` })),
                rules: STREAK_RULES,
              }
            : null
        }
      />
    </section>
  )
}

function GoButton({ task, className, onBlocked }: { task: PublicTask; className: string; onBlocked: () => boolean }) {
  const go = kindHref(task.kind, task.param)
  if (!go) return null
  const text = 'Görevi yap'
  return (
    <a
      href={go.href}
      target={go.external ? '_blank' : undefined}
      rel={go.external ? 'noopener' : undefined}
      onClick={(event) => {
        if (!onBlocked()) event.preventDefault()
      }}
      className={className}
    >
      {text}
    </a>
  )
}
