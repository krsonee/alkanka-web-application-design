'use client'

import { useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { MousePointerClick, Move, Pointer, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TileFace } from './okey'
import { isJoker, sortHand, type Okey as OkeyValue, type Tile } from './okey-engine'

export const RACK_COLS = 14

type Slots = (number | null)[]

/** Start slot for a group of `len` tiles at `pos`: wraps to the next row instead of splitting a group, -1 when it no longer fits. */
function groupStart(pos: number, len: number, total: number) {
  const rowEnd = (Math.floor(pos / RACK_COLS) + 1) * RACK_COLS
  const start = pos + len > rowEnd && len <= RACK_COLS ? rowEnd : pos
  return start + len > total ? -1 : start
}

function reconcile(raw: Slots, hand: Tile[], total: number): Slots {
  const ids = new Set(hand.map((t) => t.id))
  const slots: Slots = Array.from({ length: total }, (_, i) => {
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
function layoutSorted(tiles: Tile[], okey: OkeyValue, mode: 'seri' | 'cift', total: number): Slots {
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
  const slots: Slots = Array(total).fill(null)
  let pos = 0
  for (const g of groups) {
    pos = groupStart(pos, g.length, total)
    if (pos < 0) return [...tiles.map((t) => t.id), ...Array(Math.max(0, total - tiles.length)).fill(null)]
    for (const t of g) slots[pos++] = t.id
    pos++
  }
  return slots
}

/** Places each group with an empty slot after it so groups read as separate sets; leftovers fill the rest. */
export function layoutGroups(groups: Tile[][], rest: Tile[], rows = 2): Slots {
  const total = RACK_COLS * rows
  const all = [...groups.flat(), ...rest]
  const compact: Slots = [...all.map((t) => t.id), ...Array(Math.max(0, total - all.length)).fill(null)]
  const slots: Slots = Array(total).fill(null)
  let pos = 0
  for (const g of groups) {
    pos = groupStart(pos, g.length, total)
    if (pos < 0) return compact
    for (const t of g) slots[pos++] = t.id
    pos++
  }
  const free = [
    ...slots.map((id, i) => (id == null && i >= pos ? i : -1)).filter((i) => i >= 0),
    ...slots.map((id, i) => (id == null && i < pos ? i : -1)).filter((i) => i >= 0),
  ]
  if (free.length < rest.length) return compact
  rest.forEach((t, k) => (slots[free[k]] = t.id))
  return slots
}

export type SlotMark = { label?: string } | null

export function useRack(hand: Tile[], okey: OkeyValue, rows = 2) {
  const total = RACK_COLS * rows
  const [raw, setRaw] = useState<Slots>(() => layoutSorted(sortHand(hand, okey, 'seri'), okey, 'seri', total))
  const [selected, setSelected] = useState<number | null>(null)
  const slots = reconcile(raw, hand, total)
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
    setRaw(layoutSorted(sortHand(hand, okey, mode), okey, mode, total))
  }

  const [flippedRaw, setFlipped] = useState<number[]>([])
  const flipped = new Set(flippedRaw.filter((id) => hand.some((t) => t.id === id)))
  function toggleFlip(id: number) {
    setFlipped((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
  }

  return { rows, slots, selected: selectedId, setSelected, moveTo, arrange, setLayout: setRaw, flipped, toggleFlip }
}

export type DropKind = 'discard' | 'finish' | `meld:${number}`

export function OkeyRack({
  hand,
  okey,
  rack,
  highlight,
  onDoubleTile,
  onDropOut,
  onDropHover,
  marks,
}: {
  hand: Tile[]
  okey: OkeyValue
  rack: ReturnType<typeof useRack>
  /** Per-slot marker: a non-null value underlines the slot as part of a valid group; label shows above its first tile. */
  marks?: SlotMark[]
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
  const ghostEl = useRef<HTMLDivElement | null>(null)
  const overRef = useRef<number | null>(null)
  const frame = useRef<number | null>(null)
  const press = useRef<{ id: number; x: number; y: number; moved: boolean; threshold: number } | null>(null)
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

  // Listeners live on window instead of pointer capture: capturing on pointerdown retargets the
  // follow-up click to the wrapper, so trackpad/mouse taps never reached the tile button.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>, id: number) => {
    if (e.button !== 0) return
    suppressClick.current = false
    // Physical clicks on a MacBook trackpad nudge the cursor a few pixels; a small threshold turned them into tiny drags.
    press.current = { id, x: e.clientX, y: e.clientY, moved: false, threshold: e.pointerType === 'touch' ? 6 : 12 }
    const move = (ev: globalThis.PointerEvent) => onPointerMove(ev)
    const up = (ev: globalThis.PointerEvent) => {
      cleanup()
      endDrag(ev)
    }
    const cancel = (ev: globalThis.PointerEvent) => {
      cleanup()
      endDrag(ev, true)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  const onPointerMove = (e: { clientX: number; clientY: number; preventDefault?: () => void }) => {
    const p = press.current
    if (!p) return
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < p.threshold) return
    const x = e.clientX
    const y = e.clientY
    if (!p.moved) {
      p.moved = true
      setGhost({ id: p.id, x, y })
    }
    if (ghostEl.current) {
      ghostEl.current.style.left = `${x}px`
      ghostEl.current.style.top = `${y}px`
    }
    if (frame.current != null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      if (!press.current?.moved) return
      const t = targetAt(x, y)
      if (overRef.current !== t.slot) {
        overRef.current = t.slot
        setOver(t.slot)
      }
      setHover(t.kind)
    })
  }

  const endDrag = (e: { clientX: number; clientY: number }, cancelled = false) => {
    const p = press.current
    press.current = null
    if (!p?.moved) return
    if (frame.current != null) cancelAnimationFrame(frame.current)
    frame.current = null
    overRef.current = null
    setGhost(null)
    setOver(null)
    setHover(null)
    if (cancelled) return
    const t = targetAt(e.clientX, e.clientY)
    // Released over its own slot: keep it a normal tap so the tile still gets selected.
    if (t.slot != null && rack.slots[t.slot] === p.id) return
    // Safari can dispatch the click after a 0ms timer, so the guard is cleared on the next press instead.
    suppressClick.current = true
    setTimeout(() => (suppressClick.current = false), 400)
    if (t.slot != null) rack.moveTo(p.id, t.slot)
    else if (t.kind) onDropOut?.(p.id, t.kind)
    rack.setSelected(null)
  }

  const ghostTile = ghost ? byId.get(ghost.id) : undefined

  return (
    <div
      className="mx-auto flex w-full max-w-[50rem] flex-col gap-1 rounded-xl bg-wood p-1.5 shadow-inner sm:gap-1.5 sm:p-2"
      role="group"
      aria-label={`Istakan, ${rack.rows === 3 ? 'üç' : 'iki'} sıra`}
    >
      {Array.from({ length: rack.rows }, (_, row) => row).map((row) => (
        <div key={row} className="grid grid-cols-14 gap-0.5 border-b-4 border-background/30 pb-1 sm:gap-1">
          {rack.slots.slice(row * RACK_COLS, row * RACK_COLS + RACK_COLS).map((id, c) => {
            const i = row * RACK_COLS + c
            const tile = id != null ? byId.get(id) : undefined
            const canDropHere = rack.selected != null && id == null
            const mark = marks?.[i]
            return (
              <div
                key={i}
                data-rack-slot={i}
                className={cn('relative flex aspect-[3/4] items-end justify-center rounded-sm', over === i && 'bg-primary/30')}
              >
                {mark && (
                  <span aria-hidden="true" className="pointer-events-none absolute -bottom-1 -left-px -right-px z-10 h-1 bg-primary" />
                )}
                {mark?.label && (
                  <span className="pointer-events-none absolute -top-1.5 left-0 z-20 rounded-sm bg-primary px-0.5 text-[8px] font-bold leading-tight tabular-nums text-primary-foreground sm:text-[9px]">
                    {mark.label}
                  </span>
                )}
                {tile ? (
                  <div
                    onPointerDown={(e) => onPointerDown(e, tile.id)}
                    onDragStart={(e) => e.preventDefault()}
                    className={cn('size-full cursor-grab touch-none select-none', ghost?.id === tile.id && 'cursor-grabbing opacity-30')}
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

      {ghost &&
        ghostTile &&
        createPortal(
          <div
            ref={ghostEl}
            aria-hidden="true"
            className="pointer-events-none fixed z-[80] h-12 w-9 -translate-x-1/2 -translate-y-[70%] rotate-3 drop-shadow-2xl will-change-[left,top] sm:h-14 sm:w-10"
            style={{ left: ghost.x, top: ghost.y }}
          >
            <TileFace tile={ghostTile} okey={okey} size="fluid" selected />
          </div>,
          document.body,
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
