import 'server-only'
import { pool } from '@/lib/db'
import { getCatalog } from '@/lib/catalog'
import { isCampaignLive } from '@/lib/catalog-shared'
import { ensureCommunity } from '@/lib/community'
import { ensureGrowth } from '@/lib/growth'
import { ensureMarketing } from '@/lib/marketing'
import { listSites } from '@/lib/sites'
import type { SponsorSummary } from '@/lib/sponsor-summary-shared'

type Row = Record<string, unknown>

const DAYS = 30
const n = (v: unknown) => Number(v) || 0

function lastDays() {
  const today = Date.now() + 3 * 3_600_000
  return Array.from({ length: DAYS }, (_, i) => new Date(today - (DAYS - 1 - i) * 86_400_000).toISOString().slice(0, 10))
}

/**
 * Everything the panel knows about one sponsor, read only when its summary is opened.
 * Older tables key a sponsor by its numeric id, sponsor accounts and the catalog by its slug, so
 * every lookup matches both.
 */
export async function getSponsorSummary(id: number, opts: { earnings: boolean }): Promise<SponsorSummary | null> {
  if (!Number.isInteger(id) || id < 1) return null
  const site = (await listSites()).find((s) => s.id === id)
  if (!site) return null
  const keys = [String(site.id), ...(site.slug ? [site.slug] : [])]
  const missing: string[] = []

  const read = async (label: string, ensure: () => unknown, text: string, params: unknown[]): Promise<Row[]> => {
    try {
      await ensure()
      return (await pool.query(text, params)).rows as Row[]
    } catch (error) {
      console.error(`[sponsor-summary] ${label} okunamadı`, error)
      missing.push(label)
      return []
    }
  }

  const [totals, daily, sources, reviews, complaints, followers, accounts, earnings, catalog] = await Promise.all([
    read('Tıklama', ensureGrowth, `SELECT
        count(*) FILTER (WHERE created_at > now() - interval '7 days') AS week,
        count(*) FILTER (WHERE created_at > now() - interval '30 days') AS month,
        count(*) AS total,
        count(DISTINCT user_id) FILTER (WHERE created_at > now() - interval '30 days') AS members
      FROM link_clicks WHERE site_id = ANY($1::text[])`, [keys]),
    read('Günlük tıklama', ensureGrowth, `SELECT to_char(created_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS day, count(*) AS n
      FROM link_clicks WHERE site_id = ANY($1::text[]) AND created_at > now() - interval '31 days' GROUP BY day`, [keys]),
    read('Tıklama kaynağı', ensureGrowth, `SELECT src, count(*) AS n FROM link_clicks
      WHERE site_id = ANY($1::text[]) AND created_at > now() - interval '30 days' GROUP BY src ORDER BY n DESC, src LIMIT 5`, [keys]),
    read('Yorum', ensureCommunity, `SELECT status, count(*) AS n, avg(rating) AS avg FROM site_reviews WHERE site_id = ANY($1::text[]) GROUP BY status`, [keys]),
    read('Şikayet', ensureCommunity, `SELECT status, count(*) AS n FROM complaints WHERE site_id = ANY($1::text[]) GROUP BY status`, [keys]),
    read('Takipçi', ensureGrowth, `SELECT count(*) AS n FROM site_follows WHERE site_id = ANY($1::text[])`, [keys]),
    read('Bağlı hesap', ensureGrowth, `SELECT status, count(*) AS n FROM sponsor_accounts WHERE site_id = ANY($1::text[]) GROUP BY status`, [keys]),
    opts.earnings
      ? read('Hakediş', ensureMarketing, `SELECT period, model, ftd, amount, currency, status FROM aff_earnings WHERE site_id = $1 ORDER BY period DESC, updated_at DESC LIMIT 60`, [site.id])
      : Promise.resolve([] as Row[]),
    getCatalog({ includeHidden: true }).catch((error) => {
      console.error('[sponsor-summary] İçerik okunamadı', error)
      missing.push('Kampanya ve bonus')
      return null
    }),
  ])

  const by = (list: Row[], status: string) => n(list.find((r) => r.status === status)?.n)
  const perDay = new Map(daily.map((r) => [String(r.day), n(r.n)]))
  const approved = reviews.find((r) => r.status === 'approved')
  const mine = (sponsorId: string) => keys.includes(sponsorId)
  const campaigns = catalog?.campaigns.filter((c) => mine(c.sponsorId)) ?? []

  const sums = new Map<string, { currency: string; pending: number; claimed: number; paid: number }>()
  for (const e of earnings) {
    const currency = String(e.currency)
    const row = sums.get(currency) ?? { currency, pending: 0, claimed: 0, paid: 0 }
    if (e.status === 'pending' || e.status === 'claimed' || e.status === 'paid') row[e.status] += n(e.amount)
    sums.set(currency, row)
  }

  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    active: site.active,
    links: { entry: Boolean(site.entryUrl.trim()), site: Boolean(site.url.trim()) },
    deal: { ends: site.dealEnds, daysLeft: dealDaysLeft(site.dealEnds, istanbulToday()), fee: site.dealFee },
    clicks: {
      week: n(totals[0]?.week),
      month: n(totals[0]?.month),
      total: n(totals[0]?.total),
      members: n(totals[0]?.members),
      daily: lastDays().map((day) => ({ day, n: perDay.get(day) ?? 0 })),
      sources: sources.map((r) => ({ src: String(r.src), n: n(r.n) })),
    },
    reviews: {
      approved: n(approved?.n),
      pending: by(reviews, 'pending'),
      rejected: by(reviews, 'rejected'),
      average: approved && n(approved.n) > 0 ? Math.round(n(approved.avg) * 10) / 10 : null,
      editorRating: site.rating,
    },
    complaints: { open: by(complaints, 'open'), forwarded: by(complaints, 'forwarded'), resolved: by(complaints, 'resolved'), rejected: by(complaints, 'rejected') },
    followers: n(followers[0]?.n),
    accounts: { pending: by(accounts, 'pending'), approved: by(accounts, 'approved'), rejected: by(accounts, 'rejected') },
    content: {
      campaigns: campaigns.length,
      liveCampaigns: campaigns.filter((c) => isCampaignLive(c)).length,
      bonuses: catalog?.bonuses.filter((b) => mine(b.sponsorId)).length ?? 0,
    },
    earnings: opts.earnings
      ? {
          rows: earnings.slice(0, 6).map((e) => ({ period: String(e.period), model: String(e.model), ftd: n(e.ftd), amount: n(e.amount), currency: String(e.currency), status: String(e.status) })),
          totals: [...sums.values()],
          ftd: earnings.reduce((sum, e) => sum + (e.status === 'rejected' ? 0 : n(e.ftd)), 0),
        }
      : null,
    missing,
  }
}
