'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dices, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GameApi } from './stake-gate'
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
  type To,
} from './tavla-engine'

type Phase = 'roll' | 'move' | 'bot' | 'over'

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

export function Die({ value, used, small }: { value: number; used?: boolean; small?: boolean }) {
  return (
    <span
      role="img"
      aria-label={`Zar ${value}${used ? ', oynandı' : ''}`}
      className={cn(
        'grid grid-cols-3 grid-rows-3 gap-0.5 rounded-lg bg-checker-light p-1.5 shadow-md transition-opacity',
        small ? 'size-8' : 'size-11',
        used && 'opacity-30',
      )}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="flex items-center justify-center">
          {PIPS[value].includes(i) && <span className={cn('rounded-full bg-checker-dark', small ? 'size-1.5' : 'size-2')} />}
        </span>
      ))}
    </span>
  )
}

function Checker({ side, label, glow }: { side: 'p' | 'b'; label?: string; glow?: boolean }) {
  return (
    <span
      className={cn(
        'relative flex aspect-square w-full max-w-11 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold shadow-[inset_0_-3px_0_rgb(0_0_0/0.25)]',
        side === 'p' ? 'border-point-a bg-checker-light text-checker-dark' : 'border-primary/70 bg-checker-dark text-primary',
        glow && 'ring-2 ring-primary ring-offset-1 ring-offset-felt',
      )}
    >
      {label}
    </span>
  )
}

function Stack({ count, side, top, glow }: { count: number; side: 'p' | 'b'; top: boolean; glow: boolean }) {
  const visible = Math.min(count, 5)
  return (
    <div className={cn('flex h-full w-full flex-col items-center gap-0.5', !top && 'flex-col-reverse')}>
      {Array.from({ length: visible }).map((_, i) => (
        <Checker key={i} side={side} glow={glow && i === visible - 1} label={i === visible - 1 && count > 5 ? String(count) : undefined} />
      ))}
    </div>
  )
}

export function Tavla({ finish }: GameApi) {
  const [board, setBoard] = useState<Board>(initialBoard)
  const [dice, setDice] = useState<number[]>([])
  const [rolled, setRolled] = useState<number[]>([])
  const [phase, setPhase] = useState<Phase>('roll')
  const [selected, setSelected] = useState<From | null>(null)
  const [snapshot, setSnapshot] = useState<{ board: Board; dice: number[] } | null>(null)
  const [message, setMessage] = useState('Sıra sende. Zarı at kanka.')
  const [lastBot, setLastBot] = useState<Move[]>([])

  const legal = useMemo(() => (phase === 'move' ? legalMoves(board, 'p', dice) : []), [board, dice, phase])
  const sources = useMemo(() => new Set(legal.map((m) => m.from)), [legal])
  const targets = useMemo(() => legal.filter((m) => m.from === selected), [legal, selected])

  function endGame(b: Board) {
    if (b.off.p === 15) {
      setPhase('over')
      setMessage('Tüm pulları topladın!')
      setTimeout(() => finish('win', b.off.b === 0 ? 'Mars! Rakip tek pul bile toplayamadı.' : 'Tüm pulları rakibinden önce topladın.'), 900)
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

  function roll() {
    const d = rollDice()
    setRolled(d)
    setDice(d)
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

  function clickSource(from: From) {
    if (phase !== 'move') return
    if (selected === from) return setSelected(null)
    if (sources.has(from)) setSelected(from)
  }

  function clickTarget(to: To) {
    const m = targets.find((t) => t.to === to)
    if (m) play(m)
  }

  function clickPoint(i: number) {
    if (targets.some((t) => t.to === i)) return clickTarget(i)
    clickSource(i)
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
        setRolled(d)
        setDice(d)
        const plan = botPlan(board, d)
        if (!plan.length) {
          setMessage(`Rakip ${d.slice(0, 2).join(' - ')} attı, hamle yok. Sıra sende.`)
          timers.push(
            setTimeout(() => {
              setDice([])
              setPhase('roll')
            }, 1100),
          )
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
            }, 650 * (idx + 1)),
          )
        })
      }, 800),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

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

  const botTouched = new Set(lastBot.map((m) => m.to))
  const top = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
  const bottom = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]

  const renderPoint = (i: number, isTop: boolean) => {
    const v = board.pts[i]
    const side = v > 0 ? 'p' : 'b'
    const isTarget = targets.some((t) => t.to === i)
    const isSource = sources.has(i)
    return (
      <button
        key={i}
        type="button"
        onClick={() => clickPoint(i)}
        aria-label={`Hane ${i + 1}${v ? `, ${Math.abs(v)} ${v > 0 ? 'senin' : 'rakip'} pulu` : ', boş'}${isTarget ? ', buraya oynanabilir' : ''}`}
        className={cn('relative flex h-full min-w-0 flex-1 flex-col items-center px-0.5 outline-none', isTop ? 'justify-start' : 'justify-end')}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-x-0.5 h-[88%] transition-opacity',
            isTop ? 'top-0' : 'bottom-0',
            i % 2 === 0 ? 'bg-point-a' : 'bg-point-b',
            isTarget && 'bg-primary',
            !isTarget && 'opacity-90',
          )}
          style={{ clipPath: isTop ? 'polygon(0 0, 100% 0, 50% 100%)' : 'polygon(50% 0, 100% 100%, 0 100%)' }}
        />
        {isTarget && <span aria-hidden="true" className="absolute inset-x-1 bottom-1/2 top-1/2 z-10 m-auto size-3 animate-pulse rounded-full bg-primary" />}
        <span className="relative z-10 flex h-full w-full flex-col py-1">
          {v !== 0 && <Stack count={Math.abs(v)} side={side} top={isTop} glow={(isSource && selected === i) || (side === 'b' && botTouched.has(i))} />}
        </span>
        {isSource && selected !== i && <span aria-hidden="true" className={cn('absolute z-20 h-1 w-1/2 rounded-full bg-primary', isTop ? '-bottom-1' : '-top-1')} />}
        <span className={cn('absolute z-20 text-[9px] font-semibold text-muted-foreground', isTop ? '-top-4' : '-bottom-4')}>{i + 1}</span>
      </button>
    )
  }

  const barSelectable = sources.has('bar')
  const offTarget = targets.some((t) => t.to === 'off')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-2xl bg-wood p-2 shadow-xl sm:p-3">
        <div className="flex aspect-[16/11] w-full gap-1.5 sm:gap-2">
          <div className="flex flex-1 flex-col justify-between rounded-lg bg-felt px-1 py-5 sm:px-2">
            <div className="flex h-[44%] gap-0">{top.slice(0, 6).map((i) => renderPoint(i, true))}</div>
            <div className="flex h-[44%] gap-0">{bottom.slice(0, 6).map((i) => renderPoint(i, false))}</div>
          </div>

          <button
            type="button"
            onClick={() => clickSource('bar')}
            disabled={!barSelectable}
            aria-label={`Kırık pullar: sen ${board.bar.p}, rakip ${board.bar.b}`}
            className={cn('flex w-8 flex-col items-center justify-between rounded-md bg-wood py-3 sm:w-12', barSelectable && 'ring-2 ring-primary', selected === 'bar' && 'bg-primary/30')}
          >
            <span className="flex w-full flex-col items-center gap-0.5 px-0.5">
              {Array.from({ length: Math.min(board.bar.p, 4) }).map((_, i) => (
                <Checker key={i} side="p" label={i === 0 && board.bar.p > 4 ? String(board.bar.p) : undefined} />
              ))}
            </span>
            <span className="flex w-full flex-col-reverse items-center gap-0.5 px-0.5">
              {Array.from({ length: Math.min(board.bar.b, 4) }).map((_, i) => (
                <Checker key={i} side="b" label={i === 0 && board.bar.b > 4 ? String(board.bar.b) : undefined} />
              ))}
            </span>
          </button>

          <div className="flex flex-1 flex-col justify-between rounded-lg bg-felt px-1 py-5 sm:px-2">
            <div className="flex h-[44%] gap-0">{top.slice(6).map((i) => renderPoint(i, true))}</div>
            <div className="flex h-[44%] gap-0">{bottom.slice(6).map((i) => renderPoint(i, false))}</div>
          </div>

          <div className="flex w-9 flex-col justify-between gap-2 sm:w-14">
            <div className="flex flex-1 flex-col items-center gap-1 rounded-md bg-felt/70 p-1 text-center">
              <span className="text-[9px] font-bold uppercase text-muted-foreground">Rakip</span>
              <span className="font-display text-lg font-bold text-primary">{board.off.b}</span>
            </div>
            <button
              type="button"
              onClick={() => clickTarget('off')}
              disabled={!offTarget}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 rounded-md bg-felt/70 p-1 text-center',
                offTarget && 'animate-pulse bg-primary/40 ring-2 ring-primary',
              )}
              aria-label={`Toplanan pulların: ${board.off.p}${offTarget ? ', pulu topla' : ''}`}
            >
              <span className="text-[9px] font-bold uppercase text-muted-foreground">Sen</span>
              <span className="font-display text-lg font-bold text-foreground">{board.off.p}</span>
              {offTarget && <span className="text-[9px] font-bold uppercase text-primary">Topla</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {rolled.length ? rolled.map((d, i) => <Die key={i} value={d} used={usedFlags[i]} />) : <Die value={6} used />}
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-semibold text-foreground" aria-live="polite">
              {message}
            </p>
            <p className="text-xs text-muted-foreground">
              Kalan yol: sen {pipCount(board, 'p')} · rakip {pipCount(board, 'b')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {phase === 'move' && snapshot && (
            <button onClick={undo} className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary">
              <Undo2 className="size-4" aria-hidden="true" />
              Geri al
            </button>
          )}
          <button
            onClick={roll}
            disabled={phase !== 'roll'}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 disabled:opacity-40"
          >
            <Dices className="size-4" aria-hidden="true" />
            {phase === 'bot' ? 'Rakip oynuyor' : 'Zar at'}
          </button>
        </div>
      </div>
    </div>
  )
}
