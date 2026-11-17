'use client'

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shows the dropped order at once and falls back to the server's order as soon as the list itself
 * changes (a save landed, a record was added), so a stale drag can never mask fresh data.
 */
export function useOrder<T>(items: T[], idOf: (item: T) => string) {
  const serverKey = items.map(idOf).join('|')
  const [local, setLocal] = useState<{ key: string; ids: string[] } | null>(null)
  const ids = local && local.key === serverKey ? local.ids : null
  const byId = new Map(items.map((item) => [idOf(item), item]))
  const ordered = ids ? ids.map((id) => byId.get(id)).filter((item): item is T => item !== undefined) : items
  return {
    ordered,
    set: (next: string[]) => setLocal({ key: serverKey, ids: next }),
    reset: () => setLocal(null),
  }
}

/** Puts a reordered subset back into the slots that subset held in the full list. */
export function mergeOrder(all: string[], visible: string[]) {
  const moved = new Set(visible)
  let i = 0
  return all.map((id) => (moved.has(id) ? visible[i++] : id))
}

// While a save runs the grip is only marked aria-disabled: a truly disabled button drops keyboard focus to the top of the page.
const HANDLE = 'flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground active:cursor-grabbing aria-disabled:cursor-not-allowed aria-disabled:opacity-40'

function Row({
  id,
  name,
  as: Tag,
  className,
  handleClassName,
  disabled,
  held,
  onKey,
  onLeave,
  children,
}: {
  id: string
  name: string
  as: 'li' | 'div'
  className?: string
  handleClassName?: string
  disabled?: boolean
  held: boolean
  onKey: (id: string, event: KeyboardEvent<HTMLButtonElement>) => void
  onLeave: () => void
  children: (handle: ReactNode) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    attributes: { roleDescription: 'sıralanabilir' },
  })
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={(event) => onKey(id, event)}
      onBlur={held ? onLeave : undefined}
      aria-pressed={held || isDragging}
      data-grip={id}
      aria-label={`${name} sırasını değiştir`}
      title="Sürükleyerek sırala"
      className={cn(HANDLE, handleClassName)}
    >
      <GripVertical className="size-4" aria-hidden="true" />
    </button>
  )
  return (
    <Tag
      ref={setNodeRef as (node: HTMLElement | null) => void}
      data-sort-row=""
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(className, (isDragging || held) && 'relative z-20 scroll-my-4 shadow-lg ring-1 ring-primary')}
    >
      {children(handle)}
    </Tag>
  )
}

export function SortableList<T>({
  items,
  idOf,
  nameOf,
  onMove,
  children,
  layout = 'list',
  className,
  itemClassName,
  handleClassName,
  disabled,
  before,
}: {
  items: T[]
  idOf: (item: T) => string
  nameOf: (item: T) => string
  onMove: (ids: string[]) => void
  children: (item: T, handle: ReactNode, index: number) => ReactNode
  layout?: 'list' | 'grid'
  className?: string
  itemClassName?: string
  handleClassName?: string
  disabled?: boolean
  before?: ReactNode
}) {
  const contextId = useId()
  const listRef = useRef<HTMLUListElement & HTMLDivElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  // Keyboard moves are counted in the list itself, not measured on screen: a measured move lands on
  // the wrong card whenever a key arrives while the page is still scrolling or cards are settling.
  const [held, setHeld] = useState<{ id: string; order: string[] } | null>(null)
  const [said, setSaid] = useState('')

  const ids = items.map(idOf)
  const byId = new Map(items.map((item) => [idOf(item), item]))
  const names = new Map(items.map((item) => [idOf(item), nameOf(item)]))
  const name = (id: UniqueIdentifier) => names.get(String(id)) ?? 'Kayıt'
  const place = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1

  const holding = held && !disabled && byId.has(held.id) ? held : null
  const order = holding ? [...holding.order.filter((id) => byId.has(id)), ...ids.filter((id) => !holding.order.includes(id))] : ids
  const shown = holding ? order.flatMap((id) => byId.get(id) ?? []) : items
  const heldId = holding?.id
  const heldAt = holding ? order.indexOf(holding.id) : -1

  useLayoutEffect(() => {
    if (heldId === undefined) return
    const grip = listRef.current?.querySelector<HTMLElement>(`[data-grip="${CSS_ESCAPE(heldId)}"]`)
    if (!grip) return
    if (document.activeElement !== grip) grip.focus({ preventScroll: true })
    ;(grip.closest('[data-sort-row]') ?? grip).scrollIntoView({ block: 'nearest', behavior: 'instant' })
  }, [heldId, heldAt])

  function end(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    onMove(arrayMove(ids, from, to))
  }

  function drop() {
    if (!holding) return
    setHeld(null)
    setSaid(`${name(holding.id)} ${heldAt + 1}. sıraya bırakıldı.`)
    if (order.some((id, i) => id !== ids[i])) onMove(order)
  }

  function key(id: string, event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    const grab = event.key === ' ' || event.key === 'Enter'
    if (holding?.id !== id) {
      if (!grab) return
      event.preventDefault()
      if (event.repeat) return
      setHeld({ id, order: ids })
      setSaid(`${name(id)} tutuldu. Şu an ${place(id)}. sırada.`)
      return
    }
    if (grab) {
      event.preventDefault()
      if (!event.repeat) drop()
      return
    }
    if (event.key === 'Tab') {
      drop()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setHeld(null)
      setSaid(`Vazgeçildi. ${name(id)} eski sırasında.`)
      return
    }
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const to = heldAt + step
    if (to < 0 || to >= order.length) {
      setSaid(`${name(id)} zaten ${to < 0 ? 'ilk' : 'son'} sırada.`)
      return
    }
    setHeld({ id, order: arrayMove(order, heldAt, to) })
    setSaid(`${name(id)} ${to + 1}. sıraya geldi.`)
  }

  // Reordering can blur the grip for a moment before the layout effect focuses it again, so judge a frame later.
  function leave() {
    requestAnimationFrame(() => {
      const grip = listRef.current?.querySelector('[data-grip][aria-pressed="true"]')
      if (!grip || grip === document.activeElement) return
      setHeld(null)
      setSaid('Vazgeçildi. Kayıt eski sırasında.')
    })
  }

  const List = layout === 'list' ? 'ul' : 'div'
  const item = layout === 'list' ? 'li' : 'div'
  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => setHeld(null)}
      onDragEnd={end}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'Sırayı değiştirmek için boşluk tuşuna bas, ok tuşlarıyla taşı, bırakmak için tekrar boşluğa bas. Esc vazgeçer.',
        },
        announcements: {
          onDragStart: ({ active }) => `${name(active.id)} tutuldu. Şu an ${place(active.id)}. sırada.`,
          onDragOver: ({ active, over }) => (over ? `${name(active.id)} ${place(over.id)}. sıraya geldi.` : undefined),
          onDragEnd: ({ active, over }) => (over ? `${name(active.id)} ${place(over.id)}. sıraya bırakıldı.` : `${name(active.id)} bırakıldı.`),
          onDragCancel: ({ active }) => `Vazgeçildi. ${name(active.id)} eski sırasında.`,
        },
      }}
    >
      <SortableContext items={order} strategy={layout === 'list' ? verticalListSortingStrategy : rectSortingStrategy}>
        <List ref={listRef} className={className}>
          {before}
          {shown.map((entry, i) => {
            const id = idOf(entry)
            return (
              <Row
                key={id}
                id={id}
                name={nameOf(entry)}
                as={item}
                className={itemClassName}
                handleClassName={handleClassName}
                disabled={disabled}
                held={heldId === id}
                onKey={key}
                onLeave={leave}
              >
                {(handle) => children(entry, handle, i)}
              </Row>
            )
          })}
        </List>
      </SortableContext>
      <div data-sort-live="" aria-live="assertive" aria-atomic="true" className="sr-only">
        {said}
      </div>
    </DndContext>
  )
}

const CSS_ESCAPE = (value: string) => (typeof window !== 'undefined' && window.CSS?.escape ? window.CSS.escape(value) : value.replace(/["\\]/g, '\\$&'))
