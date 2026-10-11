import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureCommunity } from '@/lib/community'
import { BADGE_ICONS, BADGE_TIERS, DEFAULT_LEVELS, DEFAULT_RULES, type BadgeTier, type LevelDef, type PointRules } from '@/lib/kanka-puan-shared'

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
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

// --- Config --------------------------------------------------------------

export async function getKpConfig(): Promise<KpConfig> {
  await ensureKp()
  const r = await rows<{ key: string; value: unknown }>(sql`SELECT key, value FROM kp_settings WHERE key IN ('levels', 'rules')`)
  const levels = r.find((x) => x.key === 'levels')?.value as LevelDef[] | undefined
  const rules = r.find((x) => x.key === 'rules')?.value as Partial<PointRules> | undefined
  return {
    levels: levels?.length ? levels : DEFAULT_LEVELS,
    rules: { ...DEFAULT_RULES, ...(rules ?? {}) },
  }
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

async function totals(rules: PointRules, userId: string | null, limit = 1, period: RankPeriod = 'tum') {
  const since = periodStart(period)
  const [chat, tg] = await Promise.all([tableExists('tg_chat_messages'), tableExists('tg_links')])
  const chatCte = chat
    ? sql`SELECT user_id, sum(least(n, ${rules.chatDailyCap}))::bigint AS v FROM (
        SELECT user_id, date_trunc('day', created_at AT TIME ZONE 'Europe/Istanbul') AS d, count(*) AS n
        FROM tg_chat_messages WHERE user_id IS NOT NULL AND created_at >= ${since} GROUP BY 1, 2) x GROUP BY user_id`
    : sql`SELECT NULL::text AS user_id, 0::bigint AS v WHERE false`
  const tgCte = tg
    ? sql`SELECT user_id, 1::bigint AS v FROM tg_links WHERE coalesce(linked_at, now()) >= ${since}`
    : sql`SELECT NULL::text AS user_id, 0::bigint AS v WHERE false`
  const r = await rows(sql`WITH
    g AS (SELECT user_id, count(*) FILTER (WHERE mode <> 'odul') AS games, count(*) FILTER (WHERE mode = 'odul' AND game = 'gorev') AS tasks
      FROM game_history WHERE created_at >= ${since} GROUP BY user_id),
    c AS (${chatCte}),
    l AS (SELECT user_id, coalesce(sum(points), 0) AS v FROM league_picks WHERE created_at >= ${since} GROUP BY user_id),
    rv AS (SELECT user_id, count(*) AS v FROM site_reviews WHERE status = 'approved' AND created_at >= ${since} GROUP BY user_id),
    rf AS (SELECT referrer_id AS user_id, count(*) AS v FROM referrals WHERE rewarded_at IS NOT NULL AND rewarded_at >= ${since} GROUP BY referrer_id),
    t AS (${tgCte}),
    e AS (SELECT user_id, coalesce(sum(points) FILTER (WHERE source = 'sure'), 0) AS time, coalesce(sum(points) FILTER (WHERE source <> 'sure'), 0) AS bonus
      FROM kp_events WHERE created_at >= ${since} GROUP BY user_id),
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
      WHERE ids.user_id IS NOT NULL AND (${userId}::text IS NULL OR ids.user_id = ${userId}))
    SELECT s.*, (s.time + s.games + s.tasks + s.chat + s.league + s.reviews + s.referrals + s.telegram + s.bonus) AS total, u.name
    FROM s LEFT JOIN public."user" u ON u.id = s.user_id
    ORDER BY total DESC LIMIT ${limit}`)
  return r.map((x) => {
    const breakdown = Object.fromEntries(SOURCE_KEYS.map((k) => [k, Number(x[k] ?? 0)])) as KpBreakdown
    return { userId: String(x.user_id), name: String(x.name ?? 'Kanka'), total: Math.max(0, Number(x.total ?? 0)), breakdown }
  })
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

export type LeaderRow = { userId: string; name: string; kp: number; level: number; levelName: string; badge: string; specials: number }

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
    name: String(x.name ?? 'Kanka').split(' ')[0],
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

export async function leaderboard(limit = 20, period: RankPeriod = 'tum'): Promise<LeaderRow[]> {
  const cfg = await getKpConfig()
  const list = (await totals(cfg.rules, null, limit, period)).filter((l) => l.total > 0)
  if (!list.length) return []
  const counts = await rows<{ user_id: string; n: string }>(sql`SELECT user_id, count(*) AS n FROM kp_awards
    WHERE user_id IN ${list.map((l) => l.userId)} GROUP BY user_id`)
  return list.map((l) => {
    const lv = levelFor(cfg.levels, l.total)
    return {
      userId: l.userId,
      name: l.name.split(' ')[0],
      kp: l.total,
      level: lv.index + 1,
      levelName: lv.name,
      badge: lv.badge,
      specials: Number(counts.find((c) => c.user_id === l.userId)?.n ?? 0),
    }
  })
}

// --- Time on site --------------------------------------------------------

/** Credits one minute of active time. The minute bucket makes repeated or parallel pings harmless. */
export async function pingActive(userId: string) {
  const cfg = await getKpConfig()
  if (cfg.rules.minute > 0) {
    await rows(sql`INSERT INTO kp_events (user_id, source, points, ref)
      SELECT ${userId}, 'sure', ${cfg.rules.minute}, to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD"T"HH24:MI')
      WHERE (SELECT count(*) FROM kp_events WHERE user_id = ${userId} AND source = 'sure'
        AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')) < ${cfg.rules.minuteDailyCap}
      ON CONFLICT DO NOTHING`)
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
  for (const x of r) (out[x.badge_id] ??= []).length < 8 && out[x.badge_id].push({ name: String(x.name ?? 'Kanka').split(' ')[0], count: Number(x.n) })
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
