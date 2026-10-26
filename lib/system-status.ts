import 'server-only'
import { listBots } from '@/lib/telegram-mirror'
import { shareStatus, getBotSuite } from '@/lib/telegram-bots'
import { chatStatus } from '@/lib/telegram-chat'
import { tvBotStatus } from '@/lib/kankatv-engage'
import { betsBotStatus } from '@/lib/tv-bets'
import { getVerification } from '@/lib/deals'
import { getTracking } from '@/lib/marketing'

export type StatusLevel = 'ok' | 'warn' | 'off'
export type StatusItem = { id: string; group: string; label: string; level: StatusLevel; detail: string; href: string }

const STALE_MS = 6 * 60 * 60 * 1000

function runState(lastRunAt: string | Date | null | undefined, lastError: string | null | undefined): { level: StatusLevel; detail: string } {
  if (lastError) return { level: 'warn', detail: `Hata: ${String(lastError).slice(0, 80)}` }
  if (!lastRunAt) return { level: 'off', detail: 'Hiç çalışmadı' }
  const at = new Date(lastRunAt)
  const ago = Date.now() - at.getTime()
  const when = at.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
  return ago > STALE_MS ? { level: 'warn', detail: `Son çalışma eski: ${when}` } : { level: 'ok', detail: `Son çalışma: ${when}` }
}

const settled = <T,>(p: Promise<T>) => p.then((v) => v).catch(() => null)

export async function loadSystemStatus(): Promise<StatusItem[]> {
  const [bots, suite, share, chat, tv, bets, verify, tracking] = await Promise.all([
    settled(listBots()),
    settled(getBotSuite()),
    settled(shareStatus()),
    settled(chatStatus()),
    settled(tvBotStatus()),
    settled(betsBotStatus()),
    settled(getVerification()),
    settled(getTracking()),
  ])

  const tg = '/panel?b=telegram'
  const seo = '/panel?b=seo'
  const mk = '/panel?b=marketing'
  const items: StatusItem[] = []

  const botCount = bots?.length ?? 0
  items.push({ id: 'bots', group: 'Telegram', label: 'Bot bağlantısı', level: botCount > 0 ? 'ok' : 'off', detail: botCount > 0 ? `${botCount} bot bağlı` : 'Bot eklenmemiş', href: tg })

  const webhook = chat?.webhook
  items.push({
    id: 'chat',
    group: 'Telegram',
    label: 'Canlı sohbet webhook',
    level: !webhook?.url ? 'off' : webhook.lastError ? 'warn' : 'ok',
    detail: !webhook?.url ? 'Kurulmadı' : webhook.lastError ? `Hata: ${String(webhook.lastError).slice(0, 80)}` : 'Çalışıyor',
    href: tg,
  })

  const shareOn = Boolean(suite?.share.enabled)
  items.push({ id: 'share', group: 'Otomasyon', label: 'Post paylaşım', ...(shareOn ? runState(share?.lastRunAt, share?.lastError) : { level: 'off' as const, detail: 'Kapalı' }), href: tg })
  items.push({ id: 'tv', group: 'Otomasyon', label: 'KankaTV gol botu cron', ...runState(tv?.lastRunAt, tv?.lastError), href: tg })
  items.push({ id: 'bets', group: 'Otomasyon', label: 'Canlı etkinlik cron', ...runState(bets?.lastRunAt, bets?.lastError), href: tg })

  const v = verify ?? { google: '', bing: '', yandex: '', meta: '' }
  for (const [id, label] of [['google', 'Google doğrulama'], ['bing', 'Bing doğrulama'], ['yandex', 'Yandex doğrulama']] as const) {
    items.push({ id, group: 'SEO', label, level: v[id] ? 'ok' : 'off', detail: v[id] ? 'Kod girildi' : 'Kod girilmedi', href: seo })
  }

  items.push({ id: 'ga4', group: 'Takip', label: 'Google Analytics', level: tracking?.ga4Id ? 'ok' : 'off', detail: tracking?.ga4Id || 'Kimlik girilmedi', href: mk })
  items.push({ id: 'pixel', group: 'Takip', label: 'Meta Pixel', level: tracking?.metaPixelId ? 'ok' : 'off', detail: tracking?.metaPixelId || 'Kimlik girilmedi', href: mk })

  return items
}
