'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check, Dices, Flag, Undo2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TavlaState } from '@/lib/pvp/rules'
import type { GameApi } from './stake-gate'
import { loadSaved, useSaveGame } from './saved-game'
import type { Remote } from './remote'
import { BrandLogo } from '../logo-selector'
import { TableBrand } from './table-brand'
import { playSound } from '@/lib/sound'
import {
  applyMove,
  botPlan,
  initialBoard,
  legalMoves,
  openingRoll,
  pipCount,
  rollDice,
  routesFrom,
  spendDie,
  winKind,
  WIN_LABEL,
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

export function Die({
  value,
  used,
  small,
  fill,
  className,
  style,
}: {
  value: number
  used?: boolean
  small?: boolean
  fill?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      role="img"
      style={style}
      aria-label={`Zar ${value}${used ? ', oynandı' : ''}`}
      className={cn(
        'grid grid-cols-3 grid-rows-3 gap-0.5 rounded-lg bg-checker-light p-1 shadow-[0_6px_14px_rgb(0_0_0/0.45)] transition-opacity sm:p-1.5',
        fill ? 'aspect-square h-full' : small ? 'size-8' : 'size-8 sm:size-12',
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

export const DOUBLE_NAMES: Record<number, string> = { 1: 'Hepyek', 2: 'Dubara', 3: 'Dü se', 4: 'Dört cihar', 5: 'Dübeş', 6: 'Düşeş' }

/**
 * Throws the dice whenever `rollKey` changes: faces flicker while they tumble across the felt,
 * then they land with a knock. `landed` flips on at touchdown so the board can celebrate doubles.
 */
function useRollAnimation(rolled: number[], rollKey: number) {
  const [faces, setFaces] = useState<number[] | null>(null)
  const [landed, setLanded] = useState(0)
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
      if (n > 11) {
        clearInterval(id)
        setFaces(null)
        setLanded(rollKey)
        playSound('chip')
        if (typeof navigator !== 'undefined') navigator.vibrate?.(25)
      }
    }, 75)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey])
  return { faces, landed }
}

function Checker({ side, label, glow, hint, pulse }: { side: Side; label?: string; glow?: boolean; hint?: boolean; pulse?: boolean }) {
  return (
    <span
      data-checker
      className={cn(
        'relative flex aspect-square w-full max-w-11 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-transform duration-200 sm:max-w-14 sm:text-xs',
        side === 'p' ? 'checker-light-3d text-checker-dark' : 'checker-dark-3d text-primary',
        glow && 'z-10 -translate-y-0.5 scale-110 ring-[3px] ring-primary ring-offset-2 ring-offset-felt',
        !glow && hint && 'z-10 ring-2 ring-primary/80 shadow-[0_0_14px_2px_var(--primary)]',
        pulse && 'animate-pulse ring-2 ring-destructive',
      )}
    >
      {label}
    </span>
  )
}

/** Borne-off checkers drawn edge-on, like a real tray; each new one drops in. */
function OffPile({ count, side, fromTop }: { count: number; side: Side; fromTop?: boolean }) {
  return (
    <span className={cn('flex w-full flex-1 gap-px px-0.5', fromTop ? 'flex-col' : 'flex-col-reverse')} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-full shrink-0 rounded-[3px] animate-in fade-in duration-300 sm:h-2',
            fromTop ? 'slide-in-from-bottom-3' : 'slide-in-from-top-3',
            side === 'p'
              ? 'bg-checker-light shadow-[inset_0_-1px_0_rgb(0_0_0/0.25),0_1px_1px_rgb(0_0_0/0.5)]'
              : 'bg-checker-dark shadow-[inset_0_1px_0_color-mix(in_oklch,var(--primary)_45%,transparent),0_1px_1px_rgb(0_0_0/0.5)]',
          )}
        />
      ))}
    </span>
  )
}

function Stack({
  count,
  side,
  top,
  glow,
  hint,
  lifted,
}: {
  count: number
  side: Side
  top: boolean
  glow: boolean
  hint?: boolean
  lifted?: boolean
}) {
  const visible = Math.min(count, 5)
  return (
    <div className={cn('flex h-full w-full flex-col items-center gap-px sm:gap-0.5', !top && 'flex-col-reverse')}>
      {Array.from({ length: visible }).map((_, i) => {
        const isTopChecker = i === visible - 1
        return (
          <span key={i} className={cn('flex w-full justify-center', lifted && isTopChecker && 'opacity-30')}>
            <Checker
              side={side}
              glow={glow && isTopChecker && !lifted}
              hint={hint && isTopChecker && !lifted}
              label={isTopChecker && count > 5 ? String(count) : undefined}
            />
          </span>
        )
      })}
    </div>
  )
}

type Fly = { key: number; moves: Move[]; side: Side }

type BoardProps = {
  board: Board
  me: Side
  legal: Move[]
  selected: From | null
  onSelect: (from: From | null) => void
  onPlay: (seq: Move[]) => void
  rolled: number[]
  dice: number[]
  rollKey: number
  highlight: Set<number>
  names: { me: string; opp: string }
  turn: 'me' | 'opp' | null
  /** Points the opponent's last checkers left from, drawn as a faint trail. */
  trail?: Set<number>
  /** Changing `key` animates the given moves sliding across the board. */
  fly?: Fly | null
}

function TavlaBoard({ board, me, legal, selected, onSelect, onPlay, rolled, dice, rollKey, highlight, names, turn, trail, fly }: BoardProps) {
  const opp: Side = me === 'p' ? 'b' : 'p'
  const sources = useMemo(() => new Set(legal.map((m) => m.from)), [legal])
  const rootRef = useRef<HTMLDivElement>(null)

  function anchor(spot: From | To, side: Side, size: number) {
    const root = rootRef.current
    if (!root) return null
    const sel =
      spot === 'bar' ? '[data-bar]' : spot === 'off' ? `[data-off="${side === me ? 'me' : 'opp'}"]` : `[data-drop="${spot}"]`
    const el = root.querySelector<HTMLElement>(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2
    if (spot === 'bar') return { x, y: side === me ? r.bottom - size : r.top + size }
    if (spot === 'off') return { x, y: r.top + r.height / 2 }
    return { x, y: el.dataset.top === '1' ? r.top + size * 0.9 : r.bottom - size * 0.9 }
  }

  function animate(moves: Move[], side: Side) {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const size = rootRef.current?.querySelector<HTMLElement>('[data-checker]')?.getBoundingClientRect().width ?? 32
    moves.forEach((m, idx) => {
      const a = anchor(m.from, side, size)
      const b = anchor(m.to, side, size)
      if (!a || !b) return
      const el = document.createElement('span')
      el.setAttribute('aria-hidden', 'true')
      el.className = cn('pointer-events-none fixed left-0 top-0 z-[90] rounded-full', side === 'p' ? 'checker-light-3d' : 'checker-dark-3d')
      el.style.width = `${size}px`
      el.style.height = `${size}px`
      document.body.appendChild(el)
      const at = (p: { x: number; y: number }) => `translate(${p.x - size / 2}px, ${p.y - size / 2}px)`
      const anim = el.animate(
        [
          { transform: `${at(a)} scale(1.1)`, opacity: 1 },
          { transform: `${at(b)} scale(1)`, opacity: 1, offset: 0.85 },
          { transform: `${at(b)} scale(1)`, opacity: 0 },
        ],
        { duration: 460, delay: idx * 280, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'both' },
      )
      anim.onfinish = () => el.remove()
      anim.oncancel = () => el.remove()
    })
  }

  useEffect(() => {
    if (fly?.moves.length) animate(fly.moves, fly.side)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fly?.key])

  // A hit checker must re-enter first, so open the entry points right away.
  const mustEnter = sources.has('bar')
  useEffect(() => {
    if (mustEnter && selected == null) onSelect('bar')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustEnter, selected])

  function playClick(seq: Move[]) {
    animate(seq, me)
    onPlay(seq)
  }
  const routes = useMemo(
    () => (selected != null && sources.has(selected) ? routesFrom(board, me, dice, selected) : new Map<To, Move[]>()),
    [board, me, dice, selected, sources],
  )
  const { faces, landed } = useRollAnimation(rolled, rollKey)

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

  const drag = useRef<{ from: From; x: number; y: number; active: boolean } | null>(null)
  const suppressClick = useRef(false)
  const [ghost, setGhost] = useState<{ x: number; y: number; from: From } | null>(null)
  const [hover, setHover] = useState<To | null>(null)

  function dropAt(x: number, y: number): To | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]')
    const v = el?.dataset.drop
    if (v == null) return null
    return v === 'off' ? 'off' : Number(v)
  }

  function startDrag(e: React.PointerEvent, from: From) {
    if (!sources.has(from) || e.button !== 0) return
    drag.current = { from, x: e.clientX, y: e.clientY, active: false }
    const dragRoutes = routesFrom(board, me, dice, from)
    const onMove = (ev: PointerEvent) => {
      const d = drag.current
      if (!d) return
      if (!d.active) {
        if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 6) return
        d.active = true
        onSelect(d.from)
      }
      ev.preventDefault()
      setGhost({ x: ev.clientX, y: ev.clientY, from: d.from })
      setHover(dropAt(ev.clientX, ev.clientY))
    }
    const finish = (ev: PointerEvent, cancelled: boolean) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      const d = drag.current
      drag.current = null
      setGhost(null)
      setHover(null)
      if (!d?.active) return
      suppressClick.current = true
      setTimeout(() => (suppressClick.current = false), 0)
      if (cancelled) return
      const to = dropAt(ev.clientX, ev.clientY)
      const seq = to == null ? undefined : dragRoutes.get(to)
      if (seq) onPlay(seq)
    }
    const onUp = (ev: PointerEvent) => finish(ev, false)
    const onCancel = (ev: PointerEvent) => finish(ev, true)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  function clickPoint(i: number) {
    if (suppressClick.current) return
    const seq = routes.get(i)
    if (seq) return playClick(seq)
    if (selected === i) return onSelect(null)
    if (sources.has(i)) onSelect(i)
  }

  const renderPoint = (visual: number, isTop: boolean) => {
    const i = real(visual)
    const v = board.pts[i]
    const side: Side = v > 0 ? 'p' : 'b'
    const steps = routes.get(i)?.length ?? 0
    const isTarget = steps > 0
    const isSource = sources.has(i)
    const mine = side === me
    const label = me === 'p' ? i + 1 : 24 - i
    return (
      <button
        key={visual}
        type="button"
        data-drop={i}
        data-top={isTop ? '1' : '0'}
        onClick={() => clickPoint(i)}
        onPointerDown={(e) => startDrag(e, i)}
        aria-label={`Hane ${label}${v ? `, ${Math.abs(v)} ${mine ? 'senin' : 'rakip'} pulu` : ', boş'}${isTarget ? ', buraya oynanabilir' : ''}`}
        className={cn(
          'relative flex h-full min-w-0 flex-1 flex-col items-center px-px outline-none sm:px-0.5',
          isTop ? 'justify-start' : 'justify-end',
          isSource && 'cursor-grab touch-none',
          ghost && 'cursor-grabbing',
        )}
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
              'absolute inset-x-0 z-20 m-auto flex size-5 items-center justify-center rounded-full border-2 border-primary bg-primary/30 transition-transform sm:size-7',
              isTop ? 'bottom-[12%]' : 'top-[12%]',
              hover === i && 'scale-150 bg-primary/60',
            )}
          >
            {steps > 1 ? (
              <span className="text-[9px] font-black text-primary-foreground sm:text-[11px]">{`×${steps}`}</span>
            ) : (
              <span className="size-2 animate-ping rounded-full bg-primary" />
            )}
          </span>
        )}
        <span className="relative z-10 flex h-full w-full flex-col py-0.5 sm:py-1">
          {v !== 0 && (
            <Stack
              count={Math.abs(v)}
              side={side}
              top={isTop}
              glow={(isSource && selected === i) || (!mine && highlight.has(i))}
              hint={isSource && selected !== i}
              lifted={ghost?.from === i}
            />
          )}
        </span>
        {trail?.has(i) && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-x-0 z-10 m-auto aspect-square w-[70%] max-w-12 rounded-full border-2 border-dashed border-primary/70',
              isTop ? (v === 0 ? 'top-1' : 'bottom-[14%]') : v === 0 ? 'bottom-1' : 'top-[14%]',
            )}
          />
        )}
        <span
          className={cn(
            'absolute z-20 text-[9px] font-bold tabular-nums text-foreground/70 sm:text-xs',
            isTop ? '-top-3.5 sm:-top-5' : '-bottom-3.5 sm:-bottom-5',
          )}
        >
          {label}
        </span>
      </button>
    )
  }

  const barSelectable = sources.has('bar')
  const offTarget = routes.get('off')
  const shown = faces ?? rolled.slice(0, rolled.length === 4 ? 4 : 2)
  // Dice sit in the empty middle band of the roller's own half so they never cover a stack.
  const diceLeft = turn === 'opp'
  const isDouble = rolled.length >= 2 && rolled[0] === rolled[1]
  const celebrate = !faces && isDouble && landed === rollKey && rollKey > 0
  const diceRow = shown.length > 0 && (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex h-[15%] -translate-y-1/2 items-center justify-center gap-2 sm:gap-4">
      {shown.map((d, i) => (
        <Die
          key={`${rollKey}-${i}`}
          fill
          value={d}
          used={!faces && usedFlags[i]}
          className={cn(
            faces ? (diceLeft ? 'die-throw-left' : 'die-throw-right') : landed === rollKey && rollKey > 0 && 'die-land',
            celebrate && 'ring-[3px] ring-gold shadow-[0_0_22px_2px_var(--gold)]',
          )}
          style={faces ? { animationDelay: `${i * 70}ms` } : undefined}
        />
      ))}
      {celebrate && (
        <span
          key={`dbl-${rollKey}`}
          className="die-banner absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-3 py-1 text-sm font-black uppercase tracking-wider text-gold-foreground shadow-lg sm:-top-11 sm:text-base"
        >
          {DOUBLE_NAMES[rolled[0]]}!
        </span>
      )}
    </div>
  )

  return (
    <div ref={rootRef} className="flex select-none flex-col gap-2">
      {ghost &&
        createPortal(
          <span
            aria-hidden="true"
            className="pointer-events-none fixed z-[100] flex w-10 -translate-x-1/2 -translate-y-1/2 scale-110 drop-shadow-[0_10px_14px_rgb(0_0_0/0.55)] sm:w-12"
            style={{ left: ghost.x, top: ghost.y }}
          >
            <Checker side={me} />
          </span>,
          document.body,
        )}
      <TurnIndicator turn={turn} me={names.me} opp={names.opp} />
      <div className="tavla-wood relative rounded-2xl p-1.5 sm:p-3">
      <TableBrand center={false} corners={false} jako={false} />
      <div className="flex aspect-[16/12] w-full gap-1 sm:aspect-[16/11] sm:gap-2">
        <div className="tavla-felt relative flex flex-1 flex-col justify-between rounded-lg px-0.5 py-4 sm:px-2 sm:py-6">
          <div className="flex h-[42%]">{topRow.slice(0, 6).map((v) => renderPoint(v, true))}</div>
          {diceLeft ? (
            diceRow
          ) : (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25">
              <span className="scale-75 sm:scale-100">
                <BrandLogo size="sm" />
              </span>
            </div>
          )}
          <div className="flex h-[42%]">{bottomRow.slice(0, 6).map((v) => renderPoint(v, false))}</div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (suppressClick.current) return
            if (selected === 'bar') onSelect(null)
            else if (barSelectable) onSelect('bar')
          }}
          onPointerDown={(e) => startDrag(e, 'bar')}
          disabled={!barSelectable}
          data-bar
          aria-label={`Kırık pullar: sen ${board.bar[me]}, rakip ${board.bar[opp]}`}
          className={cn(
            'flex w-6 flex-col items-center justify-between rounded-md bg-wood py-2 sm:w-14 sm:py-3',
            barSelectable && 'cursor-grab touch-none ring-2 ring-primary',
            selected === 'bar' && 'bg-primary/30',
          )}
        >
          <span className="flex w-full flex-col items-center gap-0.5 px-px">
            {Array.from({ length: Math.min(board.bar[opp], 4) }).map((_, i) => (
              <Checker key={i} side={opp} label={i === 0 && board.bar[opp] > 4 ? String(board.bar[opp]) : undefined} />
            ))}
          </span>
          <span className="flex w-full flex-col-reverse items-center gap-0.5 px-px">
            {Array.from({ length: Math.min(board.bar[me], 4) }).map((_, i) => (
              <Checker
                key={i}
                side={me}
                pulse={barSelectable && i === 0}
                label={i === 0 && board.bar[me] > 4 ? String(board.bar[me]) : undefined}
              />
            ))}
          </span>
        </button>

        <div className="tavla-felt relative flex flex-1 flex-col justify-between rounded-lg px-0.5 py-4 sm:px-2 sm:py-6">
          <div className="flex h-[42%]">{topRow.slice(6).map((v) => renderPoint(v, true))}</div>
          {!diceLeft && diceRow}
          <div className="flex h-[42%]">{bottomRow.slice(6).map((v) => renderPoint(v, false))}</div>
        </div>

        <div className="flex w-8 flex-col justify-between gap-1.5 sm:w-16 sm:gap-2">
          <div
            data-off="opp"
            className="flex flex-1 flex-col items-center gap-1 rounded-md bg-felt/70 p-0.5 text-center shadow-[inset_0_2px_6px_rgb(0_0_0/0.5)]"
            aria-label={`${names.opp} toplanan pullar: ${board.off[opp]}`}
          >
            <span className="line-clamp-1 text-[8px] font-bold uppercase text-muted-foreground sm:text-[9px]">
              {names.opp} <span className="text-primary">{board.off[opp]}</span>
            </span>
            <OffPile count={board.off[opp]} side={opp} fromTop />
          </div>
          <button
            type="button"
            data-drop="off"
            data-off="me"
            onClick={() => !suppressClick.current && offTarget && playClick(offTarget)}
            disabled={!offTarget}
            className={cn(
              'flex flex-1 flex-col-reverse items-center gap-1 rounded-md bg-felt/70 p-0.5 text-center shadow-[inset_0_2px_6px_rgb(0_0_0/0.5)] transition-transform',
              offTarget && 'bg-primary/30 ring-2 ring-primary',
              hover === 'off' && 'scale-105 bg-primary/60',
            )}
            aria-label={`Toplanan pulların: ${board.off[me]}${offTarget ? ', pulu topla' : ''}`}
          >
            <span className="text-[8px] font-bold uppercase text-muted-foreground sm:text-[9px]">
              Sen <span className="text-foreground">{board.off[me]}</span>
            </span>
            {offTarget && <span className="animate-pulse text-[8px] font-bold uppercase text-primary sm:text-[9px]">Topla</span>}
            <OffPile count={board.off[me]} side={me} />
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
          'flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2 py-2 transition-all sm:px-3',
          who === 'opp' && 'flex-row-reverse text-right',
          active ? 'border-primary bg-primary/15 shadow-[0_0_18px_-4px_var(--primary)]' : 'border-border bg-card opacity-70',
        )}
      >
        <span aria-hidden="true" className={cn('size-5 shrink-0 rounded-full', side === 'light' ? 'checker-light-3d' : 'checker-dark-3d')} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{name}</span>
        {active && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary p-1.5 text-[10px] font-bold uppercase text-primary-foreground sm:px-2 sm:py-0.5">
            <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" />
            <span className="hidden sm:inline">Sırada</span>
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
  onConfirm,
  auto,
  onAuto,
  onResign,
}: {
  message: string
  sub: string
  canUndo: boolean
  onUndo: () => void
  canRoll: boolean
  onRoll: () => void
  rollLabel: string
  onConfirm?: () => void
  auto: boolean
  onAuto: (v: boolean) => void
  onResign?: () => void
}) {
  const [arming, setArming] = useState(false)
  useEffect(() => {
    if (!arming) return
    const t = setTimeout(() => setArming(false), 3000)
    return () => clearTimeout(t)
  }, [arming])

  return (
    <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex min-w-0 flex-col">
        <p className="text-sm font-semibold text-foreground" aria-live="polite">
          {message}
        </p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={auto}
          onClick={() => onAuto(!auto)}
          title="Zarı kendiliğinden atar, tek seçenek varsa hamleyi oynar"
          className={cn(
            'flex items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition-colors',
            auto ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:bg-secondary',
          )}
        >
          <Zap className="size-4" aria-hidden="true" />
          Otomatik
        </button>
        {onResign && (
          <button
            type="button"
            onClick={() => (arming ? (setArming(false), onResign()) : setArming(true))}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition-colors',
              arming ? 'border-destructive bg-destructive/15 text-destructive' : 'border-border text-muted-foreground hover:bg-secondary',
            )}
          >
            <Flag className="size-4" aria-hidden="true" />
            {arming ? 'Emin misin?' : 'Pes et'}
          </button>
        )}
        {canUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary sm:flex-none"
          >
            <Undo2 className="size-4" aria-hidden="true" />
            Geri al
          </button>
        )}
        {onConfirm ? (
          <button
            type="button"
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 sm:flex-none"
          >
            <Check className="size-4" aria-hidden="true" />
            Hamleyi onayla
          </button>
        ) : (
          <button
            type="button"
            onClick={onRoll}
            disabled={!canRoll}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:brightness-110 disabled:opacity-40 sm:flex-none"
          >
            <Dices className="size-4" aria-hidden="true" />
            {rollLabel}
          </button>
        )}
      </div>
    </div>
  )
}

const AUTO_KEY = 'alkanka-tavla-auto'

/** Remembers the auto-play preference on this device; it only changes how the player's own UI behaves. */
function useAutoPlay() {
  const [auto, setAuto] = useState(false)
  useEffect(() => {
    setAuto(window.localStorage.getItem(AUTO_KEY) === '1')
  }, [])
  const update = (v: boolean) => {
    setAuto(v)
    window.localStorage.setItem(AUTO_KEY, v ? '1' : '0')
  }
  return [auto, update] as const
}

/** The single move to play when every legal option lands the same checker on the same point. */
function onlyMove(legal: Move[]): Move | null {
  if (!legal.length) return null
  const first = legal[0]
  return legal.every((m) => m.from === first.from && m.to === first.to) ? first : null
}

function moveTrail(moves: Move[]) {
  return new Set(moves.map((m) => (typeof m.from === 'number' ? m.from : -1)))
}

type Phase = 'roll' | 'move' | 'confirm' | 'bot' | 'over'

type TavlaSave = { board: Board; dice: number[]; rolled: number[]; phase: Phase; snapshot: { board: Board; dice: number[] } | null; message: string }

type Opening = { mine: number; theirs: number }

export function Tavla({ finish, saveKey }: GameApi) {
  const [saved] = useState(() => loadSaved<TavlaSave>(saveKey))
  const [opening] = useState<Opening | null>(() => {
    if (saved) return null
    const [mine, theirs] = openingRoll()
    return { mine, theirs }
  })
  const playerOpens = !!opening && opening.mine > opening.theirs
  const openDice = opening ? [Math.max(opening.mine, opening.theirs), Math.min(opening.mine, opening.theirs)] : []

  const [board, setBoard] = useState<Board>(saved?.board ?? initialBoard)
  const [dice, setDice] = useState<number[]>(saved?.dice ?? (playerOpens ? openDice : []))
  const [rolled, setRolled] = useState<number[]>(saved?.rolled ?? (opening ? [opening.mine, opening.theirs] : []))
  const [rollKey, setRollKey] = useState(0)
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? (opening ? (playerOpens ? 'move' : 'bot') : 'roll'))
  const [selected, setSelected] = useState<From | null>(null)
  const [snapshot, setSnapshot] = useState<{ board: Board; dice: number[] } | null>(
    saved?.snapshot ?? (playerOpens ? { board: initialBoard(), dice: openDice } : null),
  )
  const [message, setMessage] = useState(
    saved?.message ??
      (opening
        ? `Başlangıç zarı: sen ${opening.mine}, rakip ${opening.theirs}. ${playerOpens ? 'Sen başlıyorsun, bu iki zarı oyna.' : 'Rakip başlıyor.'}`
        : 'Sıra sende. Zarı at kanka.'),
  )
  const [lastBot, setLastBot] = useState<Move[]>([])
  const [fly, setFly] = useState<Fly | null>(null)
  const [auto, setAuto] = useAutoPlay()
  const botOpening = useRef<number[] | null>(opening && !playerOpens ? openDice : null)
  const botStart = useRef<Board | null>(null)
  if (phase === 'bot' && !botStart.current) botStart.current = board
  if (phase !== 'bot') botStart.current = null

  useSaveGame(
    saveKey,
    phase === 'over'
      ? null
      : phase === 'bot'
        ? { board: botStart.current ?? board, dice: [], rolled, phase, snapshot: null, message: 'Rakip oynuyor...' }
        : { board, dice, rolled, phase, snapshot, message },
  )

  const legal = useMemo(() => (phase === 'move' ? legalMoves(board, 'p', dice) : []), [board, dice, phase])

  function endGame(b: Board) {
    if (b.off.p === 15) {
      setPhase('over')
      const kind = winKind(b, 'p')
      const text =
        kind === 'agir'
          ? 'AĞIR MARS! Rakibin pulu hâlâ senin evinde ya da kırıkta kaldı.'
          : kind === 'mars'
            ? 'MARS! Rakip tek pul bile toplayamadı.'
            : 'Tüm pulları topladın!'
      setMessage(text)
      setTimeout(
        () =>
          finish('win', kind === 'normal' ? 'Tüm pulları rakibinden önce topladın.' : `${WIN_LABEL[kind]}! Rakip tek pul bile toplayamadan bitirdin.`, {
            for: 15,
            against: b.off.b,
          }),
        900,
      )
      return true
    }
    if (b.off.b === 15) {
      setPhase('over')
      const kind = winKind(b, 'b')
      setMessage(kind === 'normal' ? 'Rakip tüm pulları topladı.' : `Rakip ${WIN_LABEL[kind].toLowerCase()} yaptı.`)
      setTimeout(() => finish('lose', 'Rakip pullarını senden önce topladı.'), 900)
      return true
    }
    return false
  }

  function showRoll(d: number[]) {
    playSound('dice')
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

  function play(seq: Move[]) {
    let next = board
    let left = dice
    for (const m of seq) {
      next = applyMove(next, 'p', m)
      left = spendDie(left, m.die)
    }
    const hit = seq.some((m) => m.hit)
    playSound(hit ? 'hit' : seq.some((m) => m.to === 'off') ? 'bearoff' : 'move')
    setBoard(next)
    setDice(left)
    setSelected(null)
    setLastBot([])
    if (endGame(next)) return
    if (!left.length || !legalMoves(next, 'p', left).length) {
      setMessage(hit ? 'Rakibin pulunu kırdın! Hamleni onayla ya da geri al.' : 'Hamleni bitirdin. Onayla ya da geri al.')
      setPhase('confirm')
    } else if (hit) setMessage('Rakibin pulunu kırdın!')
  }

  function confirm() {
    setMessage('Sıra rakipte.')
    setPhase('bot')
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
    if (!auto) return
    if (phase === 'roll') {
      const t = setTimeout(roll, 650)
      return () => clearTimeout(t)
    }
    if (phase === 'move') {
      const m = onlyMove(legal)
      if (!m) return
      const t = setTimeout(() => {
        setFly({ key: Date.now(), moves: [m], side: 'p' })
        play([m])
      }, 550)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, phase, legal])

  useEffect(() => {
    if (phase !== 'bot') return
    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(
      setTimeout(() => {
        const preset = botOpening.current
        botOpening.current = null
        const d = preset ?? rollDice()
        if (preset) setDice(d)
        else showRoll(d)
        const plan = botPlan(board, d)
        if (!plan.length) {
          setMessage(`Rakip ${d.slice(0, 2).join(' - ')} attı, hamle yok. Sıra sende.`)
          timers.push(setTimeout(() => setPhase('roll'), 1300))
          return
        }
        setMessage(preset ? 'Rakip açılış zarlarını oynuyor...' : `Rakip ${d.slice(0, 2).join(' - ')} attı...`)
        let current = board
        let left = d
        plan.forEach((m, idx) => {
          timers.push(
            setTimeout(() => {
              setFly({ key: Date.now() + idx, moves: [m], side: 'b' })
              current = applyMove(current, 'b', m)
              playSound(m.hit ? 'hit' : m.to === 'off' ? 'bearoff' : 'move')
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
                  }, 600),
                )
              }
            }, 900 + 750 * idx),
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
        trail={moveTrail(lastBot)}
        fly={fly}
        names={{ me: 'Sen', opp: 'Rakip' }}
        turn={phase === 'over' ? null : phase === 'bot' ? 'opp' : 'me'}
      />
      <ControlBar
        message={message}
        sub={`Kalan yol: sen ${pipCount(board, 'p')} · rakip ${pipCount(board, 'b')}`}
        canUndo={(phase === 'move' || phase === 'confirm') && !!snapshot}
        onUndo={undo}
        canRoll={phase === 'roll'}
        onRoll={roll}
        rollLabel={phase === 'bot' ? 'Rakip oynuyor' : 'Zar at'}
        onConfirm={phase === 'confirm' ? confirm : undefined}
        auto={auto}
        onAuto={setAuto}
        onResign={
          phase === 'over'
            ? undefined
            : () => {
                setPhase('over')
                setMessage('Pes ettin.')
                finish('lose', 'Pes ettin.')
              }
        }
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
  const [fly, setFly] = useState<Fly | null>(null)
  const [auto, setAuto] = useAutoPlay()
  const sentFor = useRef(-1)

  useEffect(() => {
    setPending([])
    setSelected(null)
  }, [remote.version])

  // Replay the opponent's checkers sliding into place, and buzz the phone when the turn comes back.
  const oppMoved = remote.myTurn && s.lastMoves.length > 0
  useEffect(() => {
    if (oppMoved) setFly({ key: remote.version, moves: s.lastMoves, side: opp })
    if (remote.myTurn && typeof navigator !== 'undefined') navigator.vibrate?.(60)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const turnDone = myMove && pending.length > 0 && (board.off[me] >= 15 || dice.length === 0 || legalMoves(board, me, dice).length === 0)
  const legal = useMemo(
    () => (myMove && !remote.busy && !turnDone ? legalMoves(board, me, dice) : []),
    [myMove, remote.busy, turnDone, board, me, dice],
  )

  function send() {
    if (sentFor.current === remote.version) return
    sentFor.current = remote.version
    void remote.send({ type: 'moves', moves: pending }).then((ok) => {
      if (!ok) {
        sentFor.current = -1
        setPending([])
      }
    })
  }

  // Finishing the game needs no confirmation; anything else waits for "Hamleyi onayla".
  useEffect(() => {
    if (turnDone && board.off[me] >= 15) send()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnDone])

  useEffect(() => {
    if (!auto || remote.busy || !remote.myTurn) return
    if (s.phase === 'roll') {
      const t = setTimeout(() => void remote.send({ type: 'roll' }), 650)
      return () => clearTimeout(t)
    }
    const m = onlyMove(legal)
    if (!m) return
    const t = setTimeout(() => {
      setFly({ key: Date.now(), moves: [m], side: me })
      setPending((p) => [...p, m])
    }, 550)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, remote.busy, remote.myTurn, s.phase, legal])

  const rollKey = remote.version * 10 + (s.phase === 'move' ? 1 : 0)
  const highlight = new Set(s.lastMoves.map((m) => (typeof m.to === 'number' ? m.to : -1)))
  const oppName = remote.names[remote.seat === 0 ? 1 : 0] || 'Rakip'

  let message: string
  if (s.note && !remote.myTurn) message = s.note
  else if (remote.myTurn && s.phase === 'roll') message = s.note ? `${s.note}. Sıra sende, zarı at.` : 'Sıra sende, zarı at.'
  else if (turnDone) message = 'Hamleni bitirdin. Onayla ya da geri al.'
  else if (myMove) message = dice.length === 4 ? `Çift ${dice[0]}! Dört hamle hakkın var.` : 'Pulunu seç ve oyna.'
  else message = `${oppName} oynuyor...`

  const target = s.target ?? 1
  const score = s.score ?? [0, 0]
  const mySeat = remote.seat === 0 ? 0 : 1
  const series = target > 1 ? ` · Seri ${score[mySeat]}-${score[1 - mySeat]} (hedef ${target})` : ''

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <TavlaBoard
        board={board}
        me={me}
        legal={legal}
        selected={selected}
        onSelect={setSelected}
        onPlay={(seq) => {
          setPending((p) => [...p, ...seq])
          setSelected(null)
        }}
        rolled={s.rolled}
        dice={s.phase === 'move' ? dice : []}
        rollKey={rollKey}
        highlight={highlight}
        trail={remote.myTurn ? moveTrail(s.lastMoves) : undefined}
        fly={fly}
        names={{ me: 'Sen', opp: oppName }}
        turn={remote.myTurn ? 'me' : 'opp'}
      />
      <ControlBar
        message={message}
        sub={`Kalan yol: sen ${pipCount(board, me)} · ${oppName} ${pipCount(board, opp)}${series}`}
        canUndo={myMove && pending.length > 0 && !remote.busy}
        onUndo={() => setPending([])}
        canRoll={remote.myTurn && s.phase === 'roll' && !remote.busy}
        onRoll={() => void remote.send({ type: 'roll' })}
        rollLabel={remote.myTurn ? 'Zar at' : 'Rakip oynuyor'}
        onConfirm={turnDone && !remote.busy ? send : undefined}
        auto={auto}
        onAuto={setAuto}
        onResign={remote.spectator ? undefined : () => void remote.send({ type: 'resign' })}
      />
    </div>
  )
}
