export const SPORTS = [
  { slug: 'futbol', id: 1, name: 'Futbol' },
  { slug: 'basketbol', id: 2, name: 'Basketbol' },
  { slug: 'voleybol', id: 8, name: 'Voleybol' },
] as const

export type SportSlug = (typeof SPORTS)[number]['slug']
export const DAY_OFFSETS = [-1, 0, 1] as const
export type DayOffset = (typeof DAY_OFFSETS)[number]

export type ChannelGroup = 'oyun' | 'slot' | 'tv' | 'spor' | 'uye'

export const CHANNEL_GROUPS: { key: ChannelGroup; label: string }[] = [
  { key: 'oyun', label: 'E-spor yayınları' },
  { key: 'slot', label: 'Şans oyunları' },
  { key: 'tv', label: 'TV & Mizah & Haber' },
  { key: 'spor', label: 'Sports' },
  { key: 'uye', label: 'Kanka yayıncılar' },
]

type TvChannel = { slug: string; name: string; group: 'spor' | 'tv'; tag: string; path: string }

const TV_CHANNELS: TvChannel[] = [
  { slug: 'aspor', name: 'A Spor', group: 'spor', tag: 'Spor', path: 'channel/UCJElRTCNEmLemgirqvsW63Q' },
  { slug: 'trtspor', name: 'TRT Spor', group: 'spor', tag: 'Spor', path: '@trtspor' },
  { slug: 'htspor', name: 'HT Spor', group: 'spor', tag: 'Spor', path: '@htspor' },
  { slug: 'beinhaber', name: 'beIN Sports', group: 'spor', tag: 'Spor haber', path: '@beinsportsturkiye' },
  { slug: 'atv', name: 'ATV', group: 'tv', tag: 'Ulusal', path: 'channel/UCUVZ7T_kwkxDOGFcDlFI-hg' },
  { slug: 'tv8', name: 'TV8', group: 'tv', tag: 'Ulusal', path: '@tv8' },
  { slug: 'tv85', name: 'TV8,5', group: 'tv', tag: 'Ulusal', path: 'channel/UCp4N3g1zcvp8WE2qJ_JKqBg' },
  { slug: 'kanald', name: 'Kanal D', group: 'tv', tag: 'Ulusal', path: '@kanald' },
  { slug: 'startv', name: 'Star TV', group: 'tv', tag: 'Ulusal', path: '@startv' },
  { slug: 'now', name: 'NOW', group: 'tv', tag: 'Ulusal', path: '@nowtv' },
  { slug: 'kanal7', name: 'Kanal 7', group: 'tv', tag: 'Ulusal', path: '@kanal7' },
  { slug: 'dmax', name: 'DMAX', group: 'tv', tag: 'Belgesel', path: '@dmaxturkiye' },
  { slug: 'trthaber', name: 'TRT Haber', group: 'tv', tag: 'Haber', path: '@trthaber' },
  { slug: 'ahaber', name: 'A Haber', group: 'tv', tag: 'Haber', path: '@ahaber' },
  { slug: 'cnnturk', name: 'CNN Türk', group: 'tv', tag: 'Haber', path: '@cnnturk' },
  { slug: 'sozcu', name: 'Sözcü TV', group: 'tv', tag: 'Haber', path: '@sozcutelevizyonu' },
  { slug: 'tv100', name: 'tv100', group: 'tv', tag: 'Haber', path: '@tv100' },
  { slug: 'tgrthaber', name: 'TGRT Haber', group: 'tv', tag: 'Haber', path: '@tgrthaber' },
  { slug: 'guldurguldur', name: 'Güldür Güldür Show', group: 'tv', tag: 'Mizah', path: '@guldurguldurshow' },
  { slug: 'cokguzelhareketler', name: 'Çok Güzel Hareketler 2', group: 'tv', tag: 'Mizah', path: '@cokguzelhareketler2' },
  { slug: 'tolgshow', name: 'Tolgshow', group: 'tv', tag: 'Mizah', path: '@tolgshow' },
  { slug: 'cmylmz', name: 'Cem Yılmaz', group: 'tv', tag: 'Mizah', path: '@cmylmz' },
  { slug: 'kafalar', name: 'Kafalar', group: 'tv', tag: 'Mizah', path: '@kafalar' },
  { slug: 'yasinobuz', name: 'Yasin Obuz', group: 'tv', tag: 'Mizah', path: '@yasinobuz' },
]

const KICK_CATEGORY_IDS = { slot: 28, spor: 75 } as const

/** Real-world sport only; football video games (EA FC, eFootball) are e-sports. */
const SPORT_CATEGORY = /^sports$|^football$|soccer|basketball|volleyball|tennis|formula|motorsport|ufc|mma|boxing|wrestling/i
const CHANCE_CATEGORY = /\b(slots?|casino|gambling|poker|roulette|blackjack)\b/i
const NOT_GAME_CATEGORY = /^(just chatting|irl|music|asmr|art|talk shows?.*|podcasts?|travel.*|food.*|special events|pools.*|chess)$/i

function classifyKick(category: string): Exclude<ChannelGroup, 'tv' | 'uye'> | null {
  if (!category) return null
  if (CHANCE_CATEGORY.test(category)) return 'slot'
  if (SPORT_CATEGORY.test(category)) return 'spor'
  if (NOT_GAME_CATEGORY.test(category)) return null
  return 'oyun'
}

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
export type Channel = {
  slug: string
  name: string
  group: ChannelGroup
  tag: string
  live: boolean
  embedUrl: string | null
  /** Set for streams that cannot be embedded (Telegram); the player shows a join button instead. */
  externalUrl?: string | null
  title: string | null
  avatar: string | null
  viewers: number | null
}
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
      { headers: HEADERS, next: { revalidate: day === 0 ? 30 : 600 }, signal: AbortSignal.timeout(8000) },
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

/** 365Scores competition ids: top domestic leagues, UEFA club cups and national-team competitions. */
const FIXTURE_COMPETITIONS = new Map<number, number>([
  [572, 100], [573, 95], [7016, 90], [7, 88], [11, 87], [78, 86], [17, 85], [25, 84], [35, 83],
  [57, 80], [73, 79], [113, 76], [649, 75], [72, 74], [570, 60],
])
const FIXTURE_NAME = /konferans|conference|dünya kupası|world cup|avrupa şampiyonası|euro 20|eleme|qualif/i

export type Fixture = {
  extId: number
  league: string
  home: string
  away: string
  homeLogo: string
  awayLogo: string
  kickoff: string
  started: boolean
  /** Left out for football. */
  sport?: FeedSport
}

const FEED_SPORT_ID = { football: 1, basketball: 2, tennis: 3, volleyball: 8 } as const

/** The sports whose fixtures and results the feed carries. */
export type FeedSport = keyof typeof FEED_SPORT_ID

export const isFeedSport = (v: unknown): v is FeedSport => typeof v === 'string' && Object.hasOwn(FEED_SPORT_ID, v)

export type FeedCountry = { id: number; name: string }
export type FeedLeague = { id: number; name: string; country: string }
export type FeedTeam = { name: string; logo: string }

async function feedJson<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}&${BASE_QUERY}`, { headers: HEADERS, next: { revalidate }, signal: AbortSignal.timeout(8000) })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

type RawCountry = { id: number; name: string; sportTypes?: number[]; isInternational?: boolean }
type RawCompetition = { id: number; name: string; countryId: number; sportId?: number; popularityRank?: number }

/** Every country (and continent) with competitions in this sport: Türkiye first, then the international ones. Null when the feed is down. */
export async function getFeedCountries(sport: FeedSport): Promise<FeedCountry[] | null> {
  const id = FEED_SPORT_ID[sport]
  const raw = await feedJson<{ countries?: RawCountry[] }>(`/countries/?sports=${id}`, 86_400)
  if (!raw) return null
  const rank = (c: RawCountry) => (/^türkiye$/i.test(c.name.trim()) ? 0 : c.isInternational ? 1 : 2)
  return (raw.countries ?? [])
    .filter((c) => !c.sportTypes || c.sportTypes.includes(id))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'tr'))
    .map((c) => ({ id: c.id, name: tidy(c.name) }))
}

/** The competitions of one country, best known first. */
export async function getFeedLeagues(sport: FeedSport, countryId: number): Promise<FeedLeague[] | null> {
  const id = FEED_SPORT_ID[sport]
  const raw = await feedJson<{ competitions?: RawCompetition[]; countries?: RawCountry[] }>(`/competitions/?sports=${id}&countries=${countryId}`, 21_600)
  if (!raw) return null
  const country = tidy((raw.countries ?? []).find((c) => c.id === countryId)?.name)
  return (raw.competitions ?? [])
    .filter((c) => c.countryId === countryId && (c.sportId === undefined || c.sportId === id))
    .sort((a, b) => (b.popularityRank ?? 0) - (a.popularityRank ?? 0) || a.name.localeCompare(b.name, 'tr'))
    .map((c) => ({ id: c.id, name: tidy(c.name), country }))
}

export type LeagueFixtures = { league: FeedLeague; fixtures: Fixture[]; teams: FeedTeam[] }

/** The games a competition still has to play, soonest first, and the sides that play in it. Null when it is not a competition of this sport. */
export async function getLeagueFixtures(sport: FeedSport, leagueId: number): Promise<LeagueFixtures | null> {
  const id = FEED_SPORT_ID[sport]
  const raw = await feedJson<{ games?: RawGame[]; countries?: RawCountry[]; competitions?: RawCompetition[]; competitors?: RawCompetitor[] }>(
    `/games/fixtures/?competitions=${leagueId}&showOdds=false`,
    300,
  )
  const comp = raw?.competitions?.find((c) => c.id === leagueId)
  if (!raw || !comp || (comp.sportId !== undefined && comp.sportId !== id)) return null
  const league: FeedLeague = { id: leagueId, name: tidy(comp.name), country: tidy((raw.countries ?? []).find((c) => c.id === comp.countryId)?.name) }
  const games = (raw.games ?? []).filter((g) => g.competitionId === leagueId)
  const now = Date.now()
  const fixtures = games
    .filter((g) => g.statusGroup !== 3 && g.statusGroup !== 4 && new Date(g.startTime).getTime() > now)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 60)
    .map((g) => ({
      extId: g.id,
      league: league.name,
      home: g.homeCompetitor.name.trim(),
      away: g.awayCompetitor.name.trim(),
      homeLogo: crest(g.homeCompetitor.id, g.homeCompetitor.imageVersion),
      awayLogo: crest(g.awayCompetitor.id, g.awayCompetitor.imageVersion),
      kickoff: new Date(g.startTime).toISOString(),
      started: false,
      ...(sport === 'football' ? {} : { sport }),
    }))
  const sides = new Map<number, FeedTeam>()
  for (const c of [...(raw.competitors ?? []), ...games.flatMap((g) => [g.homeCompetitor, g.awayCompetitor])]) {
    if (c?.name && !sides.has(c.id)) sides.set(c.id, { name: c.name.trim(), logo: crest(c.id, c.imageVersion) })
  }
  return { league, fixtures, teams: [...sides.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr')).slice(0, 200) }
}

/** Upcoming football fixtures for a calendar day (YYYY-MM-DD, Istanbul time), most prestigious first. */
export async function getFixtures(day: string): Promise<Fixture[]> {
  const [y, m, d] = day.split('-')
  if (!y || !m || !d) return []
  try {
    const date = `${d}/${m}/${y}`
    const res = await fetch(
      `${API}/games/allscores/?${BASE_QUERY}&sports=1&startDate=${date}&endDate=${date}&showOdds=false&onlyMajorGames=false`,
      { headers: HEADERS, next: { revalidate: 900 }, signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return []
    const raw = (await res.json()) as RawScores
    const comps = new Map((raw.competitions ?? []).map((c) => [c.id, c]))
    const rank = (id: number) => {
      const c = comps.get(id)
      if (!c) return -1
      return FIXTURE_COMPETITIONS.get(id) ?? (FIXTURE_NAME.test(c.name) && !/women|kadın|u1\d|u2\d/i.test(c.name) ? 70 : -1)
    }
    return (raw.games ?? [])
      .filter((g) => rank(g.competitionId) >= 0)
      .sort((a, b) => rank(b.competitionId) - rank(a.competitionId) || a.startTime.localeCompare(b.startTime))
      .map((g) => ({
        extId: g.id,
        league: tidy(comps.get(g.competitionId)?.name),
        home: g.homeCompetitor.name.trim(),
        away: g.awayCompetitor.name.trim(),
        homeLogo: crest(g.homeCompetitor.id, g.homeCompetitor.imageVersion),
        awayLogo: crest(g.awayCompetitor.id, g.awayCompetitor.imageVersion),
        kickoff: new Date(g.startTime).toISOString(),
        started: g.statusGroup === 3 || g.statusGroup === 4,
      }))
  } catch {
    return []
  }
}

/** Final score of a finished game, or null while it is still to be played or in progress. */
export async function getFinalScore(id: number): Promise<{ home: number; away: number } | null> {
  try {
    const res = await fetch(`${API}/game/?${BASE_QUERY}&gameId=${id}`, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const { game } = (await res.json()) as { game?: RawGame }
    if (!game || game.statusGroup !== 4) return null
    const home = game.homeCompetitor.score
    const away = game.awayCompetitor.score
    return typeof home === 'number' && typeof away === 'number' && home >= 0 && away >= 0 ? { home, away } : null
  } catch {
    return null
  }
}

export type FinalResult = { home: number; away: number; htHome: number | null; htAway: number | null; corners: number | null; cards: number | null }

const STAGE_HALF_TIME = 7
const STAGE_FULL_TIME = 9
const STAT_YELLOWS = 1

type RawStage = { id: number; homeCompetitorScore?: number; awayCompetitorScore?: number }

/**
 * Everything the prediction league scores from a finished game: the 90-minute score (extra time and
 * penalties are left out), the half-time score, corners and cards. A figure the feed does not carry is null.
 */
export async function getFinalResult(id: number): Promise<FinalResult | null> {
  try {
    const res = await fetch(`${API}/game/?${BASE_QUERY}&gameId=${id}`, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const { game } = (await res.json()) as { game?: RawGame & { stages?: RawStage[] } }
    if (!game || game.statusGroup !== 4) return null
    const stage = (stageId: number) => {
      const s = (game.stages ?? []).find((x) => x.id === stageId)
      const h = s?.homeCompetitorScore
      const a = s?.awayCompetitorScore
      return typeof h === 'number' && typeof a === 'number' && h >= 0 && a >= 0 ? { home: h, away: a } : null
    }
    const live = { home: game.homeCompetitor.score, away: game.awayCompetitor.score }
    const full = stage(STAGE_FULL_TIME) ?? (typeof live.home === 'number' && typeof live.away === 'number' && live.home >= 0 && live.away >= 0 ? { home: live.home, away: live.away } : null)
    if (!full) return null
    const half = stage(STAGE_HALF_TIME)
    const stats = await fetch(`${API}/game/stats/?${BASE_QUERY}&games=${id}`, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? (r.json() as Promise<{ statistics?: { id: number; value?: string | number }[] }>) : null))
      .catch(() => null)
    const sum = (statId: number) => {
      const list = (stats?.statistics ?? []).filter((s) => s.id === statId)
      return list.length ? list.reduce((acc, s) => acc + (Number.parseInt(String(s.value ?? 0), 10) || 0), 0) : null
    }
    const yellows = sum(STAT_YELLOWS)
    const reds = sum(STAT_REDS)
    return {
      home: full.home,
      away: full.away,
      htHome: half && half.home <= full.home && half.away <= full.away ? half.home : null,
      htAway: half && half.home <= full.home && half.away <= full.away ? half.away : null,
      corners: sum(STAT_CORNERS),
      cards: yellows === null ? null : yellows + (reds ?? 0),
    }
  } catch {
    return null
  }
}

export type SportResult = FinalResult & { first: '1' | '2' | null }

type NamedStage = { name?: string; homeCompetitorScore?: number; awayCompetitorScore?: number }

/**
 * The final figures of a finished game in any sport the feed carries. Football keeps its own reader
 * (90 minutes, corners, cards). Elsewhere the score is the feed's own final figure: points with overtime
 * in basketball, sets in volleyball and tennis. The first half is the first two quarters; the first set
 * is read from the stage named after it. A figure the feed does not carry is null.
 */
export async function getSportResult(id: number, sport: 'football' | 'basketball' | 'volleyball' | 'tennis' | 'esports'): Promise<SportResult | null> {
  if (sport === 'esports') return null
  if (sport === 'football') {
    const r = await getFinalResult(id)
    return r ? { ...r, first: null } : null
  }
  try {
    const res = await fetch(`${API}/game/?${BASE_QUERY}&gameId=${id}`, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const { game } = (await res.json()) as { game?: RawGame & { stages?: NamedStage[] } }
    if (!game || game.statusGroup !== 4) return null
    const home = game.homeCompetitor.score
    const away = game.awayCompetitor.score
    if (typeof home !== 'number' || typeof away !== 'number' || home < 0 || away < 0) return null
    const stage = (name: RegExp) => {
      const s = (game.stages ?? []).find((x) => name.test(String(x.name ?? '').trim()))
      const h = s?.homeCompetitorScore
      const a = s?.awayCompetitorScore
      return typeof h === 'number' && typeof a === 'number' && h >= 0 && a >= 0 ? { home: h, away: a } : null
    }
    const out: SportResult = { home, away, htHome: null, htAway: null, corners: null, cards: null, first: null }
    if (sport === 'basketball') {
      const q1 = stage(/^(q1|1\. ?çeyrek)$/i)
      const q2 = stage(/^(q2|2\. ?çeyrek)$/i)
      if (q1 && q2 && q1.home + q2.home <= home && q1.away + q2.away <= away) {
        out.htHome = q1.home + q2.home
        out.htAway = q1.away + q2.away
      }
    } else {
      const set1 = stage(/^set 1$/i)
      if (set1 && set1.home !== set1.away) out.first = set1.home > set1.away ? '1' : '2'
    }
    return out
  } catch {
    return null
  }
}

export type LiveGame = {
  id: number
  league: string
  top: boolean
  clock: string
  home: { id: number; name: string; score: number }
  away: { id: number; name: string; score: number }
}

/** In-play football games with scores, used by the goal-alert scanner. Never cached for long. */
export async function getLiveFootball(): Promise<LiveGame[]> {
  const raw = await fetchScores('futbol', 0)
  if (!raw) return []
  const comps = new Map((raw.competitions ?? []).map((c) => [c.id, c]))
  return (raw.games ?? [])
    .filter((g) => g.statusGroup === 3)
    .map((g) => {
      const comp = comps.get(g.competitionId)
      return {
        id: g.id,
        league: tidy(comp?.name),
        top: FIXTURE_COMPETITIONS.has(g.competitionId) || Boolean(comp && FIXTURE_NAME.test(comp.name) && !/women|kadın|u1\d|u2\d/i.test(comp.name)),
        clock: g.gameTimeDisplay ?? g.statusText ?? '',
        home: { id: g.homeCompetitor.id, name: g.homeCompetitor.name.trim(), score: Math.max(0, g.homeCompetitor.score ?? 0) },
        away: { id: g.awayCompetitor.id, name: g.awayCompetitor.name.trim(), score: Math.max(0, g.awayCompetitor.score ?? 0) },
      }
    })
}

export type GameSnapshot = {
  state: MatchState
  home: { id: number; name: string; score: number }
  away: { id: number; name: string; score: number }
  /** Sides of every goal in the order they were scored. */
  goals: ('home' | 'away')[]
}

export async function getGameSnapshot(id: number): Promise<GameSnapshot | null> {
  try {
    const res = await fetch(`${API}/game/?${BASE_QUERY}&gameId=${id}`, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const { game } = (await res.json()) as { game?: RawGame & NonNullable<RawDetail['game']> }
    if (!game) return null
    const homeId = game.homeCompetitor.id
    return {
      state: toState(game.statusGroup),
      home: { id: homeId, name: game.homeCompetitor.name.trim(), score: Math.max(0, game.homeCompetitor.score ?? 0) },
      away: { id: game.awayCompetitor.id, name: game.awayCompetitor.name.trim(), score: Math.max(0, game.awayCompetitor.score ?? 0) },
      goals: (game.events ?? []).filter((e) => e.eventType.id === 1).map((e) => (e.competitorId === homeId ? 'home' : 'away')),
    }
  } catch {
    return null
  }
}

export type GameLive = GameSnapshot & {
  league: string
  /** Elapsed minute; 0 before kick-off. */
  minute: number
  statusGroup: number
  startTime: string
  corners: number | null
  reds: number
}

const STAT_CORNERS = 8
const STAT_REDS = 2

async function gameStats(id: number): Promise<{ corners: number | null; reds: number | null }> {
  try {
    const res = await fetch(`${API}/game/stats/?${BASE_QUERY}&games=${id}`, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!res.ok) return { corners: null, reds: null }
    const { statistics = [] } = (await res.json()) as { statistics?: { id: number; value?: string | number }[] }
    const sum = (statId: number) => {
      const list = statistics.filter((s) => s.id === statId)
      if (!list.length) return null
      return list.reduce((acc, s) => acc + (Number.parseInt(String(s.value ?? 0), 10) || 0), 0)
    }
    return { corners: sum(STAT_CORNERS), reds: sum(STAT_REDS) }
  } catch {
    return { corners: null, reds: null }
  }
}

/** Full live state for auto-settled TV events: score, goal order, minute, corners and red cards. */
export async function getGameLive(id: number): Promise<GameLive | null> {
  try {
    const res = await fetch(`${API}/game/?${BASE_QUERY}&gameId=${id}`, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const { game } = (await res.json()) as {
      game?: RawGame & NonNullable<RawDetail['game']> & { gameTime?: number; competitionDisplayName?: string }
    }
    if (!game) return null
    const homeId = game.homeCompetitor.id
    const state = toState(game.statusGroup)
    const stats = state === 'pre' ? { corners: 0, reds: 0 } : await gameStats(id)
    const redEvents = (game.events ?? []).filter((e) => e.eventType.id === 3).length
    return {
      state,
      league: tidy(game.competitionDisplayName),
      minute: state === 'pre' ? 0 : Math.max(0, Math.floor(Number(game.gameTime ?? 0))),
      statusGroup: game.statusGroup,
      startTime: game.startTime,
      home: { id: homeId, name: game.homeCompetitor.name.trim(), score: Math.max(0, game.homeCompetitor.score ?? 0) },
      away: { id: game.awayCompetitor.id, name: game.awayCompetitor.name.trim(), score: Math.max(0, game.awayCompetitor.score ?? 0) },
      goals: (game.events ?? []).filter((e) => e.eventType.id === 1).map((e) => (e.competitorId === homeId ? 'home' : 'away')),
      corners: stats.corners,
      reds: Math.max(stats.reds ?? 0, redEvents),
    }
  } catch {
    return null
  }
}

export async function getMatchDetail(id: number): Promise<MatchDetail> {
  try {
    const res = await fetch(`${API}/game/?${BASE_QUERY}&gameId=${id}`, { headers: HEADERS, next: { revalidate: 30 }, signal: AbortSignal.timeout(8000) })
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

// YouTube's /live page is ~4MB, over Next's 2MB fetch-cache limit, so `revalidate` silently
// never caches and every request re-downloads it. Cache the parsed id in memory instead.
const LIVE_ID_TTL = 5 * 60_000
const liveIdCache = new Map<string, { at: number; value: Promise<string | null> }>()

export function getLiveVideoId(path: string): Promise<string | null> {
  const hit = liveIdCache.get(path)
  if (hit && Date.now() - hit.at < LIVE_ID_TTL) return hit.value
  const value = fetchLiveVideoId(path)
  liveIdCache.set(path, { at: Date.now(), value })
  return value
}

async function fetchLiveVideoId(path: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/${path}/live`, {
      headers: { ...HEADERS, 'Accept-Language': 'tr' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()
    // `/live` only canonicalises to a watch URL when the channel itself is broadcasting; the
    // looser `"isLive":true` check also matched recommended videos from other channels.
    const canonical = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1]
    if (!canonical) return null
    const detailsId = html.match(/"videoDetails":\{"videoId":"([\w-]{11})"/)?.[1]
    if (detailsId && detailsId !== canonical) return null
    if (!html.includes('"isLiveNow":true')) return null
    if (html.includes('"playableInEmbed":false')) return null
    return canonical
  } catch {
    return null
  }
}

type KickStream = {
  title: string
  viewer_count: number
  channel: { slug: string; username: string; profile_pic: string | null }
  category?: { name?: string } | null
}

function kickChannel(s: KickStream, group: ChannelGroup, tag: string): Channel {
  return {
    slug: `kick-${s.channel.slug}`,
    name: s.channel.username,
    group,
    tag,
    live: true,
    embedUrl: `https://player.kick.com/${encodeURIComponent(s.channel.slug)}?autoplay=true&muted=false`,
    title: s.title,
    avatar: s.channel.profile_pic,
    viewers: s.viewer_count,
  }
}

async function fetchKick(query: string, limit: number): Promise<KickStream[]> {
  try {
    const res = await fetch(`https://web.kick.com/api/v1/livestreams?limit=${limit}&sort=viewer_count_desc&language=tr${query}`, {
      headers: HEADERS,
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: { livestreams?: KickStream[] } }
    return json.data?.livestreams ?? []
  } catch {
    return []
  }
}

const KICK_PER_GROUP = 24

/**
 * Every Kick stream is filed by its own category name, so a stream only lands in a tab it
 * belongs to; streams with no fitting tab (Just Chatting, music, ...) are dropped.
 */
async function getKickChannels(): Promise<Channel[]> {
  const batches = await Promise.all([
    fetchKick(`&category_id=${KICK_CATEGORY_IDS.slot}`, KICK_PER_GROUP),
    fetchKick(`&category_id=${KICK_CATEGORY_IDS.spor}`, KICK_PER_GROUP),
    fetchKick('', 100),
  ])
  const seen = new Set<string>()
  const buckets: Record<'oyun' | 'slot' | 'spor', Channel[]> = { oyun: [], slot: [], spor: [] }
  for (const s of batches.flat()) {
    if (seen.has(s.channel.slug)) continue
    seen.add(s.channel.slug)
    const category = s.category?.name?.trim() ?? ''
    const group = classifyKick(category)
    if (!group || buckets[group].length >= KICK_PER_GROUP) continue
    buckets[group].push(kickChannel(s, group, category))
  }
  const byViewers = (a: Channel, b: Channel) => (b.viewers ?? 0) - (a.viewers ?? 0)
  return [...buckets.oyun.sort(byViewers), ...buckets.slot.sort(byViewers), ...buckets.spor.sort(byViewers)]
}

export async function getChannels(): Promise<Channel[]> {
  const [ids, kickAll] = await Promise.all([
    Promise.all(TV_CHANNELS.map((c) => getLiveVideoId(c.path))),
    getKickChannels(),
  ])
  const tv: Channel[] = TV_CHANNELS.map((c, i) => ({
    slug: c.slug,
    name: c.name,
    group: c.group,
    tag: c.tag,
    live: Boolean(ids[i]),
    embedUrl: ids[i] ? `https://www.youtube.com/embed/${ids[i]}?autoplay=1&mute=0&playsinline=1&enablejsapi=1` : null,
    title: null,
    avatar: null,
    viewers: null,
  }))
  tv.sort((a, b) => Number(b.live) - Number(a.live))
  return [...tv, ...kickAll]
}
