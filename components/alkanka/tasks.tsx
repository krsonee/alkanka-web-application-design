'use client'

import { useState } from 'react'
import { Check, CalendarCheck, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TASKS, type TaskItem } from './data'
import { DetailButton, DetailModal } from './detail-modal'
import { JakoTip } from './jako'
import { formatAC, usePoints } from './points-context'
import { SectionHeading } from './section-heading'

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

export function Tasks() {
  const { add } = usePoints()
  const [detail, setDetail] = useState<TaskItem | null>(null)
  const [streakInfo, setStreakInfo] = useState(false)
  const [streakDay, setStreakDay] = useState(4)
  const [checkedToday, setCheckedToday] = useState(false)
  const [done, setDone] = useState<Record<string, boolean>>({})

  function checkIn() {
    if (checkedToday) return
    const today = DAYS[streakDay]
    if (!today) return
    add(today.reward)
    setStreakDay((d) => d + 1)
    setCheckedToday(true)
  }

  function complete(id: string, reward: number) {
    if (done[id]) return
    setDone((d) => ({ ...d, [id]: true }))
    add(reward)
  }

  return (
    <section aria-label="Görevler" className="flex flex-col gap-5">

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

        <ul className="flex flex-col gap-2 xl:col-span-2">
          {TASKS.map((t) => {
            const Icon = t.icon
            const isDone = done[t.id]
            return (
              <li key={t.id} className="panel-gold flex items-center gap-3 rounded-xl p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col items-start">
                  <span className="truncate text-sm font-semibold text-foreground">{t.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{t.detail}</span>
                  <DetailButton onClick={() => setDetail(t)} label="Nasıl yapılır?" />
                </div>
                {t.href && !isDone ? (
                  <a
                    href={t.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => complete(t.id, t.reward)}
                    className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
                  >
                    +{formatAC(t.reward)}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => complete(t.id, t.reward)}
                    disabled={isDone}
                    className="shrink-0 rounded-lg border border-primary/40 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10 disabled:border-transparent disabled:bg-primary/10"
                  >
                    {isDone ? 'Tamam' : `+${formatAC(t.reward)}`}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <DetailModal
        onClose={() => setDetail(null)}
        content={
          detail && {
            eyebrow: 'Görev',
            title: detail.title,
            description: detail.description,
            facts: [
              { label: 'Ödül', value: `+${formatAC(detail.reward)} KC` },
              { label: 'Durum', value: done[detail.id] ? 'Tamamlandı' : 'Bekliyor' },
            ],
            steps: detail.steps,
            rules: detail.rules,
            note: detail.verification,
          }
        }
        action={
          detail && (
            <button
              type="button"
              onClick={() => {
                if (detail.href) window.open(detail.href, '_blank', 'noopener,noreferrer')
                complete(detail.id, detail.reward)
              }}
              disabled={done[detail.id]}
              className="flex h-11 items-center justify-center rounded-lg bg-primary text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:bg-primary/15 disabled:text-primary"
            >
              {done[detail.id] ? 'Tamamlandı' : `Görevi yap, +${formatAC(detail.reward)} KC`}
            </button>
          )
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
