/** Weekly closing sprint: the last 24 hours of the Istanbul week (Sunday) count KP x1.5 on the weekly league. */
export const SPRINT_MULTIPLIER = 1.5

const DAY = 86_400_000
const WEEK = 7 * DAY
const SPRINT_FROM = 6 * DAY
/** Turkey has been fixed at UTC+3 since 2016, so plain offset math is exact. */
const TR_OFFSET = 3 * 3_600_000

export type SprintState = { active: boolean; endsAt: number; startsAt: number }

export function sprintState(now = Date.now()): SprintState {
  const tr = new Date(now + TR_OFFSET)
  const weekday = (tr.getUTCDay() + 6) % 7
  const intoDay = tr.getUTCHours() * 3_600_000 + tr.getUTCMinutes() * 60_000 + tr.getUTCSeconds() * 1000 + tr.getUTCMilliseconds()
  const intoWeek = weekday * DAY + intoDay
  const weekStart = now - intoWeek
  return { active: intoWeek >= SPRINT_FROM, startsAt: weekStart + SPRINT_FROM, endsAt: weekStart + WEEK }
}
