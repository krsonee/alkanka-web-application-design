import 'server-only'
import { cache } from 'react'
import { Events } from '@/components/alkanka/events'
import { getMember } from '@/lib/member'
import { getLeagueSettings, lastPaidPeriods, leagueTable, listLeagueMatches } from '@/lib/predictions'
import { periodBounds, type Award, type PeriodKind } from '@/lib/predictions-shared'
import { League, type LeagueStart } from './league'
import type { PeriodView } from './standings'

export const leagueMember = cache(() => getMember())
/** Read once per request: the page's title and the page itself ask for the same list. */
export const leagueMatches = cache((userId: string | null) => listLeagueMatches(userId, { crowd: true }))

const STARTS: Record<string, LeagueStart> = { acik: 'open', bekleyen: 'waiting', sonuclanan: 'done', lig: 'league' }

/** The prediction league as /tahminler shows it; `focus` opens one match, `tab` is the ?sekme= of a shared address. */
export async function LeagueView({ focus, tab }: { focus?: number; tab?: string }) {
  const member = await leagueMember()
  const [matches, week, month, all, settings, paid, awards] = await Promise.all([
    leagueMatches(member?.id ?? null),
    leagueTable('week'),
    leagueTable('month'),
    leagueTable('all'),
    getLeagueSettings(),
    lastPaidPeriods().catch(() => ({})),
    member ? import('@/lib/prediction-awards').then((m) => m.myAwards(member.id)).catch(() => [] as Award[]) : ([] as Award[]),
  ])
  if (matches.length === 0 && awards.length === 0) return <Events view="tahminler" />

  const now = Date.now()
  const period = (kind: PeriodKind): PeriodView => ({ on: settings[kind].on, places: settings[kind].places, label: periodBounds(kind, now).label })
  return (
    <League
      matches={matches}
      tables={{ week, month, all }}
      periods={{ week: period('week'), month: period('month') }}
      paid={paid}
      awards={awards}
      meId={member?.id ?? null}
      serverNow={now}
      focus={focus}
      start={tab ? STARTS[tab] : undefined}
    />
  )
}
