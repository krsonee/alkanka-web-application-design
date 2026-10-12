'use client'

import { useState, useTransition } from 'react'
import { Check, CalendarCheck, Flame } from 'lucide-react'
import { completeTaskAction } from '@/app/actions/tasks'
import { cn } from '@/lib/utils'
import { DetailButton, DetailModal } from './detail-modal'
import { JakoTip } from './jako'
import { DailyGames } from './daily-games'
import { usePoints } from './points-context'

export type PublicTask = { id: number; title: string; detail: string; points: number; done: boolean }

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

export function Tasks({ tasks }: { tasks: PublicTask[] }) {
  const { add, requireLogin } = usePoints()
  const [streakInfo, setStreakInfo] = useState(false)
  const [streakDay, setStreakDay] = useState(4)
  const [checkedToday, setCheckedToday] = useState(false)
  const [done, setDone] = useState<Record<number, boolean>>(() => Object.fromEntries(tasks.filter((task) => task.done).map((task) => [task.id, true])))
  const [note, setNote] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function checkIn() {
    if (checkedToday) return
    const today = DAYS[streakDay]
    if (!today) return
    add(today.reward)
    setStreakDay((d) => d + 1)
    setCheckedToday(true)
  }

  function complete(task: PublicTask) {
    if (done[task.id] || pending) return
    if (!requireLogin()) return
    start(async () => {
      const result = await completeTaskAction(task.id)
      if (!result.ok) {
        setNote(result.error)
        return
      }
      setDone((current) => ({ ...current, [task.id]: true }))
      setNote(result.message)
    })
  }

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
              const isDone = Boolean(done[task.id])
              return (
                <li key={task.id} className="panel-gold flex items-center gap-3 rounded-xl p-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">{task.title}</span>
                    {task.detail ? <span className="truncate text-xs text-muted-foreground">{task.detail}</span> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => complete(task)}
                    disabled={isDone || pending}
                    className="shrink-0 rounded-lg border border-primary/40 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10 disabled:border-transparent disabled:bg-primary/10"
                  >
                    {isDone ? 'Tamam' : `+${task.points}`}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {note ? <p className="text-sm text-muted-foreground" aria-live="polite">{note}</p> : null}
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
