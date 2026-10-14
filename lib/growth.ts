import 'server-only'
import { createHash } from 'node:crypto'
import { rows, sql } from '@/lib/db'
import { sponsorExists } from '@/lib/sites'

/** A 3rd account from the same network within this window gets flagged. */
export const MAX_ACCOUNTS_PER_NETWORK = 2
const NETWORK_WINDOW_DAYS = 7

let ready: Promise<unknown> | null = null
export function ensureGrowth() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS site_links (
      site_id text PRIMARY KEY, url text NOT NULL, prev_url text, changed_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE TABLE IF NOT EXISTS site_follows (
      user_id text NOT NULL, site_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, site_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS link_clicks (
      id bigserial PRIMARY KEY, site_id text NOT NULL, src text NOT NULL, user_id text, created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE INDEX IF NOT EXISTS link_clicks_created ON link_clicks (created_at)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS member_origin (
      user_id text PRIMARY KEY, src text NOT NULL, ip_hash text, flagged boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now())`)
    await rows(sql`CREATE INDEX IF NOT EXISTS member_origin_ip ON member_origin (ip_hash)`)
    await rows(sql`CREATE TABLE IF NOT EXISTS sponsor_accounts (
      user_id text NOT NULL, site_id text NOT NULL, username text NOT NULL, status text NOT NULL DEFAULT 'pending',
      note text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, site_id))`)
    await rows(sql`CREATE TABLE IF NOT EXISTS wager_entries (
      site_id text NOT NULL, username_key text NOT NULL, period text NOT NULL, amount numeric NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (site_id, username_key, period))`)
  })().catch((error) => {
    ready = null
    throw error
  })
  return ready
}

const iso = (v: unknown) => new Date(String(v)).toISOString()
export const isSponsor = (id: string) => sponsorExists(id)

export function cleanSrc(value: string | null | undefined) {
  const v = (value ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32)
  return v || 'direkt'
}

export function hashNetwork(ip: string | null | undefined) {
  if (!ip) return null
  const salt = process.env.BETTER_AUTH_SECRET ?? 'alkanka'
  return createHash('sha256').update(`${salt}:${ip.split(',')[0].trim()}`).digest('hex').slice(0, 32)
}

export function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  return `${y}-${m}`
}

// --- Site addresses -------------------------------------------------------

export type SiteLink = { url: string; prevUrl: string | null; changedAt: string }

export async function getSiteLinks(): Promise<Record<string, SiteLink>> {
  await ensureGrowth()
  const r = await rows(sql`SELECT * FROM site_links`)
  return Object.fromEntries(r.map((x) => [String(x.site_id), { url: String(x.url), prevUrl: x.prev_url ? String(x.prev_url) : null, changedAt: iso(x.changed_at) }]))
}

export async function getSiteLink(siteId: string): Promise<SiteLink | null> {
  await ensureGrowth()
  const r = await rows(sql`SELECT * FROM site_links WHERE site_id = ${siteId}`)
  if (!r[0]) return null
  return { url: String(r[0].url), prevUrl: r[0].prev_url ? String(r[0].prev_url) : null, changedAt: iso(r[0].changed_at) }
}

/** Saves the current entry address. Returns true when an existing address changed (followers should be alerted). */
export async function setSiteLink(siteId: string, rawUrl: string) {
  if (!(await isSponsor(siteId))) throw new Error('Site bulunamadı.')
  const url = rawUrl.trim()
  if (!url) {
    await ensureGrowth()
    await rows(sql`DELETE FROM site_links WHERE site_id = ${siteId}`)
    return { changed: false }
  }
  if (!/^https:\/\/[^\s"'<>]+$/.test(url)) throw new Error('Adres https:// ile başlamalı.')
  const prev = await getSiteLink(siteId)
  if (prev?.url === url) return { changed: false }
  await rows(sql`INSERT INTO site_links (site_id, url, prev_url, changed_at) VALUES (${siteId}, ${url}, ${prev?.url ?? null}, now())
    ON CONFLICT (site_id) DO UPDATE SET prev_url = site_links.url, url = EXCLUDED.url, changed_at = now()`)
  return { changed: Boolean(prev) }
}

// --- Click & source tracking ---------------------------------------------

export async function logClick(siteId: string, src: string, userId: string | null) {
  await ensureGrowth()
  await rows(sql`INSERT INTO link_clicks (site_id, src, user_id) VALUES (${siteId}, ${cleanSrc(src)}, ${userId})`)
}

/** Records where a new member came from and flags multi-account abuse from one network. */
export async function recordOrigin(userId: string, src: string, ipHash: string | null) {
  await ensureGrowth()
  const known = await rows(sql`SELECT 1 FROM member_origin WHERE user_id = ${userId}`)
  if (known.length) return
  const fresh = await rows(sql`SELECT 1 FROM public."user" WHERE id = ${userId} AND "createdAt" > now() - interval '48 hours'`)
  let flagged = false
  if (ipHash && fresh.length) {
    const same = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM member_origin
      WHERE ip_hash = ${ipHash} AND created_at > now() - make_interval(days => ${NETWORK_WINDOW_DAYS})`)
    flagged = Number(same[0]?.n ?? 0) >= MAX_ACCOUNTS_PER_NETWORK
  }
  await rows(sql`INSERT INTO member_origin (user_id, src, ip_hash, flagged)
    VALUES (${userId}, ${fresh.length ? cleanSrc(src) : 'eski-uye'}, ${ipHash}, ${flagged}) ON CONFLICT DO NOTHING`)
}

export async function isFlagged(userId: string) {
  await ensureGrowth()
  const r = await rows(sql`SELECT 1 FROM member_origin WHERE user_id = ${userId} AND flagged`)
  return r.length > 0
}

export async function sameNetwork(a: string, b: string) {
  await ensureGrowth()
  const r = await rows(sql`SELECT 1 FROM member_origin x JOIN member_origin y ON x.ip_hash = y.ip_hash
    WHERE x.user_id = ${a} AND y.user_id = ${b} AND x.ip_hash IS NOT NULL`)
  return r.length > 0
}

export type SourceRow = { src: string; clicks: number; signups: number; clickers: number }
export type SiteClickRow = { siteId: string; clicks: number }
export type TrafficReport = { days: number; sources: SourceRow[]; sites: SiteClickRow[]; totalClicks: number; totalSignups: number }

export async function trafficReport(days = 30): Promise<TrafficReport> {
  await ensureGrowth()
  const [clicks, signups, sites] = await Promise.all([
    rows(sql`SELECT src, count(*) AS clicks, count(DISTINCT user_id) AS clickers FROM link_clicks
      WHERE created_at > now() - make_interval(days => ${days}) GROUP BY src`),
    rows(sql`SELECT src, count(*) AS signups FROM member_origin
      WHERE created_at > now() - make_interval(days => ${days}) AND src <> 'eski-uye' GROUP BY src`),
    rows(sql`SELECT site_id, count(*) AS clicks FROM link_clicks
      WHERE created_at > now() - make_interval(days => ${days}) GROUP BY site_id ORDER BY clicks DESC LIMIT 15`),
  ])
  const map = new Map<string, SourceRow>()
  for (const c of clicks) map.set(String(c.src), { src: String(c.src), clicks: Number(c.clicks), clickers: Number(c.clickers), signups: 0 })
  for (const s of signups) {
    const row = map.get(String(s.src)) ?? { src: String(s.src), clicks: 0, clickers: 0, signups: 0 }
    row.signups = Number(s.signups)
    map.set(row.src, row)
  }
  const sources = [...map.values()].sort((a, b) => b.signups + b.clicks - (a.signups + a.clicks))
  return {
    days,
    sources,
    sites: sites.map((s) => ({ siteId: String(s.site_id), clicks: Number(s.clicks) })),
    totalClicks: sources.reduce((n, s) => n + s.clicks, 0),
    totalSignups: sources.reduce((n, s) => n + s.signups, 0),
  }
}

export type FlaggedMember = { userId: string; name: string; email: string; src: string; siblings: number; createdAt: string }

export async function flaggedMembers(): Promise<FlaggedMember[]> {
  await ensureGrowth()
  const r = await rows(sql`SELECT o.user_id, o.src, o.created_at, u.name, u.email,
      (SELECT count(*) FROM member_origin s WHERE s.ip_hash = o.ip_hash AND s.user_id <> o.user_id) AS siblings
    FROM member_origin o LEFT JOIN public."user" u ON u.id = o.user_id
    WHERE o.flagged ORDER BY o.created_at DESC LIMIT 100`)
  return r.map((x) => ({
    userId: String(x.user_id),
    name: String(x.name ?? 'Üye'),
    email: String(x.email ?? ''),
    src: String(x.src),
    siblings: Number(x.siblings),
    createdAt: iso(x.created_at),
  }))
}

export async function setFlag(userId: string, flagged: boolean) {
  await ensureGrowth()
  await rows(sql`UPDATE member_origin SET flagged = ${flagged} WHERE user_id = ${userId}`)
}

// --- Follows (address change alarm) -------------------------------------

export async function toggleFollow(userId: string, siteId: string) {
  const { activeSiteRecordId } = await import('@/lib/sites')
  const recordId = await activeSiteRecordId(siteId)
  if (!recordId) throw new Error('Site bulunamadı.')
  await ensureGrowth()
  const removed = await rows(sql`DELETE FROM site_follows WHERE user_id = ${userId} AND site_id = ${recordId} RETURNING site_id`)
  if (removed.length) return false
  await rows(sql`INSERT INTO site_follows (user_id, site_id) VALUES (${userId}, ${recordId}) ON CONFLICT DO NOTHING`)
  return true
}

export async function myFollows(userId: string) {
  await ensureGrowth()
  const r = await rows<{ site_id: string }>(sql`SELECT site_id FROM site_follows WHERE user_id = ${userId} ORDER BY created_at DESC`)
  return r.map((x) => x.site_id)
}

export async function followerCounts(): Promise<Record<string, number>> {
  await ensureGrowth()
  const r = await rows(sql`SELECT site_id, count(*) AS n FROM site_follows GROUP BY site_id`)
  return Object.fromEntries(r.map((x) => [String(x.site_id), Number(x.n)]))
}

/** Push + Telegram DM to everyone following a site. */
export async function notifyAddressChange(siteId: string, siteName: string, pageUrl: string) {
  await ensureGrowth()
  const followers = await rows<{ user_id: string }>(sql`SELECT user_id FROM site_follows WHERE site_id = ${siteId}`)
  const ids = followers.map((f) => f.user_id)
  if (!ids.length) return { push: 0, telegram: 0 }
  const title = `${siteName} adresi değişti`
  const body = 'Yeni giriş adresi AL KANKA’da. Dokun, doğrudan güncel adrese git.'
  const { sendToUsers } = await import('@/lib/push')
  const push = await sendToUsers(ids, { title, body, url: pageUrl }).catch(() => ({ sent: 0 }))
  let telegram = 0
  try {
    const { getChatConfig } = await import('@/lib/telegram-chat')
    const { botToken, callBot } = await import('@/lib/telegram-mirror')
    const cfg = await getChatConfig()
    if (cfg) {
      const token = await botToken(cfg.botId)
      const links = await rows<{ tg_id: string }>(sql`SELECT tg_id FROM tg_links WHERE user_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)
      for (const l of links) {
        const ok = await callBot(token, 'sendMessage', { chat_id: l.tg_id, text: `${title}\n\n${body}\n${pageUrl}`, disable_web_page_preview: true })
          .then(() => true)
          .catch(() => false)
        if (ok) telegram++
      }
    }
  } catch {
    // tg_links only exists once the Telegram chat module has run.
  }
  return { push: push.sent, telegram }
}

// --- Sponsor accounts & wager leaderboard --------------------------------

export type SponsorAccount = {
  userId: string
  userName: string
  siteId: string
  username: string
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  updatedAt: string
}

const mapAccount = (x: Record<string, unknown>): SponsorAccount => ({
  userId: String(x.user_id),
  userName: String(x.name ?? 'Üye'),
  siteId: String(x.site_id),
  username: String(x.username),
  status: String(x.status) as SponsorAccount['status'],
  note: x.note ? String(x.note) : null,
  updatedAt: iso(x.updated_at),
})

export async function linkSponsorAccount(userId: string, siteId: string, rawUsername: string) {
  if (!(await isSponsor(siteId))) throw new Error('Site bulunamadı.')
  const username = rawUsername.trim().replace(/\s+/g, '').slice(0, 40)
  if (username.length < 3) throw new Error('Kullanıcı adı en az 3 karakter olmalı.')
  await ensureGrowth()
  const taken = await rows(sql`SELECT 1 FROM sponsor_accounts WHERE site_id = ${siteId} AND lower(username) = lower(${username})
    AND user_id <> ${userId} AND status <> 'rejected'`)
  if (taken.length) throw new Error('Bu kullanıcı adı başka bir üyeye bağlı. Hata olduğunu düşünüyorsan şikâyet aç.')
  await rows(sql`INSERT INTO sponsor_accounts (user_id, site_id, username) VALUES (${userId}, ${siteId}, ${username})
    ON CONFLICT (user_id, site_id) DO UPDATE SET username = EXCLUDED.username, status = 'pending', note = NULL, updated_at = now()`)
}

export async function removeSponsorAccount(userId: string, siteId: string) {
  await ensureGrowth()
  await rows(sql`DELETE FROM sponsor_accounts WHERE user_id = ${userId} AND site_id = ${siteId}`)
}

export async function mySponsorAccounts(userId: string) {
  await ensureGrowth()
  const r = await rows(sql`SELECT * FROM sponsor_accounts WHERE user_id = ${userId} ORDER BY updated_at DESC`)
  return r.map(mapAccount)
}

export async function adminSponsorAccounts() {
  await ensureGrowth()
  const r = await rows(sql`SELECT a.*, u.name FROM sponsor_accounts a LEFT JOIN public."user" u ON u.id = a.user_id
    ORDER BY (a.status = 'pending') DESC, a.updated_at DESC LIMIT 200`)
  return r.map(mapAccount)
}

export async function setSponsorAccountStatus(userId: string, siteId: string, status: 'approved' | 'rejected', note: string) {
  await ensureGrowth()
  await rows(sql`UPDATE sponsor_accounts SET status = ${status}, note = ${note.trim().slice(0, 200) || null}, updated_at = now()
    WHERE user_id = ${userId} AND site_id = ${siteId}`)
}

function parseAmount(raw: string) {
  let v = raw.replace(/[^\d.,-]/g, '')
  if (v.includes(',') && v.includes('.')) v = v.lastIndexOf(',') > v.lastIndexOf('.') ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '')
  else if (v.includes(',')) v = v.replace(',', '.')
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

/** Accepts "kullaniciadi,tutar" lines (comma, semicolon or tab). Replaces the period's data for that site. */
export async function importWagers(siteId: string, period: string, text: string) {
  if (!(await isSponsor(siteId))) throw new Error('Site bulunamadı.')
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Dönem YYYY-AA biçiminde olmalı (ör. 2026-10).')
  const entries = new Map<string, number>()
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^([^,;\t]+)[,;\t]\s*(.+)$/)
    if (!match) continue
    const [, name, amount] = match
    const key = name.trim().toLowerCase().replace(/\s+/g, '')
    const value = amount ? parseAmount(amount) : null
    if (!key || key.length < 3 || value === null || /kullan|user|name/i.test(key)) continue
    entries.set(key, (entries.get(key) ?? 0) + value)
  }
  if (!entries.size) throw new Error('Geçerli satır bulunamadı. Her satır: kullaniciadi,tutar')
  await ensureGrowth()
  await rows(sql`DELETE FROM wager_entries WHERE site_id = ${siteId} AND period = ${period}`)
  for (const [key, amount] of entries) {
    await rows(sql`INSERT INTO wager_entries (site_id, username_key, period, amount) VALUES (${siteId}, ${key}, ${period}, ${amount})`)
  }
  const matched = await rows<{ n: string }>(sql`SELECT count(*) AS n FROM wager_entries w JOIN sponsor_accounts a
    ON a.site_id = w.site_id AND lower(a.username) = w.username_key AND a.status = 'approved'
    WHERE w.site_id = ${siteId} AND w.period = ${period}`)
  return { rows: entries.size, matched: Number(matched[0]?.n ?? 0) }
}

export type WagerRow = { userId: string; name: string; amount: number; sites: number }

export async function wagerBoard(period = currentPeriod(), limit = 50): Promise<WagerRow[]> {
  await ensureGrowth()
  const r = await rows(sql`SELECT a.user_id, u.name, sum(w.amount) AS amount, count(DISTINCT w.site_id) AS sites
    FROM wager_entries w
    JOIN sponsor_accounts a ON a.site_id = w.site_id AND lower(a.username) = w.username_key AND a.status = 'approved'
    LEFT JOIN public."user" u ON u.id = a.user_id
    WHERE w.period = ${period}
    GROUP BY a.user_id, u.name ORDER BY amount DESC LIMIT ${limit}`)
  return r.map((x) => ({ userId: String(x.user_id), name: String(x.name ?? 'Kanka').split(' ')[0], amount: Number(x.amount), sites: Number(x.sites) }))
}

export async function wagerPeriods() {
  await ensureGrowth()
  const r = await rows<{ period: string }>(sql`SELECT DISTINCT period FROM wager_entries ORDER BY period DESC LIMIT 12`)
  return r.map((x) => x.period)
}
