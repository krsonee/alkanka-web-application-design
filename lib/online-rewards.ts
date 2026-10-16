import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureKp, isRoleHolder } from '@/lib/kanka-puan'
import { publicRankName } from '@/lib/kanka-puan-shared'
import { credit } from '@/lib/member'
import { ensureTasks } from '@/lib/tasks'
import {
  cleanOnlineConfig,
  DEFAULT_ONLINE,
  MAX_ONLINE_HOURS,
  nextReward,
  rewardForHour,
  type OnlineConfig,
  type OnlineGrant,
  type OnlineStatus,
} from '@/lib/online-rewards-shared'

const SETTINGS_KEY = 'online_rewards'

let ready: Promise<unknown> | null = null
function ensureOnline() {
  ready ??= (async () => {
    await ensureKp()
    await rows(sql`CREATE TABLE IF NOT EXISTS online_sessions (
      user_id text PRIMARY KEY, started_at timestamptz NOT NULL, last_seen timestamptz NOT NULL)`)
    await rows(sql`ALTER TABLE kp_events ADD COLUMN IF NOT EXISTS coins int NOT NULL DEFAULT 0`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export async function getOnlineConfig(): Promise<OnlineConfig> {
  await ensureOnline()
  const [row] = await rows<{ value: Partial<OnlineConfig> }>(sql`SELECT value FROM kp_settings WHERE key = ${SETTINGS_KEY}`)
  return row ? cleanOnlineConfig(row.value) : DEFAULT_ONLINE
}

export async function saveOnlineConfig(input: OnlineConfig) {
  await ensureOnline()
  const cfg = cleanOnlineConfig(input)
  if (!cfg.tiers.length) throw new Error('En az bir saat ödülü olmalı.')
  await rows(sql`INSERT INTO kp_settings (key, value) VALUES (${SETTINGS_KEY}, ${JSON.stringify(cfg)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)
}

function statusFor(cfg: OnlineConfig, minutes: number, opts: { member: boolean; active: boolean; granted?: OnlineGrant[] }): OnlineStatus {
  return {
    enabled: cfg.enabled,
    member: opts.member,
    active: opts.active,
    minutes,
    graceMinutes: cfg.graceMinutes,
    tiers: cfg.tiers,
    extra: cfg.extra,
    next: cfg.enabled ? nextReward(cfg, minutes) : null,
    granted: opts.granted ?? [],
  }
}

export async function guestOnlineStatus(): Promise<OnlineStatus> {
  return statusFor(await getOnlineConfig(), 0, { member: false, active: false })
}

/** Extends (or restarts after a long break) the member's uninterrupted session and pays any hour reward reached. */
export async function tickOnline(userId: string): Promise<OnlineStatus> {
  const cfg = await getOnlineConfig()
  if (!cfg.enabled) return statusFor(cfg, 0, { member: true, active: false })
  const [s] = await rows<{ started_at: string; last_seen: string }>(sql`
    INSERT INTO online_sessions (user_id, started_at, last_seen) VALUES (${userId}, now(), now())
    ON CONFLICT (user_id) DO UPDATE SET
      started_at = CASE WHEN online_sessions.last_seen < now() - make_interval(mins => ${cfg.graceMinutes}) THEN now() ELSE online_sessions.started_at END,
      last_seen = now()
    RETURNING started_at, last_seen`)
  const started = new Date(s.started_at)
  const minutes = Math.max(0, Math.floor((new Date(s.last_seen).getTime() - started.getTime()) / 60000))
  const hours = Math.min(Math.floor(minutes / 60), MAX_ONLINE_HOURS)
  const granted: OnlineGrant[] = []
  if (hours >= 1 && !(await isRoleHolder(userId))) {
    const sessionKey = started.getTime().toString(36)
    // Pings arrive every minute, so only the current and previous hour can still be unpaid.
    for (const h of [hours - 1, hours]) {
      const tier = h >= 1 ? rewardForHour(cfg, h) : null
      if (!tier) continue
      const inserted = await rows(sql`INSERT INTO kp_events (user_id, source, points, coins, ref, note)
        VALUES (${userId}, 'online', ${tier.kp}, ${tier.coin}, ${`${sessionKey}:${h}`}, ${`${h} saat kesintisiz online`})
        ON CONFLICT DO NOTHING RETURNING id`)
      if (!inserted.length) continue
      if (tier.coin > 0) await credit(userId, tier.coin)
      granted.push(tier)
    }
  }
  return statusFor(cfg, minutes, { member: true, active: true, granted })
}

export async function readOnlineStatus(userId: string): Promise<OnlineStatus> {
  const cfg = await getOnlineConfig()
  const [s] = await rows<{ minutes: number; active: boolean }>(sql`
    SELECT floor(extract(epoch FROM last_seen - started_at) / 60)::int AS minutes,
      last_seen >= now() - make_interval(mins => ${cfg.graceMinutes}) AS active
    FROM online_sessions WHERE user_id = ${userId}`)
  const active = Boolean(s?.active) && cfg.enabled
  return statusFor(cfg, active ? Number(s.minutes) : 0, { member: true, active })
}

export type FeedKind = 'gorev' | 'rozet' | 'online'
export type FeedItem = { id: string; kind: FeedKind; name: string; title: string; coin: number; kp: number; at: string }

/** Recent public wins across tasks, badges and online streaks. Names are reduced to first names. */
export async function winnersFeed(limit = 30): Promise<FeedItem[]> {
  await Promise.all([ensureOnline(), ensureTasks()])
  const [events, awards] = await Promise.all([
    rows<{ id: number; source: string; points: number; coins: number; note: string | null; title: string | null; name: string | null; created_at: string }>(sql`
      SELECT e.id, e.source, e.points, e.coins, e.note, t.title, u.name, e.created_at
      FROM kp_events e
      LEFT JOIN public."user" u ON u.id = e.user_id
      LEFT JOIN tasks t ON e.source = 'gorev' AND t.id::text = split_part(e.ref, ':', 1)
      WHERE e.source IN ('gorev', 'online') AND e.created_at > now() - interval '48 hours'
      ORDER BY e.created_at DESC LIMIT ${limit}`),
    rows<{ id: number; badge: string; bonus: number; name: string | null; awarded_at: string }>(sql`
      SELECT a.id, b.name AS badge, b.bonus, u.name, a.awarded_at
      FROM kp_awards a JOIN kp_badges b ON b.id = a.badge_id LEFT JOIN public."user" u ON u.id = a.user_id
      WHERE a.awarded_at > now() - interval '7 days' AND a.badge_id NOT IN ('moderator', 'sponsor-destek')
      ORDER BY a.awarded_at DESC LIMIT ${limit}`),
  ])
  const items: FeedItem[] = [
    ...events.map((e) => ({
      id: `e${e.id}`,
      kind: e.source as FeedKind,
      name: publicRankName(e.name),
      title: e.source === 'gorev' ? (e.title ?? 'Görev') : (e.note ?? 'Kesintisiz online'),
      coin: e.source === 'gorev' ? Number(e.points) : Number(e.coins),
      kp: Number(e.points),
      at: new Date(e.created_at).toISOString(),
    })),
    ...awards.map((a) => ({
      id: `a${a.id}`,
      kind: 'rozet' as const,
      name: publicRankName(a.name),
      title: a.badge,
      coin: 0,
      kp: Number(a.bonus),
      at: new Date(a.awarded_at).toISOString(),
    })),
  ]
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}
