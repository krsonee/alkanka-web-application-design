import 'server-only'
import { cache } from 'react'
import { Events } from '@/components/alkanka/events'
import { getMember, type Member } from '@/lib/member'
import { getLeagueSettings, lastPaidPeriods, leagueTable, listLeagueMatches } from '@/lib/predictions'
import { periodBounds, type Award, type PeriodKind } from '@/lib/predictions-shared'
import { LEAGUE_SPORT_ADDRESS, LEAGUE_TABLE_ADDRESS, fromAddress } from '@/lib/record-links'
import { GoalBoard } from './goal-board'
import { League, type LeagueStart } from './league'
import type { BoardView, PeriodView } from './standings'

export const leagueMember = cache(() => getMember())
/** Read once per request: the page's title and the page itself ask for the same list. */
export const leagueMatches = cache((userId: string | null) => listLeagueMatches(userId, { crowd: true }))

/** Every special league, read once per request: a league's own page asks for the list twice. */
export const allBoards = cache(async () => (await import('@/lib/prediction-boards')).listBoards())

const STARTS: Record<string, LeagueStart> = { acik: 'open', bekleyen: 'waiting', sonuclanan: 'done', lig: 'league' }

/** What a shared address may ask for: `tab`, `table` and `sport` are its ?sekme=, ?tablo= and ?spor= words. */
export type LeagueAddress = { tab?: string; table?: string; sport?: string }

/**
 * The prediction league as /tahminler shows it. `focus` opens one match; `league` is the league of a
 * /tahminler/lig/... address, 0 for the general one.
 */
export async function LeagueView({ focus, league, tab, table, sport }: { focus?: number; league?: number } & LeagueAddress) {
  const member = await leagueMember()
  const [matches, week, month, all, settings, paid, awards, boards] = await Promise.all([
    leagueMatches(member?.id ?? null),
    leagueTable('week'),
    leagueTable('month'),
    leagueTable('all'),
    getLeagueSettings(),
    lastPaidPeriods().catch(() => ({})),
    member ? import('@/lib/prediction-awards').then((m) => m.myAwards(member.id)).catch(() => [] as Award[]) : ([] as Award[]),
    specialLeagues(league),
  ])
  const now = Date.now()
  // A match's own page shows that match; the goal events stay on the list page.
  const goals = focus == null ? await goalSection(member, now) : null
  if (matches.length === 0 && awards.length === 0) {
    return (
      <>
        {goals}
        <Events view="tahminler" />
      </>
    )
  }

  const period = (kind: PeriodKind): PeriodView => ({ on: settings[kind].on, places: settings[kind].places, label: periodBounds(kind, now).label })
  return (
    <>
      {goals}
      <League
        matches={matches}
        tables={{ week, month, all }}
        periods={{ week: period('week'), month: period('month') }}
        paid={paid}
        boards={boards}
        awards={awards}
        meId={member?.id ?? null}
        serverNow={now}
        focus={focus}
        start={tab ? STARTS[tab] : undefined}
        league={league}
        table={fromAddress(LEAGUE_TABLE_ADDRESS, table)}
        sport={fromAddress(LEAGUE_SPORT_ADDRESS, sport)}
      />
    </>
  )
}

/** How many special leagues the page shows at once, newest first. */
const BOARDS_SHOWN = 8
/** A closed league keeps its table and winners on the page for this long. */
const BOARD_DAYS = 14

/**
 * Special leagues with a match in them, each with its own table. `keep` is the league whose page is open:
 * it is listed even when it is older or emptier than the rest. A failure here leaves the general league standing.
 */
async function specialLeagues(keep?: number): Promise<BoardView[]> {
  try {
    const [{ boardTable }, all] = await Promise.all([import('@/lib/prediction-boards'), allBoards()])
    const cutoff = Date.now() - BOARD_DAYS * 86_400_000
    const recent = all.filter((b) => b.matches > 0 && (b.open || (b.closedAt !== null && Date.parse(b.closedAt) > cutoff))).slice(0, BOARDS_SHOWN)
    const kept = keep ? all.find((b) => b.id === keep) : undefined
    const boards = kept && !recent.includes(kept) ? [kept, ...recent] : recent
    return Promise.all(boards.map(async (b) => ({ ...b, table: await boardTable(b.id) })))
  } catch (error) {
    console.error('[league] özel ligler okunamadı', (error as Error).message)
    return []
  }
}

/**
 * "Gol başı ödül" events. Sponsor events follow the rule of every other sponsor page: members only,
 * and only after the age question is answered. A failure here never takes the league down with it.
 */
async function goalSection(member: Member | null, now: number) {
  try {
    const [{ goalBoard }, { getSponsorAccess }] = await Promise.all([import('@/lib/goal-rewards'), import('@/lib/sponsor-access')])
    const [events, access] = await Promise.all([goalBoard(member?.id ?? null), getSponsorAccess(member)])
    const open = access.state === 'open'
    const held = events.some((e) => e.category === 'sponsor') && !open
    const note = !held ? null : access.state === 'guest' ? 'Sponsor etkinlikleri sadece üyelere açık. Giriş yaptığında burada görünür.' : 'Sponsor etkinliklerini görmek için önce sponsorlar sayfasında 18 yaş onayını ver.'
    return <GoalBoard events={open ? events : events.filter((e) => e.category !== 'sponsor')} serverNow={now} sponsorNote={note} />
  } catch (error) {
    console.error('[goal] etkinlikler okunamadı', (error as Error).message)
    return null
  }
}
