import 'server-only'
import { rows, sql } from '@/lib/db'
import { DEFAULT_TELEGRAM_LINK } from '@/lib/social-shared'
import { getTelegramAddresses, setChannel } from '@/lib/telegram-channels'
import { getHub, modLog, saveHub } from '@/lib/tg-hub'
import type { HubConfig } from '@/lib/tg-hub-shared'
import {
  CHANGE_ADDRESS,
  MAIN_CHANNEL_KEY,
  parseChannelAddress,
  swapAddress,
  swapDeep,
  type BridgeStats,
  type ChannelAddress,
  type ResilienceData,
} from '@/lib/tg-resilience-shared'

export async function getChannelAddress(): Promise<ResilienceData['address']> {
  const a = await getTelegramAddresses(DEFAULT_TELEGRAM_LINK)
  return { url: a.main, username: parseChannelAddress(a.main)?.username ?? null, custom: a.custom, feed: a.usernames.duyuru }
}

type Swap = (text: string) => string

/** Each place that stores a channel link of its own. Returns the note to show, or null when nothing there pointed at the old address. */
const STORES: { name: string; run: (swap: Swap, from: ChannelAddress) => Promise<string | null> }[] = [
  {
    name: 'Site şeridi',
    run: async (swap, from) => {
      const { getTelegramPromo, saveTelegramPromo } = await import('@/lib/telegram-promo')
      const promo = await getTelegramPromo()
      // An empty link follows the main address by itself, which is better than a second copy of it.
      const own = promo.url && parseChannelAddress(promo.url)?.url.toLowerCase() === from.url.toLowerCase() ? '' : swap(promo.url)
      const next = { ...promo, url: own, text: swap(promo.text), cta: swap(promo.cta) }
      if (JSON.stringify(next) === JSON.stringify(promo)) return null
      await saveTelegramPromo(next)
      return 'Site şeridi yeni adrese döndü.'
    },
  },
  {
    name: 'Sosyal linkler',
    run: async (swap) => {
      const { getSocialLinks, saveSocialLinks } = await import('@/lib/social')
      const links = await getSocialLinks()
      const next = swapDeep(links, swap)
      if (!next.changed) return null
      await saveSocialLinks(next.value)
      return `Sosyal hesap linklerinde ${next.changed} adres güncellendi.`
    },
  },
  {
    name: 'Ana sayfa kartları',
    run: async (swap) => {
      const { getContent, setContent } = await import('@/lib/content')
      const { HOME_V2_KEY } = await import('@/lib/home-v2-shared')
      const saved = await getContent<unknown>(HOME_V2_KEY)
      if (!saved) return null
      const next = swapDeep(saved, swap)
      if (!next.changed) return null
      await setContent(HOME_V2_KEY, next.value)
      return 'Ana sayfadaki tanıtım kartları yeni adrese döndü.'
    },
  },
  {
    name: 'Bekleyen postlar',
    run: async (swap) => {
      const { ensurePostTables } = await import('@/lib/tg-posts')
      const { swapButtons } = await import('@/lib/tg-post-manual')
      await ensurePostTables()
      const plans = await rows<{ id: number; text: string; buttons: string }>(sql`SELECT id, text, buttons FROM tg_post_plans WHERE status <> 'sending'`)
      let changed = 0
      for (const p of plans) {
        const text = swap(p.text)
        let buttons = p.buttons
        try {
          buttons = JSON.stringify(swapButtons(JSON.parse(p.buttons), swap))
        } catch {
          buttons = p.buttons
        }
        if (text === p.text && buttons === p.buttons) continue
        await rows(sql`UPDATE tg_post_plans SET text = ${text}, buttons = ${buttons}, updated_at = now() WHERE id = ${p.id} AND status <> 'sending'`)
        changed++
      }
      return changed ? `${changed} taslak, şablon ya da zamanlı post güncellendi.` : null
    },
  },
  {
    name: 'Elle atılan post kuralları',
    run: async (swap) => {
      const { rewriteRuleLinks } = await import('@/lib/tg-post-manual')
      const changed = await rewriteRuleLinks(swap)
      return changed ? `${changed} kanal kuralının imzası ya da butonu güncellendi.` : null
    },
  },
  {
    name: 'Sıradaki DM duyuruları',
    run: async (swap) => {
      const queued = await rows<{ id: number; text: string; buttons: string | null; button_url: string | null }>(
        sql`SELECT id, text, buttons, button_url FROM tg_broadcasts WHERE status = 'queued'`,
      )
      let changed = 0
      for (const b of queued) {
        const text = swap(b.text)
        const url = b.button_url == null ? null : swap(b.button_url)
        let buttons = b.buttons
        try {
          buttons = b.buttons == null ? null : JSON.stringify(swapDeep(JSON.parse(b.buttons), swap).value)
        } catch {
          buttons = b.buttons
        }
        if (text === b.text && url === b.button_url && buttons === b.buttons) continue
        await rows(sql`UPDATE tg_broadcasts SET text = ${text}, buttons = ${buttons}, button_url = ${url} WHERE id = ${b.id} AND status = 'queued'`)
        changed++
      }
      return changed ? `${changed} bekleyen DM duyurusu güncellendi.` : null
    },
  },
]

/** The guard deletes links it does not know; the new address has to be on its allow list before anyone posts it. */
function allowWith(allow: string[], to: ChannelAddress) {
  const entry = to.url.toLowerCase().replace(/^https?:\/\//, '')
  const covered = allow.some((a) => a && entry.startsWith(a.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '')))
  return covered ? allow : [...allow, entry]
}

function swapHub(hub: HubConfig, swap: Swap, to: ChannelAddress) {
  const auto = swapDeep(hub.autoReply, swap)
  const support = swapDeep({ welcome: hub.support.welcome, canned: hub.support.canned }, swap)
  const rules = swap(hub.guard.rules)
  const allowDomains = allowWith(hub.guard.allowDomains, to)
  const texts = auto.changed + support.changed + (rules === hub.guard.rules ? 0 : 1)
  const next: HubConfig = {
    ...hub,
    autoReply: auto.value,
    support: { ...hub.support, ...support.value },
    guard: { ...hub.guard, rules, allowDomains },
  }
  return { next, texts, allowed: allowDomains !== hub.guard.allowDomains }
}

/**
 * Points everything at a new channel in one go: the site's links, the in-site feed when the new channel
 * is public, and every stored text or button that named the old address. Posts already sent are history
 * and stay as they are. A step that fails is reported and does not stop the others.
 */
export async function switchChannel(input: string, by: string): Promise<{ url: string; notes: string[] }> {
  const to = parseChannelAddress(input)
  if (!to) throw new Error('Adres geçersiz. @kanaladi, t.me/kanaladi ya da t.me/+… davet linki yaz.')
  const current = await getChannelAddress()
  const from: ChannelAddress = { url: current.url, username: current.username }
  if (from.url.toLowerCase() === to.url.toLowerCase()) throw new Error('Bu adres zaten güncel kanal adresi.')
  const notes: string[] = []
  const swap: Swap = (text) => swapAddress(text, from, to)

  let feedMoved = false
  if (to.username) {
    try {
      await setChannel('duyuru', to.username)
      feedMoved = true
      notes.push('Site içindeki duyuru akışı yeni kanala bağlandı.')
    } catch (error) {
      notes.push(`Site içindeki duyuru akışı eski kanalda kaldı (${String((error as Error).message).replace(/\.$/, '')}). Kanal hazır olunca Kanallar sekmesinden bağla.`)
    }
  } else {
    notes.push('Bu özel bir davet linki. Site içindeki duyuru akışı herkese açık kanal ister, o yüzden akış değişmedi.')
  }
  // Once the feed follows the new channel the address comes from it; an override is only kept when it has to say something different.
  if (feedMoved) await rows(sql`DELETE FROM tg_settings WHERE key = ${MAIN_CHANNEL_KEY}`)
  else await rows(sql`INSERT INTO tg_settings (key, value) VALUES (${MAIN_CHANNEL_KEY}, ${to.url}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`)

  try {
    const hub = await getHub()
    const { next, texts, allowed } = swapHub(hub, swap, to)
    if (texts || allowed) {
      await saveHub(next)
      const { recordHubChange } = await import('@/lib/tg-history')
      await recordHubChange(hub, next, by, CHANGE_ADDRESS).catch((error) => console.error('[tg-address] history', error))
      if (texts) notes.push(`Oto cevap, karşılama ve destek yazılarında ${texts} yer güncellendi.`)
      if (allowed) notes.push('Yeni adres Bekçi’nin izinli linklerine eklendi; grupta paylaşılınca silinmez.')
    }
  } catch (error) {
    notes.push(`Bot yazıları güncellenemedi: ${String((error as Error).message)}`)
  }

  for (const store of STORES) {
    try {
      const note = await store.run(swap, from)
      if (note) notes.push(note)
    } catch (error) {
      console.error('[tg-address]', store.name, error)
      notes.push(`${store.name} güncellenemedi: ${String((error as Error).message).slice(0, 140)}`)
    }
  }

  await modLog({ action: CHANGE_ADDRESS, reason: `${from.url} → ${to.url} (değiştiren: ${by})` })
  return { url: to.url, notes }
}

async function bridgeStats(): Promise<BridgeStats> {
  const [r] = await rows(sql`SELECT count(*) AS linked,
      count(*) FILTER (WHERE NOT dm_off AND NOT dm_blocked) AS reachable,
      count(*) FILTER (WHERE linked_at > now() - interval '7 days') AS week,
      count(*) FILTER (WHERE linked_at > now() - interval '30 days') AS month
    FROM tg_links`)
  return { linked: Number(r.linked), reachable: Number(r.reachable), week: Number(r.week), month: Number(r.month) }
}

export async function loadResilience(): Promise<ResilienceData> {
  const hub = await getHub()
  const { listInvites } = await import('@/lib/tg-invites')
  const [address, bridge, invites] = await Promise.all([
    getChannelAddress(),
    // The table belongs to the live chat; a site that never connected it simply has nobody linked.
    bridgeStats().catch(() => ({ linked: 0, reachable: 0, week: 0, month: 0 })),
    listInvites().catch(() => []),
  ])
  return {
    address,
    bridge,
    invites,
    chats: hub.groups.map((g) => ({ chatId: g.chatId, title: g.title })),
    guardReady: Boolean(hub.guard.enabled && hub.guardBotId),
  }
}
