'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ghostTransform } from './okey-rack'
import { COLOR_NAMES, isJoker, type Okey as OkeyValue, type Tile } from './okey-engine'

const TEXT = ['text-tile-red', 'text-tile-black', 'text-tile-blue', 'text-tile-yellow']


export function TileFace({
  tile,
  okey,
  size = 'md',
  selected,
  onClick,
  label,
}: {
  tile: Tile
  okey: OkeyValue
  size?: 'mini' | 'xs' | 'sm' | 'md' | 'fluid'
  selected?: boolean
  onClick?: () => void
  label?: string
}) {
  if (size === 'fluid') return <FluidTile tile={tile} okey={okey} selected={selected} onClick={onClick} label={label} />
  const joker = isJoker(tile, okey)
  const Comp = onClick ? 'button' : 'span'
  const name = tile.fake ? 'Sahte okey' : `${COLOR_NAMES[tile.color]} ${tile.num}${joker ? ' (okey)' : ''}`
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={label ?? name}
      aria-pressed={onClick ? selected : undefined}
      className={cn(
        'okey-tile-face relative flex shrink-0 flex-col items-center justify-start rounded-md shadow-[inset_0_-4px_0_rgb(0_0_0/0.12),0_2px_4px_rgb(0_0_0/0.3)] transition-transform',
        size === 'md'
          ? 'h-16 w-11 pt-1.5 sm:h-[4.5rem] sm:w-12'
          : size === 'xs'
            ? 'h-8 w-6 rounded pt-0.5'
            : size === 'mini'
              ? 'h-7 w-5 rounded-[3px] pt-0.5 shadow-[inset_0_-2px_0_rgb(0_0_0/0.12),0_1px_2px_rgb(0_0_0/0.3)] sm:h-11 sm:w-8 sm:rounded-md sm:pt-1'
              : 'h-11 w-8 pt-1',
        selected && '-translate-y-3 ring-2 ring-primary',
        onClick && 'hover:-translate-y-1',
        joker && 'ring-2 ring-primary/80',
      )}
    >
      {tile.fake ? (
        <Sparkles className={cn('text-tile-black', size === 'md' ? 'mt-2 size-6' : size === 'mini' ? 'mt-0.5 size-3 sm:mt-1 sm:size-4' : 'mt-1 size-4')} aria-hidden="true" />
      ) : (
        <>
          <span
            className={cn(
              'font-display font-bold leading-none',
              TEXT[tile.color],
              size === 'md' ? 'text-2xl' : size === 'xs' ? 'text-sm' : size === 'mini' ? 'text-xs sm:text-base' : 'text-base',
            )}
          >
            {tile.num}
          </span>
          <span
            className={cn(
              'rounded-full',
              size === 'md' ? 'mt-1 size-2.5' : size === 'xs' || size === 'mini' ? 'mt-0.5 size-1' : 'mt-1 size-1.5',
              size === 'mini' && 'sm:mt-1 sm:size-1.5',
              ['bg-tile-red', 'bg-tile-black', 'bg-tile-blue', 'bg-tile-yellow'][tile.color],
            )}
          />
        </>
      )}
      {joker && (
        <span
          className={cn(
            'absolute rounded bg-primary font-bold uppercase text-primary-foreground',
            size === 'mini' ? '-top-1.5 px-0.5 text-[6px] leading-tight sm:-top-2 sm:px-1 sm:text-[8px]' : '-top-2 px-1 text-[8px]',
          )}
        >
          Okey
        </span>
      )}
    </Comp>
  )
}

export function TurnSteps({ phase }: { phase: 'draw' | 'discard' | 'wait' }) {
  const steps = [
    { key: 'draw', label: '1. Taş çek', hint: 'Ortadaki desteye ya da yerdeki taşa dokun' },
    { key: 'discard', label: '2. Taş at', hint: 'Taşa çift dokun ya da "Buraya at" alanına sürükle' },
  ] as const
  return (
    <ol className="grid grid-cols-2 gap-2" aria-label="Hamle adımları">
      {steps.map((s) => {
        const on = phase === s.key
        return (
          <li
            key={s.key}
            aria-current={on ? 'step' : undefined}
            className={cn('flex flex-col rounded-lg border px-3 py-2', on ? 'border-primary bg-primary/15' : 'border-border opacity-60')}
          >
            <span className={cn('text-xs font-bold uppercase tracking-wide', on ? 'text-primary' : 'text-foreground')}>{s.label}</span>
            <span className="hidden text-[11px] text-muted-foreground sm:block">{s.hint}</span>
          </li>
        )
      })}
    </ol>
  )
}

function FluidTile({ tile, okey, selected, onClick, label }: { tile: Tile; okey: OkeyValue; selected?: boolean; onClick?: () => void; label?: string }) {
  const joker = isJoker(tile, okey)
  const name = tile.fake ? 'Sahte okey' : `${COLOR_NAMES[tile.color]} ${tile.num}${joker ? ' (okey)' : ''}`
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? name}
      aria-pressed={selected}
      className={cn(
        'relative block size-full rounded-[13%/9%] [container-type:size]',
        joker ? 'okey-tile-joker' : 'okey-tile-face okey-tile-body',
        selected && 'ring-2 ring-primary',
      )}
    >
      {tile.fake ? (
        <span className="flex size-full items-center justify-center">
          <Sparkles className="size-1/2 text-tile-black" aria-hidden="true" />
        </span>
      ) : (
        <span className="flex size-full flex-col items-center justify-center gap-[4cqh] pb-[3cqh]">
          <span
            className={cn(
              'font-display font-extrabold leading-none tabular-nums',
              tile.num >= 10 ? 'text-[min(38cqh,46cqw)] tracking-[-0.04em]' : 'text-[min(44cqh,62cqw)] tracking-tight',
              TEXT[tile.color],
            )}
          >
            {tile.num}
          </span>
          <span className={cn('aspect-square w-[15cqw] rounded-full', ['bg-tile-red', 'bg-tile-black', 'bg-tile-blue', 'bg-tile-yellow'][tile.color])} />
        </span>
      )}
    </button>
  )
}

export function TileBack({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('tile-back-porcelain h-8 w-6 rounded-sm', className)} />
}

type DrawSource = 'deck' | 'pile'

/**
 * Drag a tile from the deck or the left player's pile onto the rack. Releasing over a rack slot places it there;
 * releasing anywhere a clear distance away still draws, so the player never has to aim precisely.
 */
export function useDrawDrag(onDraw: (src: DrawSource, slot: number | null) => void) {
  const [ghost, setGhost] = useState<{ src: DrawSource; x: number; y: number; w: number; h: number } | null>(null)
  const ghostEl = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)
  const drawRef = useRef(onDraw)
  drawRef.current = onDraw

  const start = (e: ReactPointerEvent, src: DrawSource) => {
    if (e.button !== 0) return
    const sx = e.clientX
    const sy = e.clientY
    const threshold = e.pointerType === 'touch' ? 6 : 10
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const size = src === 'deck' ? { w: box.width * 0.9, h: box.width * 1.26 } : { w: box.width, h: box.height }
    let moved = false
    dragged.current = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < threshold) return
      if (!moved) {
        moved = true
        dragged.current = true
        setGhost({ src, x: ev.clientX, y: ev.clientY, ...size })
      }
      if (ghostEl.current) ghostEl.current.style.transform = ghostTransform(ev.clientX, ev.clientY)
    }
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (!moved) return
      setGhost(null)
      setTimeout(() => (dragged.current = false), 400)
      if (ev.type === 'pointercancel') return
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const slot = el?.closest<HTMLElement>('[data-rack-slot]')
      const far = Math.hypot(ev.clientX - sx, ev.clientY - sy) > 48
      if (slot || el?.closest('[data-rack]') || far) drawRef.current(src, slot ? Number(slot.dataset.rackSlot) : null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  return { ghost, ghostEl, start, dragged }
}
