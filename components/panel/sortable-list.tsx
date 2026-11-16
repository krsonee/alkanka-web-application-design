'use client'

import { useId, useState, type ReactNode } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
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

const HANDLE = 'flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40'

function Row({
  id,
  name,
  as: Tag,
  className,
  handleClassName,
  disabled,
  children,
}: {
  id: string
  name: string
  as: 'li' | 'div'
  className?: string
  handleClassName?: string
  disabled?: boolean
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
      disabled={disabled}
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
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(className, isDragging && 'relative z-20 shadow-lg ring-1 ring-primary')}
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = items.map(idOf)
  const names = new Map(items.map((item) => [idOf(item), nameOf(item)]))
  const name = (id: UniqueIdentifier) => names.get(String(id)) ?? 'Kayıt'
  const place = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1

  function end(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    onMove(arrayMove(ids, from, to))
  }

  const List = layout === 'list' ? 'ul' : 'div'
  const item = layout === 'list' ? 'li' : 'div'
  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={closestCenter}
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
      <SortableContext items={ids} strategy={layout === 'list' ? verticalListSortingStrategy : rectSortingStrategy}>
        <List className={className}>
          {before}
          {items.map((entry, i) => (
            <Row key={idOf(entry)} id={idOf(entry)} name={nameOf(entry)} as={item} className={itemClassName} handleClassName={handleClassName} disabled={disabled}>
              {(handle) => children(entry, handle, i)}
            </Row>
          ))}
        </List>
      </SortableContext>
    </DndContext>
  )
}
