import { PREDICTIONS, SPECIAL_ODDS, SPONSORS } from '@/components/alkanka/data'
import { splitMatch } from '@/lib/split-match'

export const LOGO_SPONSORS = SPONSORS.map((s) => ({ id: s.id, label: s.name, initials: s.initials }))

export const LOGO_TEAMS = Array.from(
  new Set([...SPECIAL_ODDS.flatMap((o) => splitMatch(o.match)), ...PREDICTIONS.flatMap((p) => [p.home, p.away])].filter(Boolean)),
).map((name) => ({ id: name, label: name, initials: name.slice(0, 2).toUpperCase() }))
