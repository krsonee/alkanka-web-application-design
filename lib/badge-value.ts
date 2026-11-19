import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureKp, publicRankName, type BadgeTier } from '@/lib/kanka-puan'
import { ALL_BADGES, MAX_RAFFLE_WINNERS, type RaffleRow } from '@/lib/badge-raffle-shared'
import type { MemberRole } from '@/lib/kanka-puan-shared'

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
    await rows(sql`ALTER TABLE kp_raffles ADD COLUMN IF NOT EXISTS badge_label text`)
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
    ? await rows<{ badge_id: string }>(sql`SELECT DISTINCT badge_id FROM kp_awards WHERE user_id = ${userId} AND badge_id IN ${wanted}`)
    : []
  const ok = wanted.filter((id) => owned.some((o) => o.badge_id === id))
  // A list placed straight into the query is written as "(a, b)", which is not an array: the column needs ARRAY[...] spelled out.
  const list = ok.length ? sql`ARRAY[${sql.join(ok.map((id) => sql`${id}`), sql`, `)}]::text[]` : sql`'{}'::text[]`
  await rows(sql`INSERT INTO kp_pins (user_id, badge_ids) VALUES (${userId}, ${list}) ON CONFLICT (user_id) DO UPDATE SET badge_ids = EXCLUDED.badge_ids, updated_at = now()`)
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
    WHERE p.user_id IN ${userIds} AND EXISTS (SELECT 1 FROM kp_awards a WHERE a.user_id = p.user_id AND a.badge_id = b.id)
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
    WHERE a.user_id IN ${userIds} AND a.badge_id NOT IN (SELECT id FROM kp_badges WHERE role_style IS NOT NULL)`)
  const out: Record<string, BadgeTier> = {}
  for (const x of r) if (!out[x.user_id] || TIER_RANK[x.tier] > TIER_RANK[out[x.user_id]]) out[x.user_id] = x.tier
  return out
}

// --- Badge next to the name in chat ------------------------------------------

/** The badge a member wears: the first one they pinned, otherwise their highest tier, newest first. */
const WORN_ORDER = sql`COALESCE(array_position(p.badge_ids, b.id), 99),
  CASE b.tier WHEN 'efsane' THEN 3 WHEN 'elmas' THEN 2 ELSE 1 END DESC, a.awarded_at DESC`

const CHAT_BADGE_CACHE_MS = 60_000
let chatBadgeCache: { at: number; data: Record<string, MemberRole> } | null = null

/** userId → the badge shown beside the name in chat. Roles are left out: they already have their own chip. */
export async function chatBadges(): Promise<Record<string, MemberRole>> {
  if (chatBadgeCache && Date.now() - chatBadgeCache.at < CHAT_BADGE_CACHE_MS) return chatBadgeCache.data
  await ensure()
  const r = await rows<{ user_id: string; name: string; icon: string; tier: string }>(sql`SELECT DISTINCT ON (a.user_id) a.user_id, b.name, b.icon, b.tier
    FROM kp_awards a JOIN kp_badges b ON b.id = a.badge_id LEFT JOIN kp_pins p ON p.user_id = a.user_id
    WHERE b.active AND b.role_style IS NULL
    ORDER BY a.user_id, ${WORN_ORDER}`)
  const data: Record<string, MemberRole> = {}
  for (const x of r) data[x.user_id] = { name: x.name, style: x.tier, icon: x.icon }
  chatBadgeCache = { at: Date.now(), data }
  return data
}

/** What is written next to one member's name in Telegram: their role if they hold one, otherwise the badge they wear. */
export async function chatMarkOf(userId: string): Promise<{ name: string; icon: string; role: boolean } | null> {
  await ensure()
  const [x] = await rows<{ name: string; icon: string; role: boolean }>(sql`SELECT b.name, b.icon, (b.role_style IS NOT NULL) AS role
    FROM kp_awards a JOIN kp_badges b ON b.id = a.badge_id LEFT JOIN kp_pins p ON p.user_id = a.user_id
    WHERE a.user_id = ${userId} AND b.active
    ORDER BY (b.role_style IS NOT NULL) DESC, CASE WHEN b.role_style IS NOT NULL THEN a.awarded_at END DESC NULLS LAST, ${WORN_ORDER}
    LIMIT 1`)
  return x ? { name: x.name, icon: x.icon, role: Boolean(x.role) } : null
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

export type { RaffleRow }

/** Badges a raffle can draw from when "all badges" is chosen: every badge that is not a role. */
const anyBadge = sql`SELECT id FROM kp_badges WHERE role_style IS NULL`

/**
 * Members holding at least one of the badges, each counted once however many of them they hold.
 * A member whose role earns no KP is left out: the prize would never show on their account.
 */
function rafflePool(badgeIds: string[] | typeof ALL_BADGES) {
  const wanted = badgeIds === ALL_BADGES ? sql`a.badge_id IN (${anyBadge})` : sql`a.badge_id IN ${badgeIds}`
  return sql`SELECT a.user_id FROM kp_awards a WHERE ${wanted}
    AND NOT EXISTS (SELECT 1 FROM kp_awards ra JOIN kp_badges rb ON rb.id = ra.badge_id WHERE ra.user_id = a.user_id AND rb.role_no_kp)
    GROUP BY a.user_id`
}

function raffleBadges(input: string[] | typeof ALL_BADGES): string[] | typeof ALL_BADGES {
  if (input === ALL_BADGES) return ALL_BADGES
  const ids = [...new Set((Array.isArray(input) ? input : []).map(String).filter(Boolean))]
  if (!ids.length) throw new Error('En az bir rozet seç.')
  if (ids.length > 100) throw new Error('Tek çekilişte en fazla 100 rozet seçilebilir. Hepsi için "Tüm rozetler"i kullan.')
  return ids
}

/** How many different members the chosen badges cover. */
export async function rafflePoolSize(input: string[] | typeof ALL_BADGES): Promise<number> {
  await ensure()
  const [r] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM (${rafflePool(raffleBadges(input))}) p`)
  return Number(r?.n ?? 0)
}

/**
 * Draws `winners` different members from the holders of the chosen badges and pays each the prize in KP.
 * The draw, its records and the payments are one statement: either every winner is paid or nobody is.
 */
export async function drawBadgeRaffle(input: string[] | typeof ALL_BADGES, prize: number, note: string, winners = 1): Promise<string[]> {
  await ensure()
  const badgeIds = raffleBadges(input)
  const p = Number(prize)
  if (!Number.isInteger(p) || p < 1 || p > 100000) throw new Error('Ödül 1 ile 100.000 KP arasında tam sayı olmalı.')
  const n = Number(winners)
  if (!Number.isInteger(n) || n < 1 || n > MAX_RAFFLE_WINNERS) throw new Error(`Kazanan sayısı 1 ile ${MAX_RAFFLE_WINNERS} arasında tam sayı olmalı.`)
  const size = await rafflePoolSize(badgeIds)
  if (!size) throw new Error('Seçtiğin rozetlerde ödül alabilecek üye yok, çekiliş yapılamaz.')
  if (n > size) throw new Error(`Seçtiğin rozetlerde ${size} farklı üye var; ${n} kazanan seçilemez. Hiçbir şey ödenmedi.`)

  let label: string | null = 'Tüm rozetler'
  if (badgeIds !== ALL_BADGES) {
    const names = await rows<{ id: string; name: string }>(sql`SELECT id, name FROM kp_badges WHERE id IN ${badgeIds}`)
    if (names.length !== badgeIds.length) throw new Error('Seçtiğin rozetlerden biri artık yok. Sayfayı yenileyip tekrar dene.')
    label = badgeIds.length === 1 ? null : names.map((x) => x.name).join(', ').slice(0, 200)
  }
  const key = badgeIds === ALL_BADGES ? ALL_BADGES : badgeIds.length === 1 ? badgeIds[0] : 'coklu'
  const text = note.trim().slice(0, 120)
  const won = await rows<{ name: string | null }>(sql`WITH picked AS (SELECT user_id FROM (${rafflePool(badgeIds)}) pool ORDER BY random() LIMIT ${n}),
    drawn AS (INSERT INTO kp_raffles (badge_id, badge_label, user_id, prize, note)
      SELECT ${key}, ${label}, user_id, ${p}, ${text || null} FROM picked RETURNING id, user_id),
    paid AS (INSERT INTO kp_events (user_id, source, points, ref, note)
      SELECT user_id, 'admin', ${p}, 'cekilis:' || id::text, ${text || 'Rozet çekilişi'} FROM drawn ON CONFLICT DO NOTHING RETURNING user_id)
    SELECT u.name FROM drawn d LEFT JOIN public."user" u ON u.id = d.user_id ORDER BY d.id`)
  return won.map((w) => publicRankName(w.name))
}

export async function recentRaffles(limit = 10): Promise<RaffleRow[]> {
  await ensure()
  const r = await rows<{ id: number; badge_name: string; name: string | null; prize: number; note: string | null; drawn_at: string }>(sql`
    SELECT r.id, coalesce(r.badge_label, b.name, 'Silinmiş rozet') AS badge_name, u.name, r.prize, r.note, r.drawn_at FROM kp_raffles r
    LEFT JOIN kp_badges b ON b.id = r.badge_id LEFT JOIN public."user" u ON u.id = r.user_id ORDER BY r.drawn_at DESC, r.id DESC LIMIT ${limit}`)
  return r.map((x) => ({ id: x.id, badgeName: x.badge_name, userName: publicRankName(x.name), prize: Number(x.prize), note: x.note, drawnAt: String(x.drawn_at) }))
}
