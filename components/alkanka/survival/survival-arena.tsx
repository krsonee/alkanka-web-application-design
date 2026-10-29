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
  const meIndex = players.findIndex((p) => p.me)
  const homeStage = useMemo(() => Math.max(0, plan.stages.findIndex((s) => s.entrants.includes(meIndex))), [plan, meIndex])
  const [focus, setFocus] = useState(homeStage)
  const pinnedRef = useRef(false)
  const [info, setInfo] = useState<{ alive: number; done: boolean; winTeam: number }[]>([])

  useEffect(() => {
    setFocus(homeStage)
    pinnedRef.current = false
    setInfo(plan.stages.map((s) => ({ alive: s.entrants.length, done: false, winTeam: -1 })))
  }, [plan, homeStage])

  useEffect(() => {
    if (!info[focus]?.done) return
    const next = info.findIndex((s, k) => k !== focus && !s.done)
    if (next < 0) return
    const id = setTimeout(() => setFocus(next), pinnedRef.current ? 6000 : 3000)
    return () => clearTimeout(id)
  }, [info, focus])

  const patchInfo = (k: number, patch: Partial<{ alive: number; done: boolean; winTeam: number }>) =>
    setInfo((list) => list.map((s, i) => (i === k ? { ...s, ...patch } : s)))

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
        patchInfo(k, { alive: e.alive })
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
        patchInfo(k, { done: true, winTeam: plan.kind === 'matches' ? e.winningTeam : -1 })
        if (plan.kind === 'matches') {
          setWins((w) => w.map((v, t) => (t === e.winningTeam ? v + 1 : v)))
          if (doneRef.current.size === plan.stages.length) {
            const home = plan.stages.find((st) => st.entrants.includes(meIndex))
            const meTeam = home ? home.entrants.indexOf(meIndex) % teams : -1
            emit({ type: 'done', winners: plan.winners, winningTeam: plan.winningTeam, seconds: Math.round(plan.steps * SV_STEP), wins: plan.wins, meTeam })
          }
        } else if (doneRef.current.size === plan.stages.length && !startAt) {
          setTimeout(() => setPhase('final'), 2500)
        }
      }
    },
    [plan, startAt, meIndex, teams],
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

  // Server polling hands us a fresh players array each time; restarting the canvases on identity alone blanks the pitch.
  const playerKey = players.map((p) => `${p.id}:${p.me ? 1 : 0}:${p.image ?? ''}`).join('|')
  const stagePlayers = useMemo(() => plan.stages.map((s) => s.entrants.map((i) => players[i])), [plan, playerKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const finalPlayers = useMemo(() => plan.final?.entrants.map((i) => players[i]) ?? [], [plan, playerKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const handlers = useMemo(() => plan.stages.map((s, k) => stageHandler(k, s)), [plan, stageHandler])

  const pitches = plan.stages.length
  const label = plan.kind === 'heats' ? 'Saha' : 'Maç'

  if (phase === 'final' && plan.final) {
    const f = plan.final
    return (
      <div className="relative h-full w-full">
        <SurvivalCanvas
          players={finalPlayers}
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
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        {plan.stages.map((s, k) => (
          <div
            key={`${seed}-${k}`}
            aria-hidden={k !== focus}
            className={cn('absolute inset-0 transition-opacity duration-300', k === focus ? 'opacity-100' : 'pointer-events-none opacity-0')}
          >
            <SurvivalCanvas
              players={stagePlayers[k]}
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
              sound={k === homeStage}
              stage={plan.kind === 'heats' ? 'heat' : 'match'}
              onEvent={handlers[k]}
            />
          </div>
        ))}
      </div>

      <div className="relative z-20 flex shrink-0 flex-col gap-1.5 border-t border-primary/20 bg-card/95 px-2 pb-2 pt-1.5">
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span className="truncate">
            {plan.kind === 'heats'
              ? `Ön eleme · ${pitches} saha · ${plan.final?.entrants.length ?? 0} kişi finale`
              : `${pitches} maç aynı anda`}
          </span>
          {plan.kind === 'matches' && (
            <span className="flex shrink-0 items-center gap-2 text-foreground">
              {wins.slice(0, Math.max(2, teams)).map((w, t) => (
                <span key={t} className="flex items-center gap-1 tabular-nums">
                  <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: SV_TEAMS[t].color }} />
                  <span className="sr-only">{SV_TEAMS[t].name}</span>
                  {w}
                </span>
              ))}
            </span>
          )}
        </div>
        <div role="tablist" aria-label={`${label} seç`} className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {plan.stages.map((s, k) => {
            const st = info[k]
            const active = k === focus
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  pinnedRef.current = true
                  setFocus(k)
                }}
                className={cn(
                  'flex min-w-0 flex-1 shrink-0 basis-12 flex-col items-center rounded-md border px-1.5 py-1 leading-none transition-colors',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:border-primary/50',
                )}
              >
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
                  {label} {k + 1}
                  {k === homeStage && meIndex >= 0 && <span className="sr-only">(senin sahan)</span>}
                  {k === homeStage && meIndex >= 0 && <span aria-hidden className={cn('size-1.5 rounded-full', active ? 'bg-primary-foreground' : 'bg-primary')} />}
                </span>
                <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold tabular-nums">
                  {st?.done && st.winTeam >= 0 ? (
                    <>
                      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: SV_TEAMS[st.winTeam]?.color }} />
                      Bitti
                    </>
                  ) : st?.done ? (
                    'Bitti'
                  ) : (
                    `${st?.alive ?? s.entrants.length} kişi`
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>
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
