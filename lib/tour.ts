import { rows, sql } from '@/lib/db'
import { getContent, setContent } from '@/lib/content'
import { credit, getBalance, recordHistory } from '@/lib/member'
import { ensureGrowth } from '@/lib/growth'
import { normalizeTourSettings, TOUR_SETTINGS_KEY, type TourSettings } from '@/lib/tour-config'

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
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export type TourState = { done: boolean; rewarded: boolean }

export async function getTourState(userId: string): Promise<TourState> {
  await ensureTable()
  const r = await rows<{ rewarded: number }>(sql`SELECT rewarded FROM tour_members WHERE user_id = ${userId}`)
  return { done: r.length > 0, rewarded: Number(r[0]?.rewarded ?? 0) > 0 }
}

export async function markTourSeen(userId: string, ipHash: string | null, deviceId: string | null) {
  await ensureTable()
  await rows(sql`INSERT INTO tour_members (user_id, ip_hash, device_id) VALUES (${userId}, ${ipHash}, ${deviceId})
    ON CONFLICT (user_id) DO NOTHING`)
}

export type TourClaim =
  | { status: 'awarded'; amount: number; balance: number }
  | { status: 'already' | 'multi' | 'off' }

/**
 * Pays the completion reward once per member. A second account on the same network (current IP or the
 * signup network) or the same browser is refused; the partial unique indexes make concurrent claims safe too.
 */
export async function claimTourReward(member: { id: string; name: string }, ipHash: string | null, deviceId: string): Promise<TourClaim> {
  await ensureTable()
  await ensureGrowth()
  const { reward, enabled } = await getTourSettings()

  const own = await rows<{ rewarded: number }>(sql`SELECT rewarded FROM tour_members WHERE user_id = ${member.id}`)
  if (Number(own[0]?.rewarded ?? 0) > 0) return { status: 'already' }

  const block = async (reason: string) => {
    await rows(sql`INSERT INTO tour_members (user_id, ip_hash, device_id, blocked) VALUES (${member.id}, ${ipHash}, ${deviceId}, ${reason})
      ON CONFLICT (user_id) DO UPDATE SET blocked = EXCLUDED.blocked, done_at = now()`)
    return { status: 'multi' as const }
  }

  if (!enabled || reward <= 0) {
    await markTourSeen(member.id, ipHash, deviceId)
    return { status: 'off' }
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

  try {
    const paid = await rows(sql`INSERT INTO tour_members (user_id, rewarded, ip_hash, device_id) VALUES (${member.id}, ${reward}, ${ipHash}, ${deviceId})
      ON CONFLICT (user_id) DO UPDATE SET rewarded = EXCLUDED.rewarded, ip_hash = EXCLUDED.ip_hash, device_id = EXCLUDED.device_id, blocked = NULL, done_at = now()
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

  await credit(member.id, reward)
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
