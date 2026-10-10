'use client'

import { useState } from 'react'
import { Check, Crown, Flame, Gift, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionHeading } from './section-heading'

const DAYS = [
  { day: 1, reward: '25 pts' },
  { day: 2, reward: '50 pts' },
  { day: 3, reward: 'Extra Spin' },
  { day: 4, reward: '100 pts' },
  { day: 5, reward: '2x Boost' },
  { day: 6, reward: 'Gold Chest' },
  { day: 7, reward: 'VIP Pass', grand: true },
]

export function StreakTracker() {
  const [claimed, setClaimed] = useState(3)
  const [justClaimed, setJustClaimed] = useState<number | null>(null)
  const complete = claimed >= DAYS.length
  const progress = (claimed / DAYS.length) * 100

  function claim() {
    if (complete) return
    setJustClaimed(claimed + 1)
    setClaimed((c) => c + 1)
  }

  return (
    <section aria-labelledby="streak-title" className="bg-surface/50">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-20 sm:px-6">
        <SectionHeading
          id="streak-title"
          eyebrow="Daily Login Streak"
          title="Show up 7 days in a row. Unlock the VIP Pass."
          description="Each daily check-in unlocks a bigger milestone. Miss a day and the streak resets — unless you hold a Streak Shield."
          action={
            <div className="glass flex items-center gap-3 self-start rounded-2xl px-4 py-3 md:self-auto">
              <Flame className="size-6 text-gold" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Current streak</span>
                <span className="font-display text-xl font-bold text-foreground tabular-nums">
                  {claimed} {claimed === 1 ? 'day' : 'days'}
                </span>
              </div>
            </div>
          }
        />

        <div className="glass flex flex-col gap-8 rounded-3xl p-6 sm:p-8">
          <div
            role="progressbar"
            aria-label="Weekly streak progress"
            aria-valuemin={0}
            aria-valuemax={DAYS.length}
            aria-valuenow={claimed}
            className="relative h-2.5 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--primary), var(--accent), var(--gold))',
                boxShadow: '0 0 16px color-mix(in oklch, var(--accent) 60%, transparent)',
              }}
            />
          </div>

          <ol className="grid grid-cols-3 gap-3 sm:grid-cols-7">
            {DAYS.map((d) => {
              const isClaimed = d.day <= claimed
              const isToday = d.day === claimed + 1
              return (
                <li
                  key={d.day}
                  className={cn(
                    'relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all duration-500',
                    d.grand && 'col-span-3 sm:col-span-1',
                    isClaimed && 'border-primary/40 bg-primary/5',
                    isToday && 'border-gold/60 bg-gold/5 glow-gold',
                    !isClaimed && !isToday && 'border-border bg-card/40',
                  )}
                >
                  <span className="text-xs font-medium text-muted-foreground">Day {d.day}</span>
                  <span
                    key={justClaimed === d.day ? 'claimed' : 'idle'}
                    className={cn(
                      'flex size-11 items-center justify-center rounded-full',
                      isClaimed && 'bg-primary text-primary-foreground',
                      isToday && 'bg-gold text-gold-foreground',
                      !isClaimed && !isToday && 'bg-secondary text-muted-foreground',
                      justClaimed === d.day && 'animate-pop',
                    )}
                  >
                    {isClaimed ? (
                      <Check className="size-5" aria-hidden="true" />
                    ) : d.grand ? (
                      <Crown className="size-5" aria-hidden="true" />
                    ) : isToday ? (
                      <Gift className="size-5" aria-hidden="true" />
                    ) : (
                      <Lock className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <span className={cn('text-xs font-semibold', d.grand ? 'text-gold' : 'text-foreground')}>{d.reward}</span>
                  <span className="sr-only">{isClaimed ? 'claimed' : isToday ? 'available today' : 'locked'}</span>
                </li>
              )
            })}
          </ol>

          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {complete
                ? 'Streak complete! Your VIP Pass has been unlocked.'
                : `Today's reward: ${DAYS[claimed].reward}. ${DAYS.length - claimed} days until the VIP Pass.`}
            </p>
            <button
              type="button"
              onClick={claim}
              disabled={complete}
              className="w-full rounded-full bg-gold px-6 py-3 text-sm font-semibold text-gold-foreground transition-transform hover:scale-[1.03] disabled:opacity-60 disabled:hover:scale-100 sm:w-auto glow-gold"
            >
              {complete ? 'All rewards claimed' : `Claim Day ${claimed + 1}`}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
