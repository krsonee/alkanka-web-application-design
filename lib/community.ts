import 'server-only'
import { randomBytes } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { credit } from '@/lib/member'
import { SPONSORS } from '@/components/alkanka/data'
import type { ParsedOdd } from '@/lib/deal-types'

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
      ADD COLUMN IF NOT EXISTS away_logo text, ADD COLUMN IF NOT EXISTS ext_id bigint`)
    await rows(sql`CREATE UNIQUE INDEX IF NOT EXISTS league_matches_ext_id ON league_matches (ext_id) WHERE ext_id IS NOT NULL`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

export const siteName = (id: string) => SPONSORS.find((s) => s.id === id)?.name ?? id
export const isSite = (id: string) => SPONSORS.some((s) => s.id === id)
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
    (SELECT count(*) FROM game_history WHERE user_id = ${userId}) AS games,
    (SELECT coalesce(sum(delta) FILTER (WHERE delta > 0), 0) FROM game_history WHERE user_id = ${userId}) AS won,
    (SELECT count(*) FROM site_reviews WHERE user_id = ${userId} AND status = 'approved') AS reviews,
    (SELECT coalesce(sum(points), 0) FROM league_picks WHERE user_id = ${userId}) AS league_points,
    (SELECT count(*) FROM league_picks WHERE user_id = ${userId} AND points = 3) AS exact,
    (SELECT count(*) FROM referrals WHERE referrer_id = ${userId} AND rewarded_at IS NOT NULL) AS referrals,
    (SELECT count(*) FROM odds_alerts WHERE user_id = ${userId}) AS alerts,
    (SELECT count(*) FROM tg_links WHERE user_id = ${userId}) AS telegram`).catch(async () => {
    // tg_links only exists once the Telegram chat module has run.
    return rows<Record<string, string | null>>(sql`SELECT
      (SELECT count(*) FROM game_history WHERE user_id = ${userId}) AS games,
      (SELECT coalesce(sum(delta) FILTER (WHERE delta > 0), 0) FROM game_history WHERE user_id = ${userId}) AS won,
      (SELECT count(*) FROM site_reviews WHERE user_id = ${userId} AND status = 'approved') AS reviews,
      (SELECT coalesce(sum(points), 0) FROM league_picks WHERE user_id = ${userId}) AS league_points,
      (SELECT count(*) FROM league_picks WHERE user_id = ${userId} AND points = 3) AS exact,
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
  const r = await rows(sql`INSERT INTO referrals (referred_id, referrer_id) VALUES (${userId}, ${referrer}) ON CONFLICT DO NOTHING RETURNING referred_id`)
  return r.length > 0
}

export type ReferralRow = { name: string; games: number; rewarded: boolean; createdAt: string }

export async function listReferrals(userId: string): Promise<ReferralRow[]> {
  await ensureCommunity()
  const r = await rows(sql`SELECT u.name, r.rewarded_at, r.created_at,
      (SELECT count(*) FROM game_history g WHERE g.user_id = r.referred_id) AS games
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
  const done = await rows<{ referred_id: string }>(sql`UPDATE referrals r SET rewarded_at = now()
    WHERE r.referrer_id = ${userId} AND r.rewarded_at IS NULL
      AND (SELECT count(*) FROM game_history g WHERE g.user_id = r.referred_id) >= ${REFERRAL_MIN_GAMES}
    RETURNING r.referred_id`)
  for (const d of done) await credit(d.referred_id, REFERRED_REWARD)
  if (done.length) await credit(userId, REFERRER_REWARD * done.length)
  return { count: done.length, total: REFERRER_REWARD * done.length }
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

export type SiteTrust = { siteId: string; name: string; rating: number | null; reviews: number; complaints: number; resolved: number }

export async function siteTrustTable(): Promise<SiteTrust[]> {
  await ensureCommunity()
  const rv = await rows<{ site_id: string; avg: string; n: string }>(sql`SELECT site_id, avg(rating) AS avg, count(*) AS n
    FROM site_reviews WHERE status = 'approved' GROUP BY site_id`)
  const cp = await rows<{ site_id: string; n: string; ok: string }>(sql`SELECT site_id, count(*) AS n,
    count(*) FILTER (WHERE status = 'resolved') AS ok FROM complaints WHERE status <> 'rejected' GROUP BY site_id`)
  return SPONSORS.map((s) => {
    const r = rv.find((x) => x.site_id === s.id)
    const c = cp.find((x) => x.site_id === s.id)
    return {
      siteId: s.id,
      name: s.name,
      rating: r ? Math.round(Number(r.avg) * 10) / 10 : null,
      reviews: Number(r?.n ?? 0),
      complaints: Number(c?.n ?? 0),
      resolved: Number(c?.ok ?? 0),
    }
  })
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
  if (!isSite(siteId)) throw new Error('Site bulunamadı.')
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Puan 1 ile 5 arasında olmalı.')
  const text = body.trim()
  if (text.length < 20) throw new Error('Yorum en az 20 karakter olmalı.')
  if (text.length > 1000) throw new Error('Yorum en fazla 1000 karakter olabilir.')
  await rows(sql`INSERT INTO site_reviews (site_id, user_id, user_name, rating, body) VALUES (${siteId}, ${user.id}, ${user.name.slice(0, 40)}, ${rating}, ${text})
    ON CONFLICT (site_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, status = 'pending', created_at = now()`)
}

export async function addComplaint(user: { id: string; name: string }, siteId: string, title: string, body: string) {
  await ensureCommunity()
  if (!isSite(siteId)) throw new Error('Site bulunamadı.')
  const t = title.trim()
  const b = body.trim()
  if (t.length < 5 || t.length > 120) throw new Error('Başlık 5-120 karakter olmalı.')
  if (b.length < 30 || b.length > 2000) throw new Error('Açıklama 30-2000 karakter olmalı.')
  const [{ open }] = await rows<{ open: string }>(sql`SELECT count(*) AS open FROM complaints WHERE user_id = ${user.id} AND status IN ('open', 'forwarded')`)
  if (Number(open) >= 3) throw new Error('Aynı anda en fazla 3 açık şikâyetin olabilir.')
  await rows(sql`INSERT INTO complaints (site_id, user_id, user_name, title, body) VALUES (${siteId}, ${user.id}, ${user.name.slice(0, 40)}, ${t}, ${b})`)
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

export async function setReviewStatus(id: number, status: 'approved' | 'rejected') {
  await ensureCommunity()
  await rows(sql`UPDATE site_reviews SET status = ${status} WHERE id = ${id}`)
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
      const text = `Oran alarmı (${brand})\n\n${[...new Set(lines)].slice(0, 6).join('\n')}\n\n${link}`
      await callBot(token, 'sendMessage', { chat_id: tg, text, disable_web_page_preview: true }).catch(() => null)
    }
  } catch (error) {
    console.error('[alerts] bildirim gönderilemedi', error)
  }
}

// --- Prediction league ---------------------------------------------------

export const EXACT_REWARD = 150
export const OUTCOME_REWARD = 40

export type LeagueMatch = {
  id: number
  league: string
  home: string
  away: string
  homeLogo: string | null
  awayLogo: string | null
  extId: number | null
  kickoff: string
  homeGoals: number | null
  awayGoals: number | null
  settled: boolean
  picks: number
  myPick: { home: number; away: number; points: number | null } | null
}

export async function listLeagueMatches(userId: string | null, opts: { admin?: boolean } = {}): Promise<LeagueMatch[]> {
  await ensureCommunity()
  const r = await rows(sql`SELECT m.*, (SELECT count(*) FROM league_picks p WHERE p.match_id = m.id) AS picks,
      mp.home AS my_home, mp.away AS my_away, mp.points AS my_points
    FROM league_matches m
    LEFT JOIN league_picks mp ON mp.match_id = m.id AND mp.user_id = ${userId ?? ''}
    WHERE ${opts.admin ?? false}::boolean OR m.kickoff > now() - interval '7 days'
    ORDER BY m.settled ASC, m.kickoff ASC LIMIT 100`)
  return r.map((x) => ({
    id: Number(x.id),
    league: String(x.league),
    home: String(x.home),
    away: String(x.away),
    homeLogo: x.home_logo ? String(x.home_logo) : null,
    awayLogo: x.away_logo ? String(x.away_logo) : null,
    extId: x.ext_id === null || x.ext_id === undefined ? null : Number(x.ext_id),
    kickoff: iso(x.kickoff),
    homeGoals: x.home_goals === null ? null : Number(x.home_goals),
    awayGoals: x.away_goals === null ? null : Number(x.away_goals),
    settled: Boolean(x.settled),
    picks: Number(x.picks),
    myPick: x.my_home === null || x.my_home === undefined ? null : { home: Number(x.my_home), away: Number(x.my_away), points: x.my_points === null ? null : Number(x.my_points) },
  }))
}

const goals = (n: number) => Number.isInteger(n) && n >= 0 && n <= 20

export async function savePick(user: { id: string; name: string }, matchId: number, home: number, away: number) {
  await ensureCommunity()
  if (!goals(home) || !goals(away)) throw new Error('Skor 0-20 arasında olmalı.')
  const open = await rows(sql`SELECT 1 FROM league_matches WHERE id = ${matchId} AND NOT settled AND kickoff > now()`)
  if (!open.length) throw new Error('Bu maç için tahminler kapandı.')
  await rows(sql`INSERT INTO league_picks (match_id, user_id, user_name, home, away) VALUES (${matchId}, ${user.id}, ${user.name.slice(0, 40)}, ${home}, ${away})
    ON CONFLICT (match_id, user_id) DO UPDATE SET home = EXCLUDED.home, away = EXCLUDED.away, created_at = now()`)
}

export type LeagueRow = { userId: string; name: string; points: number; exact: number; picks: number }

export async function leagueTable(scope: 'week' | 'all'): Promise<LeagueRow[]> {
  await ensureCommunity()
  const r = await rows(sql`SELECT p.user_id, max(p.user_name) AS name, coalesce(sum(p.points), 0) AS points,
      count(*) FILTER (WHERE p.points = 3) AS exact, count(*) AS picks
    FROM league_picks p JOIN league_matches m ON m.id = p.match_id
    WHERE m.settled AND (${scope}::text = 'all' OR m.kickoff >= date_trunc('week', now()))
    GROUP BY p.user_id ORDER BY points DESC, exact DESC, picks ASC LIMIT 20`)
  return r.map((x) => ({ userId: String(x.user_id), name: String(x.name), points: Number(x.points), exact: Number(x.exact), picks: Number(x.picks) }))
}

export async function addLeagueMatch(input: { league: string; home: string; away: string; kickoff: string }) {
  await ensureCommunity()
  const when = new Date(input.kickoff)
  if (Number.isNaN(when.getTime())) throw new Error('Geçerli bir tarih gir.')
  if (!input.home.trim() || !input.away.trim()) throw new Error('Takım adlarını gir.')
  await rows(sql`INSERT INTO league_matches (league, home, away, kickoff)
    VALUES (${input.league.trim() || 'Futbol'}, ${input.home.trim()}, ${input.away.trim()}, ${when.toISOString()})`)
}

export type FixtureInput = { extId: number; league: string; home: string; away: string; homeLogo: string; awayLogo: string; kickoff: string }

const safeLogo = (url: string) => (/^https:\/\/imagecache\.365scores\.com\//.test(url) ? url : null)

/** Publishes fixtures picked from the calendar; already-published games are skipped. */
export async function importLeagueFixtures(list: FixtureInput[]) {
  await ensureCommunity()
  let added = 0
  for (const f of list.slice(0, 60)) {
    const when = new Date(f.kickoff)
    if (!Number.isSafeInteger(f.extId) || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) continue
    const r = await rows(sql`INSERT INTO league_matches (league, home, away, kickoff, home_logo, away_logo, ext_id)
      VALUES (${f.league.slice(0, 80)}, ${f.home.slice(0, 80)}, ${f.away.slice(0, 80)}, ${when.toISOString()},
        ${safeLogo(f.homeLogo)}, ${safeLogo(f.awayLogo)}, ${f.extId})
      ON CONFLICT (ext_id) WHERE ext_id IS NOT NULL DO NOTHING RETURNING id`)
    added += r.length
  }
  return added
}

export async function publishedFixtureIds(): Promise<number[]> {
  await ensureCommunity()
  const r = await rows(sql`SELECT ext_id FROM league_matches WHERE ext_id IS NOT NULL AND kickoff > now() - interval '2 days'`)
  return r.map((x) => Number(x.ext_id))
}

/** Scores every finished calendar match using the official result feed. */
export async function autoSettleLeague(fetchScore: (id: number) => Promise<{ home: number; away: number } | null>) {
  await ensureCommunity()
  const due = await rows(sql`SELECT id, ext_id FROM league_matches
    WHERE NOT settled AND ext_id IS NOT NULL AND kickoff < now() - interval '100 minutes' ORDER BY kickoff LIMIT 30`)
  let settled = 0
  for (const m of due) {
    const score = await fetchScore(Number(m.ext_id))
    if (!score) continue
    await settleLeagueMatch(Number(m.id), Math.min(score.home, 20), Math.min(score.away, 20)).catch(() => null)
    settled++
  }
  return { checked: due.length, settled }
}

export async function deleteLeagueMatch(id: number) {
  await ensureCommunity()
  await rows(sql`DELETE FROM league_matches WHERE id = ${id} AND NOT settled`)
}

/** Records the final score once, scores every pick and pays KC: exact score 3 pts, correct outcome 1 pt. */
export async function settleLeagueMatch(id: number, home: number, away: number) {
  await ensureCommunity()
  if (!goals(home) || !goals(away)) throw new Error('Skor 0-20 arasında olmalı.')
  const done = await rows(sql`UPDATE league_matches SET home_goals = ${home}, away_goals = ${away}, settled = true
    WHERE id = ${id} AND NOT settled RETURNING id`)
  if (!done.length) throw new Error('Maç zaten sonuçlandırılmış.')
  const scored = await rows<{ user_id: string; points: number }>(sql`UPDATE league_picks SET points = CASE
      WHEN home = ${home} AND away = ${away} THEN 3
      WHEN sign(home - away) = sign(${home}::int - ${away}::int) THEN 1
      ELSE 0 END
    WHERE match_id = ${id} RETURNING user_id, points`)
  for (const s of scored) {
    const p = Number(s.points)
    if (p === 3) await credit(s.user_id, EXACT_REWARD)
    else if (p === 1) await credit(s.user_id, OUTCOME_REWARD)
  }
  return { picks: scored.length, winners: scored.filter((s) => Number(s.points) > 0).length }
}
