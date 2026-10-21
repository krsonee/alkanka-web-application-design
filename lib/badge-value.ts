import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureKp, publicRankName, type BadgeTier } from '@/lib/kanka-puan'

export const MAX_PINS = 3

export type BadgeSet = { id: string; name: string; description: string; badgeIds: string[]; reward: number }

export const BADGE_SETS: BadgeSet[] = [
  { id: 'kahin-seti', name: 'Kâhin Seti', description: 'Haftanın ve ayın tahmin şampiyonluğu.', badgeIds: ['tahmin-krali', 'kahin'], reward: 1500 },
  { id: 'soz-seti', name: 'Söz Ustası Seti', description: 'Sohbetin ve yorumların yıldızı ol.', badgeIds: ['sohbet-yildizi', 'kalem-ustasi', 'ayin-yorumcusu'], reward: 2000 },
  { id: 'arena-seti', name: 'Arena Seti', description: 'Masaların hakimi: turnuva, çok yönlülük, haftanın kurdu.', badgeIds: ['turnuva-sampiyonu', 'cok-yonlu', 'haftanin-kurdu'], reward: 2500 },
  { id: 'sadakat-seti', name: 'Sadakat Seti', description: 'Her gün burada olanlara.', badgeIds: ['aylik-sadik', 'yolcu', 'sponsor-mudavimi'], reward: 2000 },
]

let ready: Promise<void> | null = null
function ensure() {
  ready ??= (async () => {
    await ensureKp()
    await rows(sql`CREATE TABLE IF NOT EXISTS kp_pins (user_id text PRIMARY KEY, badge_ids text[] NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS kp_set_claims (set_id text NOT NULL, user_id text NOT NULL, claimed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (set_id, user_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS kp_raffles (id serial PRIMARY KEY, badge_id text NOT NULL, user_id text NOT NULL, prize int NOT NULL,
      note text, drawn_at timestamptz NOT NULL DEFAULT now())`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

// --- Rarity (RZ6) ----------------------------------------------------------

/** Share of members holding each badge, in percent with one decimal. */
export async function badgeRarity(): Promise<Record<string, number>> {
  await ensure()
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM public."user"`)
  const total = Math.max(1, Number(n))
  const r = await rows<{ badge_id: string; h: string }>(sql`SELECT badge_id, count(DISTINCT user_id) AS h FROM kp_awards GROUP BY badge_id`)
  return Object.fromEntries(r.map((x) => [x.badge_id, Math.round((Number(x.h) / total) * 1000) / 10]))
}

export const rarityLabel = (pct: number | undefined) =>
  !pct ? 'Henüz kimsede yok' : pct < 1 ? "Üyelerin %1'inden azında var" : `Üyelerin %${pct.toLocaleString('tr-TR')}'inde var`

// --- Pinned showcase (RZ3) -------------------------------------------------

export type PinnedBadge = { id: string; name: string; icon: string; tier: BadgeTier }

export async function getPins(userId: string): Promise<string[]> {
  await ensure()
  const [r] = await rows<{ badge_ids: string[] }>(sql`SELECT badge_ids FROM kp_pins WHERE user_id = ${userId}`)
  return r?.badge_ids ?? []
}

export async function savePins(userId: string, ids: string[]) {
  await ensure()
  const wanted = [...new Set(ids.map(String))].slice(0, MAX_PINS)
  const owned = wanted.length
    ? await rows<{ badge_id: string }>(sql`SELECT DISTINCT badge_id FROM kp_awards WHERE user_id = ${userId} AND badge_id = ANY(${wanted})`)
    : []
  const ok = wanted.filter((id) => owned.some((o) => o.badge_id === id))
  await rows(sql`INSERT INTO kp_pins (user_id, badge_ids) VALUES (${userId}, ${ok}) ON CONFLICT (user_id) DO UPDATE SET badge_ids = EXCLUDED.badge_ids, updated_at = now()`)
  return ok
}

/** Pinned badges for many members at once, for leaderboards and chat. Only badges still owned are shown. */
export async function pinnedFor(userIds: string[]): Promise<Record<string, PinnedBadge[]>> {
  if (!userIds.length) return {}
  await ensure()
  const r = await rows<{ user_id: string; id: string; name: string; icon: string; tier: BadgeTier; pos: number }>(sql`
    SELECT p.user_id, b.id, b.name, b.icon, b.tier, x.pos
    FROM kp_pins p CROSS JOIN LATERAL unnest(p.badge_ids) WITH ORDINALITY AS x(badge_id, pos)
    JOIN kp_badges b ON b.id = x.badge_id
    WHERE p.user_id = ANY(${userIds}) AND EXISTS (SELECT 1 FROM kp_awards a WHERE a.user_id = p.user_id AND a.badge_id = b.id)
    ORDER BY p.user_id, x.pos`)
  const out: Record<string, PinnedBadge[]> = {}
  for (const x of r) (out[x.user_id] ??= []).push({ id: x.id, name: x.name, icon: x.icon, tier: x.tier })
  return out
}

// --- Avatar frame (RZ1) ----------------------------------------------------

const TIER_RANK: Record<string, number> = { altin: 1, elmas: 2, efsane: 3 }

/** Highest badge tier a member holds; drives the avatar frame. */
export async function frameTiers(userIds: string[]): Promise<Record<string, BadgeTier>> {
  if (!userIds.length) return {}
  await ensure()
  const r = await rows<{ user_id: string; tier: BadgeTier }>(sql`SELECT DISTINCT a.user_id, b.tier FROM kp_awards a JOIN kp_badges b ON b.id = a.badge_id
    WHERE a.user_id = ANY(${userIds}) AND a.badge_id NOT IN ('moderator', 'sponsor-destek')`)
  const out: Record<string, BadgeTier> = {}
  for (const x of r) if (!out[x.user_id] || TIER_RANK[x.tier] > TIER_RANK[out[x.user_id]]) out[x.user_id] = x.tier
  return out
}

// --- Collection sets (RZ5) -------------------------------------------------

export type SetProgress = BadgeSet & { owned: string[]; claimed: boolean; completedBy: number }

/** Set progress; completing a set pays its KP reward once, right when it is seen complete. */
export async function getBadgeSets(userId: string | null): Promise<SetProgress[]> {
  await ensure()
  const owned = userId ? await rows<{ badge_id: string }>(sql`SELECT DISTINCT badge_id FROM kp_awards WHERE user_id = ${userId}`) : []
  const mine = new Set(owned.map((o) => o.badge_id))
  const claims = userId ? await rows<{ set_id: string }>(sql`SELECT set_id FROM kp_set_claims WHERE user_id = ${userId}`) : []
  const claimed = new Set(claims.map((c) => c.set_id))
  const counts = await rows<{ set_id: string; n: string }>(sql`SELECT set_id, count(*) AS n FROM kp_set_claims GROUP BY set_id`)
  const out: SetProgress[] = []
  for (const s of BADGE_SETS) {
    const have = s.badgeIds.filter((id) => mine.has(id))
    let isClaimed = claimed.has(s.id)
    if (userId && !isClaimed && have.length === s.badgeIds.length) {
      const ins = await rows(sql`INSERT INTO kp_set_claims (set_id, user_id) VALUES (${s.id}, ${userId}) ON CONFLICT DO NOTHING RETURNING set_id`)
      if (ins.length) {
        await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note)
          VALUES (${userId}, 'rozet', ${s.reward}, ${`set:${s.id}`}, ${`${s.name} tamamlandı`}) ON CONFLICT DO NOTHING`)
      }
      isClaimed = true
    }
    const n = Number(counts.find((c) => c.set_id === s.id)?.n ?? 0) + (isClaimed && !claimed.has(s.id) ? 1 : 0)
    out.push({ ...s, owned: have, claimed: isClaimed, completedBy: n })
  }
  return out
}

// --- Badge-only raffle (RZ1) -----------------------------------------------

export type RaffleRow = { id: number; badgeName: string; userName: string; prize: number; note: string | null; drawnAt: string }

/** Picks one random holder of the badge and pays the prize in KP. */
export async function drawBadgeRaffle(badgeId: string, prize: number, note: string) {
  await ensure()
  const p = Math.floor(Number(prize))
  if (!Number.isFinite(p) || p < 1 || p > 100000) throw new Error('Ödül 1 ile 100.000 KP arasında olmalı.')
  const [winner] = await rows<{ user_id: string; name: string | null }>(sql`SELECT a.user_id, max(u.name) AS name FROM kp_awards a
    LEFT JOIN public."user" u ON u.id = a.user_id WHERE a.badge_id = ${badgeId} GROUP BY a.user_id ORDER BY random() LIMIT 1`)
  if (!winner) throw new Error('Bu rozetin henüz sahibi yok, çekiliş yapılamaz.')
  const [row] = await rows<{ id: number }>(sql`INSERT INTO kp_raffles (badge_id, user_id, prize, note) VALUES (${badgeId}, ${winner.user_id}, ${p}, ${note.trim().slice(0, 120) || null}) RETURNING id`)
  await rows(sql`INSERT INTO kp_events (user_id, source, points, ref, note)
    VALUES (${winner.user_id}, 'admin', ${p}, ${`cekilis:${row.id}`}, ${note.trim().slice(0, 120) || 'Rozet çekilişi'}) ON CONFLICT DO NOTHING`)
  return publicRankName(winner.name)
}

export async function recentRaffles(limit = 10): Promise<RaffleRow[]> {
  await ensure()
  const r = await rows<{ id: number; badge_name: string; name: string | null; prize: number; note: string | null; drawn_at: string }>(sql`
    SELECT r.id, b.name AS badge_name, u.name, r.prize, r.note, r.drawn_at FROM kp_raffles r
    JOIN kp_badges b ON b.id = r.badge_id LEFT JOIN public."user" u ON u.id = r.user_id ORDER BY r.drawn_at DESC LIMIT ${limit}`)
  return r.map((x) => ({ id: x.id, badgeName: x.badge_name, userName: publicRankName(x.name), prize: Number(x.prize), note: x.note, drawnAt: String(x.drawn_at) }))
}
