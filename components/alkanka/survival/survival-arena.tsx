'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { planSV, svPlanKind, SV_STEP, type SVRule, type SVStage } from '@/lib/survival-sim'
import { SurvivalCanvas, SV_TEAMS, type SVEvent, type SVPlayer } from './survival-canvas'
import { cn } from '@/lib/utils'

type Props = {
  players: SVPlayer[]
  duration: number
  winners: number
  teams: 0 | 2 | 5
  rule: SVRule
  shield: boolean
  captain?: boolean
  prizePool?: number
  seed: number
  startAt?: number
  now?: () => number
  powers?: number[]
  onEvent: (e: SVEvent) => void
}

/**
 * Picks the right layout for the crowd: one pitch, several team matches side by side,
 * or qualifying heats followed by a final. Every pitch replays the same seeded plan the server scored.
 */
export function SurvivalArena(props: Props) {
  const kind = svPlanKind(props.players.length, props.teams)
  if (kind === 'single') return <SurvivalCanvas {...props} />
  return <CrowdArena {...props} />
}

function CrowdArena({ players, duration, winners, teams, rule, shield, captain = false, prizePool = 0, seed, startAt, now, powers, onEvent }: Props) {
  const powerKey = powers?.join('') ?? ''
  const plan = useMemo(
    () => planSV({ n: players.length, seed, duration, winners, teams, rule, shield, captain, powers }),
    [players.length, seed, duration, winners, teams, rule, shield, captain, powerKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const eventRef = useRef(onEvent)
  eventRef.current = onEvent
  const [phase, setPhase] = useState<'stages' | 'final'>('stages')
  const [wins, setWins] = useState<number[]>([])
  const doneRef = useRef<Set<number>>(new Set())
  const aliveRef = useRef<number[]>([])
  const teamAliveRef = useRef<number[][]>([])
  const tickRef = useRef<{ left: number; waiting: number }[]>([])
  const sentFinalRef = useRef(false)

  useEffect(() => {
    setPhase('stages')
    setWins(Array.from({ length: Math.max(2, teams) }, () => 0))
    doneRef.current = new Set()
    aliveRef.current = plan.stages.map((s) => s.entrants.length)
    teamAliveRef.current = plan.stages.map(() => [])
    tickRef.current = plan.stages.map(() => ({ left: duration, waiting: 0 }))
    sentFinalRef.current = false
  }, [plan, teams, duration])

  const finalAt = plan.final && startAt ? startAt + plan.final.startStep * SV_STEP * 1000 : undefined

  useEffect(() => {
    if (!finalAt || phase === 'final') return
    const id = setInterval(() => {
      if ((now ? now() : Date.now()) >= finalAt) setPhase('final')
    }, 400)
    return () => clearInterval(id)
  }, [finalAt, now, phase])

  const sumTeams = () => {
    const out: number[] = []
    for (const row of teamAliveRef.current) row.forEach((v, t) => (out[t] = (out[t] ?? 0) + v))
    return out
  }

  const stageHandler = useCallback(
    (k: number, stage: SVStage) => (e: SVEvent) => {
      const emit = eventRef.current
      if (e.type === 'out') {
        aliveRef.current[k] = e.alive
        teamAliveRef.current[k] = e.teamAlive
        emit({ type: 'out', index: stage.entrants[e.index], alive: aliveRef.current.reduce((a, b) => a + b, 0), teamAlive: sumTeams() })
      } else if (e.type === 'enter') {
        emit({ type: 'enter', index: stage.entrants[e.index] })
      } else if (e.type === 'power') {
        emit({ ...e, index: stage.entrants[e.index] })
      } else if (e.type === 'tick') {
        tickRef.current[k] = e
        const ticks = tickRef.current
        emit({ type: 'tick', left: Math.max(...ticks.map((t) => t.left)), waiting: ticks.reduce((a, t) => a + t.waiting, 0) })
      } else if (e.type === 'final') {
        if (plan.kind === 'matches' && !sentFinalRef.current) {
          sentFinalRef.current = true
          emit(e)
        }
      } else if (e.type === 'done') {
        if (doneRef.current.has(k)) return
        doneRef.current.add(k)
        if (plan.kind === 'matches') {
          setWins((w) => w.map((v, t) => (t === e.winningTeam ? v + 1 : v)))
          if (doneRef.current.size === plan.stages.length) {
            emit({ type: 'done', winners: plan.winners, winningTeam: plan.winningTeam, seconds: Math.round(plan.steps * SV_STEP) })
          }
        } else if (doneRef.current.size === plan.stages.length && !startAt) {
          setTimeout(() => setPhase('final'), 2500)
        }
      }
    },
    [plan, startAt],
  )

  const finalHandler = useCallback(
    (e: SVEvent) => {
      const stage = plan.final!
      const emit = eventRef.current
      if (e.type === 'out' || e.type === 'power') emit({ ...e, index: stage.entrants[e.index] })
      else if (e.type === 'enter') emit({ type: 'enter', index: stage.entrants[e.index] })
      else if (e.type === 'done') emit({ type: 'done', winners: plan.winners, winningTeam: -1, seconds: Math.round(plan.steps * SV_STEP) })
      else emit(e)
    },
    [plan],
  )

  const pitches = plan.stages.length
  const cols = pitches <= 2 ? pitches : pitches <= 4 ? 2 : 3

  if (phase === 'final' && plan.final) {
    const f = plan.final
    return (
      <div className="relative h-full w-full">
        <SurvivalCanvas
          players={f.entrants.map((i) => players[i])}
          duration={f.opts.duration}
          winners={f.opts.winners}
          teams={0}
          rule={rule}
          shield={f.opts.shield}
          prizePool={prizePool}
          seed={f.opts.seed}
          powers={f.opts.powers}
          startAt={finalAt}
          now={now}
          onEvent={finalHandler}
        />
        <Banner>{`FİNAL · ${f.entrants.length} finalist · ${f.opts.winners} kazanan`}</Banner>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <div className="grid h-full w-full gap-1 p-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {plan.stages.map((s, k) => (
          <div key={`${seed}-${k}`} className="relative min-h-0 overflow-hidden rounded-md">
            <SurvivalCanvas
              players={s.entrants.map((i) => players[i])}
              duration={s.opts.duration}
              winners={s.opts.winners}
              teams={s.opts.teams as 0 | 2 | 5}
              rule={rule}
              shield={s.opts.shield}
              captain={s.opts.captain}
              seed={s.opts.seed}
              powers={s.opts.powers}
              startAt={startAt}
              now={now}
              sound={k === 0}
              stage={plan.kind === 'heats' ? 'heat' : 'match'}
              onEvent={stageHandler(k, s)}
            />
            <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-foreground">
              {plan.kind === 'heats' ? `Saha ${k + 1}` : `Maç ${k + 1}`}
            </span>
          </div>
        ))}
      </div>
      {plan.kind === 'heats' ? (
        <Banner>{`ÖN ELEME · ${pitches} saha · ${plan.final?.entrants.length ?? 0} kişi finale çıkar`}</Banner>
      ) : (
        <Banner>
          <span>{`${pitches} MAÇ AYNI ANDA`}</span>
          <span className="flex items-center gap-2">
            {wins.slice(0, Math.max(2, teams)).map((w, t) => (
              <span key={t} className="flex items-center gap-1 tabular-nums">
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: SV_TEAMS[t].color }} />
                <span className="sr-only">{SV_TEAMS[t].name}</span>
                {w}
              </span>
            ))}
          </span>
        </Banner>
      )}
    </div>
  )
}

function Banner({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-background/85 px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}
