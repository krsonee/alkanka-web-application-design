import 'server-only'
import { rows, sql } from '@/lib/db'
import { credit } from '@/lib/member'
import { ensureCommunity } from '@/lib/community'
import { getContent, setContent } from '@/lib/content'
import {
  LEGACY_SET,
  MARKET_IDS,
  PERIOD_LABEL,
  SPORTS,
  answersError,
  cleanAnswers,
  defaultSet,
  gradePick,
  marketList,
  normalizePrize,
  normalizeSet,
  normalizeSettings,
  parseScore,
  parseSport,
  periodBounds,
  resultError,
  resultNeeds,
  sportOf,
  startingSet,
  voidedBy,
  type Answers,
  type LeagueSettings,
  type MarketId,
  type MatchResult,
  type Outcome,
  type Period,
  type PeriodKind,
  type PeriodPrizes,
  type Prize,
  type QuestionSet,
  type Sport,
} from '@/lib/predictions-shared'

export const LEAGUE_SETTINGS_KEY = 'prediction_league'

let ready: Promise<unknown> | null = null

/** The league's own tables. The match and pick tables live with the rest of the community schema. */
export function ensureLeague() {
  ready ??= (async () => {
    await ensureCommunity()
    await rows(sql`CREATE TABLE IF NOT EXISTS league_awards (
      id serial PRIMARY KEY, user_id text NOT NULL, user_name text NOT NULL, source text NOT NULL, ref text NOT NULL, place int,
      title text NOT NULL, kind text NOT NULL, amount int NOT NULL DEFAULT 0, item_ref text NOT NULL DEFAULT '', item_name text NOT NULL DEFAULT '',
      status text NOT NULL, needs_username boolean NOT NULL DEFAULT false, site_username text, note text,
      created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, UNIQUE (user_id, source, ref))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS league_periods (
      key text PRIMARY KEY, kind text NOT NULL, label text NOT NULL, winners jsonb NOT NULL DEFAULT '[]', paid_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS league_boards (
      id serial PRIMARY KEY, name text NOT NULL, general boolean NOT NULL DEFAULT false, places jsonb NOT NULL DEFAULT '[]',
      status text NOT NULL DEFAULT 'open', winners jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz)`)
    await rows(sql`ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS board_id int`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const iso = (v: unknown) => new Date(String(v)).toISOString()
const stamp = (ms: number) => new Date(ms).toISOString()

// --- Settings ------------------------------------------------------------

export async function getLeagueSettings(): Promise<LeagueSettings> {
  return normalizeSettings(await getContent<Partial<LeagueSettings>>(LEAGUE_SETTINGS_KEY).catch(() => null))
}

/** Saves the questions new matches of one sport open with. */
export async function saveLeagueDefaults(input: unknown, sportInput: unknown = 'football') {
  const current = await getLeagueSettings()
  const sport = parseSport(sportInput)
  const set = normalizeSet({ ...(input && typeof input === 'object' ? input : {}), sport })
  await checkSetPrize(set)
  await setContent(LEAGUE_SETTINGS_KEY, sport === 'football' ? { ...current, defaults: set } : { ...current, sportDefaults: { ...current.sportDefaults, [sport]: set } })
}

export async function setLeagueAuto(on: boolean) {
  const current = await getLeagueSettings()
  await setContent(LEAGUE_SETTINGS_KEY, { ...current, auto: Boolean(on) })
}

/** Confirms a market product or a sponsor still exists and stores its current name with the prize. */
export async function checkPrize(prize: Prize): Promise<Prize> {
  if (prize.kind === 'market') {
    const { listProducts } = await import('@/lib/market')
    const item = (await listProducts({ includeInactive: true })).find((p) => p.id === prize.ref)
    if (!item) throw new Error('Seçilen market ürünü bulunamadı.')
    return { ...prize, name: item.name }
  }
  if (prize.kind === 'cash') {
    const { siteOptions } = await import('@/lib/sites')
    const site = (await siteOptions()).find((s) => String(s.id) === prize.ref)
    if (!site) throw new Error('Seçilen sponsor site bulunamadı.')
    return { ...prize, name: site.name }
  }
  return prize
}

async function checkSetPrize(set: QuestionSet) {
  if (set.bonus?.prize) set.bonus.prize = await checkPrize(set.bonus.prize)
}

export async function saveLeaguePrizes(kind: PeriodKind, input: { on: boolean; places: unknown[] }) {
  const current = await getLeagueSettings()
  const raw = Array.isArray(input.places) ? input.places : []
  const places: Prize[] = []
  for (const [i, p] of raw.entries()) {
    const prize = normalizePrize(p)
    if (!prize) throw new Error(`${i + 1}. sıranın ödülü eksik. Tutarı ya da ürünü seç, istemiyorsan sırayı kaldır.`)
    places.push(await checkPrize(prize))
  }
  if (input.on && !places.length) throw new Error('Ödülü açmak için en az bir sıraya ödül gir.')
  const before = current[kind]
  const next: PeriodPrizes = { on: Boolean(input.on), places, since: input.on ? (before.on && before.since ? before.since : new Date().toISOString()) : null }
  await setContent(LEAGUE_SETTINGS_KEY, { ...current, [kind]: next })
}

// --- Matches -------------------------------------------------------------

export type MyPick = {
  answers: Answers
  points: number | null
  outcomes: Partial<Record<MarketId, Outcome>> | null
  kc: number
  kp: number
  bonus: boolean
}

export type Crowd = Partial<Record<MarketId, Record<string, number>>>

export type LeagueMatch = {
  id: number
  league: string
  home: string
  away: string
  homeLogo: string | null
  awayLogo: string | null
  extId: number | null
  kickoff: string
  /** When predictions lock; null means at kickoff. */
  closesAt: string | null
  homeGoals: number | null
  awayGoals: number | null
  settled: boolean
  picks: number
  /** The special league the match is filed under; null when it belongs to the general league. */
  boardId: number | null
  boardName: string | null
  set: QuestionSet
  result: MatchResult | null
  myPick: MyPick | null
  /** How members answered each question. Withheld while the viewer can still be swayed by it. */
  crowd: Crowd | null
}

const setOf = (raw: unknown): QuestionSet => (raw ? normalizeSet(raw) : LEGACY_SET)

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

const cleanFirst = (v: unknown): '1' | '2' | null => (v === '1' || v === '2' ? v : null)

function resultOf(x: Record<string, unknown>): MatchResult | null {
  if (!x.settled || x.home_goals === null || x.away_goals === null) return null
  const r = (x.result ?? {}) as Partial<MatchResult>
  return {
    home: Number(x.home_goals),
    away: Number(x.away_goals),
    htHome: num(r.htHome),
    htAway: num(r.htAway),
    corners: num(r.corners),
    cards: num(r.cards),
    first: cleanFirst(r.first),
  }
}

/** Picks made before questions existed only carry a score. */
function answersOf(answers: unknown, home: unknown, away: unknown): Answers {
  if (answers && typeof answers === 'object') return answers as Answers
  return home === null || home === undefined ? {} : { score: `${Number(home)}-${Number(away)}` }
}

export async function listLeagueMatches(userId: string | null, opts: { admin?: boolean; crowd?: boolean } = {}): Promise<LeagueMatch[]> {
  await ensureLeague()
  const admin = opts.admin ?? false
  const [r, crowdRows] = await Promise.all([
    rows(sql`SELECT m.*, (SELECT count(*) FROM league_picks p WHERE p.match_id = m.id) AS picks,
        (SELECT b.name FROM league_boards b WHERE b.id = m.board_id) AS board_name,
        mp.user_id AS my_id, mp.home AS my_home, mp.away AS my_away, mp.answers AS my_answers, mp.points AS my_points,
        mp.outcome AS my_outcome, mp.kc AS my_kc, mp.kp AS my_kp, mp.bonus AS my_bonus
      FROM league_matches m
      LEFT JOIN league_picks mp ON mp.match_id = m.id AND mp.user_id = ${userId ?? ''}
      WHERE ${admin}::boolean OR m.kickoff > now() - interval '7 days'
      ORDER BY m.settled ASC, m.kickoff ASC LIMIT 100`),
    opts.crowd || admin
      ? rows<{ match_id: number; key: string; value: string; n: string }>(sql`SELECT p.match_id, e.key, e.value, count(*) AS n
          FROM league_picks p JOIN league_matches m ON m.id = p.match_id
          CROSS JOIN LATERAL jsonb_each_text(coalesce(p.answers, jsonb_build_object('score', p.home::text || '-' || p.away::text))) e
          WHERE ${admin}::boolean OR m.kickoff > now() - interval '7 days'
          GROUP BY p.match_id, e.key, e.value`)
      : [],
  ])
  const crowds = new Map<number, Crowd>()
  for (const c of crowdRows) {
    if (!MARKET_IDS.includes(c.key as MarketId)) continue
    const crowd = crowds.get(Number(c.match_id)) ?? {}
    ;(crowd[c.key as MarketId] ??= {})[c.value] = Number(c.n)
    crowds.set(Number(c.match_id), crowd)
  }
  const now = Date.now()
  return r.map((x) => {
    const set = setOf(x.markets)
    const result = resultOf(x)
    const answers = x.my_id ? answersOf(x.my_answers, x.my_home, x.my_away) : null
    const points = x.my_points === null || x.my_points === undefined ? null : Number(x.my_points)
    const closed = Boolean(x.settled) || new Date(String(x.closes_at ?? x.kickoff)).getTime() <= now
    return {
      id: Number(x.id),
      league: String(x.league),
      home: String(x.home),
      away: String(x.away),
      homeLogo: x.home_logo ? String(x.home_logo) : null,
      awayLogo: x.away_logo ? String(x.away_logo) : null,
      extId: x.ext_id === null || x.ext_id === undefined ? null : Number(x.ext_id),
      kickoff: iso(x.kickoff),
      closesAt: x.closes_at ? iso(x.closes_at) : null,
      homeGoals: x.home_goals === null ? null : Number(x.home_goals),
      awayGoals: x.away_goals === null ? null : Number(x.away_goals),
      settled: Boolean(x.settled),
      picks: Number(x.picks),
      boardId: x.board_name ? Number(x.board_id) : null,
      boardName: x.board_name ? String(x.board_name) : null,
      set,
      result,
      myPick: answers
        ? {
            answers,
            points,
            // Matches scored before per-question results were stored are graded again on the way out.
            outcomes: (x.my_outcome as MyPick['outcomes']) ?? (result && points !== null ? gradePick(set, result, answers).outcomes : null),
            kc: Number(x.my_kc ?? 0),
            kp: Number(x.my_kp ?? 0),
            bonus: Boolean(x.my_bonus),
          }
        : null,
      crowd: admin || closed || answers ? (crowds.get(Number(x.id)) ?? {}) : null,
    }
  })
}

export async function savePick(user: { id: string; name: string }, matchId: number, input: Answers) {
  await ensureLeague()
  if (!Number.isSafeInteger(matchId) || matchId <= 0) throw new Error('Maç bulunamadı.')
  const [m] = await rows(sql`SELECT home, away, markets FROM league_matches WHERE id = ${matchId} AND NOT settled AND coalesce(closes_at, kickoff) > now()`)
  if (!m) throw new Error('Bu maç için tahminler kapandı.')
  const set = setOf(m.markets)
  const answers = cleanAnswers(set, input && typeof input === 'object' ? input : {})
  const problem = answersError(set, answers, { home: String(m.home), away: String(m.away) })
  if (problem) throw new Error(problem)
  const score = parseScore(answers.score)
  const saved = await rows(sql`INSERT INTO league_picks (match_id, user_id, user_name, home, away, answers)
    SELECT m.id, ${user.id}, ${user.name.slice(0, 40)}, ${score ? score[0] : null}::int, ${score ? score[1] : null}::int, ${JSON.stringify(answers)}::jsonb
    FROM league_matches m WHERE m.id = ${matchId} AND NOT m.settled AND coalesce(m.closes_at, m.kickoff) > now()
    ON CONFLICT (match_id, user_id) DO NOTHING RETURNING match_id`)
  if (!saved.length) throw new Error('Bu maç için zaten tahmin yaptın.')
}

export type LeaguePick = {
  userId: string
  name: string
  answers: Answers
  points: number | null
  outcomes: Partial<Record<MarketId, Outcome>> | null
  kc: number
  kp: number
  bonus: boolean
  at: string
}

/** Everyone who predicted this match, earliest first, for the panel. */
export async function leaguePicks(matchId: number, limit = 500): Promise<{ total: number; set: QuestionSet; home: string; away: string; picks: LeaguePick[] }> {
  await ensureLeague()
  const empty = { total: 0, set: LEGACY_SET, home: '', away: '', picks: [] }
  if (!Number.isSafeInteger(matchId) || matchId <= 0) return empty
  const [[m], count, list] = await Promise.all([
    rows(sql`SELECT * FROM league_matches WHERE id = ${matchId}`),
    rows<{ n: string }>(sql`SELECT count(*) AS n FROM league_picks WHERE match_id = ${matchId}`),
    rows(sql`SELECT user_id, user_name, home, away, answers, points, outcome, kc, kp, bonus, created_at FROM league_picks WHERE match_id = ${matchId} ORDER BY created_at ASC LIMIT ${limit}`),
  ])
  if (!m) return empty
  const set = setOf(m.markets)
  const result = resultOf(m)
  return {
    total: Number(count[0]?.n ?? 0),
    set,
    home: String(m.home),
    away: String(m.away),
    picks: list.map((x) => {
      const answers = answersOf(x.answers, x.home, x.away)
      const points = x.points === null || x.points === undefined ? null : Number(x.points)
      return {
        userId: String(x.user_id),
        name: String(x.user_name),
        answers,
        points,
        outcomes: (x.outcome as LeaguePick['outcomes']) ?? (result && points !== null ? gradePick(set, result, answers).outcomes : null),
        kc: Number(x.kc ?? 0),
        kp: Number(x.kp ?? 0),
        bonus: Boolean(x.bonus),
        at: iso(x.created_at),
      }
    }),
  }
}

// --- Standings -----------------------------------------------------------

export type LeagueRow = { userId: string; name: string; points: number; exact: number; hits: number; picks: number }

export type LeagueScope = PeriodKind | 'all'

/** Which matches a table counts: one special league's, or everything that feeds the general league. */
const inTable = (boardId: number | null) =>
  boardId === null ? sql`(m.board_id IS NULL OR NOT EXISTS (SELECT 1 FROM league_boards b WHERE b.id = m.board_id AND NOT b.general))` : sql`m.board_id = ${boardId}`

/** The special league a match is filed under, checked to be open; null files it under the general league. */
export async function openBoardId(v: unknown): Promise<number | null> {
  if (v === null || v === undefined || v === '' || v === 0) return null
  const id = Number(v)
  const found = Number.isSafeInteger(id) && id > 0 ? await rows(sql`SELECT id FROM league_boards WHERE id = ${id} AND status = 'open'`) : []
  if (!found.length) throw new Error('Seçilen lig bulunamadı ya da kapatılmış.')
  return id
}

export async function standings(start: number | null, end: number | null, limit: number, boardId: number | null = null): Promise<LeagueRow[]> {
  const since = start === null ? sql`'-infinity'::timestamptz` : sql`${stamp(start)}::timestamptz`
  const until = end === null ? sql`'infinity'::timestamptz` : sql`${stamp(end)}::timestamptz`
  const r = await rows(sql`SELECT p.user_id, max(p.user_name) AS name, coalesce(sum(p.points), 0) AS points,
      count(*) FILTER (WHERE p.exact) AS exact, count(*) FILTER (WHERE p.points > 0) AS hits, count(*) AS picks
    FROM league_picks p JOIN league_matches m ON m.id = p.match_id
    WHERE m.settled AND m.kickoff >= ${since} AND m.kickoff < ${until} AND ${inTable(boardId)}
    GROUP BY p.user_id
    ORDER BY points DESC, exact DESC, hits DESC, picks ASC, min(p.created_at) ASC, p.user_id ASC LIMIT ${limit}`)
  return r.map((x) => ({ userId: String(x.user_id), name: String(x.name), points: Number(x.points), exact: Number(x.exact), hits: Number(x.hits), picks: Number(x.picks) }))
}

export async function leagueTable(scope: LeagueScope, limit = 50): Promise<LeagueRow[]> {
  await ensureLeague()
  if (scope === 'all') return standings(null, null, limit)
  const p = periodBounds(scope, Date.now())
  return standings(p.start, p.end, limit)
}

// --- Managing matches ----------------------------------------------------

export async function addLeagueMatch(input: { league: string; home: string; away: string; kickoff: string; closesAt?: string; set?: unknown; sport?: string; bestOf?: number; boardId?: unknown }) {
  await ensureLeague()
  const when = new Date(input.kickoff)
  if (Number.isNaN(when.getTime())) throw new Error('Geçerli bir tarih gir.')
  if (!input.home.trim() || !input.away.trim()) throw new Error('Takım adlarını gir.')
  if (input.home.trim().toLocaleLowerCase('tr') === input.away.trim().toLocaleLowerCase('tr')) throw new Error('İki takım aynı olamaz.')
  if (when.getTime() < Date.now()) throw new Error('Maç saati geçmişte olamaz. Tarihi kontrol et.')
  let closes: string | null = null
  if (input.closesAt) {
    const c = new Date(input.closesAt)
    if (Number.isNaN(c.getTime())) throw new Error('Geçerli bir tahmin bitiş tarihi gir.')
    if (c.getTime() > when.getTime()) throw new Error('Tahmin bitişi maç saatinden sonra olamaz.')
    closes = c.toISOString()
  }
  const sport = parseSport(input.sport)
  // The sport chosen in the form wins over whatever the question set carries.
  const set = input.set
    ? normalizeSet({ ...(typeof input.set === 'object' ? input.set : {}), sport, bestOf: input.bestOf })
    : startingSet(await getLeagueSettings(), sport, input.bestOf)
  await checkSetPrize(set)
  const boardId = await openBoardId(input.boardId)
  await rows(sql`INSERT INTO league_matches (league, home, away, kickoff, closes_at, markets, board_id)
    VALUES (${input.league.trim().slice(0, 80) || SPORTS[sport].label}, ${input.home.trim().slice(0, 80)}, ${input.away.trim().slice(0, 80)}, ${when.toISOString()}, ${closes}, ${JSON.stringify(set)}::jsonb, ${boardId})`)
}

/** Questions can only change while nobody has answered them. */
export async function updateLeagueMarkets(id: number, input: unknown) {
  await ensureLeague()
  const set = normalizeSet(input)
  await checkSetPrize(set)
  const r = await rows(sql`UPDATE league_matches m SET markets = ${JSON.stringify(set)}::jsonb
    WHERE m.id = ${id} AND NOT m.settled AND NOT EXISTS (SELECT 1 FROM league_picks p WHERE p.match_id = m.id) RETURNING m.id`)
  if (!r.length) throw new Error('Bu maça tahmin yapılmış ya da maç sonuçlanmış; soruları artık değiştirilemez.')
}

export type FixtureInput = { extId: number; league: string; home: string; away: string; homeLogo: string; awayLogo: string; kickoff: string; sport?: string; set?: unknown }

const safeLogo = (url: string) => (/^https:\/\/imagecache\.365scores\.com\//.test(url) ? url : null)

/** Publishes fixtures picked from the calendar, each with its own questions or its sport's template; already-published games are skipped. */
export async function importLeagueFixtures(list: FixtureInput[], board?: unknown) {
  await ensureLeague()
  const settings = await getLeagueSettings()
  const boardId = await openBoardId(board)
  let added = 0
  for (const f of list.slice(0, 60)) {
    const when = new Date(f.kickoff)
    if (!Number.isSafeInteger(f.extId) || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) continue
    const sport = parseSport(f.sport)
    // Only sports the feed carries can be published from it: their results are read back by the same id.
    if (!SPORTS[sport].feed) continue
    const own = f.set && typeof f.set === 'object' ? normalizeSet({ ...f.set, sport }) : null
    if (own) await checkSetPrize(own)
    const set = JSON.stringify(own ?? startingSet(settings, sport))
    const r = await rows(sql`INSERT INTO league_matches (league, home, away, kickoff, home_logo, away_logo, ext_id, markets, board_id)
      VALUES (${f.league.slice(0, 80)}, ${f.home.slice(0, 80)}, ${f.away.slice(0, 80)}, ${when.toISOString()},
        ${safeLogo(f.homeLogo)}, ${safeLogo(f.awayLogo)}, ${f.extId}, ${set}::jsonb, ${boardId})
      ON CONFLICT (ext_id) WHERE ext_id IS NOT NULL DO NOTHING RETURNING id`)
    added += r.length
  }
  return added
}

export async function publishedFixtureIds(): Promise<number[]> {
  await ensureLeague()
  const r = await rows(sql`SELECT ext_id FROM league_matches WHERE ext_id IS NOT NULL AND kickoff > now() - interval '2 days'`)
  return r.map((x) => Number(x.ext_id))
}

export async function deleteLeagueMatch(id: number) {
  await ensureLeague()
  await rows(sql`DELETE FROM league_matches WHERE id = ${id} AND NOT settled`)
}

// --- Scoring -------------------------------------------------------------

const cleanStat = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)))

function cleanResult(input: Partial<MatchResult>): MatchResult {
  return {
    home: Math.trunc(Number(input.home)),
    away: Math.trunc(Number(input.away)),
    htHome: cleanStat(input.htHome),
    htAway: cleanStat(input.htAway),
    corners: cleanStat(input.corners),
    cards: cleanStat(input.cards),
    first: cleanFirst(input.first),
  }
}

export type SettleSummary = { picks: number; winners: number; kc: number; kp: number; gifts: number; voided: MarketId[] }

/**
 * Records the final result once, scores every pick and pays what it earned.
 * A question whose figure is left empty is cancelled: it earns nothing and does not stand in the way of the bonus.
 */
export async function settleLeagueMatch(id: number, input: Partial<MatchResult>): Promise<SettleSummary> {
  await ensureLeague()
  const [m] = await rows(sql`SELECT home, away, markets, settled FROM league_matches WHERE id = ${id}`)
  if (!m) throw new Error('Maç bulunamadı.')
  if (m.settled) throw new Error('Maç zaten sonuçlandırılmış.')
  const set = setOf(m.markets)
  const result = cleanResult(input)
  const problem = resultError(set, result)
  if (problem) throw new Error(problem)
  const voided = voidedBy(set, result)
  if (voided.length === marketList(set).length) throw new Error('Girilen sonuçla puanlanacak soru kalmıyor. Eksik rakamları gir.')
  const done = await rows(sql`UPDATE league_matches SET home_goals = ${result.home}, away_goals = ${result.away},
      result = ${JSON.stringify(result)}::jsonb, settled = true
    WHERE id = ${id} AND NOT settled RETURNING id`)
  if (!done.length) throw new Error('Maç zaten sonuçlandırılmış.')

  const picks = await rows(sql`SELECT user_id, home, away, answers FROM league_picks WHERE match_id = ${id}`)
  const { getBoostConfig } = await import('@/lib/boosts')
  const { applyMult, boostFor } = await import('@/lib/boosts-shared')
  const mult = await getBoostConfig().then((cfg) => boostFor(cfg, 'tahmin')).catch(() => 1)
  const gift = set.bonus?.prize && (set.bonus.prize.kind === 'market' || set.bonus.prize.kind === 'cash') ? set.bonus.prize : null
  const graded = picks.map((p) => {
    const g = gradePick(set, result, answersOf(p.answers, p.home, p.away))
    const kc = applyMult(g.kc, mult)
    return { user_id: String(p.user_id), points: g.pts, exact: g.exact, outcome: g.outcomes, kc, kp: g.kp, bonus: g.bonus, owed: kc > 0 || g.kp > 0 || (g.bonus && gift !== null) }
  })
  if (graded.length) {
    await rows(sql`UPDATE league_picks p SET points = x.points, exact = x.exact, outcome = x.outcome, kc = x.kc, kp = x.kp, bonus = x.bonus, paid = NOT x.owed
      FROM jsonb_to_recordset(${JSON.stringify(graded)}::jsonb) AS x(user_id text, points int, exact boolean, outcome jsonb, kc int, kp int, bonus boolean, owed boolean)
      WHERE p.match_id = ${id} AND p.user_id = x.user_id`)
  }
  await payLeagueMatches()
  return {
    picks: graded.length,
    winners: graded.filter((g) => g.points > 0 || g.owed).length,
    kc: graded.reduce((s, g) => s + g.kc, 0),
    kp: graded.reduce((s, g) => s + g.kp, 0),
    gifts: gift ? graded.filter((g) => g.bonus).length : 0,
    voided,
  }
}

/**
 * Pays every scored pick that is still owed. Each pick is claimed before it is paid, so a run that
 * stops halfway is finished by the next one and nobody is paid twice.
 */
export async function payLeagueMatches() {
  await ensureLeague()
  const owed = await rows(sql`SELECT p.match_id, p.user_id, p.user_name, p.kc, p.kp, p.bonus, m.home, m.away, m.markets
    FROM league_picks p JOIN league_matches m ON m.id = p.match_id WHERE NOT p.paid AND m.settled ORDER BY p.match_id LIMIT 2000`)
  if (!owed.length) return 0
  const { grantAward } = await import('@/lib/prediction-awards')
  const { ensureKp } = await import('@/lib/kanka-puan')
  await ensureKp()
  let paid = 0
  for (const p of owed) {
    const claimed = await rows(sql`UPDATE league_picks SET paid = true WHERE match_id = ${p.match_id} AND user_id = ${p.user_id} AND NOT paid RETURNING user_id`)
    if (!claimed.length) continue
    const userId = String(p.user_id)
    const match = `${p.home} - ${p.away}`
    try {
      if (Number(p.kc) > 0) await credit(userId, Number(p.kc), `Tahmin ödülü (${match})`)
      if (Number(p.kp) > 0) {
        await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note)
          VALUES (${userId}, 'tahmin', ${Number(p.kp)}, ${`mac:${p.match_id}`}, ${`Tahmin ödülü (${match})`.slice(0, 120)}) ON CONFLICT DO NOTHING`)
      }
      const prize = setOf(p.markets).bonus?.prize
      if (p.bonus && prize && (prize.kind === 'market' || prize.kind === 'cash')) {
        await grantAward({ userId, userName: String(p.user_name), source: 'match', ref: `mac:${p.match_id}`, place: null, title: `Bütün soruları bildin: ${match}`, prize })
      }
      paid++
    } catch (error) {
      console.error('[league] ödül yazılamadı', p.match_id, userId, error)
    }
  }
  return paid
}

type FeedResult = { home: number; away: number; htHome: number | null; htAway: number | null; corners: number | null; cards: number | null; first?: '1' | '2' | null }

/**
 * Scores finished calendar matches from the result feed. A match that asks about corners, cards, the
 * first half or the first set waits until the feed has that figure; the panel can still enter it by hand.
 */
export async function autoSettleLeague(fetchResult: (id: number, sport: Sport) => Promise<FeedResult | null>, opts: { limit?: number; recentOnly?: boolean } = {}) {
  await ensureLeague()
  const due = await rows(sql`SELECT id, ext_id, markets FROM league_matches
    WHERE NOT settled AND ext_id IS NOT NULL AND kickoff < now() - interval '100 minutes'
      AND (NOT ${opts.recentOnly ?? false}::boolean OR kickoff > now() - interval '2 days')
    ORDER BY kickoff LIMIT ${opts.limit ?? 30}`)
  let settled = 0
  let waiting = 0
  for (const m of due) {
    const set = setOf(m.markets)
    const sport = sportOf(set)
    const r = await fetchResult(Number(m.ext_id), sport)
    if (!r) continue
    const needs = resultNeeds(set)
    if ((needs.half && r.htHome === null) || (needs.corners && r.corners === null) || (needs.cards && r.cards === null) || (needs.first && !r.first)) {
      waiting++
      continue
    }
    const cap = SPORTS[sport].maxScore
    // A result the rules reject (a retired tennis match, say) is left for the panel to decide.
    const ok = await settleLeagueMatch(Number(m.id), { ...r, home: Math.min(r.home, cap), away: Math.min(r.away, cap) }).then(
      () => true,
      () => false,
    )
    if (ok) settled++
  }
  return { checked: due.length, settled, waiting }
}

// --- League prizes -------------------------------------------------------

export type PeriodWinner = { place: number; userId: string; name: string; points: number; prize: Prize }

export type PaidPeriod = { key: string; kind: PeriodKind; label: string; winners: PeriodWinner[]; paidAt: string }

/** A match that kicked off late on the last day can still be scored for this long before the prizes go out without it. */
const PERIOD_GRACE_MS = 36 * 3_600_000

const settledKeys = new Set<string>()

async function settlePeriod(kind: PeriodKind, cfg: PeriodPrizes, now: number): Promise<boolean> {
  const p: Period = periodBounds(kind, now, -1)
  if (!cfg.on || !cfg.since || Date.parse(cfg.since) >= p.end || settledKeys.has(p.key)) return false
  const [state] = await rows<{ paid: string; open: string }>(sql`SELECT
    (SELECT count(*) FROM league_periods WHERE key = ${p.key}) AS paid,
    (SELECT count(*) FROM league_matches m WHERE NOT m.settled AND m.kickoff >= ${stamp(p.start)}::timestamptz AND m.kickoff < ${stamp(p.end)}::timestamptz AND ${inTable(null)}) AS open`)
  if (Number(state.paid) > 0) {
    settledKeys.add(p.key)
    return false
  }
  if (Number(state.open) > 0 && now < p.end + PERIOD_GRACE_MS) return false
  const claimed = await rows(sql`INSERT INTO league_periods (key, kind, label) VALUES (${p.key}, ${kind}, ${p.label}) ON CONFLICT (key) DO NOTHING RETURNING key`)
  settledKeys.add(p.key)
  if (!claimed.length) return false

  const { grantAward } = await import('@/lib/prediction-awards')
  const { roleBlocks } = await import('@/lib/kanka-puan')
  const board = await standings(p.start, p.end, cfg.places.length + 20)
  const winners: PeriodWinner[] = []
  for (const row of board) {
    if (winners.length >= cfg.places.length) break
    // Staff stay on the table but the prizes are for members.
    if (row.points <= 0 || (await roleBlocks(row.userId, 'events').catch(() => false))) continue
    const place = winners.length + 1
    const prize = cfg.places[place - 1]
    await grantAward({ userId: row.userId, userName: row.name, source: kind, ref: p.key, place, title: `${PERIOD_LABEL[kind]} lig ${place}. sıra (${p.label})`, prize })
    winners.push({ place, userId: row.userId, name: row.name, points: row.points, prize })
  }
  await rows(sql`UPDATE league_periods SET winners = ${JSON.stringify(winners)}::jsonb WHERE key = ${p.key}`)
  return true
}

/** Pays the week and the month that have just ended, once each. */
export async function settleLeaguePeriods(now = Date.now(), settings?: LeagueSettings) {
  await ensureLeague()
  const s = settings ?? (await getLeagueSettings())
  let paid = 0
  for (const kind of ['week', 'month'] as const) if (await settlePeriod(kind, s[kind], now)) paid++
  return paid
}

/** The last paid week and month, for the "who won" line on the site. */
export async function lastPaidPeriods(): Promise<Partial<Record<PeriodKind, PaidPeriod>>> {
  await ensureLeague()
  const r = await rows(sql`SELECT DISTINCT ON (kind) key, kind, label, winners, paid_at FROM league_periods ORDER BY kind, paid_at DESC`)
  const out: Partial<Record<PeriodKind, PaidPeriod>> = {}
  for (const x of r) {
    const kind = x.kind === 'month' ? 'month' : 'week'
    out[kind] = { key: String(x.key), kind, label: String(x.label), winners: (x.winners as PeriodWinner[]) ?? [], paidAt: iso(x.paid_at) }
  }
  return out
}

const LOOK_EVERY_MS = 10 * 60_000
let nextLook = 0

/**
 * Rides on the visitor-driven background slot: at most one look per instance every ten minutes, and
 * nothing at all while the league prizes and automatic scoring are both switched off.
 */
export async function leagueTick() {
  const now = Date.now()
  if (now < nextLook) return
  nextLook = now + LOOK_EVERY_MS
  const s = await getLeagueSettings()
  if (!s.auto && !s.week.on && !s.month.on) return
  if (s.auto) {
    const { getSportResult } = await import('@/lib/kankatv')
    await autoSettleLeague(getSportResult, { limit: 8, recentOnly: true }).catch((e) => console.error('[league] otomatik puanlama', e))
  }
  await settleLeaguePeriods(now, s).catch((e) => console.error('[league] dönem ödülleri', e))
}
