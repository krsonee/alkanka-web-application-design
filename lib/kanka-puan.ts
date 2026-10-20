import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureCommunity } from '@/lib/community'
import { SPRINT_MULTIPLIER, sprintState } from '@/lib/sprint'
import { BADGE_ICONS, BADGE_TIERS, DEFAULT_LEVELS, DEFAULT_RULES, publicRankName, type BadgeTier, type LevelDef, type PointRules } from '@/lib/kanka-puan-shared'

export * from '@/lib/kanka-puan-shared'

export type KpConfig = { levels: LevelDef[]; rules: PointRules }

export type SpecialBadge = {
  id: string
  name: string
  description: string
  icon: string
  tier: BadgeTier
  bonus: number
  auto: AutoKind | null
  active: boolean
  holders: number
}

export type AutoKind = 'tahmin-hafta' | 'tahmin-ay' | 'sohbet-hafta' | 'sohbet-ay' | 'turnuva'

export const AUTO_LABELS: Record<AutoKind, string> = {
  'tahmin-hafta': 'Haftanın en çok doğru tahmin yapanı',
  'tahmin-ay': 'Ayın en çok doğru tahmin yapanı',
  'sohbet-hafta': 'Haftanın en aktif sohbet yazarı',
  'sohbet-ay': 'Ayın sohbet yazı yarışması şampiyonu',
  turnuva: 'Turnuva şampiyonu (otomatik verilir)',
}

const DEFAULT_BADGES: Omit<SpecialBadge, 'holders' | 'active'>[] = [
  { id: 'tahmin-krali', name: 'Tahmin Kralı', description: 'Haftanın en çok doğru tahmin yapan üyesi.', icon: 'target', tier: 'altin', bonus: 500, auto: 'tahmin-hafta' },
  { id: 'kahin', name: 'Kâhin', description: 'Ayın tahmin ligi şampiyonu.', icon: 'eye', tier: 'elmas', bonus: 1500, auto: 'tahmin-ay' },
  { id: 'sohbet-yildizi', name: 'Sohbet Yıldızı', description: 'Haftanın sohbet kanalında en aktif üyesi.', icon: 'message', tier: 'altin', bonus: 300, auto: 'sohbet-hafta' },
  { id: 'kalem-ustasi', name: 'Kalem Ustası', description: 'Ayın sohbet yazı yarışması şampiyonu.', icon: 'feather', tier: 'elmas', bonus: 1000, auto: 'sohbet-ay' },
  { id: 'turnuva-sampiyonu', name: 'Turnuva Şampiyonu', description: 'Bir AL KANKA turnuvasını kazandı.', icon: 'trophy', tier: 'efsane', bonus: 750, auto: 'turnuva' },
  { id: 'kurucu-kanka', name: 'Kurucu Kanka', description: 'AL KANKA’nın ilk üyelerinden.', icon: 'crown', tier: 'efsane', bonus: 0, auto: null },
]

/** Staff badges. Holders earn no KP, never appear in rankings, never level up and cannot buy from the market. */
export const ROLE_BADGES = [
  { id: 'moderator', name: 'Moderatör', description: 'AL KANKA topluluk moderatörü.', icon: 'shield' },
  { id: 'sponsor-destek', name: 'Sponsor Destek', description: 'Sponsor destek ekibi üyesi.', icon: 'heart' },
] as const

export const ROLE_BADGE_IDS: readonly string[] = ROLE_BADGES.map((b) => b.id)

let ready: Promise<unknown> | null = null
export function ensureKp() {
  ready ??= (async () => {
    await ensureCommunity()
    await rows(sql`CREATE TABLE IF NOT EXISTS kp_settings (key text PRIMARY KEY, value jsonb NOT NULL)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS kp_events (
      id serial PRIMARY KEY, user_id text NOT NULL, source text NOT NULL, points int NOT NULL, ref text, note text,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS kp_events_ref_uniq ON kp_events (user_id, source, ref) WHERE ref IS NOT NULL`)
    await rows(sql`CREATE INDEX IF NOT EXISTS kp_events_user_idx ON kp_events (user_id, created_at DESC)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS kp_badges (
      id text PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '', icon text NOT NULL DEFAULT 'award',
      tier text NOT NULL DEFAULT 'altin', bonus int NOT NULL DEFAULT 0, auto text, active boolean NOT NULL DEFAULT true,
      sort int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS kp_awards (
      id serial PRIMARY KEY, badge_id text NOT NULL REFERENCES kp_badges(id) ON DELETE CASCADE, user_id text NOT NULL,
      period text NOT NULL DEFAULT 'tek', note text, awarded_at timestamptz NOT NULL DEFAULT now(), UNIQUE (badge_id, user_id, period))`)
    const seeded = await rows(sql`SELECT 1 FROM kp_settings WHERE key = 'badges_seeded'`)
    if (!seeded.length) {
      for (const [i, b] of DEFAULT_BADGES.entries()) {
        await rows(sql`INSERT INTO kp_badges (id, name, description, icon, tier, bonus, auto, sort)
          VALUES (${b.id}, ${b.name}, ${b.description}, ${b.icon}, ${b.tier}, ${b.bonus}, ${b.auto}, ${i}) ON CONFLICT DO NOTHING`)
      }
      await rows(sql`INSERT INTO kp_settings (key, value) VALUES ('badges_seeded', 'true'::jsonb) ON CONFLICT DO NOTHING`)
    }
    for (const b of ROLE_BADGES) {
      await rows(sql`INSERT INTO kp_badges (id, name, description, icon, tier, bonus, auto, sort)
        VALUES (${b.id}, ${b.name}, ${b.description}, ${b.icon}, 'elmas', 0, NULL, 900) ON CONFLICT DO NOTHING`)
    }
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

// --- Config --------------------------------------------------------------

function configFrom(r: { key: string; value: unknown }[]): KpConfig {
  const levels = r.find((x) => x.key === 'levels')?.value as LevelDef[] | undefined
  const rules = r.find((x) => x.key === 'rules')?.value as Partial<PointRules> | undefined
  return {
    levels: levels?.length ? levels : DEFAULT_LEVELS,
    rules: { ...DEFAULT_RULES, ...(rules ?? {}) },
  }
}

export async function getKpConfig(): Promise<KpConfig> {
  await ensureKp()
  const r = await rows<{ key: string; value: unknown }>(sql`SELECT key, value FROM kp_settings WHERE key IN ('levels', 'rules')`)
  return configFrom(r)
}

export async function saveLevels(input: LevelDef[]) {
  await ensureKp()
  const levels = input
    .map((l) => ({ name: String(l.name).trim().slice(0, 30), badge: String(l.badge).trim().slice(0, 40), min: Math.max(0, Math.floor(Number(l.min))) }))
    .filter((l) => l.name && l.badge && Number.isFinite(l.min))
    .sort((a, b) => a.min - b.min)
  if (levels.length < 2) throw new Error('En az 2 seviye olmalı.')
  if (levels.length > 50) throw new Error('En fazla 50 seviye olabilir.')
  if (levels[0].min !== 0) throw new Error('İlk seviyenin puanı 0 olmalı.')
  if (new Set(levels.map((l) => l.min)).size !== levels.length) throw new Error('İki seviye aynı puanda olamaz.')
  await rows(sql`INSERT INTO kp_settings (key, value) VALUES ('levels', ${JSON.stringify(levels)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

export async function saveRules(input: PointRules) {
  await ensureKp()
  const rules = Object.fromEntries(
    (Object.keys(DEFAULT_RULES) as (keyof PointRules)[]).map((k) => {
      const v = Math.floor(Number(input[k]))
      if (!Number.isFinite(v) || v < 0 || v > 100000) throw new Error('Puan değerleri 0 ile 100.000 arasında olmalı.')
      return [k, v]
    }),
  )
  await rows(sql`INSERT INTO kp_settings (key, value) VALUES ('rules', ${JSON.stringify(rules)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

// --- Totals --------------------------------------------------------------

const tableExists = async (name: string) =>
  Boolean((await rows<{ t: string | null }>(sql`SELECT to_regclass(${name}) AS t`))[0]?.t)

/** Levels and rules already stored. Does not create tables or seed rows. */
async function readKpConfig(): Promise<KpConfig> {
  if (!(await tableExists('kp_settings'))) return { levels: DEFAULT_LEVELS, rules: DEFAULT_RULES }
  const r = await rows<{ key: string; value: unknown }>(sql`SELECT key, value FROM kp_settings WHERE key IN ('levels', 'rules')`)
  return configFrom(r)
}

export type KpBreakdown = { time: number; games: number; tasks: number; chat: number; league: number; reviews: number; referrals: number; telegram: number; bonus: number }

const SOURCE_KEYS: (keyof KpBreakdown)[] = ['time', 'games', 'tasks', 'chat', 'league', 'reviews', 'referrals', 'telegram', 'bonus']

/** Per-user KP, computed from activity tables so every game, task and chat message counts without extra hooks. */
export type RankPeriod = 'gun' | 'hafta' | 'ay' | 'tum'

const TRUNC: Record<Exclude<RankPeriod, 'tum'>, string> = { gun: 'day', hafta: 'week', ay: 'month' }

/** Start of the current Istanbul day/week/month as timestamptz; '-infinity' for all-time. */
function periodStart(period: RankPeriod) {
  if (period === 'tum') return sql`'-infinity'::timestamptz`
  return sql`(date_trunc(${TRUNC[period]}, now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')`
}

type Window = { since: ReturnType<typeof sql>; until: ReturnType<typeof sql> }
const NO_END = sql`'infinity'::timestamptz`

async function totals(rules: PointRules, userId: string | null, limit = 1, period: RankPeriod = 'tum', win?: Window) {
  const since = win?.since ?? periodStart(period)
  const until = win?.until ?? NO_END
  const [chat, tg, awards] = await Promise.all([tableExists('tg_chat_messages'), tableExists('tg_links'), tableExists('kp_awards')])
  const notRoleHolder = awards
    ? sql`AND NOT EXISTS (SELECT 1 FROM kp_awards ra WHERE ra.user_id = ids.user_id AND ra.badge_id IN ('moderator', 'sponsor-destek'))`
    : sql``
  const chatCte = chat
    ? sql`SELECT user_id, sum(least(n, ${rules.chatDailyCap}))::bigint AS v FROM (
        SELECT user_id, date_trunc('day', created_at AT TIME ZONE 'Europe/Istanbul') AS d, count(*) AS n
        FROM tg_chat_messages WHERE user_id IS NOT NULL AND created_at >= ${since} AND created_at < ${until} GROUP BY 1, 2) x GROUP BY user_id`
    : sql`SELECT NULL::text AS user_id, 0::bigint AS v WHERE false`
  const tgCte = tg
    ? sql`SELECT user_id, 1::bigint AS v FROM tg_links WHERE coalesce(linked_at, now()) >= ${since} AND coalesce(linked_at, now()) < ${until}`
    : sql`SELECT NULL::text AS user_id, 0::bigint AS v WHERE false`
  const r = await rows(sql`WITH
    g AS (SELECT user_id, sum(least(games, ${rules.gameDailyCap})) AS games, sum(tasks) AS tasks FROM (
        SELECT user_id, date_trunc('day', created_at AT TIME ZONE 'Europe/Istanbul') AS d,
          count(*) FILTER (WHERE mode <> 'odul') AS games, count(*) FILTER (WHERE mode = 'odul' AND game = 'gorev') AS tasks
        FROM game_history WHERE created_at >= ${since} AND created_at < ${until} GROUP BY 1, 2) gd GROUP BY user_id),
    c AS (${chatCte}),
    l AS (SELECT user_id, coalesce(sum(points), 0) AS v FROM league_picks WHERE created_at >= ${since} AND created_at < ${until} GROUP BY user_id),
    rv AS (SELECT user_id, count(*) AS v FROM site_reviews WHERE status = 'approved' AND created_at >= ${since} AND created_at < ${until} GROUP BY user_id),
    rf AS (SELECT referrer_id AS user_id, count(*) AS v FROM referrals WHERE rewarded_at IS NOT NULL AND rewarded_at >= ${since} AND rewarded_at < ${until} GROUP BY referrer_id),
    t AS (${tgCte}),
    e AS (SELECT user_id, coalesce(sum(points) FILTER (WHERE source = 'sure'), 0) AS time, coalesce(sum(points) FILTER (WHERE source <> 'sure'), 0) AS bonus
      FROM kp_events WHERE created_at >= ${since} AND created_at < ${until} GROUP BY user_id),
    ids AS (SELECT user_id FROM g UNION SELECT user_id FROM c UNION SELECT user_id FROM l UNION SELECT user_id FROM rv
      UNION SELECT user_id FROM rf UNION SELECT user_id FROM t UNION SELECT user_id FROM e),
    s AS (SELECT ids.user_id,
      coalesce(e.time, 0) AS time,
      coalesce(g.games, 0) * ${rules.game} AS games,
      coalesce(g.tasks, 0) * ${rules.task} AS tasks,
      coalesce(c.v, 0) * ${rules.chat} AS chat,
      coalesce(l.v, 0) * ${rules.leaguePoint} AS league,
      coalesce(rv.v, 0) * ${rules.review} AS reviews,
      coalesce(rf.v, 0) * ${rules.referral} AS referrals,
      coalesce(t.v, 0) * ${rules.telegram} AS telegram,
      coalesce(e.bonus, 0) AS bonus
      FROM ids LEFT JOIN g USING (user_id) LEFT JOIN c USING (user_id) LEFT JOIN l USING (user_id) LEFT JOIN rv USING (user_id)
      LEFT JOIN rf USING (user_id) LEFT JOIN t USING (user_id) LEFT JOIN e USING (user_id)
      WHERE ids.user_id IS NOT NULL AND (${userId}::text IS NULL OR ids.user_id = ${userId}) ${notRoleHolder})
    SELECT s.*, (s.time + s.games + s.tasks + s.chat + s.league + s.reviews + s.referrals + s.telegram + s.bonus) AS total, u.name
    FROM s LEFT JOIN public."user" u ON u.id = s.user_id
    ORDER BY total DESC LIMIT ${limit}`)
  return r.map((x) => {
    const breakdown = Object.fromEntries(SOURCE_KEYS.map((k) => [k, Number(x[k] ?? 0)])) as KpBreakdown
    return { userId: String(x.user_id), name: String(x.name ?? 'Kanka'), total: Math.max(0, Number(x.total ?? 0)), breakdown }
  })
}

/** Totals for a window where activity after `sprintSince` counts SPRINT_MULTIPLIER times. */
async function rankedWindow(rules: PointRules, limit: number, win: Window, sprintSince: ReturnType<typeof sql> | null) {
  if (!sprintSince) return totals(rules, null, limit, 'tum', win)
  const [base, sprint] = await Promise.all([
    totals(rules, null, Math.max(limit, 1000), 'tum', win),
    totals(rules, null, 5000, 'tum', { since: sprintSince, until: win.until }),
  ])
  const extra = new Map(sprint.map((s) => [s.userId, Math.floor(s.total * (SPRINT_MULTIPLIER - 1))]))
  return base
    .map((b) => ({ ...b, total: b.total + (extra.get(b.userId) ?? 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export function levelFor(levels: LevelDef[], kp: number) {
  const index = levels.reduce((acc, l, i) => (kp >= l.min ? i : acc), 0)
  const next = levels[index + 1] ?? null
  const span = next ? next.min - levels[index].min : 1
  const progress = next ? Math.min(100, Math.round(((kp - levels[index].min) / span) * 100)) : 100
  return { index, ...levels[index], next, progress }
}

export type UserBadge = { id: string; name: string; description: string; icon: string; tier: BadgeTier; count: number; lastAt: string }

export type KpStatus = {
  kp: number
  level: ReturnType<typeof levelFor>
  breakdown: KpBreakdown
  badges: UserBadge[]
  todayMinutes: number
  rank: number | null
}

export async function getKpStatus(userId: string): Promise<KpStatus> {
  const cfg = await getKpConfig()
  const [row] = await totals(cfg.rules, userId)
  const kp = row?.total ?? 0
  const [badges, today, rank] = await Promise.all([
    userBadges(userId),
    rows<{ n: string }>(sql`SELECT count(*) AS n FROM kp_events WHERE user_id = ${userId} AND source = 'sure'
      AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')`),
    kp > 0 ? leaderboard(200).then((l) => l.findIndex((x) => x.userId === userId)) : Promise.resolve(-1),
  ])
  return {
    kp,
    level: levelFor(cfg.levels, kp),
    breakdown: row?.breakdown ?? (Object.fromEntries(SOURCE_KEYS.map((k) => [k, 0])) as KpBreakdown),
    badges,
    todayMinutes: Number(today[0]?.n ?? 0),
    rank: rank >= 0 ? rank + 1 : null,
  }
}

export type KpToday = {
  total: number
  breakdown: KpBreakdown
  weekTotal: number
  weekDays: number
}

/** Today's and this week's KP for one member; powers the daily progress card and pace estimate. */
export async function getKpToday(userId: string): Promise<KpToday> {
  const cfg = await getKpConfig()
  const [[day], [week]] = await Promise.all([totals(cfg.rules, userId, 1, 'gun'), totals(cfg.rules, userId, 1, 'hafta')])
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(new Date())
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday) + 1 || 1
  return {
    total: day?.total ?? 0,
    breakdown: day?.breakdown ?? (Object.fromEntries(SOURCE_KEYS.map((k) => [k, 0])) as KpBreakdown),
    weekTotal: week?.total ?? 0,
    weekDays,
  }
}

export type LeaderRow = { userId: string; name: string; kp: number; level: number; levelName: string; badge: string; specials: number; breakdown: KpBreakdown }

export type PredictionRow = { userId: string; name: string; points: number; hits: number; exact: number; picks: number }

/** Prediction league table for a period: points from settled matches kicked off in that window. */
export async function predictionBoard(period: RankPeriod, limit = 20): Promise<PredictionRow[]> {
  await ensureKp()
  const since = periodStart(period)
  const r = await rows(sql`SELECT p.user_id, max(p.user_name) AS name, coalesce(sum(p.points), 0) AS pts,
      count(*) FILTER (WHERE p.points > 0) AS hits, count(*) FILTER (WHERE p.points = 3) AS exact, count(*) AS picks
    FROM league_picks p JOIN league_matches m ON m.id = p.match_id
    WHERE m.settled AND m.kickoff >= ${since}
    GROUP BY p.user_id HAVING count(*) > 0 ORDER BY pts DESC, exact DESC, hits DESC LIMIT ${limit}`)
  return r.map((x) => ({
    userId: String(x.user_id),
    name: publicRankName(String(x.name ?? '')),
    points: Number(x.pts),
    hits: Number(x.hits),
    exact: Number(x.exact),
    picks: Number(x.picks),
  }))
}

let levelCache: { at: number; data: Record<string, number> } | null = null

/** userId → level for every member with KP; cached briefly because it powers rank chips site-wide. */
export async function levelMap(): Promise<Record<string, number>> {
  if (levelCache && Date.now() - levelCache.at < 60_000) return levelCache.data
  const cfg = await getKpConfig()
  const list = await totals(cfg.rules, null, 5000)
  const data: Record<string, number> = {}
  for (const l of list) if (l.total > 0) data[l.userId] = levelFor(cfg.levels, l.total).index + 1
  levelCache = { at: Date.now(), data }
  return data
}

/** How many active members have reached each level (index i → members at level ≥ i+1). */
export async function levelReach(levelCount: number): Promise<{ total: number; reached: number[] }> {
  const map = await levelMap()
  const levels = Object.values(map)
  const reached = Array.from({ length: levelCount }, (_, i) => (i === 0 ? levels.length : levels.filter((l) => l >= i + 1).length))
  return { total: levels.length, reached }
}

export async function leaderboard(limit = 20, period: RankPeriod = 'tum', opts?: { readOnly?: boolean }): Promise<LeaderRow[]> {
  const cfg = opts?.readOnly ? await readKpConfig() : await getKpConfig()
  const sprintOn = period === 'hafta' && sprintState().active
  const raw = sprintOn
    ? await rankedWindow(cfg.rules, limit, { since: periodStart('hafta'), until: NO_END }, periodStart('gun'))
    : await totals(cfg.rules, null, limit, period)
  const list = raw.filter((l) => l.total > 0)
  if (!list.length) return []
  let counts: { user_id: string; n: string }[] = []
  const awardsReady = !opts?.readOnly || (await tableExists('kp_awards'))
  if (awardsReady) {
    try {
      counts = await rows<{ user_id: string; n: string }>(sql`SELECT user_id, count(*) AS n FROM kp_awards
        WHERE user_id IN ${list.map((l) => l.userId)} GROUP BY user_id`)
    } catch (error) {
      if (!opts?.readOnly) throw error
      counts = []
    }
  }
  return list.map((l) => {
    const lv = levelFor(cfg.levels, l.total)
    return {
      userId: l.userId,
      name: publicRankName(l.name),
      kp: l.total,
      level: lv.index + 1,
      levelName: lv.name,
      badge: lv.badge,
      specials: Number(counts.find((c) => c.user_id === l.userId)?.n ?? 0),
      breakdown: l.breakdown,
    }
  })
}

/** Ranking for a public page. Same rows as leaderboard(), and it never creates or writes. */
export async function readLeaderboard(limit = 20, period: RankPeriod = 'tum'): Promise<LeaderRow[]> {
  try {
    return await leaderboard(limit, period, { readOnly: true })
  } catch (error) {
    console.error('[kanka-puan] sıra okunamadı', error)
    return []
  }
}

/** Sum of kp_events.points. Null when there is nothing to show, so the counter can stay empty. */
export async function sumKpPoints(): Promise<number | null> {
  try {
    if (!(await tableExists('kp_events'))) return null
    const r = await rows<{ n: string | number | null }>(sql`SELECT coalesce(sum(points), 0) AS n FROM kp_events`)
    const n = Number(r[0]?.n ?? 0)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
  } catch (error) {
    console.error('[kanka-puan] puan toplamı okunamadı', error)
    return null
  }
}

export async function awardBadgeId(awardId: number): Promise<string | null> {
  await ensureKp()
  const [a] = await rows<{ badge_id: string }>(sql`SELECT badge_id FROM kp_awards WHERE id = ${awardId}`)
  return a?.badge_id ?? null
}

/** True when the member holds a staff badge (Moderatör / Sponsor Destek). */
export async function isRoleHolder(userId: string): Promise<boolean> {
  if (!(await tableExists('kp_awards'))) return false
  const r = await rows(sql`SELECT 1 FROM kp_awards WHERE user_id = ${userId} AND badge_id IN ('moderator', 'sponsor-destek') LIMIT 1`)
  return r.length > 0
}

// --- Time on site --------------------------------------------------------

/** Credits one minute of active time. The minute bucket makes repeated or parallel pings harmless. */
export async function pingActive(userId: string) {
  const cfg = await getKpConfig()
  if (cfg.rules.minute > 0 && !(await isRoleHolder(userId))) {
    const { boosted, onFirstMinuteOfDay } = await import('@/lib/boosts')
    const minute = await boosted('sure', cfg.rules.minute)
    const [inserted] = await rows<{ first: boolean }>(sql`INSERT INTO kp_events (user_id, source, points, ref)
      SELECT ${userId}, 'sure', ${minute}, to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD"T"HH24:MI')
      WHERE (SELECT count(*) FROM kp_events WHERE user_id = ${userId} AND source = 'sure'
        AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')) < ${cfg.rules.minuteDailyCap}
      ON CONFLICT DO NOTHING
      RETURNING NOT EXISTS (SELECT 1 FROM kp_events WHERE user_id = ${userId} AND source = 'sure'
        AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')) AS first`)
    // The first minute of a new day can complete a 7 or 30 day streak, so the bonus is checked only then.
    if (inserted?.first) {
      await onFirstMinuteOfDay(userId).catch((error) => console.error('[boosts] ilk dakika', (error as Error).message))
      const { getStreak } = await import('@/lib/kp-extras')
      await getStreak(userId).catch(() => null)
    }
  }
  const [row] = await totals(cfg.rules, userId)
  const kp = row?.total ?? 0
  const lv = levelFor(cfg.levels, kp)
  return { kp, level: lv.index + 1, levelName: lv.name, badge: lv.badge, progress: lv.progress }
}

// --- Special badges ------------------------------------------------------

const mapBadge = (r: Record<string, unknown>): SpecialBadge => ({
  id: String(r.id),
  name: String(r.name),
  description: String(r.description ?? ''),
  icon: String(r.icon),
  tier: (BADGE_TIERS.some((t) => t.id === r.tier) ? r.tier : 'altin') as BadgeTier,
  bonus: Number(r.bonus),
  auto: (r.auto as AutoKind | null) ?? null,
  active: Boolean(r.active),
  holders: Number(r.holders ?? 0),
})

export async function listSpecialBadges(opts: { includeInactive?: boolean } = {}) {
  await ensureKp()
  const r = await rows(sql`SELECT b.*, (SELECT count(DISTINCT user_id) FROM kp_awards a WHERE a.badge_id = b.id) AS holders
    FROM kp_badges b WHERE ${opts.includeInactive ?? false}::boolean OR b.active ORDER BY b.sort, b.created_at`)
  return r.map(mapBadge)
}

export async function userBadges(userId: string): Promise<UserBadge[]> {
  await ensureKp()
  const r = await rows(sql`SELECT b.id, b.name, b.description, b.icon, b.tier, count(*) AS n, max(a.awarded_at) AS last_at
    FROM kp_awards a JOIN kp_badges b ON b.id = a.badge_id WHERE a.user_id = ${userId}
    GROUP BY b.id ORDER BY max(a.awarded_at) DESC`)
  return r.map((x) => ({
    id: String(x.id),
    name: String(x.name),
    description: String(x.description ?? ''),
    icon: String(x.icon),
    tier: x.tier as BadgeTier,
    count: Number(x.n),
    lastAt: new Date(String(x.last_at)).toISOString(),
  }))
}

const slug = (s: string) =>
  s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

export type BadgeInput = { id?: string; name: string; description: string; icon: string; tier: BadgeTier; bonus: number; auto: AutoKind | null; active: boolean }

export async function saveSpecialBadge(input: BadgeInput) {
  await ensureKp()
  const name = input.name.trim().slice(0, 40)
  if (name.length < 2) throw new Error('Rozet adı en az 2 karakter olmalı.')
  if (!BADGE_ICONS.includes(input.icon)) throw new Error('Geçersiz simge.')
  if (!BADGE_TIERS.some((t) => t.id === input.tier)) throw new Error('Geçersiz rozet değeri.')
  const bonus = Math.floor(Number(input.bonus))
  if (!Number.isFinite(bonus) || bonus < 0 || bonus > 100000) throw new Error('Bonus 0 ile 100.000 KP arasında olmalı.')
  const auto = input.auto && input.auto in AUTO_LABELS ? input.auto : null
  const description = input.description.trim().slice(0, 160)
  if (input.id) {
    const r = await rows(sql`UPDATE kp_badges SET name = ${name}, description = ${description}, icon = ${input.icon}, tier = ${input.tier},
      bonus = ${bonus}, auto = ${auto}, active = ${input.active} WHERE id = ${input.id} RETURNING id`)
    if (!r.length) throw new Error('Rozet bulunamadı.')
    return
  }
  const id = slug(name) || `rozet-${Date.now()}`
  const r = await rows(sql`INSERT INTO kp_badges (id, name, description, icon, tier, bonus, auto, active, sort)
    VALUES (${id}, ${name}, ${description}, ${input.icon}, ${input.tier}, ${bonus}, ${auto}, ${input.active},
      (SELECT coalesce(max(sort), 0) + 1 FROM kp_badges)) ON CONFLICT DO NOTHING RETURNING id`)
  if (!r.length) throw new Error('Bu isimde bir rozet zaten var.')
}

export async function deleteSpecialBadge(id: string) {
  await ensureKp()
  await rows(sql`DELETE FROM kp_events WHERE source = 'rozet' AND ref LIKE ${`${id}:%`}`)
  if (ROLE_BADGE_IDS.includes(id)) throw new Error('Görevli rozetleri silinemez.')
  await rows(sql`DELETE FROM kp_badges WHERE id = ${id}`)
}

/** Awards a badge once per period and pays its KP bonus. Returns false when that period was already awarded. */
export async function awardBadge(badgeId: string, userId: string, period = 'tek', note?: string) {
  await ensureKp()
  const [badge] = await rows<{ bonus: number; name: string }>(sql`SELECT bonus, name FROM kp_badges WHERE id = ${badgeId}`)
  if (!badge) throw new Error('Rozet bulunamadı.')
  const user = await rows(sql`SELECT 1 FROM public."user" WHERE id = ${userId}`)
  if (!user.length) throw new Error('Üye bulunamadı.')
  const r = await rows(sql`INSERT INTO kp_awards (badge_id, user_id, period, note) VALUES (${badgeId}, ${userId}, ${period}, ${note?.slice(0, 120) ?? null})
    ON CONFLICT DO NOTHING RETURNING id`)
  if (!r.length) return false
  if (Number(badge.bonus) > 0) {
    await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note)
      VALUES (${userId}, 'rozet', ${Number(badge.bonus)}, ${`${badgeId}:${period}`}, ${badge.name}) ON CONFLICT DO NOTHING`)
  }
  return true
}

export async function revokeAward(awardId: number) {
  await ensureKp()
  const [a] = await rows<{ badge_id: string; user_id: string; period: string }>(sql`DELETE FROM kp_awards WHERE id = ${awardId} RETURNING badge_id, user_id, period`)
  if (!a) throw new Error('Kayıt bulunamadı.')
  await rows(sql`DELETE FROM kp_events WHERE user_id = ${a.user_id} AND source = 'rozet' AND ref = ${`${a.badge_id}:${a.period}`}`)
}

export type AwardRow = { id: number; badgeId: string; badgeName: string; tier: BadgeTier; icon: string; userId: string; userName: string; period: string; note: string | null; awardedAt: string }

export async function recentAwards(opts: { limit?: number; badgeId?: string } = {}): Promise<AwardRow[]> {
  await ensureKp()
  const r = await rows(sql`SELECT a.*, b.name AS badge_name, b.tier, b.icon, u.name AS user_name
    FROM kp_awards a JOIN kp_badges b ON b.id = a.badge_id LEFT JOIN public."user" u ON u.id = a.user_id
    WHERE (${opts.badgeId ?? null}::text IS NULL OR a.badge_id = ${opts.badgeId ?? null})
    ORDER BY a.awarded_at DESC LIMIT ${opts.limit ?? 40}`)
  return r.map((x) => ({
    id: Number(x.id),
    badgeId: String(x.badge_id),
    badgeName: String(x.badge_name),
    tier: x.tier as BadgeTier,
    icon: String(x.icon),
    userId: String(x.user_id),
    userName: String(x.user_name ?? 'Silinmiş üye'),
    period: String(x.period),
    note: x.note ? String(x.note) : null,
    awardedAt: new Date(String(x.awarded_at)).toISOString(),
  }))
}

export async function badgeHolders(): Promise<Record<string, { name: string; count: number }[]>> {
  await ensureKp()
  const r = await rows<{ badge_id: string; name: string | null; n: string }>(sql`SELECT a.badge_id, max(u.name) AS name, count(*) AS n
    FROM kp_awards a LEFT JOIN public."user" u ON u.id = a.user_id GROUP BY a.badge_id, a.user_id ORDER BY max(a.awarded_at) DESC`)
  const out: Record<string, { name: string; count: number }[]> = {}
  for (const x of r) (out[x.badge_id] ??= []).length < 8 && out[x.badge_id].push({ name: publicRankName(x.name), count: Number(x.n) })
  return out
}

export async function adjustPoints(userId: string, points: number, note: string) {
  await ensureKp()
  const p = Math.trunc(Number(points))
  if (!Number.isFinite(p) || p === 0 || Math.abs(p) > 100000) throw new Error('Puan -100.000 ile 100.000 arasında ve sıfırdan farklı olmalı.')
  const user = await rows(sql`SELECT 1 FROM public."user" WHERE id = ${userId}`)
  if (!user.length) throw new Error('Üye bulunamadı.')
  await rows(sql`INSERT INTO kp_events (user_id, source, points, note) VALUES (${userId}, 'admin', ${p}, ${note.trim().slice(0, 120) || null})`)
}

export async function searchMembers(q: string) {
  const term = q.trim()
  if (term.length < 2) return []
  const like = `%${term.replace(/[%_]/g, '')}%`
  const r = await rows<{ id: string; name: string; email: string }>(sql`SELECT id, name, email FROM public."user"
    WHERE name ILIKE ${like} OR email ILIKE ${like} ORDER BY "createdAt" DESC LIMIT 10`)
  return r.map((x) => ({ id: x.id, name: x.name, email: x.email }))
}

// --- Contests ------------------------------------------------------------

const PERIOD_SQL = {
  hafta: { start: sql`date_trunc('week', now() AT TIME ZONE 'Europe/Istanbul')`, label: sql`to_char(now() AT TIME ZONE 'Europe/Istanbul', 'IYYY-"H"IW')` },
  ay: { start: sql`date_trunc('month', now() AT TIME ZONE 'Europe/Istanbul')`, label: sql`to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM')` },
}

export type ContestRow = { userId: string; name: string; score: number; detail: string }

/** Current standings for an automatic badge, so the admin can preview before awarding. */
export async function contestStandings(kind: Exclude<AutoKind, 'turnuva'>): Promise<{ period: string; rows: ContestRow[] }> {
  await ensureKp()
  const span = kind.endsWith('hafta') ? PERIOD_SQL.hafta : PERIOD_SQL.ay
  const [{ period }] = await rows<{ period: string }>(sql`SELECT ${span.label} AS period`)
  if (kind.startsWith('tahmin')) {
    const r = await rows(sql`SELECT p.user_id, max(p.user_name) AS name, sum(p.points) AS pts,
        count(*) FILTER (WHERE p.points = 3) AS exact, count(*) FILTER (WHERE p.points > 0) AS hits
      FROM league_picks p JOIN league_matches m ON m.id = p.match_id
      WHERE m.settled AND m.kickoff >= (${span.start} AT TIME ZONE 'Europe/Istanbul')
      GROUP BY p.user_id HAVING sum(p.points) > 0 ORDER BY pts DESC, exact DESC LIMIT 10`)
    return {
      period,
      rows: r.map((x) => ({ userId: String(x.user_id), name: String(x.name), score: Number(x.pts), detail: `${x.hits} doğru, ${x.exact} tam skor` })),
    }
  }
  if (!(await tableExists('tg_chat_messages'))) return { period, rows: [] }
  const r = await rows(sql`SELECT m.user_id, max(u.name) AS name, count(*) AS n, count(DISTINCT date_trunc('day', m.created_at)) AS days
    FROM tg_chat_messages m LEFT JOIN public."user" u ON u.id = m.user_id
    WHERE m.user_id IS NOT NULL AND length(m.text) >= 3 AND m.created_at >= (${span.start} AT TIME ZONE 'Europe/Istanbul')
    GROUP BY m.user_id ORDER BY n DESC LIMIT 10`)
  return {
    period,
    rows: r.map((x) => ({ userId: String(x.user_id), name: String(x.name ?? 'Kanka'), score: Number(x.n), detail: `${x.n} mesaj, ${x.days} gün aktif` })),
  }
}

export async function awardContest(badgeId: string) {
  await ensureKp()
  const [b] = await rows<{ auto: AutoKind | null; name: string }>(sql`SELECT auto, name FROM kp_badges WHERE id = ${badgeId}`)
  if (!b?.auto || b.auto === 'turnuva') throw new Error('Bu rozetin otomatik yarışması yok.')
  const { period, rows: list } = await contestStandings(b.auto)
  const winner = list[0]
  if (!winner) throw new Error('Bu dönem için henüz aday yok.')
  const ok = await awardBadge(badgeId, winner.userId, period, winner.detail)
  if (!ok) throw new Error(`${b.name} rozeti bu dönem için zaten verildi.`)
  return `${b.name} rozeti ${winner.name} adlı üyeye verildi (${period}).`
}

/** Called when a tournament finishes: pays the win KP and the tournament badge. */
export async function rewardTournamentWin(userId: string, tournamentId: number, title: string) {
  try {
    const cfg = await getKpConfig()
    if (cfg.rules.tournamentWin > 0) {
      await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note)
        VALUES (${userId}, 'turnuva', ${cfg.rules.tournamentWin}, ${String(tournamentId)}, ${title.slice(0, 120)}) ON CONFLICT DO NOTHING`)
    }
    const badges = await rows<{ id: string }>(sql`SELECT id FROM kp_badges WHERE auto = 'turnuva' AND active`)
    for (const b of badges) await awardBadge(b.id, userId, `turnuva-${tournamentId}`, title)
  } catch (error) {
    console.error('[kp] turnuva ödülü verilemedi', error)
  }
}

/** Rank change per user: positive = climbed, 'yeni' = entered the board since the baseline. */
export type RankMove = number | 'yeni'

let snapshotsReady: Promise<unknown> | null = null
function ensureSnapshots() {
  snapshotsReady ??= rows(sql`CREATE TABLE IF NOT EXISTS kp_rank_snapshots (
    day date NOT NULL, period text NOT NULL, user_id text NOT NULL, rank int NOT NULL,
    PRIMARY KEY (day, period, user_id))`).catch((e) => {
    snapshotsReady = null
    throw e
  })
  return snapshotsReady
}

/**
 * Stores today's first-seen ranking once per Istanbul day and compares the current board
 * against the latest earlier snapshot inside the same period, so arrows mean "since yesterday".
 */
export async function rankMoves(period: 'hafta' | 'ay', board: { userId: string }[]): Promise<Record<string, RankMove>> {
  await ensureSnapshots()
  const today = sql`(now() AT TIME ZONE 'Europe/Istanbul')::date`
  if (board.length) {
    const list = JSON.stringify(board.map((r, i) => ({ u: r.userId, r: i + 1 })))
    await rows(sql`INSERT INTO kp_rank_snapshots (day, period, user_id, rank)
      SELECT ${today}, ${period}, t.u, t.r FROM jsonb_to_recordset(${list}::jsonb) AS t(u text, r int)
      WHERE NOT EXISTS (SELECT 1 FROM kp_rank_snapshots s WHERE s.day = ${today} AND s.period = ${period})
      ON CONFLICT DO NOTHING`)
  }
  const start = sql`date_trunc(${TRUNC[period]}, now() AT TIME ZONE 'Europe/Istanbul')::date`
  const base = await rows<{ user_id: string; rank: number }>(sql`SELECT user_id, rank FROM kp_rank_snapshots
    WHERE period = ${period} AND day = (SELECT max(day) FROM kp_rank_snapshots WHERE period = ${period} AND day < ${today} AND day >= ${start})`)
  if (!base.length) return {}
  const before = new Map(base.map((b) => [b.user_id, Number(b.rank)]))
  const moves: Record<string, RankMove> = {}
  board.forEach((r, i) => {
    const prev = before.get(r.userId)
    moves[r.userId] = prev === undefined ? 'yeni' : prev - (i + 1)
  })
  return moves
}

/** Daily cron hook: keeps snapshots flowing even on days nobody opens the ranking page, and prunes old ones. */
export async function snapshotRanks() {
  const [hafta, ay] = await Promise.all([leaderboard(200, 'hafta'), leaderboard(200, 'ay')])
  const [weekMoves] = await Promise.all([rankMoves('hafta', hafta), rankMoves('ay', ay)])
  await rows(sql`DELETE FROM kp_rank_snapshots WHERE day < (now() AT TIME ZONE 'Europe/Istanbul')::date - 40`)
  const alerts = await overtakeAlerts(hafta, weekMoves).catch((e) => {
    console.error('[kp] geçildin bildirimi gönderilemedi', e)
    return 0
  })
  return { boards: hafta.length + ay.length, alerts }
}

const ALERT_TOP = 20

/** "Seni geçtiler": members in the weekly top 20 who dropped since yesterday get one push naming who passed them. */
async function overtakeAlerts(board: LeaderRow[], moves: Record<string, RankMove>) {
  const prevRank = (i: number) => {
    const m = moves[board[i].userId]
    return typeof m === 'number' ? i + 1 + m : Infinity
  }
  const due: { userId: string; title: string; body: string }[] = []
  board.slice(0, ALERT_TOP).forEach((row, i) => {
    const move = moves[row.userId]
    if (typeof move !== 'number' || move >= 0) return
    const mine = prevRank(i)
    let passer: LeaderRow | null = null
    for (let j = i - 1; j >= 0; j--) if (prevRank(j) > mine) { passer = board[j]; break }
    const now = i + 1
    due.push({
      userId: row.userId,
      title: 'Seni geçtiler kanka!',
      body: passer
        ? `${passer.name} seni ${mine}. sıradan geçti, şimdi ${now}. sıradasın. Hafta bitmeden yerini geri al.`
        : `Haftalık ligde ${mine}. sıradan ${now}. sıraya düştün. Hafta bitmeden yerini geri al.`,
    })
  })
  if (!due.length) return 0
  await rows(sql`CREATE TABLE IF NOT EXISTS kp_rank_alerts (day date NOT NULL, user_id text NOT NULL, PRIMARY KEY (day, user_id))`)
  const { sendToUsers } = await import('@/lib/push')
  let sent = 0
  for (const d of due) {
    const fresh = await rows(sql`INSERT INTO kp_rank_alerts (day, user_id) VALUES ((now() AT TIME ZONE 'Europe/Istanbul')::date, ${d.userId})
      ON CONFLICT DO NOTHING RETURNING user_id`)
    if (!fresh.length) continue
    await sendToUsers([d.userId], { title: d.title, body: d.body, url: '/siralama' }).catch(() => {})
    sent++
  }
  return sent
}

// --- Şampiyon kürsüsü -------------------------------------------------------

export type PodiumKind = 'hafta' | 'ay'
export type Podium = { kind: PodiumKind; label: string; rows: { place: number; userId: string; name: string; kp: number }[] }

let podiumReady: Promise<unknown> | null = null
function ensurePodiums() {
  podiumReady ??= rows(sql`CREATE TABLE IF NOT EXISTS kp_podiums (
    kind text NOT NULL, label text NOT NULL, place int NOT NULL, user_id text NOT NULL, name text NOT NULL, kp int NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, label, place))`).catch((e) => {
    podiumReady = null
    throw e
  })
  return podiumReady
}

const PODIUM_SPAN: Record<PodiumKind, { trunc: string; step: string }> = { hafta: { trunc: 'week', step: '1 week' }, ay: { trunc: 'month', step: '1 month' } }

/**
 * Freezes the top 3 of the period that just ended (weekly sprint bonus included) so the podium never
 * changes afterwards. Returns only podiums created by this call, so callers can announce them once.
 */
export async function settlePodiums(): Promise<Podium[]> {
  await ensurePodiums()
  const cfg = await getKpConfig()
  const created: Podium[] = []
  for (const kind of ['hafta', 'ay'] as PodiumKind[]) {
    const { trunc, step } = PODIUM_SPAN[kind]
    const startLocal = sql`date_trunc(${trunc}, now() AT TIME ZONE 'Europe/Istanbul')`
    const until = sql`(${startLocal} AT TIME ZONE 'Europe/Istanbul')`
    const since = sql`((${startLocal} - ${step}::interval) AT TIME ZONE 'Europe/Istanbul')`
    const [{ label }] = await rows<{ label: string }>(sql`SELECT to_char(${startLocal} - ${step}::interval, 'YYYY-MM-DD') AS label`)
    const exists = await rows(sql`SELECT 1 FROM kp_podiums WHERE kind = ${kind} AND label = ${label} LIMIT 1`)
    if (exists.length) continue
    const sprintSince = kind === 'hafta' ? sql`(${until} - interval '1 day')` : null
    const top = (await rankedWindow(cfg.rules, 3, { since, until }, sprintSince)).filter((t) => t.total > 0)
    if (!top.length) continue
    const podium: Podium = { kind, label, rows: top.map((t, i) => ({ place: i + 1, userId: t.userId, name: publicRankName(t.name), kp: t.total })) }
    let inserted = 0
    for (const r of podium.rows) {
      const ok = await rows(sql`INSERT INTO kp_podiums (kind, label, place, user_id, name, kp)
        VALUES (${kind}, ${label}, ${r.place}, ${r.userId}, ${r.name}, ${r.kp}) ON CONFLICT DO NOTHING RETURNING place`)
      inserted += ok.length
    }
    if (inserted) created.push(podium)
  }
  return created
}

/** Past podiums, newest first. Read-only so the public page never creates tables. */
export async function listPodiums(limit = 12): Promise<Podium[]> {
  if (!(await tableExists('kp_podiums'))) return []
  const r = await rows<{ kind: PodiumKind; label: string; place: number; user_id: string; name: string; kp: number }>(sql`
    SELECT kind, label, place, user_id, name, kp FROM kp_podiums
    WHERE (kind, label) IN (SELECT kind, label FROM kp_podiums GROUP BY kind, label ORDER BY label DESC LIMIT ${limit})
    ORDER BY label DESC, kind, place`)
  const map = new Map<string, Podium>()
  for (const x of r) {
    const key = `${x.kind}:${x.label}`
    if (!map.has(key)) map.set(key, { kind: x.kind, label: String(x.label), rows: [] })
    map.get(key)!.rows.push({ place: Number(x.place), userId: String(x.user_id), name: String(x.name), kp: Number(x.kp) })
  }
  return [...map.values()]
}

/** Current weekly #1, who wears the Kral Tacı everywhere their name shows. */
let kingCache: { at: number; id: string | null } | null = null
export async function weeklyKingId(): Promise<string | null> {
  if (kingCache && Date.now() - kingCache.at < 60_000) return kingCache.id
  const top = await readLeaderboard(1, 'hafta')
  kingCache = { at: Date.now(), id: top[0]?.userId ?? null }
  return kingCache.id
}
