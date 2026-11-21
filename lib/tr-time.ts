/**
 * Every time the site and the panel show or ask for is Turkey time. Turkey has kept UTC+3 all year
 * since 2016, so a typed time can be turned into a moment without knowing the visitor's own clock.
 */
export const TR_TZ = 'Europe/Istanbul'
export const TR_OFFSET = '+03:00'
export const TR_ZONE_NOTE = 'Türkiye saati (GMT+3)'

const TR_MS = 3 * 3_600_000

type Moment = string | number | Date

const shifted = (at: Moment) => new Date(new Date(at).getTime() + TR_MS)

/** A moment as a `datetime-local` field shows it, in Turkey time. Empty for a missing or broken date. */
export function trInput(at: Moment | null | undefined): string {
  if (at === null || at === undefined || at === '') return ''
  const d = shifted(at)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16)
}

/** A moment as a `date` field shows it, in Turkey time. */
export const trDateInput = (at: Moment | null | undefined) => trInput(at).slice(0, 10)

/** What a `datetime-local` or `date` field holds, read as Turkey time. Null when it is not a date. */
export function trInputToIso(value: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::(\d{2}))?)?$/.exec(String(value ?? '').trim())
  if (!m) return null
  const d = new Date(`${m[1]}T${m[2] ?? '00:00'}:${m[3] ?? '00'}${TR_OFFSET}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** The same in milliseconds; NaN when the field does not hold a date. */
export function trInputMs(value: string | null | undefined): number {
  const iso = trInputToIso(value)
  return iso ? Date.parse(iso) : Number.NaN
}

/** The Turkey calendar day a moment falls on: "2026-11-21". */
export const trDay = (at: Moment = Date.now()) => shifted(at).toISOString().slice(0, 10)

/** Where a Turkey day starts and where the next one does. */
export function trDayBounds(day: string) {
  const start = Date.parse(`${day}T00:00:00${TR_OFFSET}`)
  return { start: new Date(start).toISOString(), end: new Date(start + 86_400_000).toISOString() }
}
