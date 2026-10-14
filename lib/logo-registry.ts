import { PREDICTIONS, SPECIAL_ODDS } from '@/components/alkanka/data'
import { splitMatch } from '@/lib/split-match'
import { siteOptions } from '@/lib/sites'

export async function listLogoSponsors() {
  return (await siteOptions()).map((s) => ({ id: s.id, label: s.name, initials: s.initials }))
}

export const LOGO_TEAMS = Array.from(
  new Set([...SPECIAL_ODDS.flatMap((o) => splitMatch(o.match)), ...PREDICTIONS.flatMap((p) => [p.home, p.away])].filter(Boolean)),
).map((name) => ({ id: name, label: name, initials: name.slice(0, 2).toUpperCase() }))
