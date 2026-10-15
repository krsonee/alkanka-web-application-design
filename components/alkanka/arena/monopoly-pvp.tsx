'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bot,
  Car,
  Dice5,
  Droplets,
  Eye,
  Gavel,
  HelpCircle,
  Home,
  Hotel,
  KeyRound,
  Landmark,
  Lock,
  MapPin,
  Package,
  Train,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BOARD,
  canBuild,
  canMortgage,
  canSell,
  isBuyable,
  JAIL_FINE,
  netWorth,
  unmortgageCost,
  type Group,
  type MonopolyState,
} from '@/lib/games/monopoly'
import type { Remote } from './remote'

// Physical board colours of the classic edition; these are game material, not UI theme.
const GROUP_COLOR: Record<Group, string> = {
  brown: 'oklch(0.42 0.08 50)',
  lightblue: 'oklch(0.8 0.09 220)',
  pink: 'oklch(0.6 0.2 345)',
  orange: 'oklch(0.7 0.17 55)',
  red: 'oklch(0.56 0.21 27)',
  yellow: 'oklch(0.87 0.16 95)',
  green: 'oklch(0.52 0.13 150)',
  darkblue: 'oklch(0.38 0.14 265)',
}
const LIGHT_GROUPS: Group[] = ['lightblue', 'yellow']
const TOKEN_COLOR = ['oklch(0.58 0.22 27)', 'oklch(0.52 0.17 255)', 'oklch(0.6 0.16 150)', 'oklch(0.78 0.16 80)']
const PAPER = 'oklch(0.93 0.035 150)'
const PAPER_DEEP = 'oklch(0.89 0.05 152)'
const INK = 'oklch(0.22 0.02 160)'
const WHITE = 'oklch(0.985 0 0)'

const UNITS = 12.2
const STEP_MS = 230

type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner'

function cellPos(i: number): { row: number; col: number; side: Side } {
  if (i === 0) return { row: 11, col: 11, side: 'corner' }
  if (i < 10) return { row: 11, col: 11 - i, side: 'bottom' }
  if (i === 10) return { row: 11, col: 1, side: 'corner' }
  if (i < 20) return { row: 11 - (i - 10), col: 1, side: 'left' }
  if (i === 20) return { row: 1, col: 1, side: 'corner' }
  if (i < 30) return { row: 1, col: 1 + (i - 20), side: 'top' }
  if (i === 30) return { row: 1, col: 11, side: 'corner' }
  return { row: 1 + (i - 30), col: 11, side: 'right' }
}

function track(k: number): [number, number] {
  if (k === 1) return [0, 1.6]
  if (k === 11) return [10.6, 1.6]
  return [1.6 + (k - 2), 1]
}

function cellCenter(i: number) {
  const { row, col } = cellPos(i)
  const [x, w] = track(col)
  const [y, h] = track(row)
  return { x: ((x + w / 2) / UNITS) * 100, y: ((y + h / 2) / UNITS) * 100 }
}

const TURN_GAP_MS = 650

/**
 * Walks pawns one square at a time, one player at a time, in turn order starting
 * from whoever held the turn before this update — so a batch of bot moves that
 * arrives in a single server response still plays out sequentially.
 */
function useWalkingPawns(target: number[], turn: number) {
  const [shown, setShown] = useState(target)
  const [walker, setWalker] = useState<number | null>(null)
  const shownRef = useRef(target)
  const startRef = useRef(turn)
  const turnRef = useRef(turn)
  const key = target.join(',')

  useEffect(() => {
    const goal = key.split(',').map(Number)
    const n = goal.length
    if (shownRef.current.length !== n) {
      shownRef.current = goal
      setShown(goal)
      startRef.current = turnRef.current
      return
    }
    const start = startRef.current
    const order = Array.from({ length: n }, (_, k) => (start + k) % n)
    let timer = 0
    let current: number | null = null

    const tick = () => {
      const seat = order.find((i) => shownRef.current[i] !== goal[i])
      if (seat === undefined) {
        current = null
        setWalker(null)
        startRef.current = turnRef.current
        return
      }
      if (current !== null && current !== seat) {
        current = seat
        setWalker(seat)
        timer = window.setTimeout(tick, TURN_GAP_MS)
        return
      }
      current = seat
      setWalker(seat)
      const p = shownRef.current[seat]
      const t = goal[seat]
      const steps = (t - p + 40) % 40
      const next = [...shownRef.current]
      next[seat] = steps > 12 ? t : (p + 1) % 40
      shownRef.current = next
      setShown(next)
      timer = window.setTimeout(tick, next[seat] === t ? TURN_GAP_MS : STEP_MS)
    }

    timer = window.setTimeout(tick, STEP_MS)
    return () => window.clearTimeout(timer)
  }, [key])

  useEffect(() => {
    turnRef.current = turn
    if (shownRef.current.every((p, i) => p === target[i])) startRef.current = turn
  }, [turn, target])

  return { shown, walker }
}

function SquareIcon({ i, className }: { i: number; className: string }) {
  const sq = BOARD[i]
  if (sq.type === 'rail') return <Train className={className} aria-hidden="true" />
  if (sq.type === 'utility') return sq.name.includes('Su') ? <Droplets className={className} aria-hidden="true" /> : <Zap className={className} aria-hidden="true" />
  if (sq.type === 'chance') return <HelpCircle className={className} aria-hidden="true" />
  if (sq.type === 'chest') return <Package className={className} aria-hidden="true" />
  if (sq.type === 'tax') return <Landmark className={className} aria-hidden="true" />
  if (sq.type === 'parking') return <Car className={className} aria-hidden="true" />
  if (sq.type === 'gotojail') return <Gavel className={className} aria-hidden="true" />
  if (sq.type === 'jail') return <Lock className={className} aria-hidden="true" />
  if (sq.type === 'go') return <ArrowLeft className={className} aria-hidden="true" />
  return null
}

const DIE_DOTS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }

function Die({ value, delay }: { value: number; delay: number }) {
  return (
    <div
      className="grid aspect-square w-[8cqw] min-w-8 max-w-14 grid-cols-3 grid-rows-3 gap-[8%] rounded-[22%] p-[14%] shadow-[0_6px_10px_-2px_oklch(0_0_0/0.45),inset_0_-3px_0_oklch(0_0_0/0.12)] motion-safe:animate-[die-roll_650ms_cubic-bezier(.2,.8,.3,1)_both]"
      style={{ background: WHITE, animationDelay: `${delay}ms` }}
      role="img"
      aria-label={`Zar ${value}`}
    >
      {Array.from({ length: 9 }, (_, k) => (
        <span key={k} className={cn('rounded-full', DIE_DOTS[value]?.includes(k) ? 'opacity-100' : 'opacity-0')} style={{ background: INK }} />
      ))}
    </div>
  )
}

export function MonopolyPvp({ remote }: { remote: Remote<MonopolyState> }) {
  const s = remote.state
  const me = remote.spectator ? -1 : remote.seat
  const myTurn = remote.myTurn
  const [focus, setFocus] = useState<number | null>(null)
  const [tab, setTab] = useState<'deed' | 'props' | 'log'>('props')
  const nameOf = (seat: number) => (seat === me ? 'Sen' : remote.names[seat] ?? `Oyuncu ${seat + 1}`)
  const fill = (t: string) => t.replace(/@(\d)/g, (_, d) => nameOf(Number(d)))

  const realPos = useMemo(() => s.players.map((p) => p.pos), [s.players])
  const { shown: shownPos, walker } = useWalkingPawns(realPos, s.turn)
  const walking = shownPos.some((p, i) => p !== realPos[i])
  const shownTurn = walking && walker !== null ? walker : s.turn

  const myPlayer = me >= 0 ? s.players[me] : null
  const myProps = me >= 0 ? BOARD.map((_, i) => i).filter((i) => s.owner[i] === me) : []
  const active = s.players[s.turn]
  const activeSquare = active ? BOARD[active.pos] : null

  const openDeed = (i: number) => {
    setFocus(i)
    setTab('deed')
  }

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-4">
      <section aria-label="Oyuncular" className="flex flex-col gap-2 lg:col-start-2 lg:row-start-1">
        {remote.spectator && (
          <p className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground">
            <Eye className="size-4 text-primary" aria-hidden="true" /> Masayı izliyorsun.
          </p>
        )}
        <ul className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {s.players.map((p, i) => (
            <PlayerChip
              key={i}
              seat={i}
              name={nameOf(i)}
              money={p.money}
              worth={netWorth(s, i)}
              isBot={s.bots.includes(i)}
              inJail={p.inJail}
              hasCard={p.cards > 0}
              out={p.out}
              active={s.turn === i && !p.out}
            />
          ))}
        </ul>
      </section>

      <div className="lg:col-start-1 lg:row-span-3 lg:row-start-1">
        <div className="rounded-2xl bg-wood p-1.5 shadow-[0_24px_50px_-20px_oklch(0_0_0/0.8)] sm:p-3">
          <div className="@container mx-auto w-full max-w-[860px]">
            <div
              className="relative grid aspect-square w-full grid-cols-[1.6fr_repeat(9,1fr)_1.6fr] grid-rows-[1.6fr_repeat(9,1fr)_1.6fr] gap-px overflow-hidden rounded-md shadow-[inset_0_0_0_2px_oklch(0.22_0.02_160)]"
              style={{ background: INK }}
            >
              {BOARD.map((_, i) => (
                <BoardCell
                  key={i}
                  i={i}
                  s={s}
                  focused={focus === i}
                  landedColor={!walking && active && !active.out && active.pos === i && s.dice ? TOKEN_COLOR[s.turn] : null}
                  label={`${BOARD[i].name}${s.owner[i] != null ? `, sahibi ${nameOf(s.owner[i]!)}` : ''}${s.players
                    .map((p, k) => (!p.out && p.pos === i ? `, ${nameOf(k)} burada` : ''))
                    .join('')}`}
                  onSelect={() => openDeed(i)}
                />
              ))}

              <BoardCenter
                s={s}
                walking={walking}
                activeName={active ? nameOf(shownTurn) : ''}
                activeSquareIndex={active?.pos ?? 0}
                note={s.note ? fill(s.note) : myTurn ? 'Sıra sende, zarları at.' : `${nameOf(s.turn)} oynuyor`}
              />

              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                {s.players.map((p, i) => {
                  if (p.out) return null
                  const pos = shownPos[i] ?? p.pos
                  const shared = s.players.map((q, k) => (!q.out && (shownPos[k] ?? q.pos) === pos ? k : -1)).filter((k) => k >= 0)
                  const slot = shared.indexOf(i)
                  const spread = shared.length > 1 ? 1.7 : 0
                  const { x, y } = cellCenter(pos)
                  const dx = shared.length > 1 ? (slot % 2 === 0 ? -spread : spread) : 0
                  const dy = shared.length > 2 ? (slot < 2 ? -spread : spread) : 0
                  return (
                    <Pawn
                      key={i}
                      seat={i}
                      x={x + dx}
                      y={y + dy}
                      stepKey={pos}
                      moving={pos !== p.pos}
                      active={shownTurn === i}
                      zIndex={Math.round((y + dy) * 10)}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section aria-label="Hamle" className="lg:col-start-2 lg:row-start-2">
        <ActionPanel
          s={s}
          me={me}
          myTurn={myTurn}
          busy={remote.busy}
          walking={walking}
          send={remote.send}
          activeName={active ? nameOf(shownTurn) : ''}
          activeSquareIndex={active?.pos ?? 0}
          ownerName={activeSquare && s.owner[active!.pos] != null ? nameOf(s.owner[active!.pos]!) : null}
          onOpenDeed={openDeed}
        />
      </section>

      <section aria-label="Ayrıntılar" className="overflow-hidden rounded-2xl border border-border bg-card lg:col-start-2 lg:row-start-3">
        <div role="tablist" aria-label="Panel" className="grid grid-cols-3 gap-1 border-b border-border p-1.5">
          {(
            [
              ['props', `Mülklerim${myProps.length ? ` · ${myProps.length}` : ''}`],
              ['deed', 'Tapu'],
              ['log', 'Akış'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'rounded-lg px-2 py-2 text-xs font-bold transition-colors',
                tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-3">
          {tab === 'deed' &&
            (focus != null ? (
              <DeedCard i={focus} s={s} ownerName={s.owner[focus] != null ? nameOf(s.owner[focus]!) : null} />
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">Ayrıntılarını görmek için tahtada bir kareye dokun.</p>
            ))}

          {tab === 'props' &&
            (me < 0 ? (
              <p className="text-sm text-muted-foreground">İzleyici modundasın.</p>
            ) : myProps.length === 0 ? (
              <p className="text-sm leading-relaxed text-muted-foreground">Henüz tapun yok. Sahipsiz bir kareye gelince satın alabilirsin.</p>
            ) : (
              <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
                {myProps.map((i) => {
                  const sq = BOARD[i]
                  const color = sq.type === 'property' ? GROUP_COLOR[sq.group] : 'oklch(0.6 0 0)'
                  return (
                    <li key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-2">
                      <button type="button" onClick={() => openDeed(i)} className="flex items-center gap-2 text-left text-sm">
                        <span className="h-6 w-2 shrink-0 rounded-sm" style={{ background: color }} aria-hidden="true" />
                        <span className={cn('min-w-0 flex-1 truncate font-semibold text-foreground', s.mortgaged[i] && 'line-through opacity-60')}>{sq.name}</span>
                        {s.houses[i] > 0 && (
                          <span className="flex items-center gap-0.5 text-xs font-bold text-primary">
                            {s.houses[i] === 5 ? <Hotel className="size-3.5" aria-label="Otel" /> : <><Home className="size-3.5" aria-hidden="true" /> {s.houses[i]}</>}
                          </span>
                        )}
                      </button>
                      {myTurn && (canBuild(s, me, i) || canSell(s, me, i) || canMortgage(s, me, i) || s.mortgaged[i]) && (
                        <span className="flex flex-wrap gap-1">
                          {canBuild(s, me, i) && (
                            <MiniButton disabled={remote.busy} onClick={() => remote.send({ type: 'build', pos: i })}>
                              {s.houses[i] === 4 ? 'Otel dik' : 'Ev dik'}
                            </MiniButton>
                          )}
                          {canSell(s, me, i) && (
                            <MiniButton disabled={remote.busy} onClick={() => remote.send({ type: 'sell', pos: i })}>
                              Ev sat
                            </MiniButton>
                          )}
                          {canMortgage(s, me, i) && (
                            <MiniButton disabled={remote.busy} onClick={() => remote.send({ type: 'mortgage', pos: i })}>
                              İpotekle
                            </MiniButton>
                          )}
                          {s.mortgaged[i] && (
                            <MiniButton disabled={remote.busy || (myPlayer?.money ?? 0) < unmortgageCost(i)} onClick={() => remote.send({ type: 'unmortgage', pos: i })}>
                              İpoteği kaldır · {unmortgageCost(i)} ₺
                            </MiniButton>
                          )}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ))}

          {tab === 'log' && (
            <ol className="flex max-h-80 flex-col gap-1.5 overflow-y-auto text-sm leading-relaxed text-muted-foreground" aria-live="polite">
              {[...s.log].reverse().slice(0, 40).map((l, k) => (
                <li key={`${k}-${l}`} className={cn(k === 0 && 'font-semibold text-foreground')}>
                  {fill(l)}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  )
}

function PlayerChip({
  seat,
  name,
  money,
  worth,
  isBot,
  inJail,
  hasCard,
  out,
  active,
}: {
  seat: number
  name: string
  money: number
  worth: number
  isBot: boolean
  inJail: boolean
  hasCard: boolean
  out: boolean
  active: boolean
}) {
  return (
    <li
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-xl border bg-card p-1.5 pr-2 transition-colors sm:gap-3 sm:p-2',
        active ? 'border-primary bg-primary/10' : 'border-border',
        out && 'opacity-45 grayscale',
      )}
    >
      <span className="relative size-9 shrink-0 overflow-hidden rounded-full border-2 sm:size-11" style={{ borderColor: TOKEN_COLOR[seat] }}>
        <img src={`/images/monopoly/pawn-${seat}.png`} alt="" className="size-full scale-[1.6] object-cover object-[50%_32%]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-bold text-foreground">
          {isBot && <Bot className="size-3.5 shrink-0 text-muted-foreground" aria-label="Bot" />}
          <span className="truncate">{name}</span>
          {inJail && <Lock className="size-3.5 shrink-0 text-destructive" aria-label="Hapiste" />}
          {hasCard && <KeyRound className="size-3.5 shrink-0 text-primary" aria-label="Hapisten çıkış kartı" />}
        </p>
        <p className="truncate text-xs tabular-nums text-muted-foreground">
          {out ? (
            'İflas etti'
          ) : (
            <>
              <span className="font-bold text-foreground">{money.toLocaleString('tr-TR')} ₺</span>
              <span className="hidden sm:inline"> · servet {worth.toLocaleString('tr-TR')} ₺</span>
            </>
          )}
        </p>
      </div>
      {active && <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" aria-label="Sırada" />}
    </li>
  )
}

function BoardCell({
  i,
  s,
  focused,
  landedColor,
  label,
  onSelect,
}: {
  i: number
  s: MonopolyState
  focused: boolean
  landedColor: string | null
  label: string
  onSelect: () => void
}) {
  const sq = BOARD[i]
  const { row, col, side } = cellPos(i)
  const owner = s.owner[i]
  const houses = s.houses[i]
  const color = sq.type === 'property' ? GROUP_COLOR[sq.group] : null
  const corner = side === 'corner'
  const vertical = side === 'left' || side === 'right'

  const bar = side === 'bottom' ? 'top' : side === 'top' ? 'bottom' : side === 'left' ? 'right' : 'left'
  const outer = side === 'bottom' ? 'bottom' : side === 'top' ? 'top' : side === 'left' ? 'left' : 'right'
  const BAR = '24%'

  const contentInset: React.CSSProperties = { inset: 0 }
  if (color) contentInset[bar] = BAR
  if (owner != null) contentInset[outer] = '9%'

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      style={
        {
          gridRow: row,
          gridColumn: col,
          background: corner ? PAPER_DEEP : PAPER,
          color: INK,
          '--pulse-color': landedColor ?? 'transparent',
        } as React.CSSProperties
      }
      className={cn(
        'relative overflow-hidden outline-none transition-[filter] hover:brightness-[1.04] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary',
        focused && 'z-10 outline-2 outline-primary',
        landedColor && 'z-[5] motion-safe:animate-[cell-pulse_1.4s_ease-in-out_infinite]',
      )}
    >
      {color && (
        <span
          className={cn('absolute flex items-center justify-center gap-[6%]', vertical ? 'inset-y-0 flex-col' : 'inset-x-0')}
          style={{ background: color, [bar]: 0, [vertical ? 'width' : 'height']: BAR, boxShadow: 'inset 0 0 0 0.5px oklch(0 0 0 / 0.35)' }}
        >
          {houses > 0 &&
            (houses === 5 ? (
              <Hotel className="size-[1.6cqw] min-h-2 min-w-2 drop-shadow" style={{ color: 'oklch(0.55 0.2 27)', fill: 'oklch(0.55 0.2 27)' }} aria-hidden="true" />
            ) : (
              Array.from({ length: houses }, (_, k) => (
                <Home key={k} className="size-[1.3cqw] min-h-1.5 min-w-1.5 drop-shadow" style={{ color: 'oklch(0.5 0.15 150)', fill: 'oklch(0.6 0.16 150)' }} aria-hidden="true" />
              ))
            ))}
        </span>
      )}

      {owner != null && (
        <span
          className="absolute"
          style={{
            [outer]: 0,
            ...(vertical ? { top: 0, bottom: 0, width: '9%' } : { left: 0, right: 0, height: '9%' }),
            background: s.mortgaged[i]
              ? `repeating-linear-gradient(45deg, ${TOKEN_COLOR[owner]} 0 3px, transparent 3px 6px)`
              : TOKEN_COLOR[owner],
          }}
          aria-hidden="true"
        />
      )}

      <span
        className={cn(
          'absolute flex items-center justify-center gap-[0.35cqw] p-[0.35cqw] text-center font-bold uppercase leading-[1.05] tracking-tight',
          corner ? 'flex-col text-[clamp(6px,1.5cqw,13px)]' : 'flex-col text-[clamp(5.5px,1.08cqw,10px)]',
          vertical && '[writing-mode:vertical-rl]',
          side === 'right' && 'rotate-180',
        )}
        style={contentInset}
      >
        <SquareIcon i={i} className={corner ? 'size-[4.4cqw] shrink-0' : 'size-[2.2cqw] min-h-2.5 min-w-2.5 shrink-0'} />
        <span className="line-clamp-2 break-words [hyphens:auto]" lang="tr">
          {sq.name}
        </span>
        {isBuyable(sq) && <span className="font-semibold normal-case opacity-75 tabular-nums">{sq.price}₺</span>}
        {sq.type === 'tax' && <span className="font-semibold normal-case opacity-75 tabular-nums">{sq.amount}₺</span>}
        {i === 0 && <span className="font-semibold normal-case opacity-80">+200₺</span>}
      </span>
    </button>
  )
}

function Pawn({ seat, x, y, stepKey, moving, active, zIndex }: { seat: number; x: number; y: number; stepKey: number; moving: boolean; active: boolean; zIndex: number }) {
  return (
    <div
      className="absolute w-[7%] transition-[left,top] ease-out"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -78%)', zIndex: 20 + zIndex, transitionDuration: `${STEP_MS - 20}ms` }}
    >
      <span className="absolute -bottom-[6%] left-1/2 h-[18%] w-[80%] -translate-x-1/2 rounded-[50%] bg-[oklch(0_0_0/0.4)] blur-[2px]" />
      <div
        key={stepKey}
        className={cn(
          'relative',
          moving
            ? 'motion-safe:animate-[pawn-hop_220ms_ease-out]'
            : active
              ? 'motion-safe:animate-[pawn-idle_1.6s_ease-in-out_infinite]'
              : '',
        )}
      >
        <div
          className="aspect-square w-full overflow-hidden rounded-full border-[0.45cqw] shadow-[0_4px_8px_oklch(0_0_0/0.45),inset_0_2px_3px_oklch(1_0_0/0.5)]"
          style={{ borderColor: TOKEN_COLOR[seat], background: TOKEN_COLOR[seat] }}
        >
          <img src={`/images/monopoly/pawn-${seat}.png`} alt="" className="size-full scale-[1.55] object-cover object-[50%_30%]" draggable={false} />
        </div>
        <div
          className="mx-auto -mt-[8%] h-[22%] w-[78%] rounded-[50%] shadow-[0_2px_3px_oklch(0_0_0/0.45)]"
          style={{ background: `linear-gradient(180deg, ${WHITE} -40%, ${TOKEN_COLOR[seat]} 45%, oklch(0.25 0.03 60) 140%)` }}
        />
      </div>
    </div>
  )
}

function BoardCenter({ s, walking, activeName, activeSquareIndex, note }: { s: MonopolyState; walking: boolean; activeName: string; activeSquareIndex: number; note: string }) {
  const sq = BOARD[activeSquareIndex]
  const color = sq.type === 'property' ? GROUP_COLOR[sq.group] : INK
  const rollKey = `${s.turn}-${s.round}-${s.dice?.join('') ?? 'x'}`

  return (
    <div
      className="relative flex flex-col items-center justify-center gap-[2.2cqw] overflow-hidden p-[3cqw]"
      style={{
        gridRow: '2 / 11',
        gridColumn: '2 / 11',
        color: INK,
        background: `radial-gradient(ellipse at 50% 45%, ${PAPER} 0%, ${PAPER_DEEP} 100%)`,
      }}
    >
      <div
        className="absolute left-[7%] top-[9%] flex aspect-[5/3] w-[24%] -rotate-[42deg] items-center justify-center rounded-[1cqw] border-[0.35cqw] border-dashed shadow-[0_3px_0_oklch(0_0_0/0.15)]"
        style={{ background: GROUP_COLOR.orange, borderColor: WHITE }}
        aria-hidden="true"
      >
        <span className="flex items-center gap-[0.6cqw] text-[clamp(7px,1.7cqw,14px)] font-black uppercase tracking-wider" style={{ color: WHITE }}>
          <HelpCircle className="size-[2.2cqw]" /> Şans
        </span>
      </div>
      <div
        className="absolute bottom-[9%] right-[7%] flex aspect-[5/3] w-[24%] -rotate-[42deg] items-center justify-center rounded-[1cqw] border-[0.35cqw] border-dashed shadow-[0_3px_0_oklch(0_0_0/0.15)]"
        style={{ background: GROUP_COLOR.lightblue, borderColor: WHITE }}
        aria-hidden="true"
      >
        <span className="flex items-center gap-[0.6cqw] text-[clamp(6px,1.5cqw,13px)] font-black uppercase tracking-wider" style={{ color: INK }}>
          <Package className="size-[2.2cqw]" /> Kamu fonu
        </span>
      </div>

      <div className="relative -rotate-[42deg] select-none" aria-hidden="true">
        <span
          className="block rounded-[0.8cqw] border-[0.5cqw] px-[3cqw] py-[0.6cqw] font-display text-[6.4cqw] font-black uppercase leading-none tracking-wide shadow-[0_0.8cqw_0_oklch(0_0_0/0.18)]"
          style={{ background: GROUP_COLOR.red, borderColor: WHITE, color: WHITE }}
        >
          Monopoly
        </span>
      </div>

      <div className="relative z-10 flex w-[78%] flex-col items-center gap-[1.6cqw]">
        <span className="rounded-full px-[1.6cqw] py-[0.4cqw] text-[clamp(7px,1.4cqw,12px)] font-bold uppercase tracking-widest" style={{ background: 'oklch(0.22 0.02 160 / 0.08)' }}>
          Tur {Math.min(s.round, s.maxRounds)}/{s.maxRounds}
        </span>

        {s.dice && (
          <div key={rollKey} className="flex gap-[2cqw]">
            <Die value={s.dice[0]} delay={0} />
            <Die value={s.dice[1]} delay={80} />
          </div>
        )}

        {s.card ? (
          <div
            key={s.card.text}
            className="w-full max-w-[90%] rounded-[1.2cqw] border-[0.4cqw] p-[2cqw] text-center shadow-[0_10px_20px_-8px_oklch(0_0_0/0.5)] motion-safe:animate-[card-flip-in_450ms_ease-out_both]"
            style={{ background: s.card.deck === 'chance' ? GROUP_COLOR.orange : GROUP_COLOR.lightblue, borderColor: WHITE, color: s.card.deck === 'chance' ? WHITE : INK }}
          >
            <p className="text-[clamp(7px,1.4cqw,12px)] font-black uppercase tracking-widest">{s.card.deck === 'chance' ? 'Şans' : 'Kamu fonu'}</p>
            <p className="mt-[0.6cqw] text-pretty text-[clamp(9px,1.8cqw,15px)] font-semibold leading-snug">{s.card.text}</p>
          </div>
        ) : (
          s.dice && (
            <div className="flex max-w-full items-center gap-[1cqw] overflow-hidden rounded-full bg-[oklch(0.985_0_0)] py-[0.6cqw] pl-[0.6cqw] pr-[2cqw] shadow-md">
              <span className="flex size-[3.6cqw] min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full" style={{ background: color, color: WHITE }}>
                <MapPin className="size-[60%]" aria-hidden="true" />
              </span>
              <span className="truncate text-[clamp(9px,1.7cqw,14px)] font-bold">
                {walking ? `${activeName} ilerliyor…` : `${activeName} · ${sq.name}`}
              </span>
            </div>
          )
        )}

        <p className="text-pretty text-center text-[clamp(9px,1.7cqw,15px)] font-semibold leading-snug" aria-live="polite">
          {note}
        </p>
      </div>
    </div>
  )
}

function ActionPanel({
  s,
  me,
  myTurn,
  busy,
  walking,
  send,
  activeName,
  activeSquareIndex,
  ownerName,
  onOpenDeed,
}: {
  s: MonopolyState
  me: number
  myTurn: boolean
  busy: boolean
  walking: boolean
  send: Remote<MonopolyState>['send']
  activeName: string
  activeSquareIndex: number
  ownerName: string | null
  onOpenDeed: (i: number) => void
}) {
  const sq = BOARD[activeSquareIndex]
  const color = sq.type === 'property' ? GROUP_COLOR[sq.group] : 'oklch(0.45 0.02 160)'
  const light = sq.type === 'property' && LIGHT_GROUPS.includes(sq.group)
  const myPlayer = me >= 0 ? s.players[me] : null
  const canAct = myTurn && myPlayer && !walking

  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-3', myTurn ? 'border-primary' : 'border-border')}>
      <button type="button" onClick={() => onOpenDeed(activeSquareIndex)} className="flex items-stretch overflow-hidden rounded-xl border border-border text-left">
        <span className="flex w-12 shrink-0 items-center justify-center" style={{ background: color, color: light ? INK : WHITE }}>
          <MapPin className="size-5" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
          <span className="text-xs text-muted-foreground">{walking ? `${activeName} ilerliyor` : `${activeName} şurada`}</span>
          <span className="truncate font-bold text-foreground">{sq.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {isBuyable(sq) ? (ownerName ? `Sahibi ${ownerName}${s.mortgaged[activeSquareIndex] ? ' · ipotekli' : ''}` : `Sahipsiz · ${sq.price} ₺`) : sq.type === 'tax' ? `${sq.amount} ₺ vergi` : 'Özel kare'}
          </span>
        </span>
      </button>

      {canAct ? (
        <div className="flex flex-col gap-2">
          {s.phase === 'roll' && (
            <>
              <ActionButton primary disabled={busy} onClick={() => send({ type: 'roll' })}>
                <Dice5 className="size-5" aria-hidden="true" /> {myPlayer.inJail ? 'Çift için zar at' : 'Zar at'}
              </ActionButton>
              {(myPlayer.inJail && (
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton disabled={busy || myPlayer.money < JAIL_FINE} onClick={() => send({ type: 'payJail' })}>
                    {JAIL_FINE} ₺ öde
                  </ActionButton>
                  <ActionButton disabled={busy || myPlayer.cards === 0} onClick={() => send({ type: 'useCard' })}>
                    <KeyRound className="size-4" aria-hidden="true" /> Kart
                  </ActionButton>
                </div>
              )) ||
                null}
            </>
          )}
          {s.phase === 'buy' && isBuyable(sq) && (
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <ActionButton primary disabled={busy || myPlayer.money < sq.price} onClick={() => send({ type: 'buy' })}>
                Satın al · {sq.price} ₺
              </ActionButton>
              <ActionButton disabled={busy} onClick={() => send({ type: 'pass' })}>
                Alma
              </ActionButton>
            </div>
          )}
          {s.phase === 'end' && (
            <ActionButton primary disabled={busy} onClick={() => send({ type: 'end' })}>
              Turu bitir
            </ActionButton>
          )}
        </div>
      ) : (
        <p className="rounded-xl bg-secondary px-3 py-3 text-center text-sm font-semibold text-muted-foreground">
          {myTurn && walking ? 'Piyon yürüyor…' : me < 0 ? 'İzliyorsun' : `${activeName} oynuyor, sıranı bekle`}
        </p>
      )}
    </div>
  )
}

function DeedCard({ i, s, ownerName }: { i: number; s: MonopolyState; ownerName: string | null }) {
  const sq = BOARD[i]
  if (!isBuyable(sq)) {
    return (
      <div className="rounded-xl border border-border p-3 text-sm">
        <p className="font-bold text-foreground">{sq.name}</p>
        <p className="leading-relaxed text-muted-foreground">
          {sq.type === 'tax'
            ? `Buraya gelen ${sq.amount} ₺ vergi öder.`
            : sq.type === 'chance' || sq.type === 'chest'
              ? 'Buraya gelen bir kart çeker.'
              : sq.type === 'gotojail'
                ? 'Buraya gelen doğrudan hapse girer.'
                : sq.type === 'jail'
                  ? 'Hapis ya da sadece ziyaret.'
                  : sq.type === 'go'
                    ? "Başla'dan her geçişte 200 ₺ maaş alınır."
                    : 'Burada bir şey olmaz, dinlen.'}
        </p>
      </div>
    )
  }
  const color = sq.type === 'property' ? GROUP_COLOR[sq.group] : 'oklch(0.45 0.02 160)'
  const light = sq.type === 'property' && LIGHT_GROUPS.includes(sq.group)
  return (
    <div className="mx-auto max-w-xs overflow-hidden rounded-lg border-2 text-xs shadow-lg" style={{ borderColor: INK, background: WHITE, color: INK }}>
      <div className="m-1.5 rounded-sm p-2 text-center" style={{ background: color, color: light ? INK : WHITE }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest">Tapu senedi</p>
        <p className="text-base font-black uppercase">{sq.name}</p>
      </div>
      <div className="flex flex-col gap-0.5 px-3 pb-3 pt-1">
        {sq.type === 'property' ? (
          <>
            {['Kira', '1 evli', '2 evli', '3 evli', '4 evli', 'Otelli'].map((label, k) => (
              <p key={label} className={cn('flex justify-between', s.houses[i] === k && s.owner[i] != null && 'font-black')}>
                <span>{label}</span>
                <span className="tabular-nums">{sq.rent[k]} ₺</span>
              </p>
            ))}
            <p className="mt-1 text-[10px] leading-snug opacity-75">Grubun tamamı sende ise boş arsa kirası iki katıdır. Ev / otel: {sq.house} ₺</p>
          </>
        ) : sq.type === 'rail' ? (
          ['1 istasyon', '2 istasyon', '3 istasyon', '4 istasyon'].map((label, k) => (
            <p key={label} className="flex justify-between">
              <span>{label}</span>
              <span className="tabular-nums">{25 * 2 ** k} ₺</span>
            </p>
          ))
        ) : (
          <p>Bir idare: zarın 4 katı. İki idare: zarın 10 katı.</p>
        )}
        <p className="mt-1 border-t pt-1" style={{ borderColor: INK }}>
          Fiyat {sq.price} ₺ · ipotek {sq.price / 2} ₺
        </p>
        <p className="font-bold">{ownerName ? `Sahibi: ${ownerName}${s.mortgaged[i] ? ' (ipotekli)' : ''}` : 'Sahipsiz'}</p>
      </div>
    </div>
  )
}

function ActionButton({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold uppercase tracking-wide transition-transform active:scale-[0.98] disabled:opacity-40',
        primary ? 'bg-primary text-primary-foreground shadow-[0_4px_0_oklch(0_0_0/0.3)]' : 'border border-border bg-secondary text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function MiniButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-40">
      {children}
    </button>
  )
}
