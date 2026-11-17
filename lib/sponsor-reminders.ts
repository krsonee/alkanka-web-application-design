import 'server-only'
import { rows, sql } from '@/lib/db'
import { ensureMarketing } from '@/lib/marketing'
import { listSites } from '@/lib/sites'
import { DEAL_WARN_DAYS, dealDaysLeft, dealLabel, istanbulToday } from '@/lib/sites-shared'

export type SponsorReminder = {
  id: string
  kind: 'deal' | 'earning'
  urgent: boolean
  title: string
  text: string
  href: string
}

const UNPAID_DAYS = 30
const DEALS_HREF = '/panel?b=sponsors'
const EARNINGS_HREF = '/panel?b=marketing&s=earnings'

function previousPeriod(today: string) {
  const [year, month] = today.split('-').map(Number)
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
}

function money(amount: number, currency: string) {
  return `${amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${currency === 'TRY' ? '₺' : currency}`
}

type EarningRow = { site_id: number; period: string; status: string; amount: number | string; currency: string; claimed_at: string | Date | null }

/**
 * Things about sponsors that need someone to act: deals about to end and earnings that are missing,
 * not yet claimed or not yet paid. Read when the screen opens; nothing runs in the background.
 */
export async function sponsorReminders(opts: { deals: boolean; earnings: boolean }): Promise<SponsorReminder[]> {
  if (!opts.deals && !opts.earnings) return []
  const today = istanbulToday()
  const sites = await listSites()
  const out: SponsorReminder[] = []

  if (opts.deals) {
    for (const site of sites) {
      if (!site.active) continue
      const days = dealDaysLeft(site.dealEnds, today)
      if (days === null || days > DEAL_WARN_DAYS) continue
      out.push({
        id: `deal-${site.id}`,
        kind: 'deal',
        urgent: days <= 0,
        title: site.name,
        text:
          days < 0
            ? `${dealLabel(days)}, sponsor hâlâ yayında. Anlaşmayı yenile ya da sponsoru yayından çıkar.`
            : `${dealLabel(days)}. Yenileme için sponsorla şimdiden konuş.`,
        href: DEALS_HREF,
      })
    }
  }

  if (opts.earnings) {
    await ensureMarketing()
    const list = await rows<EarningRow>(sql`SELECT site_id, period, status, amount, currency, claimed_at FROM aff_earnings
      WHERE created_at > now() - interval '400 days' ORDER BY period DESC LIMIT 600`)
    const names = new Map(sites.map((site) => [site.id, site.name]))
    const last = previousPeriod(today)
    const current = today.slice(0, 7)

    const tracked = new Set(list.map((e) => Number(e.site_id)))
    const hasLast = new Set(list.filter((e) => e.period === last).map((e) => Number(e.site_id)))
    for (const site of sites) {
      if (!site.active || !tracked.has(site.id) || hasLast.has(site.id)) continue
      out.push({
        id: `missing-${site.id}`,
        kind: 'earning',
        urgent: false,
        title: site.name,
        text: `${last} dönemi için hakediş kaydı girilmemiş. Sponsorun affiliate panelindeki rakamları ekle.`,
        href: EARNINGS_HREF,
      })
    }

    for (const e of list) {
      const name = names.get(Number(e.site_id)) ?? `Sponsor #${e.site_id}`
      const sum = money(Number(e.amount) || 0, String(e.currency))
      if (e.status === 'pending' && e.period < current) {
        out.push({
          id: `unclaimed-${e.site_id}-${e.period}`,
          kind: 'earning',
          urgent: false,
          title: name,
          text: `${e.period} hakedişi (${sum}) hâlâ "Hesaplanıyor". Tutar kesinleştiyse sponsordan talep et.`,
          href: EARNINGS_HREF,
        })
      }
      if (e.status === 'claimed' && e.claimed_at) {
        const days = Math.floor((Date.now() - new Date(e.claimed_at).getTime()) / 86_400_000)
        if (days >= UNPAID_DAYS) {
          out.push({
            id: `unpaid-${e.site_id}-${e.period}`,
            kind: 'earning',
            urgent: true,
            title: name,
            text: `${e.period} hakedişi (${sum}) ${days} gün önce talep edildi, ödeme işaretlenmedi. Sponsora hatırlat.`,
            href: EARNINGS_HREF,
          })
        }
      }
    }
  }

  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent)).slice(0, 40)
}
