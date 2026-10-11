export const SPORTS = [
  { slug: 'futbol', id: 1, name: 'Futbol' },
  { slug: 'basketbol', id: 2, name: 'Basketbol' },
  { slug: 'voleybol', id: 8, name: 'Voleybol' },
] as const

export type SportSlug = (typeof SPORTS)[number]['slug']
export const DAY_OFFSETS = [-1, 0, 1] as const
export type DayOffset = (typeof DAY_OFFSETS)[number]

export const CHANNELS = [
  { slug: 'aspor', name: 'A Spor', channelId: 'UCJElRTCNEmLemgirqvsW63Q', tag: 'Spor' },
  { slug: 'trtspor', name: 'TRT Spor', channelId: 'UCfYNqluOf8EbQkL44otydMw', tag: 'Spor' },
  { slug: 'atv', name: 'ATV', channelId: 'UCUVZ7T_kwkxDOGFcDlFI-hg', tag: 'Ulusal' },
  { slug: 'tv8', name: 'TV8', channelId: 'UCp4N3g1zcvp8WE2qJ_JKqBg', tag: 'Ulusal' },
] as const

export type MatchState = 'pre' | 'in' | 'post'
export type Side = { id: number; name: string; logo: string; score: number | null }
export type Match = {
  id: number
  start: string
  state: MatchState
  status: string
  clock: string
  home: Side
  away: Side
}
export type Competition = { id: number; name: string; country: string; matches: Match[] }
export type Channel = (typeof CHANNELS)[number] & { live: boolean; videoId: string | null }
export type LiveCounts = Record<SportSlug, number>
export type ScoreBoard = {
  sport: SportSlug
  day: DayOffset
  competitions: Competition[]
  liveCounts: LiveCounts
  updatedAt: string
  failed: boolean
}
export type MatchEvent = { minute: string; kind: 'goal' | 'yellow' | 'red'; player: string; side: 'home' | 'away' }
export type Period = { name: string; home: number; away: number }
export type MatchDetail = { events: MatchEvent[]; periods: Period[] }

const API = 'https://webws.365scores.com/web'
const BASE_QUERY = 'appTypeId=5&langId=33&timezoneName=Europe/Istanbul&userCountryId=-1'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' }
const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' })

const crest = (id: number, version = 1) =>
  `https://imagecache.365scores.com/image/upload/f_png,w_56,h_56,c_limit,q_auto:eco,d_Competitors:default1.png/v${version}/Competitors/${id}`

type RawCompetitor = { id: number; name: string; score?: number; imageVersion?: number }
type RawGame = {
  id: number
  competitionId: number
  startTime: string
  statusGroup: number
  shortStatusText?: string
  statusText?: string
  gameTimeDisplay?: string
  homeCompetitor: RawCompetitor
  awayCompetitor: RawCompetitor
}
type RawScores = {
  games?: RawGame[]
  competitions?: { id: number; name: string; countryId: number; popularityRank?: number }[]
  countries?: { id: number; name: string }[]
}

export function parseSport(value: string | null): SportSlug {
  return SPORTS.some((s) => s.slug === value) ? (value as SportSlug) : 'futbol'
}

export function parseDay(value: string | null): DayOffset {
  const n = Number(value)
  return DAY_OFFSETS.includes(n as DayOffset) ? (n as DayOffset) : 0
}

const toState = (group: number): MatchState => (group === 3 ? 'in' : group === 4 ? 'post' : 'pre')

function toSide(c: RawCompetitor, state: MatchState): Side {
  const score = typeof c.score === 'number' && c.score >= 0 && state !== 'pre' ? c.score : null
  return { id: c.id, name: c.name.trim(), logo: crest(c.id, c.imageVersion), score }
}

async function fetchScores(sport: SportSlug, day: DayOffset): Promise<RawScores | null> {
  const sportId = SPORTS.find((s) => s.slug === sport)!.id
  const date = dayFormat.format(Date.now() + day * 86_400_000)
  try {
    const res = await fetch(
      `${API}/games/allscores/?${BASE_QUERY}&sports=${sportId}&startDate=${date}&endDate=${date}&showOdds=false&onlyMajorGames=false`,
      { headers: HEADERS, next: { revalidate: day === 0 ? 30 : 600 } },
    )
    if (!res.ok) return null
    return (await res.json()) as RawScores
  } catch {
    return null
  }
}

const tidy = (s = '') => {
  const t = s.trim()
  return t.charAt(0).toLocaleUpperCase('tr') + t.slice(1)
}

function toCompetitions(raw: RawScores): Competition[] {
  const countries = new Map((raw.countries ?? []).map((c) => [c.id, tidy(c.name)]))
  const comps = new Map(
    (raw.competitions ?? []).map((c) => [
      c.id,
      { id: c.id, name: tidy(c.name), country: countries.get(c.countryId) ?? '', rank: c.popularityRank ?? 0, matches: [] as Match[] },
    ]),
  )
  for (const g of raw.games ?? []) {
    const comp = comps.get(g.competitionId)
    if (!comp) continue
    const state = toState(g.statusGroup)
    comp.matches.push({
      id: g.id,
      start: g.startTime,
      state,
      status: (state === 'in' ? g.statusText : g.shortStatusText) ?? g.shortStatusText ?? '',
      clock: g.gameTimeDisplay ?? '',
      home: toSide(g.homeCompetitor, state),
      away: toSide(g.awayCompetitor, state),
    })
  }
  return [...comps.values()]
    .filter((c) => c.matches.length)
    .sort((a, b) => b.rank - a.rank)
    .map(({ rank: _rank, ...c }) => ({ ...c, matches: c.matches.sort((a, b) => a.start.localeCompare(b.start)) }))
}

const countLive = (raw: RawScores | null) => (raw?.games ?? []).filter((g) => g.statusGroup === 3).length

export async function getScoreBoard(sport: SportSlug, day: DayOffset): Promise<ScoreBoard> {
  const todays = await Promise.all(SPORTS.map((s) => fetchScores(s.slug, 0)))
  const selected = day === 0 ? todays[SPORTS.findIndex((s) => s.slug === sport)] : await fetchScores(sport, day)
  return {
    sport,
    day,
    competitions: selected ? toCompetitions(selected) : [],
    liveCounts: Object.fromEntries(SPORTS.map((s, i) => [s.slug, countLive(todays[i])])) as LiveCounts,
    updatedAt: new Date().toISOString(),
    failed: !selected,
  }
}

type RawDetail = {
  game?: {
    homeCompetitor: { id: number }
    stages?: { name: string; homeCompetitorScore?: number; awayCompetitorScore?: number }[]
    events?: { competitorId: number; gameTimeDisplay?: string; playerId?: number; eventType: { id: number } }[]
    members?: { id: number; name: string; shortName?: string }[]
  }
}

const EVENT_KINDS: Record<number, MatchEvent['kind']> = { 1: 'goal', 2: 'yellow', 3: 'red' }

export async function getMatchDetail(id: number): Promise<MatchDetail> {
  try {
    const res = await fetch(`${API}/game/?${BASE_QUERY}&gameId=${id}`, { headers: HEADERS, next: { revalidate: 30 } })
    if (!res.ok) return { events: [], periods: [] }
    const { game } = (await res.json()) as RawDetail
    if (!game) return { events: [], periods: [] }
    const members = new Map((game.members ?? []).map((m) => [m.id, m.shortName ?? m.name]))
    const events = (game.events ?? []).flatMap((e) => {
      const kind = EVENT_KINDS[e.eventType.id]
      if (!kind) return []
      return [
        {
          minute: e.gameTimeDisplay ?? '',
          kind,
          player: (e.playerId && members.get(e.playerId)) || '',
          side: e.competitorId === game.homeCompetitor.id ? ('home' as const) : ('away' as const),
        },
      ]
    })
    const periods = (game.stages ?? [])
      .filter((s) => typeof s.homeCompetitorScore === 'number' && s.homeCompetitorScore >= 0 && !/maç sonu|toplam|final|normal süre/i.test(s.name))
      .map((s) => ({ name: s.name, home: s.homeCompetitorScore!, away: s.awayCompetitorScore ?? 0 }))
    return { events, periods }
  } catch {
    return { events: [], periods: [] }
  }
}

async function getLiveVideoId(channelId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
      headers: { ...HEADERS, 'Accept-Language': 'tr' },
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

export async function getChannels(): Promise<Channel[]> {
  const ids = await Promise.all(CHANNELS.map((c) => getLiveVideoId(c.channelId)))
  return CHANNELS.map((c, i) => ({ ...c, live: Boolean(ids[i]), videoId: ids[i] }))
}
