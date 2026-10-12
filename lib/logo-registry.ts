import { PREDICTIONS, SPECIAL_ODDS } from '@/components/alkanka/data'
import { splitMatch } from '@/lib/split-match'

/** Sponsor logos live on the sites table, edited from the Sponsorlar menu. */
export const LOGO_SPONSORS: { id: string; label: string; initials: string }[] = []

export const LOGO_TEAMS = Array.from(
  new Set([...SPECIAL_ODDS.flatMap((o) => splitMatch(o.match)), ...PREDICTIONS.flatMap((p) => [p.home, p.away])].filter(Boolean)),
).map((name) => ({ id: name, label: name, initials: name.slice(0, 2).toUpperCase() }))
