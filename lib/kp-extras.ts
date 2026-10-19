import 'server-only'
import { rows, sql } from '@/lib/db'
import {
  awardBadge,
  contestStandings,
  ensureKp,
  getKpConfig,
  levelTier,
  readLeaderboard,
  publicRankName,
  type AutoKind,
  type BadgeTier,
} from '@/lib/kanka-puan'
import { DEFAULT_QUEST, QUEST_METRICS, type QuestMetric, type WeeklyQuestConfig } from '@/lib/kanka-puan-shared'

const exists = async (name: string) => Boolean((await rows<{ t: string | null }>(sql`SELECT to_regclass(${name}) AS t`))[0]?.t)
const TODAY = sql`(now() AT TIME ZONE 'Europe/Istanbul')::date`

export type Streak = { current: number; best: number; activeToday: boolean; week: { day: string; active: boolean }[] }

/** Consecutive Istanbul days with time-on-site points. Today not counted yet keeps yesterday's streak alive. */
export async function getStreak(userId: string): Promise<Streak> {
  await ensureKp()
  const runs = await rows<{ e: string; n: string; today: string }>(sql`
    WITH d AS (SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Istanbul')::date AS d FROM kp_events WHERE user_id = ${userId} AND source = 'sure'),
    g AS (SELECT d, d - (row_number() OVER (ORDER BY d))::int AS grp FROM d)
    SELECT max(d)::text AS e, count(*) AS n, ${TODAY}::text AS today FROM g GROUP BY grp ORDER BY max(d) DESC`)
  const recent = await rows<{ d: string }>(sql`SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Istanbul')::date::text AS d FROM kp_events
    WHERE user_id = ${userId} AND source = 'sure' AND created_at >= now() - interval '8 days'`)
  const todayStr = runs[0]?.today ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date())
  const today = new Date(`${todayStr}T00:00:00Z`)
  const iso = (offset: number) => new Date(today.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
  const last = runs[0]
  const alive = last && (last.e === iso(0) || last.e === iso(1))
  const active = new Set(recent.map((r) => r.d))
  const names = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
  const current = alive ? Number(last.n) : 0
  if (current >= 7) {
    const start = new Date(new Date(`${last.e}T00:00:00Z`).getTime() - (current - 1) * 86_400_000).toISOString().slice(0, 10)
    await claimStreakBonus(userId, current, start).catch((error) => console.error('[kp] seri bonusu', (error as Error).message))
  }
  return {
    current,
    best: runs.reduce((m, r) => Math.max(m, Number(r.n)), 0),
    activeToday: active.has(iso(0)),
    week: Array.from({ length: 7 }, (_, k) => {
      const day = iso(6 - k)
      return { day: names[new Date(`${day}T00:00:00Z`).getUTCDay()], active: active.has(day) }
    }),
  }
}

/** Pays the 7 and 30 day streak bonus once per streak run. The run start date is part of the ref, so a new run can earn again. */
async function claimStreakBonus(userId: string, current: number, runStart: string) {
  const { rules } = await getKpConfig()
  const steps: [number, number][] = [
    [7, rules.streak7],
    [30, rules.streak30],
  ]
  for (const [days, points] of steps) {
    if (current < days || points <= 0) continue
    await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note)
      VALUES (${userId}, 'seri', ${points}, ${`${days}:${runStart}`}, ${`${days} günlük seri`}) ON CONFLICT DO NOTHING`)
  }
}

// --- Weekly badge quest --------------------------------------------------

const WEEK_START = sql`(date_trunc('week', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')`

export async function getQuestConfig(): Promise<WeeklyQuestConfig> {
  await ensureKp()
  const [r] = await rows<{ value: Partial<WeeklyQuestConfig> }>(sql`SELECT value FROM kp_settings WHERE key = 'weekly_quest'`)
  return { ...DEFAULT_QUEST, ...(r?.value ?? {}) }
}

export async function saveQuestConfig(input: WeeklyQuestConfig) {
  await ensureKp()
  const title = String(input.title ?? '').trim().slice(0, 40)
  const target = Math.floor(Number(input.target))
  if (!QUEST_METRICS.some((m) => m.id === input.metric)) throw new Error('Geçersiz görev tipi.')
  if (!Number.isFinite(target) || target < 1 || target > 10000) throw new Error('Hedef 1 ile 10.000 arasında olmalı.')
  if (input.enabled) {
    if (title.length < 2) throw new Error('Görev başlığı en az 2 karakter olmalı.')
    const [b] = await rows(sql`SELECT 1 FROM kp_badges WHERE id = ${input.badgeId} AND active`)
    if (!b) throw new Error('Ödül olarak aktif bir değerli rozet seç.')
  }
  const value: WeeklyQuestConfig = { enabled: Boolean(input.enabled), title, badgeId: String(input.badgeId ?? ''), metric: input.metric, target }
  await rows(sql`INSERT INTO kp_settings (key, value) VALUES ('weekly_quest', ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

async function questProgress(userId: string, metric: QuestMetric) {
  const table: Record<QuestMetric, string> = { tahmin: 'league_picks', oyun: 'game_history', gorev: 'game_history', sohbet: 'tg_chat_messages', dakika: 'kp_events' }
  if (!(await exists(table[metric]))) return 0
  const q = {
    tahmin: sql`SELECT count(*) AS n FROM league_picks WHERE user_id = ${userId} AND created_at >= ${WEEK_START}`,
    oyun: sql`SELECT count(*) AS n FROM game_history WHERE user_id = ${userId} AND mode <> 'odul' AND created_at >= ${WEEK_START}`,
    gorev: sql`SELECT count(*) AS n FROM game_history WHERE user_id = ${userId} AND mode = 'odul' AND game = 'gorev' AND created_at >= ${WEEK_START}`,
    sohbet: sql`SELECT count(*) AS n FROM tg_chat_messages WHERE user_id = ${userId} AND created_at >= ${WEEK_START}`,
    dakika: sql`SELECT count(*) AS n FROM kp_events WHERE user_id = ${userId} AND source = 'sure' AND created_at >= ${WEEK_START}`,
  }[metric]
  const [r] = await rows<{ n: string }>(q)
  return Number(r?.n ?? 0)
}

export type WeeklyQuest = {
  title: string
  metric: QuestMetric
  unit: string
  label: string
  target: number
  progress: number | null
  done: boolean
  winners: number
  daysLeft: number
  badge: { id: string; name: string; icon: string; tier: BadgeTier; bonus: number }
}

/** This week's quest. Reaching the target hands out the badge right away, once per ISO week. */
export async function getWeeklyQuest(userId: string | null): Promise<WeeklyQuest | null> {
  const cfg = await getQuestConfig()
  if (!cfg.enabled || !cfg.badgeId) return null
  const [b] = await rows<{ id: string; name: string; icon: string; tier: BadgeTier; bonus: number }>(sql`SELECT id, name, icon, tier, bonus FROM kp_badges WHERE id = ${cfg.badgeId} AND active`)
  if (!b) return null
  const [{ week }] = await rows<{ week: string }>(sql`SELECT to_char(now() AT TIME ZONE 'Europe/Istanbul', 'IYYY-"H"IW') AS week`)
  const period = `hafta-gorev-${week}`
  let progress: number | null = null
  let done = false
  if (userId) {
    progress = await questProgress(userId, cfg.metric)
    const [had] = await rows(sql`SELECT 1 FROM kp_awards WHERE badge_id = ${b.id} AND user_id = ${userId} AND period = ${period}`)
    done = Boolean(had)
    if (!done && progress >= cfg.target) done = (await awardBadge(b.id, userId, period, cfg.title).catch(() => false)) || false
  }
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM kp_awards WHERE badge_id = ${b.id} AND period = ${period}`)
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(new Date())
  const m = QUEST_METRICS.find((x) => x.id === cfg.metric)!
  return {
    title: cfg.title,
    metric: cfg.metric,
    unit: m.unit,
    label: m.label,
    target: cfg.target,
    progress,
    done,
    winners: Number(n),
    daysLeft: 7 - (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday) + 1),
    badge: { ...b, bonus: Number(b.bonus) },
  }
}

export async function questWinnersThisWeek(): Promise<number> {
  const cfg = await getQuestConfig()
  if (!cfg.badgeId) return 0
  const [r] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM kp_awards WHERE badge_id = ${cfg.badgeId}
    AND period = 'hafta-gorev-' || to_char(now() AT TIME ZONE 'Europe/Istanbul', 'IYYY-"H"IW')`)
  return Number(r?.n ?? 0)
}

// --- Valuable badge owners -----------------------------------------------

export type BadgeOwner = { name: string; image: string | null; count: number; lastAt: string }
export type BadgeShowcase = { owners: Record<string, BadgeOwner[]>; leaders: Record<string, { name: string; detail: string }> }

/** Owners with avatar and date, plus who currently leads each automatic contest. */
export async function badgeShowcase(badges: { id: string; auto: AutoKind | null }[]): Promise<BadgeShowcase> {
  await ensureKp()
  const r = await rows<{ badge_id: string; name: string | null; image: string | null; n: string; last_at: string }>(sql`
    SELECT a.badge_id, max(u.name) AS name, max(u.image) AS image, count(*) AS n, max(a.awarded_at) AS last_at
    FROM kp_awards a LEFT JOIN public."user" u ON u.id = a.user_id GROUP BY a.badge_id, a.user_id ORDER BY max(a.awarded_at) DESC`)
  const owners: Record<string, BadgeOwner[]> = {}
  for (const x of r) {
    const list = (owners[x.badge_id] ??= [])
    if (list.length < 6) list.push({ name: publicRankName(x.name), image: x.image || null, count: Number(x.n), lastAt: new Date(String(x.last_at)).toISOString() })
  }
  const kinds = [...new Set(badges.map((b) => b.auto).filter((k): k is Exclude<AutoKind, 'turnuva'> => !!k && k !== 'turnuva'))]
  const standings = await Promise.all(kinds.map((k) => contestStandings(k).then((s) => [k, s.rows[0]] as const).catch(() => [k, undefined] as const)))
  const top = Object.fromEntries(standings)
  const leaders: BadgeShowcase['leaders'] = {}
  for (const b of badges) {
    const lead = b.auto && b.auto !== 'turnuva' ? top[b.auto] : undefined
    if (lead) leaders[b.id] = { name: publicRankName(lead.name), detail: lead.detail }
  }
  return { owners, leaders }
}

// --- League rivals -------------------------------------------------------

export type Rival = { name: string; kp: number; level: number; levelName: string; me: boolean; gap: number }

/** Two members just above and two just below you in your own league. */
export async function getLeagueRivals(userId: string): Promise<{ tier: string; rivals: Rival[] } | null> {
  const board = await readLeaderboard(300, 'tum')
  const idx = board.findIndex((r) => r.userId === userId)
  if (idx < 0) return null
  const me = board[idx]
  const tier = levelTier(me.level)
  const same = board.map((r, i) => ({ r, i })).filter(({ r }) => levelTier(r.level) === tier)
  const pos = same.findIndex(({ i }) => i === idx)
  const slice = same.slice(Math.max(0, pos - 2), pos + 3)
  if (slice.length < 2) return { tier, rivals: [] }
  return {
    tier,
    rivals: slice.map(({ r }) => ({ name: r.userId === userId ? 'Sen' : r.name, kp: r.kp, level: r.level, levelName: r.levelName, me: r.userId === userId, gap: r.kp - me.kp })),
  }
}

export type WeeklyStar = { name: string; kp: number; mine: { kp: number; rank: number | null } | null; daysLeft: number }

export async function getWeeklyStar(userId: string | null): Promise<WeeklyStar> {
  const board = await readLeaderboard(50, 'hafta').catch(() => [])
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(new Date())
  const daysLeft = 7 - (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday) + 1)
  const top = board[0]
  const idx = userId ? board.findIndex((r) => r.userId === userId) : -1
  return {
    name: top ? publicRankName(top.name) : '',
    kp: top?.kp ?? 0,
    mine: userId ? { kp: idx >= 0 ? board[idx].kp : 0, rank: idx >= 0 ? idx + 1 : null } : null,
    daysLeft,
  }
}

export type HiddenBadge = { id: string; name: string; hint: string; description: string; icon: string; tier: BadgeTier; unlocked: boolean }

const HIDDEN: Omit<HiddenBadge, 'unlocked'>[] = [
  { id: 'gece-kusu', name: 'Gece Kuşu', hint: 'Herkes uyurken buradasın.', description: 'Gece 02:00 ile 05:00 arasında sitede vakit geçirdin.', icon: 'star', tier: 'altin' },
  { id: 'seri-7', name: 'Ateşli Hafta', hint: 'Bir hafta boyunca hiç kopma.', description: '7 gün üst üste sitedeydin.', icon: 'flame', tier: 'altin' },
  { id: 'seri-30', name: 'Demir İrade', hint: 'Bir ay boyunca her gün.', description: '30 gün üst üste sitedeydin.', icon: 'shield', tier: 'efsane' },
  { id: 'oyun-yuz', name: 'Masa Kurdu', hint: 'Masadan kalkmayanlara.', description: '100 oyun oynadın.', icon: 'swords', tier: 'elmas' },
  { id: 'tam-skor', name: 'Nokta Atışı', hint: 'Skoru gördün, yazdın.', description: '5 maçta tam skoru bildin.', icon: 'target', tier: 'elmas' },
  { id: 'kanka-getiren', name: 'Kanka Mıknatısı', hint: 'Yalnız gelme.', description: '3 arkadaşını getirdin.', icon: 'heart', tier: 'altin' },
]

/** Secret achievements, checked live from activity. They pay no KP, so nothing needs to be stored. */
export async function getHiddenBadges(userId: string | null, bestStreak: number): Promise<HiddenBadge[]> {
  if (!userId) return HIDDEN.map((b) => ({ ...b, unlocked: false }))
  const [games, picks, refs] = await Promise.all([exists('game_history'), exists('league_picks'), exists('referrals')])
  const [r] = await rows<{ night: boolean; games: string; exact: string; refs: string }>(sql`SELECT
    EXISTS (SELECT 1 FROM kp_events WHERE user_id = ${userId} AND source = 'sure'
      AND extract(hour FROM created_at AT TIME ZONE 'Europe/Istanbul') BETWEEN 2 AND 4) AS night,
    ${games ? sql`(SELECT count(*) FROM game_history WHERE user_id = ${userId} AND mode <> 'odul')` : sql`0`} AS games,
    ${picks ? sql`(SELECT count(*) FROM league_picks WHERE user_id = ${userId} AND points = 3)` : sql`0`} AS exact,
    ${refs ? sql`(SELECT count(*) FROM referrals WHERE referrer_id = ${userId} AND rewarded_at IS NOT NULL)` : sql`0`} AS refs`)
  const done: Record<string, boolean> = {
    'gece-kusu': Boolean(r?.night),
    'seri-7': bestStreak >= 7,
    'seri-30': bestStreak >= 30,
    'oyun-yuz': Number(r?.games ?? 0) >= 100,
    'tam-skor': Number(r?.exact ?? 0) >= 5,
    'kanka-getiren': Number(r?.refs ?? 0) >= 3,
  }
  return HIDDEN.map((b) => ({ ...b, unlocked: done[b.id] ?? false }))
}

export type FeedItem = { id: string; kind: 'rozet' | 'turnuva' | 'gorev'; name: string; text: string; tier: BadgeTier | null; icon: string; at: string }

/** Latest community wins: badges handed out, tournaments won, tasks completed. */
export async function getLiveFeed(limit = 8): Promise<FeedItem[]> {
  await ensureKp()
  const games = await exists('game_history')
  const r = await rows<{ id: string; kind: FeedItem['kind']; name: string | null; text: string; tier: string | null; icon: string; at: string }>(sql`
    SELECT * FROM (
      (SELECT 'a' || a.id AS id, 'rozet' AS kind, u.name, b.name AS text, b.tier, b.icon, a.awarded_at AS at
        FROM kp_awards a JOIN kp_badges b ON b.id = a.badge_id LEFT JOIN public."user" u ON u.id = a.user_id
        WHERE a.badge_id NOT IN ('moderator', 'sponsor-destek') ORDER BY a.awarded_at DESC LIMIT ${limit})
      UNION ALL
      (SELECT 'e' || e.id, 'turnuva', u.name, coalesce(e.note, 'Turnuva'), NULL, 'trophy', e.created_at
        FROM kp_events e LEFT JOIN public."user" u ON u.id = e.user_id WHERE e.source = 'turnuva' ORDER BY e.created_at DESC LIMIT ${limit})
      ${games
        ? sql`UNION ALL (SELECT 'g' || g.ctid::text, 'gorev', u.name, 'Görev', NULL, 'zap', g.created_at
            FROM game_history g LEFT JOIN public."user" u ON u.id = g.user_id WHERE g.mode = 'odul' AND g.game = 'gorev'
            ORDER BY g.created_at DESC LIMIT ${limit})`
        : sql``}
    ) x ORDER BY at DESC LIMIT ${limit}`)
  return r.map((x) => ({
    id: String(x.id),
    kind: x.kind,
    name: publicRankName(x.name),
    text: String(x.text),
    tier: (x.tier as BadgeTier | null) ?? null,
    icon: String(x.icon),
    at: new Date(String(x.at)).toISOString(),
  }))
}
