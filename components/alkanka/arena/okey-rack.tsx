'use client'

import { useState, type DragEvent } from 'react'
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

  return { slots, selected: selectedId, setSelected, moveTo, arrange }
}

export function OkeyRack({
  hand,
  okey,
  rack,
  highlight,
}: {
  hand: Tile[]
  okey: OkeyValue
  rack: ReturnType<typeof useRack>
  /** Tile id that was just drawn, shown with a marker. */
  highlight?: number | null
}) {
  const byId = new Map(hand.map((t) => [t.id, t]))
  const [over, setOver] = useState<number | null>(null)

  const onSlot = (i: number) => {
    const id = rack.slots[i]
    if (rack.selected != null && rack.selected !== id) {
      rack.moveTo(rack.selected, i)
      if (id != null) rack.setSelected(null)
      return
    }
    if (id != null) rack.setSelected(id === rack.selected ? null : id)
  }

  const onDrop = (e: DragEvent, i: number) => {
    e.preventDefault()
    setOver(null)
    const id = Number(e.dataTransfer.getData('text/plain'))
    if (Number.isFinite(id)) rack.moveTo(id, i)
  }

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
                onDragOver={(e) => {
                  e.preventDefault()
                  setOver(i)
                }}
                onDragLeave={() => setOver((o) => (o === i ? null : o))}
                onDrop={(e) => onDrop(e, i)}
                className={cn('relative flex aspect-[3/4] items-end justify-center rounded-sm', over === i && 'bg-primary/30')}
              >
                {tile ? (
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(tile.id))
                      rack.setSelected(tile.id)
                    }}
                    className="size-full"
                  >
                    <RackTile tile={tile} okey={okey} selected={rack.selected === tile.id} fresh={highlight === tile.id} onClick={() => onSlot(i)} />
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
      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Taşa dokun, sonra ıstakada istediğin boş yuvaya dokun (bilgisayarda sürükleyip bırakabilirsin). Taşa taş üstüne dokunursan yer değiştirirler.
      </p>
    </div>
  )
}

function RackTile({ tile, okey, selected, fresh, onClick }: { tile: Tile; okey: OkeyValue; selected: boolean; fresh: boolean; onClick: () => void }) {
  return (
    <div className={cn('relative size-full transition-transform', selected && '-translate-y-1.5 sm:-translate-y-2')}>
      <div className="absolute inset-0 origin-bottom">
        <TileFace tile={tile} okey={okey} size="fluid" selected={selected} onClick={onClick} />
      </div>
      {fresh && (
        <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-primary px-1 text-[8px] font-bold uppercase leading-tight text-primary-foreground">
          Yeni
        </span>
      )}
    </div>
  )
}
