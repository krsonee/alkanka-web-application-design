'use client'

import { useRef, useState, type PointerEvent } from 'react'
import { MousePointerClick, Move, Pointer, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TileFace } from './okey'
import { isJoker, sortHand, type Okey as OkeyValue, type Tile } from './okey-engine'

export const RACK_COLS = 14
const RACK_SLOTS = RACK_COLS * 2

type Slots = (number | null)[]

function reconcile(raw: Slots, hand: Tile[]): Slots {
  const ids = new Set(hand.map((t) => t.id))
  const slots: Slots = Array.from({ length: RACK_SLOTS }, (_, i) => {
    const id = raw[i]
    return id != null && ids.has(id) ? id : null
  })
  const placed = new Set(slots.filter((id): id is number => id != null))
  for (const t of hand) {
    if (placed.has(t.id)) continue
    const free = slots.indexOf(null)
    if (free < 0) break
    slots[free] = t.id
    placed.add(t.id)
  }
  return slots
}

/** Lays sorted tiles out with a gap between groups so sets are visible, falling back to no gaps when space runs out. */
function layoutSorted(tiles: Tile[], okey: OkeyValue, mode: 'seri' | 'cift'): Slots {
  const joins = (a: Tile, b: Tile) => {
    if (isJoker(a, okey) || isJoker(b, okey)) return true
    return mode === 'seri' ? a.color === b.color && b.num === a.num + 1 : a.color === b.color && a.num === b.num
  }
  const groups: Tile[][] = []
  for (const t of tiles) {
    const g = groups.at(-1)
    if (g && joins(g[g.length - 1], t) && !(mode === 'cift' && g.length >= 2)) g.push(t)
    else groups.push([t])
  }
  const slots: Slots = Array(RACK_SLOTS).fill(null)
  let pos = 0
  for (const g of groups) {
    const rowEnd = pos < RACK_COLS ? RACK_COLS : RACK_SLOTS
    if (pos + g.length > rowEnd && pos < RACK_COLS) pos = RACK_COLS
    if (pos + g.length > RACK_SLOTS) {
      return [...tiles.map((t) => t.id), ...Array(RACK_SLOTS - tiles.length).fill(null)]
    }
    for (const t of g) slots[pos++] = t.id
    pos++
  }
  return slots
}

export function useRack(hand: Tile[], okey: OkeyValue) {
  const [raw, setRaw] = useState<Slots>(() => layoutSorted(sortHand(hand, okey, 'seri'), okey, 'seri'))
  const [selected, setSelected] = useState<number | null>(null)
  const slots = reconcile(raw, hand)
  const selectedId = selected != null && hand.some((t) => t.id === selected) ? selected : null

  function moveTo(id: number, target: number) {
    const next = [...slots]
    const from = next.indexOf(id)
    if (from < 0 || from === target) return
    next[from] = next[target]
    next[target] = id
    setRaw(next)
  }

  function arrange(mode: 'seri' | 'cift') {
    setRaw(layoutSorted(sortHand(hand, okey, mode), okey, mode))
  }

  const [flippedRaw, setFlipped] = useState<number[]>([])
  const flipped = new Set(flippedRaw.filter((id) => hand.some((t) => t.id === id)))
  function toggleFlip(id: number) {
    setFlipped((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
  }

  return { slots, selected: selectedId, setSelected, moveTo, arrange, flipped, toggleFlip }
}

export type DropKind = 'discard' | 'finish'

export function OkeyRack({
  hand,
  okey,
  rack,
  highlight,
  onDoubleTile,
  onDropOut,
  onDropHover,
}: {
  hand: Tile[]
  okey: OkeyValue
  rack: ReturnType<typeof useRack>
  /** Tile id that was just drawn, shown with a marker. */
  highlight?: number | null
  onDoubleTile?: (tile: Tile) => void
  /** Called when a tile is dragged onto an element marked with data-drop="discard" | "finish". */
  onDropOut?: (tileId: number, kind: DropKind) => void
  onDropHover?: (kind: DropKind | null) => void
}) {
  const byId = new Map(hand.map((t) => [t.id, t]))
  const [over, setOver] = useState<number | null>(null)
  const [ghost, setGhost] = useState<{ id: number; x: number; y: number } | null>(null)
  const press = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const lastTap = useRef<{ id: number; t: number } | null>(null)
  const hoverKind = useRef<DropKind | null>(null)

  const onSlot = (i: number) => {
    const id = rack.slots[i]
    if (rack.selected != null && rack.selected !== id) {
      rack.moveTo(rack.selected, i)
      if (id != null) rack.setSelected(null)
      return
    }
    if (id != null) rack.setSelected(id === rack.selected ? null : id)
  }

  const onTileTap = (tile: Tile, i: number) => {
    if (suppressClick.current) return
    const now = Date.now()
    if (lastTap.current?.id === tile.id && now - lastTap.current.t < 350) {
      lastTap.current = null
      onDoubleTile?.(tile)
      return
    }
    lastTap.current = { id: tile.id, t: now }
    onSlot(i)
  }

  const targetAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const slot = el?.closest<HTMLElement>('[data-rack-slot]')
    if (slot) return { slot: Number(slot.dataset.rackSlot), kind: null }
    const zone = el?.closest<HTMLElement>('[data-drop]')
    return { slot: null, kind: (zone?.dataset.drop as DropKind | undefined) ?? null }
  }

  const setHover = (kind: DropKind | null) => {
    if (hoverKind.current === kind) return
    hoverKind.current = kind
    onDropHover?.(kind)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>, id: number) => {
    if (e.button !== 0) return
    press.current = { id, x: e.clientX, y: e.clientY, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current
    if (!p) return
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return
    p.moved = true
    setGhost({ id: p.id, x: e.clientX, y: e.clientY })
    const t = targetAt(e.clientX, e.clientY)
    setOver(t.slot)
    setHover(t.kind)
  }

  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const p = press.current
    press.current = null
    if (!p?.moved) return
    suppressClick.current = true
    setTimeout(() => (suppressClick.current = false), 0)
    setGhost(null)
    setOver(null)
    setHover(null)
    if (cancelled) return
    const t = targetAt(e.clientX, e.clientY)
    if (t.slot != null) rack.moveTo(p.id, t.slot)
    else if (t.kind) onDropOut?.(p.id, t.kind)
    rack.setSelected(null)
  }

  const ghostTile = ghost ? byId.get(ghost.id) : undefined

  return (
    <div className="flex flex-col gap-1 rounded-xl bg-wood p-1.5 shadow-inner sm:gap-2 sm:p-3" role="group" aria-label="Istakan, iki sıra">
      {[0, 1].map((row) => (
        <div key={row} className="grid grid-cols-14 gap-0.5 border-b-4 border-background/30 pb-1 sm:gap-1">
          {rack.slots.slice(row * RACK_COLS, row * RACK_COLS + RACK_COLS).map((id, c) => {
            const i = row * RACK_COLS + c
            const tile = id != null ? byId.get(id) : undefined
            const canDropHere = rack.selected != null && id == null
            return (
              <div
                key={i}
                data-rack-slot={i}
                className={cn('relative flex aspect-[3/4] items-end justify-center rounded-sm', over === i && 'bg-primary/30')}
              >
                {tile ? (
                  <div
                    onPointerDown={(e) => onPointerDown(e, tile.id)}
                    onPointerMove={onPointerMove}
                    onPointerUp={(e) => endDrag(e)}
                    onPointerCancel={(e) => endDrag(e, true)}
                    className={cn('size-full touch-none select-none', ghost?.id === tile.id && 'opacity-30')}
                  >
                    <RackTile
                      tile={tile}
                      okey={okey}
                      selected={rack.selected === tile.id}
                      fresh={highlight === tile.id}
                      flipped={rack.flipped.has(tile.id)}
                      onClick={() => onTileTap(tile, i)}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSlot(i)}
                    aria-label={canDropHere ? `Seçili taşı ${row + 1}. sıra ${c + 1}. yuvaya taşı` : `Boş yuva ${row + 1}-${c + 1}`}
                    className={cn('size-full rounded-sm', canDropHere ? 'border border-dashed border-primary/70 bg-primary/10' : 'bg-background/10')}
                  />
                )}
              </div>
            )
          })}
        </div>
      ))}
      <ul className="hidden flex-wrap items-center gap-1.5 pt-0.5 sm:flex" aria-label="Kontroller">
        {[
          { icon: Pointer, label: 'Dokun', text: 'seç' },
          { icon: MousePointerClick, label: 'Çift dokun', text: 'at' },
          { icon: Move, label: 'Sürükle', text: 'yer değiştir / at' },
        ].map(({ icon: Icon, label, text }) => (
          <li key={label} className="flex items-center gap-1 rounded-full bg-background/35 px-2 py-1 text-[10px] text-foreground/80 sm:text-[11px]">
            <Icon className="size-3 text-primary" aria-hidden="true" />
            <span className="font-bold text-foreground">{label}</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>

      {ghost && ghostTile && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[80] h-14 w-10 -translate-x-1/2 -translate-y-[70%] rotate-3 drop-shadow-2xl sm:h-16 sm:w-12"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <TileFace tile={ghostTile} okey={okey} size="fluid" selected />
        </div>
      )}
    </div>
  )
}

function RackTile({
  tile,
  okey,
  selected,
  fresh,
  flipped,
  onClick,
}: {
  tile: Tile
  okey: OkeyValue
  selected: boolean
  fresh: boolean
  flipped: boolean
  onClick: () => void
}) {
  return (
    <div className={cn('relative size-full transition-transform', selected && '-translate-y-1.5 sm:-translate-y-2')}>
      <div className="absolute inset-0 origin-bottom [perspective:400px]">
        <div className={cn('relative size-full transition-transform duration-500 [transform-style:preserve-3d]', flipped && '[transform:rotateY(180deg)]')}>
          <div className="absolute inset-0 [backface-visibility:hidden]">
            <TileFace tile={tile} okey={okey} size="fluid" selected={selected} onClick={onClick} />
          </div>
          <button
            type="button"
            onClick={onClick}
            aria-label="Ters çevrilmiş okey"
            aria-pressed={selected}
            className={cn(
              'absolute inset-0 rounded-[3px] border border-primary/40 bg-wood shadow-[inset_0_-3px_0_rgb(0_0_0/0.2),0_2px_3px_rgb(0_0_0/0.3)] [backface-visibility:hidden] [transform:rotateY(180deg)] sm:rounded-md',
              selected && 'ring-2 ring-primary',
            )}
          >
            <Sparkles className="mx-auto size-1/2 text-primary/70" aria-hidden="true" />
          </button>
        </div>
      </div>
      {fresh && (
        <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-primary px-1 text-[8px] font-bold uppercase leading-tight text-primary-foreground">
          Yeni
        </span>
      )}
    </div>
  )
}
