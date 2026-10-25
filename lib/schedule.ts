export type Schedule = { startAt?: string; endAt?: string }

const LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

// Panel inputs are datetime-local values entered in Türkiye time (UTC+3, no DST).
export function parseLocal(value?: string) {
  if (!value || !LOCAL_RE.test(value)) return NaN
  return Date.parse(`${value}:00+03:00`)
}

export function cleanLocal(value: unknown) {
  const v = String(value ?? '').trim()
  return LOCAL_RE.test(v) ? v : ''
}

export type ScheduleState = 'live' | 'upcoming' | 'ended'

export function scheduleState(s: Schedule, now = Date.now()): ScheduleState {
  const start = parseLocal(s.startAt)
  const end = parseLocal(s.endAt)
  if (!Number.isNaN(start) && now < start) return 'upcoming'
  if (!Number.isNaN(end) && now > end) return 'ended'
  return 'live'
}

export function isScheduledLive(s: Schedule, now = Date.now()) {
  return scheduleState(s, now) === 'live'
}

export function formatLocal(value?: string) {
  if (!value || !LOCAL_RE.test(value)) return ''
  const [d, t] = value.split('T')
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y} ${t}`
}
