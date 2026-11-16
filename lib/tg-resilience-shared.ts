import type { HubConfig, KnownChat } from '@/lib/tg-hub-shared'

// --- Channel address -------------------------------------------------------------

/** `username` is null for a private invite link, which has no public page to read posts from. */
export type ChannelAddress = { url: string; username: string | null }

export const MAIN_CHANNEL_KEY = 'main_channel_url'

const NAME = '[a-z][a-z0-9_]{3,31}'
const INVITE = '(?:\\+|joinchat\\/)[\\w-]{8,64}'

/** Accepts `@name`, `t.me/name`, a full link, or a private invite link (`t.me/+…`). */
export function parseChannelAddress(input: string): ChannelAddress | null {
  const raw = String(input ?? '').trim()
  const bare = new RegExp(`^@?(${NAME})$`, 'i').exec(raw)
  if (bare) return { url: `https://t.me/${bare[1]}`, username: bare[1] }
  const link = new RegExp(`^(?:https?:\\/\\/)?(?:www\\.)?(?:t\\.me|telegram\\.me)\\/(${INVITE}|${NAME})\\/?$`, 'i').exec(raw)
  if (!link) return null
  const isInvite = /^(\+|joinchat\/)/i.test(link[1])
  return { url: `https://t.me/${link[1]}`, username: isInvite ? null : link[1] }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Rewrites every mention of the old address in a text. A longer name that only starts the same, or a
 * link to one of the old channel's posts, is left alone: neither exists under the new address.
 */
export function swapAddress(text: string, from: ChannelAddress, to: ChannelAddress) {
  const path = escapeRe(from.url.replace(/^https:\/\/t\.me\//i, ''))
  let out = text.replace(new RegExp(`(?:https?:\\/\\/)?(?:www\\.)?(?:t\\.me|telegram\\.me)\\/${path}\\/?(?![\\w+/-])`, 'gi'), to.url)
  if (from.username) {
    out = out.replace(new RegExp(`(?<![\\w@])@${escapeRe(from.username)}(?!\\w)`, 'gi'), to.username ? `@${to.username}` : to.url)
  }
  return out
}

/** Applies `swap` to every string inside a JSON value and counts how many of them changed. */
export function swapDeep<T>(value: T, swap: (s: string) => string): { value: T; changed: number } {
  let changed = 0
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const next = swap(v)
      if (next !== v) changed++
      return next
    }
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
    return v
  }
  return { value: walk(value) as T, changed }
}

// --- Panel data ------------------------------------------------------------------

export const INVITE_NAME_MAX = 32

export type InviteRow = {
  id: number
  chatId: string
  chatTitle: string
  name: string
  link: string
  approval: boolean
  createdBy: string
  createdAt: string
  revokedAt: string | null
  joins: number
  lastJoinAt: string | null
  /** Joins in roughly the last hour; the first place an attack through one link shows up. */
  recentJoins: number
}

export type BridgeStats = { linked: number; reachable: number; week: number; month: number }

export type ResilienceData = {
  address: ChannelAddress & { custom: boolean; feed: string | null }
  bridge: BridgeStats
  invites: InviteRow[]
  /** Chats a campaign link can be opened for. */
  chats: KnownChat[]
  /** False until the guard bot has been told to report joins, which happens when the first link is opened. */
  guardReady: boolean
}

export type StatsDay = { day: string; messages: number; joins: number; removed: number; leaves: number; members: number | null }

export type TgStats = {
  span: number
  chatId: string
  days: StatsDay[]
  /** Messages per hour of the day, Turkey time, index 0-23. */
  hours: number[]
  writers: number
  chats: KnownChat[]
}

export const STATS_SPANS = [7, 30] as const

export type ConfigChange = { id: number; at: string; who: string; what: string; changes: string[] }

/**
 * Saves that rewrite settings from outside the form that shows them. The panel's open forms still hold
 * the old values after one of these, so they are rebuilt instead of being allowed to save them back.
 */
export const CHANGE_ADDRESS = 'Kanal adresi değişti'
export const CHANGE_RESTORE = 'Eski ayara dönüldü'
export const CHANGE_IMPORT = 'Yedekten yüklendi'
export const OUTSIDE_CHANGES = [CHANGE_ADDRESS, CHANGE_RESTORE, CHANGE_IMPORT]

// --- What changed between two saved configs ----------------------------------------

const FIELD: Record<string, string> = {
  'guard.enabled': 'Bekçi',
  'guard.words': 'Yasaklı kelimeler',
  'guard.warnLimit': 'Uyarı sınırı',
  'guard.muteMinutes': 'Susturma süreleri',
  'guard.floodCount': 'Flood mesaj sayısı',
  'guard.floodSeconds': 'Flood süresi (sn)',
  'guard.floodMuteMinutes': 'Flood susturma süresi (dk)',
  'guard.repeatLimit': 'Tekrar sınırı',
  'guard.allowDomains': 'İzinli linkler',
  'guard.linkAction': 'Yabancı link cezası',
  'guard.blockForwards': 'İletilen mesaj engeli',
  'guard.cleanService': 'Giriş/çıkış mesajlarını silme',
  'guard.captcha': 'Giriş doğrulaması',
  'guard.captchaMode': 'Doğrulama türü',
  'guard.casCheck': 'CAS kontrolü',
  'guard.impersonation': 'Taklit koruması',
  'guard.raidJoins': 'Baskın eşiği',
  'guard.aiModeration': 'Yapay zekâ denetimi',
  'guard.rules': 'Kurallar metni',
  'shield.raidMode': 'Baskın modu',
  'shield.raidMinutes': 'Baskın kilit süresi (dk)',
  'shield.raidLock': 'Baskında grup kilidi',
  'shield.inviteLimit': 'Toplu ekleme sınırı',
  'shield.inviteLock': 'Üye ekleme izni kapatma',
  'shield.commentShield': 'Yorum kalkanı',
  'shield.commentRate': 'Yorum hız sınırı',
  'shield.commentLockMinutes': 'Yorum kilit süresi (dk)',
  'shield.quarantineHours': 'Karantina süresi (saat)',
  'shield.content': 'İçerik türü kuralları',
  'shield.swarmAccounts': 'Koordineli spam eşiği',
  'shield.hiddenAds': 'Gizli reklam taraması',
  'shield.nameWatch': 'İsim nöbeti',
  'shield.quiet': 'Sessiz saatler',
  'shield.channelJoinAlert': 'Kanal giriş alarmı',
  'shield.adminAlerts': 'Yönetici ve bot yetkisi alarmı',
  'shield.reactionLimit': 'Tepki sınırı',
  'shield.healthAlert': 'Kanal sağlığı alarmı',
  'shield.memberDropPercent': 'Üye düşüş eşiği (%)',
  'counter.enabled': 'Sohbet sayacı',
  'counter.rewards': 'Sayaç ödülleri',
  'counter.minLength': 'Sayaç en kısa mesaj',
  'counter.postToChatId': 'Sıralamanın atılacağı grup',
  'support.enabled': 'Destek botu',
  'support.staffChatId': 'Destek ekibi grubu',
  'support.sponsors': 'Sponsor destek grupları',
  'support.categories': 'Destek kategorileri',
  'support.aiFaq': 'Destekte yapay zekâ cevabı',
  'support.welcome': 'Destek karşılama yazısı',
  'support.canned': 'Hazır cevaplar',
  'support.alertMinutes': 'Cevapsız bilet uyarısı (dk)',
  'report.enabled': 'Haftalık rapor',
  'autoReply.enabled': 'Oto cevap',
  'autoReply.cooldownSeconds': 'Oto cevap bekleme süresi (sn)',
  'autoReply.siteUrl': 'Oto cevap site adresi',
  'autoReply.siteText': 'Oto cevap "site" yazısı',
  'autoReply.sponsorText': 'Oto cevap "sponsor" yazısı',
  'autoReply.sponsorLimit': 'Oto cevap sponsor sayısı',
  'autoReply.rules': 'Oto cevap kuralları',
  'autoReply.welcome': 'Karşılama mesajı',
}

const TOP: Record<string, string> = { guardBotId: 'Bekçi botu', supportBotId: 'Destek botu', logChatId: 'Kayıt grubu' }
/** Titles change together with their ids, so they are not reported on their own. */
const SILENT = new Set(['logChatTitle', 'support.staffChatTitle'])

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function show(v: unknown) {
  if (typeof v === 'boolean') return v ? 'açık' : 'kapalı'
  if (v == null || v === '') return 'boş'
  const s = String(v).replace(/\s+/g, ' ')
  return typeof v === 'string' ? `"${s.length > 40 ? `${s.slice(0, 40)}…` : s}"` : s
}

function line(label: string, a: unknown, b: unknown) {
  const scalar = (v: unknown) => v == null || typeof v !== 'object'
  if (scalar(a) && scalar(b)) return `${label}: ${show(a)} → ${show(b)}`
  if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return `${label} (${a.length} → ${b.length} kayıt)`
  return label
}

/** One line per setting that differs, in the words the panel uses for it. Empty when nothing changed. */
export function describeChanges(before: HubConfig, after: HubConfig): string[] {
  const out: string[] = []
  const a = before as unknown as Record<string, unknown>
  const b = after as unknown as Record<string, unknown>
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key === 'groups' || same(a[key], b[key])) continue
    const left = a[key]
    const right = b[key]
    const nested = (v: unknown) => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
    if (!nested(left) || !nested(right)) {
      if (!SILENT.has(key)) out.push(line(TOP[key] ?? key, left, right))
      continue
    }
    const l = left as Record<string, unknown>
    const r = right as Record<string, unknown>
    for (const sub of new Set([...Object.keys(l), ...Object.keys(r)])) {
      const path = `${key}.${sub}`
      if (same(l[sub], r[sub]) || SILENT.has(path)) continue
      out.push(line(FIELD[path] ?? path, l[sub], r[sub]))
    }
  }
  const was = new Map(before.groups.map((g) => [g.chatId, g]))
  const now = new Map(after.groups.map((g) => [g.chatId, g]))
  for (const g of after.groups) {
    const old = was.get(g.chatId)
    if (!old) out.push(`Korunan listeye eklendi: ${g.title}`)
    else if (!same(old.rules ?? {}, g.rules ?? {})) {
      const own = Object.keys(g.rules ?? {}).length
      out.push(own ? `Gruba özel ayar: ${g.title} (${own} ayar genelden farklı)` : `Gruba özel ayar kaldırıldı: ${g.title}`)
    }
  }
  for (const g of before.groups) if (!now.has(g.chatId)) out.push(`Korunan listeden çıkarıldı: ${g.title}`)
  return out
}
