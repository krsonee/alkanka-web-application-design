import 'server-only'
import { randomBytes } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { credit } from '@/lib/member'
import type { ParsedOdd } from '@/lib/deal-types'
import { COMPLAINT_BODY_MAX, COMPLAINT_BODY_MIN, COMPLAINT_TITLE_MAX, COMPLAINT_TITLE_MIN, REVIEW_MAX, REVIEW_MIN } from '@/lib/community-limits'

let ready: Promise<unknown> | null = null
export function ensureCommunity() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS ref_codes (user_id text PRIMARY KEY, code text UNIQUE NOT NULL)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS referrals (
      referred_id text PRIMARY KEY, referrer_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), rewarded_at timestamptz)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS site_reviews (
      id serial PRIMARY KEY, site_id text NOT NULL, user_id text NOT NULL, user_name text NOT NULL, rating int NOT NULL,
      body text NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (site_id, user_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS complaints (
      id serial PRIMARY KEY, site_id text NOT NULL, user_id text NOT NULL, user_name text NOT NULL, title text NOT NULL,
      body text NOT NULL, status text NOT NULL DEFAULT 'open', reply text, created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS odds_alerts (
      user_id text NOT NULL, keyword text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, keyword))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS league_matches (
      id serial PRIMARY KEY, league text NOT NULL, home text NOT NULL, away text NOT NULL, kickoff timestamptz NOT NULL,
      home_goals int, away_goals int, settled boolean NOT NULL DEFAULT false)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS league_picks (
      match_id int NOT NULL REFERENCES league_matches(id) ON DELETE CASCADE, user_id text NOT NULL, user_name text NOT NULL,
      home int NOT NULL, away int NOT NULL, points int, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (match_id, user_id))`)
    await rows(sql`ALTER TABLE league_matches ADD COLUMN IF NOT EXISTS home_logo text,
      ADD COLUMN IF NOT EXISTS away_logo text, ADD COLUMN IF NOT EXISTS ext_id bigint, ADD COLUMN IF NOT EXISTS closes_at timestamptz,
      ADD COLUMN IF NOT EXISTS markets jsonb, ADD COLUMN IF NOT EXISTS result jsonb`)
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS league_matches_ext_id ON league_matches (ext_id) WHERE ext_id IS NOT NULL`)
    // A pick now answers the questions its match asks, so the score is no longer always there.
    await rows(sql`ALTER TABLE league_picks ADD COLUMN IF NOT EXISTS answers jsonb, ADD COLUMN IF NOT EXISTS outcome jsonb,
      ADD COLUMN IF NOT EXISTS exact boolean, ADD COLUMN IF NOT EXISTS kc int NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS kp int NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS bonus boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT true,
      ALTER COLUMN home DROP NOT NULL, ALTER COLUMN away DROP NOT NULL`)
    // Picks scored before `exact` existed earned 3 points only for the exact score.
    await rows(sql`UPDATE league_picks SET exact = (points = 3) WHERE exact IS NULL AND points IS NOT NULL`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const iso = (v: unknown) => new Date(String(v)).toISOString()

// --- Levels & badges -----------------------------------------------------

export const LEVELS = [
  { name: 'Çaylak', min: 0 },
  { name: 'Kanka', min: 200 },
  { name: 'Usta', min: 600 },
  { name: 'Efsane', min: 1500 },
  { name: 'Şampiyon', min: 3500 },
] as const

export type Badge = { id: string; label: string; hint: string; earned: boolean }

export type Profile = {
  xp: number
  level: { index: number; name: string; min: number; next: { name: string; min: number } | null }
  stats: { games: number; reviews: number; leaguePoints: number; exact: number; referrals: number; alerts: number; telegram: boolean }
  badges: Badge[]
}

export async function getProfile(userId: string): Promise<Profile> {
  await ensureCommunity()
  const [s] = await rows<Record<string, string | null>>(sql`SELECT
    (SELECT count(*) FROM game_history WHERE user_id = ${userId} AND game <> 'turnuva' AND mode <> 'admin') AS games,
    (SELECT coalesce(sum(delta) FILTER (WHERE delta > 0), 0) FROM game_history WHERE user_id = ${userId}) AS won,
    (SELECT count(*) FROM site_reviews WHERE user_id = ${userId} AND status = 'approved') AS reviews,
    (SELECT coalesce(sum(points), 0) FROM league_picks WHERE user_id = ${userId}) AS league_points,
    (SELECT count(*) FROM league_picks WHERE user_id = ${userId} AND exact) AS exact,
    (SELECT count(*) FROM referrals WHERE referrer_id = ${userId} AND rewarded_at IS NOT NULL) AS referrals,
    (SELECT count(*) FROM odds_alerts WHERE user_id = ${userId}) AS alerts,
    (SELECT count(*) FROM tg_links WHERE user_id = ${userId}) AS telegram`).catch(async () => {
    // tg_links only exists once the Telegram chat module has run.
    return rows<Record<string, string | null>>(sql`SELECT
      (SELECT count(*) FROM game_history WHERE user_id = ${userId} AND game <> 'turnuva' AND mode <> 'admin') AS games,
      (SELECT coalesce(sum(delta) FILTER (WHERE delta > 0), 0) FROM game_history WHERE user_id = ${userId}) AS won,
      (SELECT count(*) FROM site_reviews WHERE user_id = ${userId} AND status = 'approved') AS reviews,
      (SELECT coalesce(sum(points), 0) FROM league_picks WHERE user_id = ${userId}) AS league_points,
      (SELECT count(*) FROM league_picks WHERE user_id = ${userId} AND exact) AS exact,
      (SELECT count(*) FROM referrals WHERE referrer_id = ${userId} AND rewarded_at IS NOT NULL) AS referrals,
      (SELECT count(*) FROM odds_alerts WHERE user_id = ${userId}) AS alerts,
      0 AS telegram`)
  })
  const n = (k: string) => Number(s?.[k] ?? 0)
  const stats = {
    games: n('games'),
    reviews: n('reviews'),
    leaguePoints: n('league_points'),
    exact: n('exact'),
    referrals: n('referrals'),
    alerts: n('alerts'),
    telegram: n('telegram') > 0,
  }
  const xp = stats.games * 5 + Math.floor(n('won') / 20) + stats.reviews * 40 + stats.leaguePoints * 20 + stats.referrals * 100 + (stats.telegram ? 50 : 0)
  const index = LEVELS.reduce((acc, l, i) => (xp >= l.min ? i : acc), 0)
  const next = LEVELS[index + 1] ?? null
  const badges: Badge[] = [
    { id: 'ilk-oyun', label: 'İlk masa', hint: 'İlk oyununu oyna', earned: stats.games >= 1 },
    { id: 'mudavim', label: 'Müdavim', hint: '50 oyun oyna', earned: stats.games >= 50 },
    { id: 'yorumcu', label: 'Güvenilir ses', hint: 'Onaylanmış bir site yorumu yaz', earned: stats.reviews >= 1 },
    { id: 'kahin', label: 'Kahin', hint: '3 maçın skorunu tam bil', earned: stats.exact >= 3 },
    { id: 'davetci', label: 'Davetçi', hint: '1 arkadaşını getir', earned: stats.referrals >= 1 },
    { id: 'ag-kurucu', label: 'Ağ kurucu', hint: '5 arkadaşını getir', earned: stats.referrals >= 5 },
    { id: 'alarmci', label: 'Oran avcısı', hint: 'Bir oran alarmı kur', earned: stats.alerts >= 1 },
    { id: 'telegram', label: 'Telegram kankası', hint: 'Hesabını Telegram’a bağla', earned: stats.telegram },
  ]
  return { xp, level: { index, name: LEVELS[index].name, min: LEVELS[index].min, next }, stats, badges }
}

// --- Referrals -----------------------------------------------------------

export const REFERRER_REWARD = 300
export const REFERRED_REWARD = 150
export const REFERRAL_MIN_GAMES = 3

export async function getRefCode(userId: string) {
  await ensureCommunity()
  const existing = await rows<{ code: string }>(sql`SELECT code FROM ref_codes WHERE user_id = ${userId}`)
  if (existing[0]) return existing[0].code
  for (let i = 0; i < 5; i++) {
    const code = randomBytes(4).toString('base64url').replace(/[-_]/g, 'k').slice(0, 6).toUpperCase()
    const r = await rows<{ code: string }>(sql`INSERT INTO ref_codes (user_id, code) VALUES (${userId}, ${code})
      ON CONFLICT DO NOTHING RETURNING code`)
    if (r[0]) return r[0].code
    const again = await rows<{ code: string }>(sql`SELECT code FROM ref_codes WHERE user_id = ${userId}`)
    if (again[0]) return again[0].code
  }
  throw new Error('Davet kodu oluşturulamadı.')
}

/** Links a freshly created account to its inviter. Only accounts younger than 48h qualify. */
export async function attachReferral(userId: string, code: string) {
  await ensureCommunity()
  const clean = code.trim().toUpperCase().slice(0, 12)
  const ref = await rows<{ user_id: string }>(sql`SELECT user_id FROM ref_codes WHERE code = ${clean}`)
  const referrer = ref[0]?.user_id
  if (!referrer || referrer === userId) return false
  const fresh = await rows(sql`SELECT 1 FROM public."user" WHERE id = ${userId} AND "createdAt" > now() - interval '48 hours'`)
  if (!fresh.length) return false
  const { sameNetwork } = await import('@/lib/growth')
  if (await sameNetwork(userId, referrer).catch(() => false)) return false
  const r = await rows(sql`INSERT INTO referrals (referred_id, referrer_id) VALUES (${userId}, ${referrer}) ON CONFLICT DO NOTHING RETURNING referred_id`)
  if (!r.length) return false
  const { getReferralSettings } = await import('@/lib/referral-settings')
  const { welcome } = await getReferralSettings()
  if (welcome > 0) await credit(userId, welcome, 'Davet: hoş geldin bonusu').catch((error) => console.error('[referral] hoş geldin bonusu verilemedi', error))
  return true
}

/** Inviters with at least one friend who has reached the game threshold but hasn't been paid yet. */
export async function referrersWithReadyRewards(): Promise<string[]> {
  await ensureCommunity()
  const { getReferralSettings } = await import('@/lib/referral-settings')
  const { minGames } = await getReferralSettings()
  const r = await rows<{ referrer_id: string }>(sql`SELECT DISTINCT r.referrer_id FROM referrals r
    WHERE r.rewarded_at IS NULL
      AND (SELECT count(*) FROM game_history g WHERE g.user_id = r.referred_id AND g.game <> 'turnuva' AND g.mode <> 'admin') >= ${minGames}
    LIMIT 500`)
  return r.map((x) => x.referrer_id)
}

export type ReferralRow = { name: string; games: number; rewarded: boolean; createdAt: string }

export async function listReferrals(userId: string): Promise<ReferralRow[]> {
  await ensureCommunity()
  const r = await rows(sql`SELECT u.name, r.rewarded_at, r.created_at,
      (SELECT count(*) FROM game_history g WHERE g.user_id = r.referred_id AND g.game <> 'turnuva' AND g.mode <> 'admin') AS games
    FROM referrals r LEFT JOIN public."user" u ON u.id = r.referred_id
    WHERE r.referrer_id = ${userId} ORDER BY r.created_at DESC LIMIT 100`)
  return r.map((x) => ({
    name: String(x.name ?? 'Yeni üye').split(' ')[0],
    games: Number(x.games),
    rewarded: Boolean(x.rewarded_at),
    createdAt: iso(x.created_at),
  }))
}

export async function claimReferralRewards(userId: string) {
  await ensureCommunity()
  const { ensureGrowth, isFlagged } = await import('@/lib/growth')
  const { rankForUser } = await import('@/lib/ranks')
  await ensureGrowth()
  if (await isFlagged(userId)) return { count: 0, total: 0, blocked: true }
  const { getReferralSettings } = await import('@/lib/referral-settings')
  const settings = await getReferralSettings()
  const done = await rows<{ referred_id: string }>(sql`UPDATE referrals r SET rewarded_at = now()
    WHERE r.referrer_id = ${userId} AND r.rewarded_at IS NULL
      AND (SELECT count(*) FROM game_history g WHERE g.user_id = r.referred_id AND g.game <> 'turnuva' AND g.mode <> 'admin') >= ${settings.minGames}
      AND NOT EXISTS (SELECT 1 FROM member_origin o WHERE o.user_id = r.referred_id AND o.flagged)
    RETURNING r.referred_id`)
  for (const d of done) await credit(d.referred_id, settings.referred, 'Davet ödülü (davet edilen)')
  const rank = await rankForUser(userId)
  const total = Math.round(settings.referrer * done.length * rank.multiplier)
  if (done.length) await credit(userId, total, 'Davet ödülü (davet eden)')
  return { count: done.length, total, blocked: false }
}

// --- Reviews & complaints ------------------------------------------------

export type Review = { id: number; siteId: string; userName: string; rating: number; body: string; status: string; createdAt: string; level?: string }
export type Complaint = {
  id: number
  siteId: string
  userName: string
  title: string
  body: string
  status: 'open' | 'forwarded' | 'resolved' | 'rejected'
  reply: string | null
  createdAt: string
  updatedAt: string
}

const mapReview = (r: Record<string, unknown>): Review => ({
  id: Number(r.id),
  siteId: String(r.site_id),
  userName: String(r.user_name),
  rating: Number(r.rating),
  body: String(r.body),
  status: String(r.status),
  createdAt: iso(r.created_at),
})

const mapComplaint = (r: Record<string, unknown>): Complaint => ({
  id: Number(r.id),
  siteId: String(r.site_id),
  userName: String(r.user_name),
  title: String(r.title),
  body: String(r.body),
  status: String(r.status) as Complaint['status'],
  reply: r.reply ? String(r.reply) : null,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
})

export type SiteTrust = {
  siteId: string
  slug: string
  name: string
  initials: string
  tagline: string
  payout: string
  editorRating: number
  logoUrl: string
  rating: number | null
  reviews: number
  complaints: number
  resolved: number
}

export async function siteTrustTable(): Promise<SiteTrust[]> {
  await ensureCommunity()
  const { listSites, toPublicSponsor } = await import('@/lib/sites')
  const sites = (await listSites()).filter((site) => site.active && site.slug)
  const rv = await rows<{ site_id: string; avg: string; n: string }>(sql`SELECT site_id, avg(rating) AS avg, count(*) AS n
    FROM site_reviews WHERE status = 'approved' GROUP BY site_id`)
  const cp = await rows<{ site_id: string; n: string; ok: string }>(sql`SELECT site_id, count(*) AS n,
    count(*) FILTER (WHERE status = 'resolved') AS ok FROM complaints WHERE status <> 'rejected' GROUP BY site_id`)
  return sites.map((site) => {
    const id = String(site.id)
    const r = rv.find((x) => x.site_id === id)
    const c = cp.find((x) => x.site_id === id)
    const sponsor = toPublicSponsor(site)
    return {
      siteId: id,
      slug: site.slug,
      name: site.name,
      initials: sponsor.initials,
      tagline: sponsor.tagline,
      payout: sponsor.payout,
      editorRating: sponsor.rating,
      logoUrl: sponsor.logoUrl ?? '',
      rating: r ? Math.round(Number(r.avg) * 10) / 10 : null,
      reviews: Number(r?.n ?? 0),
      complaints: Number(c?.n ?? 0),
      resolved: Number(c?.ok ?? 0),
    }
  })
}

/** Active sites.id for a new review or complaint. Does not rewrite old rows. */
async function recordedSiteId(id: string) {
  const { activeSiteRecordId, resolvePublicSite } = await import('@/lib/sites')
  if (/^\d+$/.test(id)) return activeSiteRecordId(id)
  const site = await resolvePublicSite(id)
  return site?.recordId ?? null
}

export async function siteReviews(siteId: string) {
  await ensureCommunity()
  return (await rows(sql`SELECT * FROM site_reviews WHERE site_id = ${siteId} AND status = 'approved' ORDER BY created_at DESC LIMIT 50`)).map(mapReview)
}

export async function siteComplaints(siteId: string) {
  await ensureCommunity()
  return (await rows(sql`SELECT * FROM complaints WHERE site_id = ${siteId} AND status <> 'rejected' ORDER BY created_at DESC LIMIT 50`)).map(mapComplaint)
}

export async function recentComplaints(limit = 8) {
  await ensureCommunity()
  return (await rows(sql`SELECT * FROM complaints WHERE status <> 'rejected' ORDER BY updated_at DESC LIMIT ${limit}`)).map(mapComplaint)
}

export async function addReview(user: { id: string; name: string }, siteId: string, rating: number, body: string) {
  await ensureCommunity()
  const recordId = await recordedSiteId(siteId)
  if (!recordId) throw new Error('Site bulunamadı.')
  siteId = recordId
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Puan 1 ile 5 arasında olmalı.')
  const text = body.trim()
  if (text.length < REVIEW_MIN) throw new Error(`Yorum en az ${REVIEW_MIN} karakter olmalı.`)
  if (text.length > REVIEW_MAX) throw new Error(`Yorum en fazla ${REVIEW_MAX} karakter olabilir.`)
  await rows(sql`INSERT INTO site_reviews (site_id, user_id, user_name, rating, body) VALUES (${siteId}, ${user.id}, ${user.name.slice(0, 40)}, ${rating}, ${text})
    ON CONFLICT (site_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, status = 'pending', created_at = now()`)
}

export async function addComplaint(user: { id: string; name: string }, siteId: string, title: string, body: string) {
  await ensureCommunity()
  const recordId = await recordedSiteId(siteId)
  if (!recordId) throw new Error('Site bulunamadı.')
  siteId = recordId
  const t = title.trim()
  const b = body.trim()
  if (t.length < COMPLAINT_TITLE_MIN || t.length > COMPLAINT_TITLE_MAX) throw new Error(`Başlık ${COMPLAINT_TITLE_MIN}-${COMPLAINT_TITLE_MAX} karakter olmalı.`)
  if (b.length < COMPLAINT_BODY_MIN || b.length > COMPLAINT_BODY_MAX) throw new Error(`Açıklama ${COMPLAINT_BODY_MIN}-${COMPLAINT_BODY_MAX} karakter olmalı.`)
  const [{ open }] = await rows<{ open: string }>(sql`SELECT count(*) AS open FROM complaints WHERE user_id = ${user.id} AND status IN ('open', 'forwarded')`)
  if (Number(open) >= 3) throw new Error('Aynı anda en fazla 3 açık şikâyetin olabilir.')
  await rows(sql`INSERT INTO complaints (site_id, user_id, user_name, title, body) VALUES (${siteId}, ${user.id}, ${user.name.slice(0, 40)}, ${t}, ${b})`)
  const { notifyApproval } = await import('@/lib/telegram-bots')
  await notifyApproval('complaint', { uye: user.name, detay: t }).catch(() => {})
}

export async function myReviews(userId: string) {
  await ensureCommunity()
  return (await rows(sql`SELECT * FROM site_reviews WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 30`)).map(mapReview)
}

export async function myComplaints(userId: string) {
  await ensureCommunity()
  return (await rows(sql`SELECT * FROM complaints WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 30`)).map(mapComplaint)
}

// Admin
export async function pendingReviews() {
  await ensureCommunity()
  return (await rows(sql`SELECT * FROM site_reviews WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100`)).map(mapReview)
}

/** A rejection with a reason is also sent to the member's inbox; without one nothing is sent. */
export async function setReviewStatus(id: number, status: 'approved' | 'rejected', note = '') {
  await ensureCommunity()
  const [row] = await rows<{ user_id: string }>(sql`UPDATE site_reviews SET status = ${status} WHERE id = ${id} RETURNING user_id`)
  const reason = String(note ?? '').trim().slice(0, 300)
  if (!row || status !== 'rejected' || !reason) return
  const { sendMessage } = await import('@/lib/inbox')
  await sendMessage({
    userId: String(row.user_id),
    targetLabel: 'Yorum',
    title: 'Yorumun yayınlanmadı',
    body: `Bir siteye yazdığın yorum yayınlanmadı. Sebep: ${reason}. Yorumunu düzeltip yeniden gönderebilirsin.`,
    url: '/guven',
    sentBy: 'Sistem',
  }).catch((error) => console.error('[community] red mesajı gönderilemedi', error))
}

export async function publishedReviews() {
  await ensureCommunity()
  return (await rows(sql`SELECT * FROM site_reviews WHERE status = 'approved' ORDER BY created_at DESC LIMIT 100`)).map(mapReview)
}

export async function deleteReview(id: number) {
  await ensureCommunity()
  await rows(sql`DELETE FROM site_reviews WHERE id = ${id}`)
}

export async function deleteComplaint(id: number) {
  await ensureCommunity()
  await rows(sql`DELETE FROM complaints WHERE id = ${id}`)
}

export async function adminComplaints() {
  await ensureCommunity()
  return (await rows(sql`SELECT * FROM complaints ORDER BY (status IN ('open','forwarded')) DESC, updated_at DESC LIMIT 100`)).map(mapComplaint)
}

export async function updateComplaint(id: number, status: Complaint['status'], reply: string) {
  await ensureCommunity()
  if (!['open', 'forwarded', 'resolved', 'rejected'].includes(status)) throw new Error('Geçersiz durum.')
  await rows(sql`UPDATE complaints SET status = ${status}, reply = ${reply.trim().slice(0, 2000) || null}, updated_at = now() WHERE id = ${id}`)
}

// --- Odds alerts ---------------------------------------------------------

const norm = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

export async function listAlerts(userId: string) {
  await ensureCommunity()
  return (await rows<{ keyword: string }>(sql`SELECT keyword FROM odds_alerts WHERE user_id = ${userId} ORDER BY created_at`)).map((r) => r.keyword)
}

export async function addAlert(userId: string, keyword: string) {
  await ensureCommunity()
  const k = keyword.trim().replace(/\s+/g, ' ')
  if (k.length < 3 || k.length > 40) throw new Error('Takım ya da lig adı 3-40 karakter olmalı.')
  const [{ n }] = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM odds_alerts WHERE user_id = ${userId}`)
  if (Number(n) >= 10) throw new Error('En fazla 10 alarm kurabilirsin.')
  await rows(sql`INSERT INTO odds_alerts (user_id, keyword) VALUES (${userId}, ${k}) ON CONFLICT DO NOTHING`)
}

export async function removeAlert(userId: string, keyword: string) {
  await ensureCommunity()
  await rows(sql`DELETE FROM odds_alerts WHERE user_id = ${userId} AND keyword = ${keyword}`)
}

const oddMatches = (odd: ParsedOdd, keyword: string) => {
  const k = norm(keyword)
  return norm(`${odd.match} ${odd.league}`).includes(k)
}

export type AlertHit = { dealId: number; brand: string; link: string; odd: ParsedOdd; keyword: string; createdAt: string }

export async function alertHits(userId: string): Promise<AlertHit[]> {
  const keywords = await listAlerts(userId)
  if (!keywords.length) return []
  const deals = await rows(sql`SELECT id, brand, link, odds, created_at FROM deals
    WHERE odds IS NOT NULL AND created_at > now() - interval '72 hours' ORDER BY created_at DESC LIMIT 200`).catch(() => [])
  const hits: AlertHit[] = []
  for (const d of deals) {
    for (const odd of (d.odds as ParsedOdd[]) ?? []) {
      const keyword = keywords.find((k) => oddMatches(odd, k))
      if (keyword) hits.push({ dealId: Number(d.id), brand: String(d.brand), link: String(d.link), odd, keyword, createdAt: iso(d.created_at) })
    }
  }
  return hits.slice(0, 30)
}

/** Sends a Telegram DM to linked members whose alert keywords match a new odds post. */
export async function notifyOddsAlerts(brand: string, link: string, odds: ParsedOdd[]) {
  try {
    await ensureCommunity()
    const alerts = await rows<{ user_id: string; keyword: string; tg_id: string }>(sql`SELECT a.user_id, a.keyword, l.tg_id
      FROM odds_alerts a JOIN tg_links l ON l.user_id = a.user_id`)
    if (!alerts.length) return
    const { getChatConfig } = await import('@/lib/telegram-chat')
    const { botToken, callBot } = await import('@/lib/telegram-mirror')
    const { TG_HTML, tgNotice } = await import('@/lib/tg-format')
    const cfg = await getChatConfig()
    if (!cfg) return
    const token = await botToken(cfg.botId)
    const perUser = new Map<string, { tg: string; lines: string[] }>()
    for (const a of alerts) {
      for (const odd of odds) {
        if (!oddMatches(odd, a.keyword)) continue
        const entry = perUser.get(a.user_id) ?? { tg: a.tg_id, lines: [] }
        entry.lines.push(`${odd.match} - ${odd.market}: ${odd.oldOdd ? `${odd.oldOdd} -> ` : ''}${odd.newOdd}`)
        perUser.set(a.user_id, entry)
      }
    }
    for (const { tg, lines } of perUser.values()) {
      const text = tgNotice({ kind: 'alarm', title: `Oran alarmı (${brand})`, lines: [...new Set(lines)].slice(0, 6), link })
      await callBot(token, 'sendMessage', { chat_id: tg, text, ...TG_HTML }).catch(() => null)
    }
  } catch (error) {
    console.error('[alerts] bildirim gönderilemedi', error)
  }
}
