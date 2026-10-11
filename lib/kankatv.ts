export const LEAGUES = [
  { slug: 'eng.1', name: 'Premier Lig', country: 'İngiltere' },
  { slug: 'esp.1', name: 'LaLiga', country: 'İspanya' },
  { slug: 'ita.1', name: 'Serie A', country: 'İtalya' },
  { slug: 'ger.1', name: 'Bundesliga', country: 'Almanya' },
  { slug: 'fra.1', name: 'Ligue 1', country: 'Fransa' },
  { slug: 'por.1', name: 'Liga Portugal', country: 'Portekiz' },
] as const

export type LeagueSlug = (typeof LEAGUES)[number]['slug']

export const CHANNELS = [
  { slug: 'aspor', name: 'A Spor', channelId: 'UCJElRTCNEmLemgirqvsW63Q', tag: 'Spor' },
  { slug: 'trtspor', name: 'TRT Spor', channelId: 'UCfYNqluOf8EbQkL44otydMw', tag: 'Spor' },
  { slug: 'atv', name: 'ATV', channelId: 'UCUVZ7T_kwkxDOGFcDlFI-hg', tag: 'Ulusal' },
  { slug: 'tv8', name: 'TV8', channelId: 'UCp4N3g1zcvp8WE2qJ_JKqBg', tag: 'Ulusal' },
] as const

export type MatchState = 'pre' | 'in' | 'post'
export type MatchEvent = { minute: string; kind: 'goal' | 'yellow' | 'red'; player: string; side: 'home' | 'away'; note?: string }
export type Side = { name: string; short: string; logo: string | null; score: string | null }
export type Match = {
  id: string
  league: LeagueSlug
  date: string
  day: string
  state: MatchState
  clock: string
  detail: string
  home: Side
  away: Side
  events: MatchEvent[]
}
export type Channel = (typeof CHANNELS)[number] & { live: boolean; videoId: string | null }
export type KankaTvData = { matches: Match[]; channels: Channel[]; days: string[]; updatedAt: string }

const TZ = 'Europe/Istanbul'
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

export function istanbulDay(input: number | string | Date) {
  return dayFormat.format(new Date(input))
}

type EspnCompetitor = {
  homeAway: 'home' | 'away'
  score?: string
  team: { id: string; displayName: string; shortDisplayName?: string; logo?: string }
}
type EspnDetail = {
  clock?: { displayValue?: string }
  team?: { id: string }
  scoringPlay?: boolean
  redCard?: boolean
  yellowCard?: boolean
  penaltyKick?: boolean
  ownGoal?: boolean
  athletesInvolved?: { displayName?: string; shortName?: string }[]
}
type EspnEvent = {
  id: string
  date: string
  status: { displayClock?: string; type: { state: MatchState; shortDetail?: string; description?: string } }
  competitions: { competitors: EspnCompetitor[]; details?: EspnDetail[] }[]
}

function toSide(c: EspnCompetitor | undefined, state: MatchState): Side {
  return {
    name: c?.team.displayName ?? '-',
    short: c?.team.shortDisplayName ?? c?.team.displayName ?? '-',
    logo: c?.team.logo ?? null,
    score: state === 'pre' ? null : (c?.score ?? '0'),
  }
}

function toEvents(details: EspnDetail[] = [], homeId?: string): MatchEvent[] {
  return details.flatMap((d) => {
    const kind = d.scoringPlay ? 'goal' : d.redCard ? 'red' : d.yellowCard ? 'yellow' : null
    if (!kind) return []
    const athlete = d.athletesInvolved?.[0]
    const note = kind === 'goal' ? (d.ownGoal ? 'K.K.' : d.penaltyKick ? 'P' : undefined) : undefined
    return [
      {
        minute: d.clock?.displayValue ?? '',
        kind,
        player: athlete?.shortName ?? athlete?.displayName ?? '',
        side: d.team?.id === homeId ? 'home' : 'away',
        note,
      },
    ]
  })
}

function translateDetail(state: MatchState, raw: string) {
  if (state === 'post') return 'MS'
  if (/half/i.test(raw) && state === 'in') return 'İY'
  return raw
}

async function fetchLeagueDay(league: LeagueSlug, ymd: string): Promise<Match[]> {
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${ymd}`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return []
    const json = (await res.json()) as { events?: EspnEvent[] }
    return (json.events ?? []).map((e) => {
      const comp = e.competitions[0]
      const state = e.status.type.state
      const home = comp?.competitors.find((c) => c.homeAway === 'home')
      const away = comp?.competitors.find((c) => c.homeAway === 'away')
      return {
        id: e.id,
        league,
        date: e.date,
        day: istanbulDay(e.date),
        state,
        clock: e.status.displayClock ?? '',
        detail: translateDetail(state, e.status.type.shortDetail ?? ''),
        home: toSide(home, state),
        away: toSide(away, state),
        events: toEvents(comp?.details, home?.team.id),
      }
    })
  } catch {
    return []
  }
}

async function getLiveVideoId(channelId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124', 'Accept-Language': 'tr' },
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const html = await res.text()
    if (!html.includes('"isLive":true')) return null
    return html.match(/"videoId":"([\w-]{11})"/)?.[1] ?? null
  } catch {
    return null
  }
}

export async function getKankaTvData(): Promise<KankaTvData> {
  const now = Date.now()
  const days = [-1, 0, 1].map((offset) => istanbulDay(now + offset * 86_400_000))
  const queryDays = [-1, 0, 1, 2].map((offset) => istanbulDay(now + offset * 86_400_000).replaceAll('-', ''))

  const [matchGroups, liveVideos] = await Promise.all([
    Promise.all(LEAGUES.flatMap((l) => queryDays.map((d) => fetchLeagueDay(l.slug, d)))),
    Promise.all(CHANNELS.map((c) => getLiveVideoId(c.channelId))),
  ])

  const seen = new Set<string>()
  const matches = matchGroups
    .flat()
    .filter((m) => days.includes(m.day) && !seen.has(m.id) && seen.add(m.id))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    matches,
    channels: CHANNELS.map((c, i) => ({ ...c, live: Boolean(liveVideos[i]), videoId: liveVideos[i] })),
    days,
    updatedAt: new Date(now).toISOString(),
  }
}
