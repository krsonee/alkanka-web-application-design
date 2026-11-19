import 'server-only'
import { listAffLinks } from '@/lib/aff-links'
import { rows, sql } from '@/lib/db'
import { cleanShortDomain, type LinkReport, type LinkRow } from '@/lib/links-shared'
import { ensureMarketing } from '@/lib/marketing'
import { listSites } from '@/lib/sites'

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const MAX_RANGE_DAYS = 400

function istanbulDay(offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() + offsetDays * 86_400_000))
}

/** Inclusive Istanbul days. Bad or reversed input falls back to the last 30 days. */
export function cleanRange(from?: string | null, to?: string | null) {
  const end = to && DAY.test(to) ? to : istanbulDay()
  let start = from && DAY.test(from) ? from : istanbulDay(-29)
  if (start > end) start = end
  const span = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000
  if (span > MAX_RANGE_DAYS) start = new Date(Date.parse(`${end}T00:00:00Z`) - MAX_RANGE_DAYS * 86_400_000).toISOString().slice(0, 10)
  return { from: start, to: end }
}

export async function getShortDomain(): Promise<string> {
  if (!process.env.DATABASE_URL) return ''
  await ensureMarketing()
  const r = await rows<{ host: string | null }>(sql`SELECT value->>'host' AS host FROM mkt_settings WHERE key = 'short_domain'`)
  return String(r[0]?.host ?? '')
}

export async function saveShortDomain(value: string) {
  await ensureMarketing()
  const host = cleanShortDomain(value)
  if (!host) {
    await rows(sql`DELETE FROM mkt_settings WHERE key = 'short_domain'`)
    return ''
  }
  await rows(sql`INSERT INTO mkt_settings (key, value) VALUES ('short_domain', ${JSON.stringify({ host })}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`)
  return host
}

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null)

type Stat = { clicks: number; uniques: number; last: string | null }
const NONE: Stat = { clicks: 0, uniques: 0, last: null }

function statMap(list: Record<string, unknown>[], key: string) {
  return new Map<string, Stat>(list.map((x) => [String(x[key]), { clicks: Number(x.clicks), uniques: Number(x.uniques), last: iso(x.last_click) }]))
}

/**
 * Every short link in one list: sponsor/outside links (/r), campaign links (/k) and the on-site "Git" buttons (/git).
 * Clicks and uniques are counted inside the range; the last click is over all time so a dead link stays visible.
 */
export async function linkReport(input: { from?: string | null; to?: string | null; siteId?: number | null } = {}): Promise<LinkReport> {
  await ensureMarketing()
  const { from, to } = cleanRange(input.from, input.to)
  const siteId = input.siteId && Number.isInteger(Number(input.siteId)) ? Number(input.siteId) : null
  const inRange = sql`created_at >= (${from}::date)::timestamp AT TIME ZONE 'Europe/Istanbul'
    AND created_at < (${to}::date + 1)::timestamp AT TIME ZONE 'Europe/Istanbul'`

  const [affLinks, sites, shortDomain] = await Promise.all([listAffLinks(), listSites(), getShortDomain()])
  const [affStats, affSources, campaigns, visitStats, signups, gitStats] = await Promise.all([
    rows(sql`SELECT link_id, count(*) FILTER (WHERE ${inRange}) AS clicks,
        count(DISTINCT coalesce(user_id, ip_hash)) FILTER (WHERE ${inRange}) AS uniques, max(created_at) AS last_click
      FROM aff_clicks GROUP BY link_id`),
    rows(sql`SELECT DISTINCT ON (link_id) link_id, src, count(*) AS n FROM aff_clicks WHERE ${inRange}
      GROUP BY link_id, src ORDER BY link_id, n DESC, src`),
    rows(sql`SELECT * FROM campaigns ORDER BY active DESC, created_at DESC`),
    rows(sql`SELECT campaign_id, count(*) FILTER (WHERE ${inRange}) AS clicks,
        count(DISTINCT ip_hash) FILTER (WHERE ${inRange}) AS uniques, max(created_at) AS last_click
      FROM campaign_visits GROUP BY campaign_id`),
    rows(sql`SELECT src, count(*) AS n FROM member_origin WHERE ${inRange} GROUP BY src`),
    rows(sql`SELECT site_id, count(*) FILTER (WHERE ${inRange}) AS clicks,
        count(DISTINCT user_id) FILTER (WHERE ${inRange}) AS uniques, max(created_at) AS last_click
      FROM link_clicks GROUP BY site_id`),
  ])

  const aff = statMap(affStats, 'link_id')
  const visits = statMap(visitStats, 'campaign_id')
  const git = statMap(gitStats, 'site_id')
  const topSrc = new Map(affSources.map((x) => [String(x.link_id), String(x.src)]))
  const signupBy = new Map(signups.map((x) => [String(x.src), Number(x.n)]))
  const siteById = new Map(sites.map((s) => [s.id, s]))
  const affCodes = new Set(affLinks.map((l) => l.code))
  const campaignCodes = new Set(campaigns.map((c) => String(c.code)))
  const primarySites = new Set(affLinks.filter((l) => l.primary && l.active && l.siteId !== null).map((l) => l.siteId as number))

  const out: LinkRow[] = []

  for (const link of affLinks) {
    if (siteId !== null && link.siteId !== siteId) continue
    const s = aff.get(String(link.id)) ?? NONE
    const site = link.siteId === null ? null : siteById.get(link.siteId) ?? null
    const clash = campaignCodes.has(link.code)
    out.push({
      key: `aff:${link.id}`,
      kind: link.siteId === null ? 'dis' : 'sponsor',
      code: link.code,
      path: `/r/${link.code}`,
      name: link.label || link.code,
      target: link.affUrl,
      siteId: link.siteId,
      siteName: site?.name ?? null,
      source: topSrc.get(String(link.id)) ?? '',
      active: link.active,
      clicks: s.clicks,
      uniques: s.uniques,
      uniqueBasis: 'ziyaretci',
      signups: null,
      lastClick: s.last,
      clash,
      note: clash ? 'Aynı kod bir kampanya linkinde de var. Kısa alan adında bu kod bu linki açar.' : null,
    })
  }

  for (const c of campaigns) {
    const code = String(c.code)
    const target = String(c.target)
    const owner = sites.find((s) => s.slug && (target === `/git/${s.slug}` || target.startsWith(`/git/${s.slug}?`) || target === `/siteler/${s.slug}`)) ?? null
    if (siteId !== null && owner?.id !== siteId) continue
    const s = visits.get(String(c.id)) ?? NONE
    const clash = affCodes.has(code)
    out.push({
      key: `kmp:${c.id}`,
      kind: 'sayfa',
      code,
      path: `/k/${code}`,
      name: String(c.name),
      target,
      siteId: owner?.id ?? null,
      siteName: owner?.name ?? null,
      source: String(c.channel),
      active: Boolean(c.active),
      clicks: s.clicks,
      uniques: s.uniques,
      uniqueBasis: 'ziyaretci',
      signups: signupBy.get(code) ?? 0,
      lastClick: s.last,
      clash,
      note: clash ? 'Aynı kod bir sponsor linkinde de var. Kısa alan adında bu link /k/ ile paylaşılır.' : null,
    })
  }

  for (const site of sites) {
    if (!site.slug || (siteId !== null && site.id !== siteId)) continue
    const byId = git.get(String(site.id)) ?? NONE
    const bySlug = git.get(site.slug) ?? NONE
    const last = [byId.last, bySlug.last].filter(Boolean).sort().pop() ?? null
    const clicks = byId.clicks + bySlug.clicks
    if (!clicks && !last && !site.active) continue
    out.push({
      key: `git:${site.id}`,
      kind: 'git',
      code: site.slug,
      path: `/git/${site.slug}`,
      name: `${site.name} · Git düğmesi`,
      target: null,
      siteId: site.id,
      siteName: site.name,
      source: 'site içi',
      active: Boolean(site.active),
      clicks,
      uniques: byId.uniques + bySlug.uniques,
      uniqueBasis: 'uye',
      signups: null,
      lastClick: last,
      clash: false,
      note: primarySites.has(site.id) ? 'Bu sponsorun ana linki var: buradaki tıklamalar ana linkin satırında da sayılır, ikisini toplama.' : null,
    })
  }

  return { from, to, siteId, shortDomain, rows: out }
}
