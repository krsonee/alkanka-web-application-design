import { rows, sql } from '@/lib/db'
import { getContent, setContent } from '@/lib/content'
import { credit, getBalance, recordHistory } from '@/lib/member'
import { ensureGrowth } from '@/lib/growth'
import { normalizeTourSettings, tourSteps, TOUR_AUDIENCES, TOUR_SETTINGS_KEY, type TourAudience, type TourSettings } from '@/lib/tour-config'

export async function getTourSettings(): Promise<TourSettings> {
  return normalizeTourSettings(await getContent(TOUR_SETTINGS_KEY).catch(() => null))
}

export async function saveTourSettings(input: unknown) {
  const clean = normalizeTourSettings(input)
  await setContent(TOUR_SETTINGS_KEY, clean)
  return clean
}

let ready: Promise<unknown> | null = null
function ensureTable() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS tour_members (
      user_id text PRIMARY KEY,
      rewarded int NOT NULL DEFAULT 0,
      ip_hash text,
      device_id text,
      blocked text,
      done_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS tour_members_ip_paid ON tour_members (ip_hash) WHERE rewarded > 0 AND ip_hash IS NOT NULL`)
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS tour_members_dev_paid ON tour_members (device_id) WHERE rewarded > 0 AND device_id IS NOT NULL`)
    await rows(sql`ALTER TABLE tour_members ADD COLUMN IF NOT EXISTS seen_version int NOT NULL DEFAULT 1`)
    await rows(sql`CREATE TABLE IF NOT EXISTS tour_funnel (
      audience text NOT NULL,
      step_id text NOT NULL,
      seen int NOT NULL DEFAULT 0,
      exits int NOT NULL DEFAULT 0,
      PRIMARY KEY (audience, step_id))`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export type TourState = { done: boolean; rewarded: boolean }

/** `done` means the member has seen the tour as it stands now; a re-show raises the version and clears it. */
export async function getTourState(userId: string, version = 1): Promise<TourState> {
  await ensureTable()
  const r = await rows<{ rewarded: number; seen_version: number }>(sql`SELECT rewarded, seen_version FROM tour_members WHERE user_id = ${userId}`)
  return { done: r.length > 0 && Number(r[0].seen_version) >= version, rewarded: Number(r[0]?.rewarded ?? 0) > 0 }
}

export async function markTourSeen(userId: string, ipHash: string | null, deviceId: string | null, version = 1) {
  await ensureTable()
  await rows(sql`INSERT INTO tour_members (user_id, ip_hash, device_id, seen_version) VALUES (${userId}, ${ipHash}, ${deviceId}, ${version})
    ON CONFLICT (user_id) DO UPDATE SET seen_version = GREATEST(tour_members.seen_version, EXCLUDED.seen_version)`)
}

export type TourClaim =
  | { status: 'awarded'; amount: number; balance: number }
  | { status: 'already' | 'multi' | 'off' | 'cap' }
  | { status: 'late'; days: number }

/**
 * Pays the completion reward once per member. A second account on the same network (current IP or the
 * signup network) or the same browser is refused; the partial unique indexes make concurrent claims safe too.
 * The panel's two extra rules come on top: only within N days of signing up, and at most N rewards a day
 * (the daily limit is checked before paying, so two claims landing together can pass it by one).
 */
export async function claimTourReward(member: { id: string; name: string }, ipHash: string | null, deviceId: string): Promise<TourClaim> {
  await ensureTable()
  await ensureGrowth()
  const { reward, enabled, version, rewardDays, rewardDailyCap } = await getTourSettings()

  const own = await rows<{ rewarded: number }>(sql`SELECT rewarded FROM tour_members WHERE user_id = ${member.id}`)
  if (Number(own[0]?.rewarded ?? 0) > 0) return { status: 'already' }

  const block = async (reason: string) => {
    await rows(sql`INSERT INTO tour_members (user_id, ip_hash, device_id, blocked, seen_version) VALUES (${member.id}, ${ipHash}, ${deviceId}, ${reason}, ${version})
      ON CONFLICT (user_id) DO UPDATE SET blocked = EXCLUDED.blocked, done_at = now(), seen_version = GREATEST(tour_members.seen_version, EXCLUDED.seen_version)`)
    return { status: 'multi' as const }
  }

  if (!enabled || reward <= 0) {
    await markTourSeen(member.id, ipHash, deviceId, version)
    return { status: 'off' }
  }

  if (rewardDays > 0) {
    const fresh = await rows(sql`SELECT 1 FROM public."user" WHERE id = ${member.id} AND "createdAt" > now() - (${rewardDays}::int * interval '1 day')`)
    if (!fresh.length) {
      await markTourSeen(member.id, ipHash, deviceId, version)
      return { status: 'late', days: rewardDays }
    }
  }

  const suspicious = await rows<{ reason: string }>(sql`
    SELECT 'flagged' AS reason FROM member_origin WHERE user_id = ${member.id} AND flagged
    UNION ALL
    SELECT 'ip' FROM tour_members t
      WHERE t.rewarded > 0 AND t.user_id <> ${member.id} AND (
        (${ipHash}::text IS NOT NULL AND t.ip_hash = ${ipHash}) OR t.device_id = ${deviceId}
        OR t.ip_hash IN (SELECT ip_hash FROM member_origin WHERE user_id = ${member.id} AND ip_hash IS NOT NULL)
        OR t.user_id IN (SELECT o2.user_id FROM member_origin o1 JOIN member_origin o2 ON o1.ip_hash = o2.ip_hash
          WHERE o1.user_id = ${member.id} AND o1.ip_hash IS NOT NULL AND o2.user_id <> ${member.id}))
    LIMIT 1`)
  if (suspicious.length) return block(suspicious[0].reason === 'flagged' ? 'işaretli hesap' : 'aynı ağ / cihaz')

  if (rewardDailyCap > 0) {
    const today = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM tour_members
      WHERE rewarded > 0 AND done_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul'`)
    if (Number(today[0]?.n ?? 0) >= rewardDailyCap) {
      // Left unpaid and unblocked on purpose: the member can finish the tour again tomorrow and be paid.
      await markTourSeen(member.id, ipHash, deviceId, version)
      return { status: 'cap' }
    }
  }

  try {
    const paid = await rows(sql`INSERT INTO tour_members (user_id, rewarded, ip_hash, device_id, seen_version) VALUES (${member.id}, ${reward}, ${ipHash}, ${deviceId}, ${version})
      ON CONFLICT (user_id) DO UPDATE SET rewarded = EXCLUDED.rewarded, ip_hash = EXCLUDED.ip_hash, device_id = EXCLUDED.device_id, blocked = NULL, done_at = now(),
        seen_version = GREATEST(tour_members.seen_version, EXCLUDED.seen_version)
      WHERE tour_members.rewarded = 0 AND tour_members.blocked IS NULL
      RETURNING user_id`)
    if (!paid.length) {
      const again = await rows<{ blocked: string | null }>(sql`SELECT blocked FROM tour_members WHERE user_id = ${member.id}`)
      return { status: again[0]?.blocked ? 'multi' : 'already' }
    }
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') return block('aynı ağ / cihaz')
    throw error
  }

  await credit(member.id, reward, 'Site turu ödülü')
  await recordHistory({
    userId: member.id,
    userName: member.name,
    game: 'uygulama',
    mode: 'odul',
    opponent: 'Site turu ödülü',
    stake: 0,
    result: 'win',
    delta: reward,
  })
  return { status: 'awarded', amount: reward, balance: await getBalance(member.id) }
}

export type TourStats = {
  done: number
  rewarded: number
  blocked: number
  paidTotal: number
  recentBlocked: { userId: string; name: string; reason: string; at: string }[]
}

export async function tourStats(): Promise<TourStats> {
  await ensureTable()
  const [totals, recent] = await Promise.all([
    rows<{ done: string; rewarded: string; blocked: string; paid: string | null }>(sql`SELECT count(*) AS done,
      count(*) FILTER (WHERE rewarded > 0) AS rewarded, count(*) FILTER (WHERE blocked IS NOT NULL) AS blocked,
      sum(rewarded) AS paid FROM tour_members`),
    rows<{ user_id: string; name: string | null; blocked: string; done_at: string }>(sql`SELECT t.user_id, u.name, t.blocked, t.done_at
      FROM tour_members t LEFT JOIN public."user" u ON u.id = t.user_id
      WHERE t.blocked IS NOT NULL ORDER BY t.done_at DESC LIMIT 20`),
  ])
  const t = totals[0]
  return {
    done: Number(t?.done ?? 0),
    rewarded: Number(t?.rewarded ?? 0),
    blocked: Number(t?.blocked ?? 0),
    paidTotal: Number(t?.paid ?? 0),
    recentBlocked: recent.map((r) => ({ userId: r.user_id, name: r.name ?? r.user_id, reason: r.blocked, at: new Date(r.done_at).toISOString() })),
  }
}

/** Lets a blocked member claim again after manual review. */
export async function clearTourBlock(userId: string) {
  await ensureTable()
  await rows(sql`DELETE FROM tour_members WHERE user_id = ${userId} AND rewarded = 0`)
}

const RUN_ROW = '__run'
const DONE_ROW = '__done'

/**
 * One finished or abandoned walk through the tour: which steps were shown and where it was left.
 * Counted per step instead of per visitor, so a run costs a single statement and no visitor row is kept.
 */
export async function trackTourRun(input: unknown): Promise<boolean> {
  const raw = (input && typeof input === 'object' ? input : {}) as { a?: unknown; seen?: unknown; exit?: unknown; done?: unknown }
  const audience = TOUR_AUDIENCES.find((a) => a === raw.a)
  if (!audience || !Array.isArray(raw.seen)) return false
  const settings = await getTourSettings()
  if (!settings.enabled) return false
  const valid = tourSteps(settings, audience).map((s) => s.id)
  const seen = valid.filter((id) => (raw.seen as unknown[]).includes(id))
  if (!seen.length) return false
  const done = raw.done === true
  const exit = !done && typeof raw.exit === 'string' && seen.includes(raw.exit) ? raw.exit : null
  const ids = [RUN_ROW, ...seen, ...(done ? [DONE_ROW] : [])]
  await ensureTable()
  await rows(sql`INSERT INTO tour_funnel (audience, step_id, seen, exits)
    SELECT ${audience}, s.id, 1, CASE WHEN s.id = ${exit}::text THEN 1 ELSE 0 END
    FROM jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb) AS s(id)
    ON CONFLICT (audience, step_id) DO UPDATE SET seen = tour_funnel.seen + 1, exits = tour_funnel.exits + EXCLUDED.exits`)
  return true
}

export type TourFunnelStep = { id: string; title: string; seen: number; exits: number }
export type TourFunnel = Record<TourAudience, { runs: number; finished: number; steps: TourFunnelStep[] }>

export const EMPTY_FUNNEL: TourFunnel = { guest: { runs: 0, finished: 0, steps: [] }, member: { runs: 0, finished: 0, steps: [] } }

export async function tourFunnel(settings: TourSettings): Promise<TourFunnel> {
  await ensureTable()
  const data = await rows<{ audience: string; step_id: string; seen: number; exits: number }>(sql`SELECT audience, step_id, seen, exits FROM tour_funnel`)
  const at = (audience: TourAudience, id: string) => data.find((r) => r.audience === audience && r.step_id === id)
  return Object.fromEntries(
    TOUR_AUDIENCES.map((audience) => [
      audience,
      {
        runs: Number(at(audience, RUN_ROW)?.seen ?? 0),
        finished: Number(at(audience, DONE_ROW)?.seen ?? 0),
        steps: tourSteps(settings, audience).map((s) => ({
          id: s.id,
          title: s.title,
          seen: Number(at(audience, s.id)?.seen ?? 0),
          exits: Number(at(audience, s.id)?.exits ?? 0),
        })),
      },
    ]),
  ) as TourFunnel
}

export async function resetTourFunnel() {
  await ensureTable()
  await rows(sql`DELETE FROM tour_funnel`)
}

/** Shows the tour once more to everyone who already saw it. The reward stays once per member. */
export async function reshowTour(note: string) {
  const current = await getTourSettings()
  return saveTourSettings({ ...current, version: current.version + 1, versionNote: note })
}
