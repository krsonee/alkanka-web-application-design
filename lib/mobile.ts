import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensurePushPrefs, type PushTopic } from '@/lib/push'

export const POCKET_BADGE = 'cepteki-kanka'
export const PUSH_TOPICS: { value: PushTopic; label: string; hint: string }[] = [
  { value: 'mac', label: 'Maçlar', hint: 'Takip ettiğin takımların maç başlangıcı ve golleri' },
  { value: 'cember', label: 'Jako Çemberi', hint: 'Katıldığın seans başlamadan önce hatırlatma' },
  { value: 'flash', label: 'Market & flaş', hint: 'Flaş indirimler, geri dönüş hediyeleri' },
  { value: 'sponsor', label: 'Sponsor', hint: 'Kayıp bonusu günleri ve sponsor kampanyaları' },
]
const TOPIC_SET = new Set<string>(PUSH_TOPICS.map((t) => t.value))
const REMIND_AFTER_DAYS = 7

export type MobileSegment = 'hepsi' | 'yukleyen' | 'bildirim' | 'ikisi' | 'hicbiri'
export const MOBILE_SEGMENTS: { value: MobileSegment; label: string }[] = [
  { value: 'hepsi', label: 'Tüm üyeler' },
  { value: 'yukleyen', label: 'Uygulamayı yükleyen' },
  { value: 'bildirim', label: 'Bildirim açan' },
  { value: 'ikisi', label: 'İkisi de' },
  { value: 'hicbiri', label: 'Hiçbiri' },
]
export const isSegment = (v: unknown): v is MobileSegment => MOBILE_SEGMENTS.some((s) => s.value === v)

export type MobileRow = {
  userId: string
  name: string
  installedAt: string | null
  platform: string | null
  lastOpen: string | null
  openDays: number
  push: boolean
  pushOffAt: string | null
  muted: string[]
}

let ready: Promise<void> | null = null
export function ensureMobile() {
  ready ??= (async () => {
    const { ensureKp } = await import('@/lib/kanka-puan')
    await ensureKp()
    await ensurePushPrefs()
    await rows(sql`CREATE TABLE IF NOT EXISTS app_installs (
      user_id text PRIMARY KEY, platform text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`ALTER TABLE app_installs ADD COLUMN IF NOT EXISTS last_seen timestamptz`)
    await rows(sql`CREATE TABLE IF NOT EXISTS app_push_rewards (
      user_id text PRIMARY KEY, endpoint text NOT NULL UNIQUE, amount int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS app_opens (
      user_id text NOT NULL, day date NOT NULL, PRIMARY KEY (user_id, day))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS app_combo_rewards (
      user_id text PRIMARY KEY, amount int NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS push_status (
      user_id text PRIMARY KEY, state text NOT NULL, off_at timestamptz, reminded_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`INSERT INTO kp_badges (id, name, description, icon, tier, bonus, auto, sort)
      VALUES (${POCKET_BADGE}, 'Cepteki Kanka', 'Alkanka uygulamasını telefonuna yükledi.', 'zap', 'altin', 0, NULL, 120)
      ON CONFLICT DO NOTHING`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

/** Marks today's app open (standalone launch) for the member. */
export async function recordAppOpen(userId: string) {
  await ensureMobile()
  await rows(sql`INSERT INTO app_opens (user_id, day) VALUES (${userId}, (now() AT TIME ZONE 'Europe/Istanbul')::date) ON CONFLICT DO NOTHING`)
  await rows(sql`UPDATE app_installs SET last_seen = now() WHERE user_id = ${userId}`)
}

export async function grantPocketBadge(userId: string) {
  await ensureMobile()
  const { awardBadge } = await import('@/lib/kanka-puan')
  await awardBadge(POCKET_BADGE, userId, 'tek', 'Uygulamayı yükledi').catch(() => false)
}

/** One-time bonus once the member has both installed the app and turned on notifications. Returns the paid amount. */
export async function claimCombo(userId: string, amount: number): Promise<number> {
  if (amount <= 0) return 0
  await ensureMobile()
  const both = await rows(sql`SELECT 1 FROM app_installs i JOIN app_push_rewards p ON p.user_id = i.user_id WHERE i.user_id = ${userId}`)
  if (!both.length) return 0
  const inserted = await rows(sql`INSERT INTO app_combo_rewards (user_id, amount) VALUES (${userId}, ${amount}) ON CONFLICT DO NOTHING RETURNING user_id`)
  return inserted.length ? amount : 0
}

/** Remembers when a member who had notifications on turned them off, so we can remind them a week later. */
export async function reportPushState(userId: string, state: string, subscribed: boolean) {
  await ensureMobile()
  const on = state === 'granted' && subscribed
  if (on) {
    await rows(sql`INSERT INTO push_status (user_id, state, off_at) VALUES (${userId}, 'on', NULL)
      ON CONFLICT (user_id) DO UPDATE SET state = 'on', off_at = NULL, updated_at = now()`)
    return
  }
  const hadPush = await rows(sql`SELECT 1 FROM app_push_rewards WHERE user_id = ${userId}
    UNION SELECT 1 FROM push_subscriptions WHERE user_id = ${userId} LIMIT 1`).catch(() => [])
  if (!hadPush.length) return
  const safe = ['denied', 'default', 'unsupported'].includes(state) ? state : 'off'
  await rows(sql`INSERT INTO push_status (user_id, state, off_at) VALUES (${userId}, ${safe}, now())
    ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, off_at = COALESCE(push_status.off_at, now()), updated_at = now()`)
  await rows(sql`DELETE FROM push_subscriptions WHERE user_id = ${userId}`).catch(() => {})
}

export async function pushReminderDue(userId: string): Promise<boolean> {
  await ensureMobile()
  const r = await rows(sql`SELECT 1 FROM push_status WHERE user_id = ${userId} AND off_at IS NOT NULL
    AND off_at <= now() - make_interval(days => ${REMIND_AFTER_DAYS})
    AND (reminded_at IS NULL OR reminded_at <= now() - make_interval(days => ${REMIND_AFTER_DAYS}))`)
  return r.length > 0
}

export async function dismissPushReminder(userId: string) {
  await ensureMobile()
  await rows(sql`UPDATE push_status SET reminded_at = now() WHERE user_id = ${userId}`)
}

export async function getPushPrefs(userId: string): Promise<string[]> {
  await ensureMobile()
  const r = await rows<{ off: string[] }>(sql`SELECT off FROM push_prefs WHERE user_id = ${userId}`)
  return (r[0]?.off ?? []).filter((t) => TOPIC_SET.has(t))
}

export async function savePushPrefs(userId: string, off: string[]) {
  await ensureMobile()
  const clean = Array.from(new Set(off.filter((t) => TOPIC_SET.has(t))))
  await rows(sql`INSERT INTO push_prefs (user_id, off, updated_at) VALUES (${userId}, ${clean}, now())
    ON CONFLICT (user_id) DO UPDATE SET off = EXCLUDED.off, updated_at = now()`)
  return clean
}

function segmentWhere(segment: MobileSegment) {
  const inst = sql`EXISTS (SELECT 1 FROM app_installs i WHERE i.user_id = u.id)`
  const push = sql`EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = u.id)`
  switch (segment) {
    case 'yukleyen':
      return inst
    case 'bildirim':
      return push
    case 'ikisi':
      return sql`${inst} AND ${push}`
    case 'hicbiri':
      return sql`NOT ${inst} AND NOT ${push}`
    default:
      return sql`TRUE`
  }
}

/** `from`/`to` (YYYY-MM-DD) filter on install date for install segments, on signup date otherwise. */
function dateWhere(segment: MobileSegment, from: string | null, to: string | null) {
  const col = segment === 'yukleyen' || segment === 'ikisi' ? sql`(SELECT i.created_at FROM app_installs i WHERE i.user_id = u.id)` : sql`u."createdAt"`
  const parts = [sql`TRUE`]
  if (from) parts.push(sql`${col} >= ${from}::date`)
  if (to) parts.push(sql`${col} < ${to}::date + 1`)
  return sql.join(parts, sql` AND `)
}

export async function mobileCounts() {
  await ensureMobile()
  const r = await rows<{ total: string; installed: string; push: string; both: string; opens_today: string; off: string }>(sql`SELECT
    (SELECT count(*) FROM public."user") AS total,
    (SELECT count(*) FROM app_installs) AS installed,
    (SELECT count(DISTINCT user_id) FROM push_subscriptions WHERE user_id IS NOT NULL) AS push,
    (SELECT count(*) FROM app_installs i WHERE EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = i.user_id)) AS both,
    (SELECT count(*) FROM app_opens WHERE day = (now() AT TIME ZONE 'Europe/Istanbul')::date) AS opens_today,
    (SELECT count(*) FROM push_status WHERE off_at IS NOT NULL) AS off`)
  const c = r[0]
  const total = Number(c?.total ?? 0)
  const installed = Number(c?.installed ?? 0)
  const push = Number(c?.push ?? 0)
  const both = Number(c?.both ?? 0)
  return { total, installed, push, both, none: Math.max(0, total - installed - push + both), opensToday: Number(c?.opens_today ?? 0), turnedOff: Number(c?.off ?? 0) }
}

export async function mobileMembers(segment: MobileSegment, from: string | null, to: string | null, limit = 200): Promise<MobileRow[]> {
  await ensureMobile()
  const list = await rows(sql`SELECT u.id, u.name, i.created_at AS installed_at, i.platform, i.last_seen,
      (SELECT count(*) FROM app_opens o WHERE o.user_id = u.id) AS open_days,
      EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = u.id) AS push,
      ps.off_at, COALESCE(pp.off, '{}') AS muted
    FROM public."user" u
    LEFT JOIN app_installs i ON i.user_id = u.id
    LEFT JOIN push_status ps ON ps.user_id = u.id
    LEFT JOIN push_prefs pp ON pp.user_id = u.id
    WHERE ${segmentWhere(segment)} AND ${dateWhere(segment, from, to)}
    ORDER BY COALESCE(i.last_seen, i.created_at, u."createdAt") DESC
    LIMIT ${limit}`)
  const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null)
  return list.map((r) => ({
    userId: String(r.id),
    name: String(r.name ?? 'Kanka'),
    installedAt: iso(r.installed_at),
    platform: r.platform ? String(r.platform) : null,
    lastOpen: iso(r.last_seen),
    openDays: Number(r.open_days ?? 0),
    push: Boolean(r.push),
    pushOffAt: iso(r.off_at),
    muted: Array.isArray(r.muted) ? (r.muted as string[]) : [],
  }))
}

export async function segmentUserIds(segment: MobileSegment, from: string | null, to: string | null): Promise<string[]> {
  await ensureMobile()
  const list = await rows<{ id: string }>(sql`SELECT u.id FROM public."user" u
    WHERE ${segmentWhere(segment)} AND ${dateWhere(segment, from, to)} LIMIT 20000`)
  return list.map((r) => r.id)
}
