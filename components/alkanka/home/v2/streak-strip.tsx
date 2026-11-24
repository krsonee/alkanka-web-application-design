'use client'

import { useState, useTransition } from 'react'
import { CalendarCheck, Check, Flame } from 'lucide-react'
import { checkInAction } from '@/app/actions/tasks'
import { STREAK_DAYS } from '@/lib/task-period'
import { cn } from '@/lib/utils'
import { formatAC, usePoints } from '../../points-context'

export function StreakStrip({ streak, checkedToday }: { streak: number; checkedToday: boolean }) {
  const { setBalance } = usePoints()
  const [day, setDay] = useState(streak)
  const [taken, setTaken] = useState(checkedToday)
  const [note, setNote] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const today = taken ? day : day + 1

  function take() {
    if (taken || pending) return
    start(async () => {
      const result = await checkInAction()
      if (!result.ok) {
        setNote(result.error)
        return
      }
      setDay(result.streak)
      setTaken(true)
      setBalance(result.balance)
      setNote(result.claimed ? `+${formatAC(result.reward)} KC yazıldı, seri ${result.streak}. gün.` : 'Bugünkü ödülü zaten aldın.')
    })
  }

  return (
    <section aria-label="Günlük giriş serisi" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Flame className="size-5" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 className="font-display text-base font-bold leading-tight text-foreground">Giriş serisi</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold tabular-nums text-primary">{day} gün</span> üst üste
            </p>
          </div>
        </div>
        {taken ? (
          <span className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground">
            <Check className="size-4 text-primary" aria-hidden="true" />
            Bugün alındı
          </span>
        ) : (
          <button
            type="button"
            onClick={take}
            disabled={pending}
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-[opacity,scale] active:scale-[0.97] disabled:opacity-60"
          >
            <CalendarCheck className="size-4" aria-hidden="true" />
            {pending ? 'Yazılıyor' : 'Bugünü al'}
          </button>
        )}
      </div>

      <ol className="grid grid-cols-7 gap-1.5">
        {STREAK_DAYS.map((d) => {
          const claimed = d.day < today || (taken && d.day === today)
          const isToday = !taken && d.day === today
          return (
            <li
              key={d.day}
              aria-current={isToday ? 'step' : undefined}
              className={cn(
                'flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-center',
                claimed && 'border-primary/50 bg-primary/10',
                isToday && 'border-primary bg-primary/5',
                !claimed && !isToday && 'border-border bg-background',
              )}
            >
              <span className="text-[10px] font-semibold leading-none text-muted-foreground">
                {d.day}
                <span className="sr-only">. gün</span>
              </span>
              {claimed ? (
                <Check className="size-4 text-primary" aria-label="Alındı" />
              ) : (
                <span className={cn('font-display text-xs font-bold leading-none tabular-nums', isToday ? 'text-primary' : 'text-foreground')}>
                  {d.vip ? 'VIP' : `+${d.reward}`}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <p aria-live="polite" className={cn('text-sm text-muted-foreground', !note && 'sr-only')}>
        {note}
      </p>
    </section>
  )
}
