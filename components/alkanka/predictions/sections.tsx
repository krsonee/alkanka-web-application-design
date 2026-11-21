'use client'

import { useEffect, type ReactNode } from 'react'
import { Goal, Trophy } from 'lucide-react'
import { readAddress, useAddressChoice } from '@/components/alkanka/use-address-choice'
import { GOAL_NAME } from '@/lib/goal-rewards-shared'
import { cn } from '@/lib/utils'

type Section = 'league' | 'goals'

/** What the two halves of the page are called in its address: /tahminler?bolum=gol-yagmuru */
const SECTION_WORD: Record<Section, string> = { league: 'tahmin-ligi', goals: 'gol-yagmuru' }

const SECTIONS: { id: Section; title: string; line: string; icon: typeof Trophy; unit: string }[] = [
  { id: 'league', title: 'Tahmin Ligi', line: 'Maçın sorularını bil, puan topla, ligde yüksel.', icon: Trophy, unit: 'maç tahmine açık' },
  { id: 'goals', title: GOAL_NAME, line: 'Atılan her gol ödül kazandırır.', icon: Goal, unit: 'maç katılıma açık' },
]

/**
 * The prediction league and the goal events are two different games; each gets the page to itself.
 * With only one of them running there is nothing to choose and it is simply shown.
 */
export function PredictionSections({ league, goals, leagueOpen, goalOpen }: { league: ReactNode; goals: ReactNode; leagueOpen: number; goalOpen: number }) {
  const [chosen, setChosen] = useAddressChoice('bolum', SECTION_WORD, 'league')

  // Links shared before the page had sections name only the event kind; they still land on the goal events.
  useEffect(() => {
    if (!readAddress('bolum') && readAddress('etkinlik')) setChosen('goals')
  }, [setChosen])

  if (!league || !goals) return <>{league ?? goals}</>
  const open: Record<Section, number> = { league: leagueOpen, goals: goalOpen }

  return (
    <div className="@container flex flex-col gap-5">
      <div role="tablist" aria-label="Bölüm" className="grid grid-cols-2 gap-2 @2xl:gap-3">
        {SECTIONS.map((s) => {
          const on = chosen === s.id
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`bolum-${s.id}`}
              aria-selected={on}
              aria-controls={`bolum-${s.id}-icerik`}
              onClick={() => setChosen(s.id)}
              className={cn(
                'flex min-w-0 flex-col gap-2 rounded-xl border p-3 text-left transition-colors @2xl:flex-row @2xl:items-center @2xl:gap-3 @2xl:p-4',
                on ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50',
              )}
            >
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors', on ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
                <s.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn('font-display text-base font-bold @2xl:text-lg', on ? 'text-primary' : 'text-foreground')}>{s.title}</span>
                <span className="hidden text-xs leading-relaxed text-muted-foreground @2xl:block">{s.line}</span>
                <span className="text-xs font-semibold text-foreground/80">{open[s.id] > 0 ? `${open[s.id]} ${s.unit}` : 'Şu an açık maç yok'}</span>
              </span>
            </button>
          )
        })}
      </div>
      {SECTIONS.map((s) => (
        <div key={s.id} role="tabpanel" id={`bolum-${s.id}-icerik`} aria-labelledby={`bolum-${s.id}`} hidden={chosen !== s.id}>
          {s.id === 'league' ? league : goals}
        </div>
      ))}
    </div>
  )
}
