export type SupportSponsor = { name: string; chatId: string; title: string }

/** Shared by the guard and the panel text so the screen never promises a different number than the bot uses. */
export const CAPTCHA_MINUTES = 3
export const RAID_BAN_MINUTES = 10

/** How long a newcomer counts as "new" for per-type content rules when no quarantine is set. */
export const NEW_MEMBER_HOURS = 24
export const WAVE_MINUTES = 30

export type ContentKind = 'media' | 'sticker' | 'gif' | 'voice' | 'poll' | 'contact' | 'location' | 'viaBot'
export type ContentRule = 'allow' | 'new' | 'block'
export const CONTENT_KINDS: { key: ContentKind; label: string }[] = [
  { key: 'media', label: 'Fotoğraf, video, dosya' },
  { key: 'sticker', label: 'Çıkartma' },
  { key: 'gif', label: 'GIF' },
  { key: 'voice', label: 'Sesli / yuvarlak video mesaj' },
  { key: 'poll', label: 'Anket' },
  { key: 'contact', label: 'Kişi kartı' },
  { key: 'location', label: 'Konum' },
  { key: 'viaBot', label: 'Başka bot üzerinden mesaj (@gif dahil), oyun' },
]

export type ShieldConfig = {
  raidMode: boolean
  raidMinutes: number
  raidLock: boolean
  inviteLimit: number
  inviteLock: boolean
  commentShield: boolean
  commentRate: number
  commentLockMinutes: number
  quarantineHours: number
  content: Record<ContentKind, ContentRule>
  swarmAccounts: number
  hiddenAds: boolean
  nameWatch: boolean
  channelJoinAlert: number
  adminAlerts: boolean
}

export const GUARD_TUNABLES = [
  'warnLimit',
  'muteMinutes',
  'floodCount',
  'floodSeconds',
  'floodMuteMinutes',
  'repeatLimit',
  'linkAction',
  'blockForwards',
  'cleanService',
  'captcha',
  'raidJoins',
] as const
export const SHIELD_TUNABLES = [
  'raidMode',
  'raidMinutes',
  'raidLock',
  'inviteLimit',
  'inviteLock',
  'commentShield',
  'commentRate',
  'commentLockMinutes',
  'quarantineHours',
  'content',
  'swarmAccounts',
  'hiddenAds',
  'nameWatch',
] as const

export type HubGroup = { chatId: string; title: string; type?: string; linkedChatId?: string; rules?: Partial<GroupRules> }

export type HubConfig = {
  guardBotId: number | null
  supportBotId: number | null
  logChatId: string
  logChatTitle: string
  groups: HubGroup[]
  shield: ShieldConfig
  guard: {
    enabled: boolean
    words: string[]
    warnLimit: number
    muteMinutes: number[]
    floodCount: number
    floodSeconds: number
    floodMuteMinutes: number
    repeatLimit: number
    allowDomains: string[]
    linkAction: 'ban' | 'warn'
    blockForwards: boolean
    cleanService: boolean
    captcha: boolean
    casCheck: boolean
    impersonation: boolean
    raidJoins: number
    aiModeration: boolean
    rules: string
  }
  counter: { enabled: boolean; rewards: number[]; minLength: number; postToChatId: string }
  support: {
    enabled: boolean
    staffChatId: string
    staffChatTitle: string
    sponsors: SupportSponsor[]
    categories: string[]
    aiFaq: boolean
    welcome: string
  }
  report: { enabled: boolean }
  autoReply: {
    enabled: boolean
    cooldownSeconds: number
    siteUrl: string
    siteText: string
    sponsorText: string
    sponsorLimit: number
  }
}

/** The settings one group may set differently from the rest. */
export type GroupRules = Pick<HubConfig['guard'], (typeof GUARD_TUNABLES)[number]> & Pick<ShieldConfig, (typeof SHIELD_TUNABLES)[number]>

export function generalRules(hub: HubConfig): GroupRules {
  const out: Record<string, unknown> = {}
  for (const k of GUARD_TUNABLES) out[k] = hub.guard[k]
  for (const k of SHIELD_TUNABLES) out[k] = hub.shield[k]
  return out as GroupRules
}

export function rulesFor(hub: HubConfig, chatId: string | number): GroupRules {
  const own = hub.groups.find((g) => g.chatId === String(chatId))?.rules
  return own ? { ...generalRules(hub), ...own } : generalRules(hub)
}

/** Only the fields a group sets differently are stored, so a later change to the general value still reaches it. */
export function rulesDiff(base: GroupRules, own: GroupRules): Partial<GroupRules> {
  const out: Record<string, unknown> = {}
  for (const k of [...GUARD_TUNABLES, ...SHIELD_TUNABLES]) {
    if (JSON.stringify(base[k]) !== JSON.stringify(own[k])) out[k] = own[k]
  }
  return out as Partial<GroupRules>
}

/** Every new protection starts switched off, so a deploy never changes how a live group behaves on its own. */
const SHIELD_OFF: ShieldConfig = {
  raidMode: false,
  raidMinutes: 15,
  raidLock: true,
  inviteLimit: 0,
  inviteLock: true,
  commentShield: false,
  commentRate: 0,
  commentLockMinutes: 10,
  quarantineHours: 0,
  content: { media: 'allow', sticker: 'allow', gif: 'allow', voice: 'allow', poll: 'allow', contact: 'allow', location: 'allow', viaBot: 'allow' },
  swarmAccounts: 0,
  hiddenAds: false,
  nameWatch: false,
  channelJoinAlert: 0,
  adminAlerts: false,
}

export const RECOMMENDED_SHIELD: ShieldConfig = {
  raidMode: true,
  raidMinutes: 15,
  raidLock: true,
  inviteLimit: 5,
  inviteLock: true,
  commentShield: true,
  commentRate: 30,
  commentLockMinutes: 10,
  quarantineHours: 24,
  content: { media: 'new', sticker: 'allow', gif: 'allow', voice: 'new', poll: 'block', contact: 'block', location: 'block', viaBot: 'new' },
  swarmAccounts: 4,
  hiddenAds: true,
  nameWatch: true,
  channelJoinAlert: 50,
  adminAlerts: true,
}

export const DEFAULT_HUB: HubConfig = {
  guardBotId: null,
  supportBotId: null,
  logChatId: '',
  logChatTitle: '',
  groups: [],
  shield: SHIELD_OFF,
  guard: {
    enabled: false,
    words: ['amk', 'aq', 'orospu', 'piç', 'sik', 'yarrak', 'göt', 'ananı', 'pezevenk', 'kahpe', 'şerefsiz', 'gavat'],
    warnLimit: 3,
    muteMinutes: [60, 1440],
    floodCount: 5,
    floodSeconds: 10,
    floodMuteMinutes: 30,
    repeatLimit: 3,
    allowDomains: ['alkanka.com', 't.me/alkanka'],
    linkAction: 'ban',
    blockForwards: true,
    cleanService: true,
    captcha: true,
    casCheck: true,
    impersonation: true,
    raidJoins: 20,
    aiModeration: false,
    rules: '1. Küfür, hakaret yasak.\n2. Reklam ve yabancı link yasak.\n3. Spam ve flood yasak.\n4. Yöneticiler asla özelden ödül için yazmaz.',
  },
  counter: { enabled: true, rewards: [500, 300, 150], minLength: 3, postToChatId: '' },
  support: {
    enabled: false,
    staffChatId: '',
    staffChatTitle: '',
    sponsors: [],
    categories: ['Yatırım', 'Çekim', 'Bonus', 'Hesap', 'Diğer'],
    aiFaq: true,
    welcome: 'Merhaba! Alkanka Destek’e hoş geldin. Sorununu hızlıca çözmek için birkaç soru soracağım.',
  },
  report: { enabled: true },
  autoReply: {
    enabled: true,
    cooldownSeconds: 120,
    siteUrl: '',
    siteText: 'Güncel Alkanka adresimiz aşağıda. Butona basman yeterli, eski linkleri kullanma.',
    sponsorText: 'Güvenilir sponsorlarımız aşağıda. Alkanka üzerinden girersen bonusların ve görevlerin hesabına işlenir.',
    sponsorLimit: 8,
  },
}

export type HubStats = {
  deletedWeek: number
  mutedWeek: number
  bannedWeek: number
  joinsBlockedWeek: number
  openTickets: number
  resolvedWeek: number
  avgResolveMin: number | null
  globalBans: number
}

export type HubLogRow = {
  id: number
  action: string
  chatId: string | null
  chatTitle: string
  tgId: number | null
  who: string
  reason: string
  createdAt: string
  canUndo: boolean
}

/** The guard writes log actions as free text; a kind is the set of openings those texts start with. */
export const LOG_KINDS = [
  { key: 'delete', label: 'Silinen mesaj', prefixes: ['Mesaj silindi', 'Toplu silme', 'Koordineli spam', 'Site mesajı engellendi'] },
  { key: 'mute', label: 'Susturma', prefixes: ['Susturuldu'] },
  { key: 'ban', label: 'Ban', prefixes: ['Banlandı'] },
  { key: 'join', label: 'Giriş ve baskın', prefixes: ['Giriş', 'Baskın', 'Doğrulanmadı', 'Grup kili', 'Kilit', 'Kanala toplu giriş', 'Şüpheli isim', 'Yorumlar kapatıldı'] },
  { key: 'admin', label: 'Bot ve yönetici', prefixes: ['Bekçi', 'Yeni yönetici', 'Yönetici çıkarıldı'] },
  { key: 'cleanup', label: 'Temizlik', prefixes: ['Tüm sohbet', 'Silinmiş hesap'] },
  { key: 'support', label: 'Destek', prefixes: ['Destek', 'Bilet'] },
  { key: 'undo', label: 'Geri alma', prefixes: ['Geri alındı', 'Susturma kaldırıldı', 'Uyarılar sıfırlandı', 'Yasak kaldırıldı'] },
] as const

export type LogKind = (typeof LOG_KINDS)[number]['key'] | 'other'

export function logKindOf(action: string): LogKind {
  return LOG_KINDS.find((k) => k.prefixes.some((p) => action.startsWith(p)))?.key ?? 'other'
}

/** Days are `YYYY-AA-GG` in Istanbul time; both ends are included. */
export type LogFilter = { kind?: string; chatId?: string; tgId?: number; q?: string; from?: string; to?: string }

export type LogPage = { rows: HubLogRow[]; hasMore: boolean }

export const LOG_PAGE = 50

export type MemberAction = 'ban' | 'mute' | 'unmute' | 'wipe' | 'clearWarns'

export type MemberCard = {
  tgId: number
  name: string
  username: string | null
  /** False when no table has ever seen this account. */
  known: boolean
  trust: { score: number; trusted: boolean; firstSeen: string | null; needsCheck: boolean }
  warns: number
  ban: { reason: string; at: string } | null
  messages: { total: number; lastAt: string | null; chats: { title: string; count: number }[] }
  joins: { title: string; at: string; via: string | null; removed: boolean }[]
  site: { userId: string; name: string; email: string | null; linkedAt: string } | null
  log: HubLogRow[]
}

/** A chat the panel already knows by name, offered in pickers so nobody has to type a -100… id. */
export type KnownChat = { chatId: string; title: string }

/** First name wins; entries without an id (a role that was never set up) are dropped. */
export function uniqueChats(list: Array<{ chatId?: string | null; title?: string | null }>): KnownChat[] {
  const seen = new Map<string, string>()
  for (const c of list) {
    const id = String(c.chatId ?? '').trim()
    if (id && !seen.has(id)) seen.set(id, String(c.title ?? '').trim() || id)
  }
  return [...seen.entries()].map(([chatId, title]) => ({ chatId, title }))
}

export type SuspectRow = { tgId: number; name: string; username: string | null; msgs: number; joinedAt: string | null; reasons: string[] }

export type LockRow = {
  chatId: string
  title: string
  kind: 'raid' | 'manual'
  locked: boolean
  until: string | null
  startedAt: string
  reason: string
  turnedAway: number
}

export type TicketRow = {
  id: number
  name: string
  username: string | null
  sponsor: string
  category: string
  text: string
  status: 'open' | 'claimed' | 'resolved' | 'rejected'
  answer: string | null
  rating: number | null
  createdAt: string
  closedAt: string | null
}

export type SponsorSupportStat = { sponsor: string; total: number; resolved: number; rejected: number; avgMin: number | null; rating: number | null }

export type LeaderRow = { key: string; name: string; count: number }

export type BroadcastRow = { id: number; text: string; status: string; sent: number; failed: number; blocked: number; total: number; createdAt: string }
