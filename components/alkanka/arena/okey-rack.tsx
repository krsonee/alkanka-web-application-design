'use client'

import { useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Hand, MousePointerClick, Move, Pointer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TileFace } from './okey'
import { COLOR_NAMES, isJoker, sortHand, valueOf, type Okey as OkeyValue, type Tile } from './okey-engine'

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

/** A candidate set or run as value keys ("color:num"); null marks a slot filled by an okey. */
type Cand = (string | null)[]

const keyOf = (c: number, n: number) => `${c}:${n}`

/**
 * Groups a hand the way a player would lay it on the rack: "seri" finds runs and sets (using okeys to fill gaps),
 * "cift" finds identical pairs. Whatever is left over is returned sorted as `rest`.
 */
export function findGroups(hand: Tile[], okey: OkeyValue, mode: 'seri' | 'cift'): { groups: Tile[][]; rest: Tile[] } {
  const jokers = hand.filter((t) => isJoker(t, okey))
  const pool = new Map<string, Tile[]>()
  for (const t of hand) {
    if (isJoker(t, okey)) continue
    const v = valueOf(t, okey)
    const k = keyOf(v.color, v.num)
    pool.set(k, [...(pool.get(k) ?? []), t])
  }

  if (mode === 'cift') {
    const groups: Tile[][] = []
    const singles: Tile[] = []
    for (const tiles of pool.values()) {
      const list = [...tiles]
      while (list.length >= 2) groups.push(list.splice(0, 2))
      singles.push(...list)
    }
    const sortedSingles = sortHand(singles, okey, 'cift')
    const js = [...jokers]
    while (js.length && sortedSingles.length) groups.push([sortedSingles.shift()!, js.shift()!])
    if (js.length >= 2) groups.push(js.splice(0, 2))
    const pairKey = (g: Tile[]) => {
      const v = valueOf(g[0], okey)
      return v.num * 10 + v.color
    }
    groups.sort((a, b) => pairKey(a) - pairKey(b))
    return { groups, rest: [...sortedSingles, ...js] }
  }

  const has = (k: string) => (pool.get(k)?.length ?? 0) > 0
  const cands: Cand[] = []
  for (let c = 0; c < 4; c++) {
    for (let start = 1; start <= 12; start++) {
      for (let len = 3; start + len - 1 <= 14 && len <= 13; len++) {
        const keys = Array.from({ length: len }, (_, i) => {
          const n = start + i === 14 ? 1 : start + i
          const k = keyOf(c, n)
          return has(k) ? k : null
        })
        const missing = keys.filter((k) => k == null).length
        if (missing <= jokers.length && len - missing >= 2) cands.push(keys)
      }
    }
  }
  for (let n = 1; n <= 13; n++) {
    const colors = [0, 1, 2, 3].filter((c) => has(keyOf(c, n)))
    for (let mask = 1; mask < 1 << colors.length; mask++) {
      const picked = colors.filter((_, i) => mask & (1 << i))
      for (let j = 0; j <= jokers.length; j++) {
        const size = picked.length + j
        if (size < 3 || size > 4 || picked.length < 2) continue
        cands.push([...picked.map((c) => keyOf(c, n)), ...Array(j).fill(null)])
      }
    }
  }
  cands.sort((a, b) => b.length - a.length)

  const avail = new Map([...pool].map(([k, v]) => [k, v.length]))
  let best: { picks: Cand[]; covered: number; jokers: number } = { picks: [], covered: 0, jokers: 0 }
  let budget = 40000
  const dfs = (from: number, picks: Cand[], covered: number, jLeft: number) => {
    const usedJ = jokers.length - jLeft
    if (covered > best.covered || (covered === best.covered && usedJ < best.jokers)) best = { picks: [...picks], covered, jokers: usedJ }
    for (let i = from; i < cands.length && budget > 0; i++) {
      budget--
      const cand = cands[i]
      const need = new Map<string, number>()
      let js = 0
      for (const k of cand) {
        if (k == null) js++
        else need.set(k, (need.get(k) ?? 0) + 1)
      }
      if (js > jLeft || [...need].some(([k, n]) => (avail.get(k) ?? 0) < n)) continue
      need.forEach((n, k) => avail.set(k, avail.get(k)! - n))
      picks.push(cand)
      dfs(i, picks, covered + cand.length, jLeft - js)
      picks.pop()
      need.forEach((n, k) => avail.set(k, avail.get(k)! + n))
    }
  }
  dfs(0, [], 0, jokers.length)

  const left = new Map([...pool].map(([k, v]) => [k, [...v]]))
  const js = [...jokers]
  const groups = best.picks.map((cand) => cand.map((k) => (k == null ? js.shift()! : left.get(k)!.shift()!)))
  const sortKey = (g: Tile[]) => {
    const real = g.find((t) => !isJoker(t, okey)) ?? g[0]
    const v = valueOf(real, okey)
    return v.color * 100 + v.num
  }
  groups.sort((a, b) => sortKey(a) - sortKey(b))
  const rest = sortHand([...[...left.values()].flat(), ...js], okey, 'seri')
  return { groups, rest }
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

function arrangeLayout(hand: Tile[], okey: OkeyValue, mode: 'seri' | 'cift', rows: number) {
  const { groups, rest } = findGroups(hand, okey, mode)
  return layoutGroups(groups, rest, rows)
}

export type SlotMark = { label?: string } | null

export function useRack(hand: Tile[], okey: OkeyValue, rows = 2) {
  const total = RACK_COLS * rows
  const [raw, setRaw] = useState<Slots>(() => arrangeLayout(hand, okey, 'seri', rows))
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

  /** Moves a contiguous group so the grabbed tile (index `grab`) lands on `target`, nudging it to the nearest free stretch in that row. */
  function moveGroup(ids: number[], grab: number, target: number) {
    const next = slots.map((id) => (id != null && ids.includes(id) ? null : id))
    const rowStart = Math.floor(target / RACK_COLS) * RACK_COLS
    const maxStart = rowStart + RACK_COLS - ids.length
    if (maxStart < rowStart) return
    const preferred = Math.min(maxStart, Math.max(rowStart, target - grab))
    const fits = (s: number) => s >= rowStart && s <= maxStart && ids.every((_, k) => next[s + k] == null)
    for (let d = 0; d <= RACK_COLS; d++) {
      for (const s of d === 0 ? [preferred] : [preferred - d, preferred + d]) {
        if (!fits(s)) continue
        ids.forEach((id, k) => (next[s + k] = id))
        setRaw(next)
        return
      }
    }
  }

  /** Puts a tile that is about to join the hand (drawn or taken) on `target`, or the nearest free slot in that row. */
  function placeAt(id: number, target: number) {
    const next = [...slots]
    const rowStart = Math.floor(target / RACK_COLS) * RACK_COLS
    for (let d = 0; d < RACK_COLS; d++) {
      for (const s of d === 0 ? [target] : [target - d, target + d]) {
        if (s < rowStart || s >= rowStart + RACK_COLS || next[s] != null) continue
        next[s] = id
        setRaw(next)
        return
      }
    }
  }

  function arrange(mode: 'seri' | 'cift') {
    setRaw(arrangeLayout(hand, okey, mode, rows))
  }

  // Okeys arrive face down, like at a real table; the player taps to reveal them.
  const [flippedRaw, setFlipped] = useState<number[]>(() => hand.filter((t) => isJoker(t, okey)).map((t) => t.id))
  const flipped = new Set(flippedRaw.filter((id) => hand.some((t) => t.id === id)))
  function toggleFlip(id: number) {
    setFlipped((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
  }
  function hide(id: number) {
    setFlipped((f) => (f.includes(id) ? f : [...f, id]))
  }

  return { rows, slots, selected: selectedId, setSelected, moveTo, moveGroup, placeAt, arrange, setLayout: setRaw, flipped, toggleFlip, hide }
}

/** A run (same colour, consecutive, 12-13-1 allowed) or a set (same number, distinct colours), okeys filling gaps. */
function isMeld(tiles: Tile[], ok: OkeyValue) {
  if (tiles.length < 3) return false
  const real = tiles.map((t) => (isJoker(t, ok) ? null : valueOf(t, ok)))
  const known = real.filter((v): v is { color: number; num: number } => v != null)
  if (!known.length) return true
  if (tiles.length <= 4 && known.every((v) => v.num === known[0].num) && new Set(known.map((v) => v.color)).size === known.length) return true
  if (!known.every((v) => v.color === known[0].color)) return false
  const runFits = (seq: typeof real) => {
    const first = seq.findIndex((v) => v != null)
    const start = seq[first]!.num - first
    if (start < 1 || start + seq.length - 1 > 14) return false
    return seq.every((v, k) => v == null || v.num === (start + k === 14 ? 1 : start + k))
  }
  return runFits(real) || runFits([...real].reverse())
}

/** Underlines every contiguous stretch on the rack that already forms a valid per (or an identical pair). */
function meldMarks(slots: Slots, byId: Map<number, Tile>, ok: OkeyValue): SlotMark[] {
  const marks: SlotMark[] = Array(slots.length).fill(null)
  for (let row = 0; row * RACK_COLS < slots.length; row++) {
    let c = 0
    while (c < RACK_COLS) {
      const i = row * RACK_COLS + c
      if (slots[i] == null) {
        c++
        continue
      }
      let end = c
      while (end + 1 < RACK_COLS && slots[row * RACK_COLS + end + 1] != null) end++
      const idx = Array.from({ length: end - c + 1 }, (_, k) => i + k)
      const tiles = idx.map((s) => byId.get(slots[s]!)).filter((t): t is Tile => !!t)
      const pair =
        tiles.length === 2 &&
        (tiles.some((t) => isJoker(t, ok)) ||
          (valueOf(tiles[0], ok).color === valueOf(tiles[1], ok).color && valueOf(tiles[0], ok).num === valueOf(tiles[1], ok).num))
      if (pair || isMeld(tiles, ok)) idx.forEach((s) => (marks[s] = {}))
      c = end + 1
    }
  }
  return marks
}

export type DropKind = 'discard' | 'finish' | `meld:${number}`

/** Compositor-only positioning for drag ghosts: moving left/top forced a layout every pointer move. */
export const ghostTransform = (x: number, y: number) => `translate3d(${x}px, ${y}px, 0) translate(-50%, -70%) rotate(3deg)`

// Short enough to feel instant on phones, long enough that a quick flick still moves a single tile.
const LONG_PRESS_MS = 320

export function OkeyRack({
  hand,
  okey,
  rack,
  highlight,
  onDoubleTile,
  onDropOut,
  onDropHover,
  marks,
  looseDiscard,
  variant = 'panel',
}: {
  /** "table" draws the walnut rack that sits on the okey table itself. */
  variant?: 'panel' | 'table'
  hand: Tile[]
  okey: OkeyValue
  rack: ReturnType<typeof useRack>
  /** Releasing a single tile anywhere off the rack counts as a discard, not only over the discard slot. */
  looseDiscard?: boolean
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
  const slotMarks = marks ?? meldMarks(rack.slots, byId, okey)
  const [over, setOver] = useState<number | null>(null)
  const [ghost, setGhost] = useState<{ ids: number[]; x: number; y: number; w: number; h: number } | null>(null)
  const [lifted, setLifted] = useState<number[] | null>(null)
  const ghostEl = useRef<HTMLDivElement | null>(null)
  const overRef = useRef<number | null>(null)
  const frame = useRef<number | null>(null)
  const press = useRef<{
    id: number
    x: number
    y: number
    moved: boolean
    threshold: number
    group: number[] | null
    timer: ReturnType<typeof setTimeout> | null
  } | null>(null)
  const suppressClick = useRef(false)
  const lastTap = useRef<{ id: number; t: number } | null>(null)
  const hoverKind = useRef<DropKind | null>(null)

  /** Tiles touching the given one in its row, i.e. the set the player has built on the rack. */
  const groupOf = (id: number) => {
    const idx = rack.slots.indexOf(id)
    if (idx < 0) return [id]
    const rowStart = Math.floor(idx / RACK_COLS) * RACK_COLS
    let a = idx
    let b = idx
    while (a - 1 >= rowStart && rack.slots[a - 1] != null) a--
    while (b + 1 < rowStart + RACK_COLS && rack.slots[b + 1] != null) b++
    return rack.slots.slice(a, b + 1) as number[]
  }

  const onSlot = (i: number) => {
    const id = rack.slots[i]
    if (id != null) {
      rack.setSelected(id === rack.selected ? null : id)
      return
    }
    if (rack.selected != null) rack.moveTo(rack.selected, i)
  }

  const onTileTap = (tile: Tile, i: number) => {
    if (suppressClick.current) return
    if (rack.flipped.has(tile.id)) {
      rack.toggleFlip(tile.id)
      return
    }
    const now = Date.now()
    if (lastTap.current?.id === tile.id && now - lastTap.current.t < 350) {
      lastTap.current = null
      // Double-tapping a revealed okey turns it face down again instead of discarding it.
      if (isJoker(tile, okey)) {
        rack.setSelected(null)
        rack.hide(tile.id)
        return
      }
      onDoubleTile?.(tile)
      return
    }
    lastTap.current = { id: tile.id, t: now }
    onSlot(i)
  }

  const rootRef = useRef<HTMLDivElement>(null)

  const targetAt = (x: number, y: number): { slot: number | null; kind: DropKind | null } => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const slot = el?.closest<HTMLElement>('[data-rack-slot]')
    if (slot) return { slot: Number(slot.dataset.rackSlot), kind: null }
    const zone = el?.closest<HTMLElement>('[data-drop]')
    const kind = (zone?.dataset.drop as DropKind | undefined) ?? null
    if (kind) return { slot: null, kind }
    // The rack frame between slots is not a target; anywhere else on screen is a throw.
    const onRack = el ? rootRef.current?.contains(el) : false
    return { slot: null, kind: looseDiscard && !onRack ? 'discard' : null }
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
    const timer = setTimeout(() => {
      const p = press.current
      if (!p || p.moved || p.id !== id) return
      const group = groupOf(id)
      if (group.length < 2) return
      p.group = group
      setLifted(group)
      navigator.vibrate?.(15)
    }, LONG_PRESS_MS)
    // Shift+drag on desktop grabs the whole per right away, without waiting for the long press.
    const shiftGroup = e.shiftKey ? groupOf(id) : null
    if (shiftGroup && shiftGroup.length > 1) {
      clearTimeout(timer)
      setLifted(shiftGroup)
    }
    // Physical clicks on a MacBook trackpad nudge the cursor a few pixels; a small threshold turned them into tiny drags.
    press.current = {
      id,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      // A touch drag needs a little more travel so a resting thumb can finish the long press without starting a single-tile drag.
      threshold: e.pointerType === 'touch' ? 10 : 12,
      group: shiftGroup && shiftGroup.length > 1 ? shiftGroup : null,
      timer,
    }
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

  const onPointerMove = (e: { clientX: number; clientY: number }) => {
    const p = press.current
    if (!p) return
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < p.threshold) return
    const x = e.clientX
    const y = e.clientY
    if (!p.moved) {
      p.moved = true
      if (p.timer) clearTimeout(p.timer)
      const r = rootRef.current?.querySelector('[data-rack-slot]')?.getBoundingClientRect()
      setGhost({ ids: p.group ?? [p.id], x, y, w: r?.width ?? 40, h: r?.height ?? 56 })
    }
    if (ghostEl.current) ghostEl.current.style.transform = ghostTransform(x, y)
    if (frame.current != null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      if (!press.current?.moved) return
      const t = targetAt(x, y)
      if (overRef.current !== t.slot) {
        overRef.current = t.slot
        setOver(t.slot)
      }
      setHover(press.current.group ? null : t.kind)
    })
  }

  const endDrag = (e: { clientX: number; clientY: number }, cancelled = false) => {
    const p = press.current
    press.current = null
    if (p?.timer) clearTimeout(p.timer)
    setLifted(null)
    if (!p) return
    if (!p.moved) {
      // A long press that never moved lifted the group; don't let the trailing click select a tile.
      if (p.group) {
        suppressClick.current = true
        setTimeout(() => (suppressClick.current = false), 400)
      }
      return
    }
    if (frame.current != null) cancelAnimationFrame(frame.current)
    frame.current = null
    overRef.current = null
    setGhost(null)
    setOver(null)
    setHover(null)
    if (cancelled) return
    const t = targetAt(e.clientX, e.clientY)
    // Released over its own slot: keep it a normal tap so the tile still gets selected.
    if (!p.group && t.slot != null && rack.slots[t.slot] === p.id) return
    // Safari can dispatch the click after a 0ms timer, so the guard is cleared on the next press instead.
    suppressClick.current = true
    setTimeout(() => (suppressClick.current = false), 400)
    if (p.group) {
      if (t.slot != null) rack.moveGroup(p.group, p.group.indexOf(p.id), t.slot)
    } else if (t.slot != null) rack.moveTo(p.id, t.slot)
    else if (t.kind) onDropOut?.(p.id, t.kind)
    rack.setSelected(null)
  }

  const ghostTiles = ghost ? ghost.ids.map((id) => byId.get(id)).filter((t): t is Tile => !!t) : []
  const dragging = new Set(ghost?.ids ?? [])
  const liftedSet = new Set(lifted ?? [])

  if (variant === 'table') {
    return (
      <div ref={rootRef} data-rack className="okt-rack" role="group" aria-label="Istakan, iki sıra">
        <div className="okt-layer">
          {Array.from({ length: rack.rows }, (_, row) => row).map((row) => (
            <div key={row} className="okt-row">
              <span aria-hidden="true" className="okt-ledge" />
              {rack.slots.slice(row * RACK_COLS, row * RACK_COLS + RACK_COLS).map((id, c) => {
                const i = row * RACK_COLS + c
                const tile = id != null ? byId.get(id) : undefined
                const canDropHere = rack.selected != null && id == null
                return (
                  <div
                    key={i}
                    data-rack-slot={i}
                    className={cn(
                      'okt-slot',
                      over === i && 'over',
                      tile && (rack.selected === tile.id || liftedSet.has(tile.id)) && 'sel',
                      tile && dragging.has(tile.id) && 'drag',
                    )}
                  >
                    {tile ? (
                      <div
                        className="okt-in"
                        onPointerDown={(e) => onPointerDown(e, tile.id)}
                        onDragStart={(e) => e.preventDefault()}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <MockTile
                          tile={tile}
                          okey={okey}
                          hidden={rack.flipped.has(tile.id)}
                          selected={rack.selected === tile.id}
                          onClick={() => onTileTap(tile, i)}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSlot(i)}
                        data-on={canDropHere || undefined}
                        aria-label={canDropHere ? `Seçili taşı ${row + 1}. sıra ${c + 1}. yuvaya taşı` : `Boş yuva ${row + 1}-${c + 1}`}
                        className="okt-empty"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <span aria-hidden="true" className="okt-brand">
          ALKANKA
        </span>
        {ghost &&
          ghostTiles.length > 0 &&
          createPortal(
            <div ref={ghostEl} aria-hidden="true" className="okt-ghost" style={{ transform: ghostTransform(ghost.x, ghost.y) }}>
              {ghostTiles.map((t) => (
                <div key={t.id} style={{ width: ghost.w, height: ghost.h }}>
                  <MockTile tile={t} okey={okey} hidden={rack.flipped.has(t.id)} />
                </div>
              ))}
            </div>,
            document.body,
          )}
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      data-rack
      className="okey-rack-wood mx-auto flex w-full max-w-[50rem] flex-col gap-1.5 rounded-md px-1 pb-1 pt-1.5 sm:gap-2.5 sm:rounded-xl sm:px-3 sm:pb-1.5 sm:pt-3"
      role="group"
      aria-label={`Istakan, ${rack.rows === 3 ? 'üç' : 'iki'} sıra`}
    >
      {Array.from({ length: rack.rows }, (_, row) => row).map((row) => (
        <div key={row} className="relative grid grid-cols-14 gap-px pb-1.5 sm:gap-1 sm:pb-2">
          <span aria-hidden="true" className="okey-rack-ledge pointer-events-none absolute -inset-x-0.5 bottom-0 h-1.5 rounded-sm sm:-inset-x-1 sm:h-2" />
          {rack.slots.slice(row * RACK_COLS, row * RACK_COLS + RACK_COLS).map((id, c) => {
            const i = row * RACK_COLS + c
            const tile = id != null ? byId.get(id) : undefined
            const canDropHere = rack.selected != null && id == null
            const mark = slotMarks[i]
            return (
              <div
                key={i}
                data-rack-slot={i}
                className={cn('relative flex aspect-[3/4] items-end justify-center rounded-sm', over === i && 'bg-primary/30')}
              >
                {mark && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute -bottom-1 z-10 h-[3px] bg-primary shadow-[0_0_6px_var(--primary)] sm:-bottom-1.5',
                      slotMarks[i - 1] && c > 0 ? '-left-px sm:-left-0.5' : 'left-[8%] rounded-l-full',
                      slotMarks[i + 1] && c < RACK_COLS - 1 ? '-right-px sm:-right-0.5' : 'right-[8%] rounded-r-full',
                    )}
                  />
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
                    onContextMenu={(e) => e.preventDefault()}
                    className={cn(
                      'size-full cursor-grab touch-none select-none transition-transform [-webkit-touch-callout:none]',
                      dragging.has(tile.id) && 'cursor-grabbing opacity-30',
                      liftedSet.has(tile.id) && '-translate-y-1.5 rounded-sm ring-2 ring-primary',
                    )}
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
      <span
        aria-hidden="true"
        className="okey-rack-plaque pointer-events-none mx-auto -mt-1 rounded-sm px-2 pl-[calc(0.5rem+0.4em)] text-[7px] font-extrabold leading-[1.6] tracking-[0.4em] sm:-mt-1.5 sm:px-3 sm:text-[9px]"
      >
        ALKANKA
      </span>
      <ul data-ls-hide className="hidden flex-wrap items-center gap-1.5 pt-0.5 sm:flex" aria-label="Kontroller">
        {[
          { icon: Pointer, label: 'Dokun', text: 'seç' },
          { icon: MousePointerClick, label: 'Çift dokun', text: 'at' },
          { icon: Move, label: 'Sürükle', text: 'yer değiştir / at' },
          { icon: Hand, label: 'Basılı tut', text: 'seriyi topluca taşı' },
        ].map(({ icon: Icon, label, text }) => (
          <li key={label} className="flex items-center gap-1 rounded-full bg-background/35 px-2 py-1 text-[10px] text-foreground/80 sm:text-[11px]">
            <Icon className="size-3 text-primary" aria-hidden="true" />
            <span className="font-bold text-foreground">{label}</span>
            <span>{text}</span>
          </li>
        ))}
      </ul>

      {ghost &&
        ghostTiles.length > 0 &&
        createPortal(
          // Above the z-[100] landscape fullscreen layer, otherwise the dragged tile hides behind the table.
          <div
            ref={ghostEl}
            aria-hidden="true"
            className="pointer-events-none fixed left-0 top-0 z-[200] flex gap-0.5 drop-shadow-2xl will-change-transform"
            style={{ transform: ghostTransform(ghost.x, ghost.y) }}
          >
            {ghostTiles.map((t) => (
              <div key={t.id} className="h-12 w-9 sm:h-14 sm:w-10">
                <TileFace tile={t} okey={okey} size="fluid" selected />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}

const TILE_COLOR = ['c0', 'c1', 'c2', 'c3']

/** Porcelain tile drawn like the approved table mockup; sizes itself from a container-query wrapper. */
export function MockTile({
  tile,
  okey,
  hidden,
  back,
  selected,
  onClick,
  label,
}: {
  tile?: Tile
  okey?: OkeyValue
  hidden?: boolean
  back?: boolean
  selected?: boolean
  onClick?: () => void
  label?: string
}) {
  const joker = tile && okey ? isJoker(tile, okey) && !tile.fake : false
  const name = !tile ? 'Kapalı taş' : hidden ? 'Kapalı okey, açmak için dokun' : tile.fake ? 'Sahte okey' : `${COLOR_NAMES[tile.color]} ${tile.num}${joker ? ' (okey)' : ''}`
  const cls = cn(
    'okt-tile',
    back || !tile
      ? 'back'
      : hidden
        ? 'hid'
        : tile.fake
          ? 'fake'
          : [TILE_COLOR[tile.color], tile.num >= 10 && 'dd', joker && 'okey reveal'],
  )
  const body = back || !tile || hidden ? null : tile.fake ? (
    <>
      {'★'}
      <i />
    </>
  ) : (
    <>
      {tile.num}
      <i />
    </>
  )
  if (!onClick)
    return (
      <div className={cls} aria-hidden={back || undefined} aria-label={back ? undefined : (label ?? name)} role={back ? undefined : 'img'}>
        {body}
      </div>
    )
  return (
    <button type="button" className={cls} onClick={onClick} aria-label={label ?? name} aria-pressed={selected}>
      {body}
    </button>
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
            aria-label="Kapalı okey, açmak için dokun"
            aria-pressed={selected}
            className={cn(
              'okey-tile-face okey-tile-body okey-tile-hidden absolute inset-0 rounded-[13%/10%] [backface-visibility:hidden] [transform:rotateY(180deg)]',
              selected && 'ring-2 ring-primary',
            )}
          />
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
