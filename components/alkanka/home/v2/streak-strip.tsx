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
    <section
      aria-label="Günlük giriş serisi"
      className="flex flex-col gap-2.5 rounded-2xl border border-border bg-gradient-to-b from-foreground/[0.04] to-transparent px-3 py-2.5 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.05)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
          <Flame className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">Giriş serisi</span>
          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold tabular-nums text-primary">{day} gün</span>
        </h2>
        {taken ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Check className="size-3.5 text-primary" aria-hidden="true" />
            Bugün alındı
          </span>
        ) : (
          <button
            type="button"
            onClick={take}
            disabled={pending}
            className="relative flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground transition-[opacity,scale] after:absolute after:-inset-1.5 active:scale-[0.97] disabled:opacity-60"
          >
            <CalendarCheck className="size-3.5" aria-hidden="true" />
            {pending ? 'Yazılıyor' : 'Bugünü al'}
          </button>
        )}
      </div>

      <ol className="grid grid-cols-7 gap-1">
        {STREAK_DAYS.map((d) => {
          const claimed = d.day < today || (taken && d.day === today)
          const isToday = !taken && d.day === today
          return (
            <li
              key={d.day}
              aria-current={isToday ? 'step' : undefined}
              aria-label={`${d.day}. gün${claimed ? ', alındı' : d.vip ? ', VIP ödül' : `, +${d.reward} KC`}`}
              className={cn(
                'flex h-7 min-w-0 items-center justify-center rounded-full text-[11px] font-bold leading-none tabular-nums',
                claimed && 'bg-primary/20 text-primary',
                isToday && 'bg-primary text-primary-foreground',
                !claimed && !isToday && 'bg-foreground/[0.06] text-muted-foreground',
              )}
            >
              {claimed ? <Check className="size-3.5" aria-hidden="true" /> : d.vip ? 'VIP' : `+${d.reward}`}
            </li>
          )
        })}
      </ol>

      <p aria-live="polite" className={cn('text-xs text-muted-foreground', !note && 'sr-only')}>
        {note}
      </p>
    </section>
  )
}
