'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Dices, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TavlaState } from '@/lib/pvp/rules'
import type { GameApi } from './stake-gate'
import type { Remote } from './remote'
import { BrandLogo } from '../logo-selector'
import {
  applyMove,
  botPlan,
  initialBoard,
  legalMoves,
  pipCount,
  rollDice,
  spendDie,
  type Board,
  type From,
  type Move,
  type Side,
  type To,
} from './tavla-engine'

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

export function Die({ value, used, small, className }: { value: number; used?: boolean; small?: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`Zar ${value}${used ? ', oynandı' : ''}`}
      className={cn(
        'grid grid-cols-3 grid-rows-3 gap-0.5 rounded-lg bg-checker-light p-1 shadow-[0_6px_14px_rgb(0_0_0/0.45)] transition-opacity sm:p-1.5',
        small ? 'size-8' : 'size-8 sm:size-12',
        used && 'opacity-35',
        className,
      )}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="flex items-center justify-center">
          {PIPS[value]?.includes(i) && <span className={cn('rounded-full bg-checker-dark', small ? 'size-1.5' : 'size-1.5 sm:size-2')} />}
        </span>
      ))}
    </span>
  )
}

/** Rolls through random faces briefly whenever `rollKey` changes, then lands on the real values. */
function useRollAnimation(rolled: number[], rollKey: number) {
  const [faces, setFaces] = useState<number[] | null>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!rolled.length) return
    let n = 0
    const id = setInterval(() => {
      n++
      setFaces(rolled.slice(0, 2).map(() => 1 + Math.floor(Math.random() * 6)))
      if (n > 7) {
        clearInterval(id)
        setFaces(null)
      }
    }, 70)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey])
  return faces
}

function Checker({ side, label, glow }: { side: Side; label?: string; glow?: boolean }) {
  return (
    <span
      className={cn(
        'relative flex aspect-square w-full max-w-11 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-transform duration-200 sm:text-[11px]',
        side === 'p' ? 'checker-light-3d text-checker-dark' : 'checker-dark-3d text-primary',
        glow && 'z-10 -translate-y-0.5 scale-110 ring-[3px] ring-primary ring-offset-2 ring-offset-felt',
      )}
    >
      {label}
    </span>
  )
}

function Stack({ count, side, top, glow }: { count: number; side: Side; top: boolean; glow: boolean }) {
  const visible = Math.min(count, 5)
  return (
    <div className={cn('flex h-full w-full flex-col items-center gap-px sm:gap-0.5', !top && 'flex-col-reverse')}>
      {Array.from({ length: visible }).map((_, i) => (
        <Checker key={i} side={side} glow={glow && i === visible - 1} label={i === visible - 1 && count > 5 ? String(count) : undefined} />
      ))}
    </div>
  )
}

type BoardProps = {
  board: Board
  me: Side
  legal: Move[]
  selected: From | null
  onSelect: (from: From | null) => void
  onPlay: (m: Move) => void
  rolled: number[]
  dice: number[]
  rollKey: number
  highlight: Set<number>
  names: { me: string; opp: string }
  turn: 'me' | 'opp' | null
}

function TavlaBoard({ board, me, legal, selected, onSelect, onPlay, rolled, dice, rollKey, highlight, names, turn }: BoardProps) {
  const opp: Side = me === 'p' ? 'b' : 'p'
  const sources = useMemo(() => new Set(legal.map((m) => m.from)), [legal])
  const targets = useMemo(() => legal.filter((m) => m.from === selected), [legal, selected])
  const faces = useRollAnimation(rolled, rollKey)

  const usedFlags = useMemo(() => {
    const left = [...dice]
    return rolled.map((d) => {
      const i = left.indexOf(d)
      if (i >= 0) {
        left.splice(i, 1)
        return false
      }
      return true
    })
  }, [rolled, dice])

  // The board is always drawn from the viewer's perspective: own home board bottom-right.
  const real = (visual: number) => (me === 'p' ? visual : 23 - visual)
  const topRow = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
  const bottomRow = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]

  function clickPoint(i: number) {
    const t = targets.find((m) => m.to === i)
    if (t) return onPlay(t)
    if (selected === i) return onSelect(null)
    if (sources.has(i)) onSelect(i)
  }

  const renderPoint = (visual: number, isTop: boolean) => {
    const i = real(visual)
    const v = board.pts[i]
    const side: Side = v > 0 ? 'p' : 'b'
    const isTarget = targets.some((t) => t.to === i)
    const isSource = sources.has(i)
    const mine = side === me
    const label = me === 'p' ? i + 1 : 24 - i
    return (
      <button
        key={visual}
        type="button"
        onClick={() => clickPoint(i)}
        aria-label={`Hane ${label}${v ? `, ${Math.abs(v)} ${mine ? 'senin' : 'rakip'} pulu` : ', boş'}${isTarget ? ', buraya oynanabilir' : ''}`}
        className={cn('relative flex h-full min-w-0 flex-1 flex-col items-center px-px outline-none sm:px-0.5', isTop ? 'justify-start' : 'justify-end')}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-x-px h-[90%] transition-colors sm:inset-x-0.5',
            isTop ? 'top-0' : 'bottom-0',
            visual % 2 === 0 ? 'bg-point-a' : 'bg-point-b',
            isTarget ? 'animate-pulse bg-primary' : 'opacity-90',
            selected === i && 'brightness-125',
          )}
          style={{
            clipPath: isTop ? 'polygon(0 0, 100% 0, 50% 100%)' : 'polygon(50% 0, 100% 100%, 0 100%)',
            backgroundImage: isTarget ? undefined : 'linear-gradient(90deg, rgb(0 0 0 / 0.18), transparent 45%, rgb(255 255 255 / 0.08) 55%, rgb(0 0 0 / 0.18))',
          }}
        />
        {isTarget && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-x-0 z-20 m-auto flex size-5 items-center justify-center rounded-full border-2 border-primary bg-primary/30 sm:size-7',
              isTop ? 'bottom-[12%]' : 'top-[12%]',
            )}
          >
            <span className="size-2 animate-ping rounded-full bg-primary" />
          </span>
        )}
        <span className="relative z-10 flex h-full w-full flex-col py-0.5 sm:py-1">
          {v !== 0 && <Stack count={Math.abs(v)} side={side} top={isTop} glow={(isSource && selected === i) || (!mine && highlight.has(i))} />}
        </span>
        {isSource && selected !== i && <span aria-hidden="true" className={cn('absolute z-20 h-1 w-1/2 rounded-full bg-primary', isTop ? '-bottom-1' : '-top-1')} />}
        <span className={cn('absolute z-20 hidden text-[9px] font-semibold text-muted-foreground sm:block', isTop ? '-top-4' : '-bottom-4')}>{label}</span>
      </button>
    )
  }

  const barSelectable = sources.has('bar')
  const offTarget = targets.find((t) => t.to === 'off')
  const shown = faces ?? rolled.slice(0, rolled.length === 4 ? 4 : 2)

  return (
    <div className="flex flex-col gap-2">
      <TurnIndicator turn={turn} me={names.me} opp={names.opp} />
      <div className="tavla-wood rounded-2xl p-1.5 sm:p-3">
      <div className="flex aspect-[16/12] w-full gap-1 sm:aspect-[16/11] sm:gap-2">
        <div className="tavla-felt relative flex flex-1 flex-col justify-between rounded-lg px-0.5 py-4 sm:px-2 sm:py-5">
          <div className="flex h-[42%]">{topRow.slice(0, 6).map((v) => renderPoint(v, true))}</div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25">
            <span className="scale-75 sm:scale-100">
              <BrandLogo size="sm" />
            </span>
          </div>
          <div className="flex h-[42%]">{bottomRow.slice(0, 6).map((v) => renderPoint(v, false))}</div>
        </div>

        <button
          type="button"
          onClick={() => (selected === 'bar' ? onSelect(null) : barSelectable && onSelect('bar'))}
          disabled={!barSelectable}
          aria-label={`Kırık pullar: sen ${board.bar[me]}, rakip ${board.bar[opp]}`}
          className={cn('flex w-6 flex-col items-center justify-between rounded-md bg-wood py-2 sm:w-12 sm:py-3', barSelectable && 'ring-2 ring-primary', selected === 'bar' && 'bg-primary/30')}
        >
          <span className="flex w-full flex-col items-center gap-0.5 px-px">
            {Array.from({ length: Math.min(board.bar[opp], 4) }).map((_, i) => (
              <Checker key={i} side={opp} label={i === 0 && board.bar[opp] > 4 ? String(board.bar[opp]) : undefined} />
            ))}
          </span>
          <span className="flex w-full flex-col-reverse items-center gap-0.5 px-px">
            {Array.from({ length: Math.min(board.bar[me], 4) }).map((_, i) => (
              <Checker key={i} side={me} label={i === 0 && board.bar[me] > 4 ? String(board.bar[me]) : undefined} />
            ))}
          </span>
        </button>

        <div className="tavla-felt relative flex flex-1 flex-col justify-between rounded-lg px-0.5 py-4 sm:px-2 sm:py-5">
          <div className="flex h-[42%]">{topRow.slice(6).map((v) => renderPoint(v, true))}</div>
          <div aria-live="polite" className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center gap-1.5 sm:gap-3">
            {shown.length > 0 &&
              shown.map((d, i) => (
                <Die key={`${rollKey}-${i}`} value={d} used={!faces && usedFlags[i]} className={cn(faces && 'animate-[tumble_0.6s_ease-out]')} />
              ))}
          </div>
          <div className="flex h-[42%]">{bottomRow.slice(6).map((v) => renderPoint(v, false))}</div>
        </div>

        <div className="flex w-8 flex-col justify-between gap-1.5 sm:w-14 sm:gap-2">
          <div className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md bg-felt/70 p-0.5 text-center">
            <span className="line-clamp-1 text-[8px] font-bold uppercase text-muted-foreground sm:text-[9px]">{names.opp}</span>
            <span className="font-display text-base font-bold text-primary sm:text-lg">{board.off[opp]}</span>
          </div>
          <button
            type="button"
            onClick={() => offTarget && onPlay(offTarget)}
            disabled={!offTarget}
            className={cn('flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md bg-felt/70 p-0.5 text-center', offTarget && 'animate-pulse bg-primary/40 ring-2 ring-primary')}
            aria-label={`Toplanan pulların: ${board.off[me]}${offTarget ? ', pulu topla' : ''}`}
          >
            <span className="text-[8px] font-bold uppercase text-muted-foreground sm:text-[9px]">Sen</span>
            <span className="font-display text-base font-bold text-foreground sm:text-lg">{board.off[me]}</span>
            {offTarget && <span className="text-[8px] font-bold uppercase text-primary sm:text-[9px]">Topla</span>}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

function TurnIndicator({ turn, me, opp }: { turn: 'me' | 'opp' | null; me: string; opp: string }) {
  const seat = (who: 'me' | 'opp', name: string, side: 'light' | 'dark') => {
    const active = turn === who
    return (
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 transition-all',
          who === 'opp' && 'flex-row-reverse text-right',
          active ? 'border-primary bg-primary/15 shadow-[0_0_18px_-4px_var(--primary)]' : 'border-border bg-card opacity-70',
        )}
      >
        <span aria-hidden="true" className={cn('size-5 shrink-0 rounded-full', side === 'light' ? 'checker-light-3d' : 'checker-dark-3d')} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{name}</span>
        {active && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" />
            Sırada
          </span>
        )}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2" aria-live="polite" aria-label={turn === 'me' ? 'Sıra sende' : turn === 'opp' ? `Sıra ${opp} oyuncusunda` : 'Oyun bitti'}>
      {seat('me', me, 'light')}
      <span className="shrink-0 text-xs font-bold text-muted-foreground">VS</span>
      {seat('opp', opp, 'dark')}
    </div>
  )
}

function ControlBar({
  message,
  sub,
  canUndo,
  onUndo,
  canRoll,
  onRoll,
  rollLabel,
}: {
  message: string
  sub: string
  canUndo: boolean
  onUndo: () => void
  canRoll: boolean
  onRoll: () => void
  rollLabel: string
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex flex-col">
        <p className="text-sm font-semibold text-foreground" aria-live="polite">
          {message}
        </p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="flex gap-2">
        {canUndo && (
          <button onClick={onUndo} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary sm:flex-none">
            <Undo2 className="size-4" aria-hidden="true" />
            Geri al
          </button>
        )}
        <button
          onClick={onRoll}
          disabled={!canRoll}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 disabled:opacity-40 sm:flex-none"
        >
          <Dices className="size-4" aria-hidden="true" />
          {rollLabel}
        </button>
      </div>
    </div>
  )
}

type Phase = 'roll' | 'move' | 'bot' | 'over'

export function Tavla({ finish }: GameApi) {
  const [board, setBoard] = useState<Board>(initialBoard)
  const [dice, setDice] = useState<number[]>([])
  const [rolled, setRolled] = useState<number[]>([])
  const [rollKey, setRollKey] = useState(0)
  const [phase, setPhase] = useState<Phase>('roll')
  const [selected, setSelected] = useState<From | null>(null)
  const [snapshot, setSnapshot] = useState<{ board: Board; dice: number[] } | null>(null)
  const [message, setMessage] = useState('Sıra sende. Zarı at kanka.')
  const [lastBot, setLastBot] = useState<Move[]>([])

  const legal = useMemo(() => (phase === 'move' ? legalMoves(board, 'p', dice) : []), [board, dice, phase])

  function endGame(b: Board) {
    if (b.off.p === 15) {
      setPhase('over')
      setMessage('Tüm pulları topladın!')
      const mars = b.off.b === 0
      setMessage(mars ? 'MARS! Rakip tek pul bile toplayamadı.' : 'Tüm pulları topladın!')
      setTimeout(
        () =>
          finish('win', mars ? 'Rakip tek pul bile toplayamadan bitirdin, kazancın 3 katı.' : 'Tüm pulları rakibinden önce topladın.', {
            for: 15,
            against: b.off.b,
          }),
        900,
      )
      return true
    }
    if (b.off.b === 15) {
      setPhase('over')
      setMessage('Rakip tüm pulları topladı.')
      setTimeout(() => finish('lose', 'Rakip pullarını senden önce topladı.'), 900)
      return true
    }
    return false
  }

  function showRoll(d: number[]) {
    setRolled(d)
    setDice(d)
    setRollKey((k) => k + 1)
  }

  function roll() {
    const d = rollDice()
    showRoll(d)
    setSnapshot({ board, dice: d })
    setLastBot([])
    if (!legalMoves(board, 'p', d).length) {
      setMessage(`${d.slice(0, 2).join(' - ')} geldi, oynanacak hamle yok. Sıra rakipte.`)
      setPhase('bot')
      return
    }
    setMessage(d.length === 4 ? `Çift ${d[0]}! Dört hamle hakkın var.` : `${d[0]} - ${d[1]} geldi. Pulunu seç.`)
    setPhase('move')
  }

  function play(m: Move) {
    const next = applyMove(board, 'p', m)
    const left = spendDie(dice, m.die)
    setBoard(next)
    setDice(left)
    setSelected(null)
    if (endGame(next)) return
    if (!left.length || !legalMoves(next, 'p', left).length) {
      setMessage('Hamleni tamamladın. Sıra rakipte.')
      setPhase('bot')
    } else if (m.hit) setMessage('Rakibin pulunu kırdın!')
  }

  function undo() {
    if (!snapshot) return
    setBoard(snapshot.board)
    setDice(snapshot.dice)
    setSelected(null)
    setPhase('move')
    setMessage('Hamleler geri alındı.')
  }

  useEffect(() => {
    if (phase !== 'bot') return
    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(
      setTimeout(() => {
        const d = rollDice()
        showRoll(d)
        const plan = botPlan(board, d)
        if (!plan.length) {
          setMessage(`Rakip ${d.slice(0, 2).join(' - ')} attı, hamle yok. Sıra sende.`)
          timers.push(setTimeout(() => setPhase('roll'), 1300))
          return
        }
        setMessage(`Rakip ${d.slice(0, 2).join(' - ')} attı...`)
        let current = board
        let left = d
        plan.forEach((m, idx) => {
          timers.push(
            setTimeout(() => {
              current = applyMove(current, 'b', m)
              left = spendDie(left, m.die)
              setBoard(current)
              setDice(left)
              setLastBot((prev) => [...prev, m])
              if (idx === plan.length - 1) {
                if (endGame(current)) return
                timers.push(
                  setTimeout(() => {
                    setMessage(plan.some((x) => x.hit) ? 'Rakip pulunu kırdı! Kırık pulu önce sokman gerek.' : 'Sıra sende. Zarı at kanka.')
                    setPhase('roll')
                  }, 500),
                )
              }
            }, 900 + 650 * idx),
          )
        })
      }, 700),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <TavlaBoard
        board={board}
        me="p"
        legal={legal}
        selected={selected}
        onSelect={setSelected}
        onPlay={play}
        rolled={rolled}
        dice={dice}
        rollKey={rollKey}
        highlight={new Set(lastBot.map((m) => (typeof m.to === 'number' ? m.to : -1)))}
        names={{ me: 'Sen', opp: 'Rakip' }}
        turn={phase === 'over' ? null : phase === 'bot' ? 'opp' : 'me'}
      />
      <ControlBar
        message={message}
        sub={`Kalan yol: sen ${pipCount(board, 'p')} · rakip ${pipCount(board, 'b')}`}
        canUndo={phase === 'move' && !!snapshot}
        onUndo={undo}
        canRoll={phase === 'roll'}
        onRoll={roll}
        rollLabel={phase === 'bot' ? 'Rakip oynuyor' : 'Zar at'}
      />
    </div>
  )
}

export function TavlaPvp({ remote }: { remote: Remote<TavlaState> }) {
  const s = remote.state
  const me: Side = remote.seat === 0 ? 'p' : 'b'
  const opp: Side = me === 'p' ? 'b' : 'p'
  const [pending, setPending] = useState<Move[]>([])
  const [selected, setSelected] = useState<From | null>(null)
  const sentFor = useRef(-1)

  useEffect(() => {
    setPending([])
    setSelected(null)
  }, [remote.version])

  const { board, dice } = useMemo(() => {
    let b = s.board
    let d = [...s.dice]
    for (const m of pending) {
      b = applyMove(b, me, m)
      d = spendDie(d, m.die)
    }
    return { board: b, dice: d }
  }, [s, pending, me])

  const myMove = remote.myTurn && s.phase === 'move'
  const legal = useMemo(() => (myMove && !remote.busy ? legalMoves(board, me, dice) : []), [myMove, remote.busy, board, me, dice])

  useEffect(() => {
    if (!myMove || pending.length === 0 || sentFor.current === remote.version) return
    const done = board.off[me] >= 15 || dice.length === 0 || legalMoves(board, me, dice).length === 0
    if (!done) return
    sentFor.current = remote.version
    void remote.send({ type: 'moves', moves: pending }).then((ok) => {
      if (!ok) {
        sentFor.current = -1
        setPending([])
      }
    })
  }, [myMove, pending, board, dice, me, remote])

  const rollKey = remote.version * 10 + (s.phase === 'move' ? 1 : 0)
  const highlight = new Set(s.lastMoves.map((m) => (typeof m.to === 'number' ? m.to : -1)))
  const oppName = remote.names[remote.seat === 0 ? 1 : 0] || 'Rakip'

  let message: string
  if (s.note && !remote.myTurn) message = s.note
  else if (remote.myTurn && s.phase === 'roll') message = s.note ? `${s.note}. Sıra sende, zarı at.` : 'Sıra sende, zarı at.'
  else if (myMove) message = dice.length === 4 ? `Çift ${dice[0]}! Dört hamle hakkın var.` : 'Pulunu seç ve oyna.'
  else message = `${oppName} oynuyor...`

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <TavlaBoard
        board={board}
        me={me}
        legal={legal}
        selected={selected}
        onSelect={setSelected}
        onPlay={(m) => {
          setPending((p) => [...p, m])
          setSelected(null)
        }}
        rolled={s.rolled}
        dice={s.phase === 'move' ? dice : []}
        rollKey={rollKey}
        highlight={highlight}
        names={{ me: 'Sen', opp: oppName }}
        turn={remote.myTurn ? 'me' : 'opp'}
      />
      <ControlBar
        message={message}
        sub={`Kalan yol: sen ${pipCount(board, me)} · ${oppName} ${pipCount(board, opp)}`}
        canUndo={myMove && pending.length > 0 && !remote.busy}
        onUndo={() => setPending([])}
        canRoll={remote.myTurn && s.phase === 'roll' && !remote.busy}
        onRoll={() => void remote.send({ type: 'roll' })}
        rollLabel={remote.myTurn ? 'Zar at' : 'Rakip oynuyor'}
      />
    </div>
  )
}
