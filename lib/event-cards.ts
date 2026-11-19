import type { EventItem } from '@/components/alkanka/data'

/** The part of an event that shows on its card; an empty id is a card that does not exist yet. */
export type EventCardInput = Pick<EventItem, 'id' | 'kind' | 'title' | 'subtitle' | 'prize' | 'image'>

export type EventCardRow = EventCardInput & { hidden: boolean; entry: number; endsAt: string | null }

export function toEventCardRow(event: EventItem, hidden: boolean): EventCardRow {
  return {
    id: event.id,
    kind: event.kind,
    title: event.title,
    subtitle: event.subtitle,
    prize: event.prize,
    image: event.image,
    hidden,
    entry: event.entry,
    endsAt: event.endsAt ?? null,
  }
}
