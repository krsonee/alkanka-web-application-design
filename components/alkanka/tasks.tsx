'use client'

import { useEffect, useState, useTransition } from 'react'
import { Check, CalendarCheck, Flame } from 'lucide-react'
import { completeTaskAction } from '@/app/actions/tasks'
import { cn } from '@/lib/utils'
import { DetailButton, DetailModal } from './detail-modal'
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
  claim: 'beklemede' | 'onaylandi' | 'reddedildi' | null
  done: boolean
}

const DAYS = [
  { day: 1, reward: 25 },
  { day: 2, reward: 40 },
  { day: 3, reward: 60 },
  { day: 4, reward: 80 },
  { day: 5, reward: 110 },
  { day: 6, reward: 150 },
  { day: 7, reward: 500, vip: true },
]

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

export function Tasks({ tasks }: { tasks: PublicTask[] }) {
  const { add, requireLogin, setBalance, refresh } = usePoints()
  const [detail, setDetail] = useState<PublicTask | null>(null)
  const [streakInfo, setStreakInfo] = useState(false)
  const [streakDay, setStreakDay] = useState(4)
  const [checkedToday, setCheckedToday] = useState(false)
  const [done, setDone] = useState<Record<number, boolean>>(() => Object.fromEntries(tasks.filter((task) => task.done).map((task) => [task.id, true])))
  const [claims, setClaims] = useState<Record<number, PublicTask['claim']>>(() => Object.fromEntries(tasks.filter((task) => task.claim).map((task) => [task.id, task.claim])))
  const [note, setNote] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const waiting = tasks.some((task) => statusOf(task, claims[task.id], Boolean(done[task.id])) === 'waiting')

  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => refresh(), 2000)
    return () => window.clearInterval(id)
  }, [waiting, refresh])

  function checkIn() {
    if (checkedToday) return
    const today = DAYS[streakDay]
    if (!today) return
    add(today.reward)
    setStreakDay((d) => d + 1)
    setCheckedToday(true)
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

  function openTask(event: { preventDefault: () => void }, task: PublicTask) {
    if (statusOf(task, claims[task.id], Boolean(done[task.id])) !== 'open') {
      event.preventDefault()
      return
    }
    if (!requireLogin()) event.preventDefault()
    complete(task)
  }

  const selected = detail ? tasks.find((task) => task.id === detail.id) ?? detail : null

  return (
    <section aria-label="Görevler" className="flex flex-col gap-5">
      <DailyGames />

      <div className="grid gap-4 xl:grid-cols-5">
        <article className="panel-gold flex flex-col gap-5 rounded-2xl p-5 xl:col-span-3">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Flame className="size-5" aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <h3 className="font-display text-lg font-bold text-foreground">Günlük giriş serisi</h3>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-primary">{streakDay} gün</span> üst üste
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={checkIn}
              disabled={checkedToday || streakDay >= DAYS.length}
              className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-secondary disabled:text-muted-foreground"
            >
              <CalendarCheck className="size-4" aria-hidden="true" />
              {checkedToday ? 'Bugün alındı' : 'Bugünü al'}
            </button>
          </header>

          <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {DAYS.map((d, i) => {
              const claimed = i < streakDay
              const isToday = i === streakDay && !checkedToday
              return (
                <li
                  key={d.day}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-1 py-2.5 text-center',
                    claimed && 'border-primary/50 bg-primary/10',
                    isToday && 'border-primary bg-primary/5 ring-1 ring-primary',
                    !claimed && !isToday && 'border-border bg-background',
                    d.vip && !claimed && 'border-accent/50',
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d.day}. gün</span>
                  {claimed ? (
                    <Check className="size-4 text-primary" aria-label="Alındı" />
                  ) : (
                    <span className={cn('font-display text-sm font-bold tabular-nums', d.vip ? 'text-accent' : 'text-foreground')}>
                      {d.vip ? 'VIP' : `+${d.reward}`}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <JakoTip pose={checkedToday ? 'kazandi' : 'dusunen'} title={checkedToday ? 'Helal kanka' : 'Unutma kanka'}>
              {checkedToday
                ? 'Bugünkü ödülü aldın, yarın da gel seriyi bozma!'
                : 'Bir günü kaçırırsan seri sıfırlanır. Marketten Seri Kalkanı alarak koruyabilirsin.'}
            </JakoTip>
            <DetailButton onClick={() => setStreakInfo(true)} label="Seri kuralları" />
          </div>
        </article>

        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground xl:col-span-2">
            Şu an listelenecek görev yok, yakında burada olacak.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 xl:col-span-2">
            {tasks.map((task) => {
              const state = statusOf(task, claims[task.id], Boolean(done[task.id]))
              const label = state === 'done' ? 'Tamam' : state === 'waiting' ? 'Onay bekliyor' : state === 'rejected' ? 'Reddedildi' : `+${formatAC(task.points)}`
              const locked = state !== 'open' || pending
              const className = 'shrink-0 rounded-lg border border-primary/40 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10 disabled:border-transparent disabled:bg-primary/10'
              return (
                <li key={task.id} className="panel-gold flex items-center gap-3 rounded-xl p-3">
                  <div className="flex min-w-0 flex-1 flex-col items-start">
                    <span className="truncate text-sm font-semibold text-foreground">{task.title}</span>
                    {task.detail ? <span className="truncate text-xs text-muted-foreground">{task.detail}</span> : null}
                    <DetailButton onClick={() => setDetail(task)} label="Nasıl yapılır?" />
                  </div>
                  {task.link && state === 'open' ? (
                    <a href={task.link} target="_blank" rel="noopener noreferrer" onClick={(event) => openTask(event, task)} className={className}>
                      {label}
                    </a>
                  ) : (
                    <button type="button" onClick={() => complete(task)} disabled={locked} className={className}>
                      {label}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
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
                  selected.needsApproval ? 'Puan, kontrol tamamlanınca yazılır.' : 'Puan görevi tamamlayınca yazılır.',
                  ...(selected.link ? ['Bağlantı yeni sekmede açılır.'] : []),
                  'Aynı görev için puan bir kez yazılır.',
                ],
              }
            : null
        }
        action={
          selected && statusOf(selected, claims[selected.id], Boolean(done[selected.id])) === 'open' ? (
            <button
              type="button"
              onClick={() => {
                if (selected.link) window.open(selected.link, '_blank', 'noopener,noreferrer')
                complete(selected)
              }}
              className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground"
            >
              {`Görevi yap, +${formatAC(selected.points)} KC`}
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
