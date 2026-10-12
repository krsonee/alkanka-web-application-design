import 'server-only'
import { rows, sql } from '@/lib/db'
import { getAnnouncements } from '@/lib/data'
import { listCampaigns, listEvents, listOdds } from '@/lib/engage'
import { listTournaments } from '@/lib/tournaments'
import type { Campaign, TickerEvent } from '@/components/alkanka/data'

export async function listPublicCampaigns(): Promise<Campaign[]> {
  const rows = await listCampaigns().catch(() => [])
  return rows.map((row) => ({
    id: String(row.id),
    sponsorId: String(row.siteId),
    title: row.title,
    description: row.bonusSummary || row.steps.join(' · '),
    ends: 'Yayında',
    image: row.logoUrl && row.logoUrl.startsWith('/') ? '/images/banner-events.png' : '/images/banner-events.png',
    tag: 'Kampanya',
    hoursLeft: 48,
  }))
}

export type PublicOddCard = {
  id: string
  siteId: string
  siteName: string
  body: string
  when: string
}

export async function listPublicOdds(): Promise<PublicOddCard[]> {
  const cards = await listOdds().catch(() => [])
  return cards.map((card) => ({
    id: String(card.id),
    siteId: card.siteId ? String(card.siteId) : '',
    siteName: card.siteLabel,
    body: card.body,
    when: card.eventAt ? new Date(card.eventAt).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '',
  }))
}

export async function tickerFromAnnouncements(): Promise<TickerEvent[]> {
  const news = await getAnnouncements().catch(() => [])
  return news.map((item) => ({
    id: `duyuru-${item.id}`,
    kind: 'drop' as const,
    text: item.text,
    time: '',
  }))
}

export async function distributedCoins() {
  try {
    const found = await rows<{ n: string }>(sql`SELECT coalesce(sum(amount), 0)::bigint AS n FROM point_ledger WHERE amount > 0`)
    return Number(found[0]?.n ?? 0)
  } catch {
    return 0
  }
}

export async function publicTickets() {
  return listEvents(null).catch(() => [])
}

export async function publicTournaments() {
  const all = await listTournaments().catch(() => [])
  return all.filter((item) => item.status !== 'iptal')
}
