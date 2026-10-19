import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureKp, readLeaderboard, publicRankName, type BadgeTier } from '@/lib/kanka-puan'

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
  return {
    current: alive ? Number(last.n) : 0,
    best: runs.reduce((m, r) => Math.max(m, Number(r.n)), 0),
    activeToday: active.has(iso(0)),
    week: Array.from({ length: 7 }, (_, k) => {
      const day = iso(6 - k)
      return { day: names[new Date(`${day}T00:00:00Z`).getUTCDay()], active: active.has(day) }
    }),
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
