export type TaskPeriod = 'once' | 'daily' | 'weekly' | 'monthly'

export const PERIODS: { value: TaskPeriod; label: string }[] = [
  { value: 'once', label: 'Tek seferlik' },
  { value: 'daily', label: 'Günlük' },
  { value: 'weekly', label: 'Haftalık' },
  { value: 'monthly', label: 'Aylık' },
]

export const STREAK_DAYS = [
  { day: 1, reward: 25 },
  { day: 2, reward: 40 },
  { day: 3, reward: 60 },
  { day: 4, reward: 80 },
  { day: 5, reward: 110 },
  { day: 6, reward: 150 },
  { day: 7, reward: 500, vip: true },
]

export function isPeriod(value: unknown): value is TaskPeriod {
  return value === 'once' || value === 'daily' || value === 'weekly' || value === 'monthly'
}

/** Turkey has been on fixed UTC+3 since 2016, so a constant offset is exact. */
export function trDay(date = new Date()) {
  return new Date(date.getTime() + 3 * 3600000).toISOString().slice(0, 10)
}

/** Empty for one-off tasks; otherwise a prefixed key that changes when the period rolls over. */
export function periodKey(period: TaskPeriod, date = new Date()) {
  const day = trDay(date)
  if (period === 'daily') return `D${day}`
  if (period === 'monthly') return `M${day.slice(0, 7)}`
  if (period === 'weekly') {
    const d = new Date(`${day}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    return `W${d.toISOString().slice(0, 10)}`
  }
  return ''
}

/** Absolute start of the current period in Turkey time; null for one-off tasks. */
export function periodStart(period: TaskPeriod, date = new Date()): Date | null {
  const key = periodKey(period, date)
  if (!key) return null
  const day = key.startsWith('M') ? `${key.slice(1)}-01` : key.slice(1)
  return new Date(`${day}T00:00:00+03:00`)
}

export function periodFromKey(key: string): TaskPeriod {
  return key.startsWith('D') ? 'daily' : key.startsWith('W') ? 'weekly' : key.startsWith('M') ? 'monthly' : 'once'
}
