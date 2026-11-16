export type SupportSponsor = { name: string; chatId: string; title: string }

/** Shared by the guard and the panel text so the screen never promises a different number than the bot uses. */
export const CAPTCHA_MINUTES = 3
export const RAID_BAN_MINUTES = 10

/** How long a newcomer counts as "new" for per-type content rules when no quarantine is set. */
export const NEW_MEMBER_HOURS = 24
export const WAVE_MINUTES = 30

/** How a newcomer proves they are a person. `dm` asks in private before the join request is approved. */
export type CaptchaMode = 'button' | 'emoji' | 'dm'
export const CAPTCHA_MODES: { value: CaptchaMode; label: string; hint: string }[] = [
  { value: 'button', label: 'Tek buton ("Ben insanım")', hint: 'Yeni gelen, gruba atılan butona basar. En kolayı; butona basabilen botları durdurmaz.' },
  {
    value: 'emoji',
    label: 'Üç emojiden doğru olanı seç',
    hint: 'Gruba üç emojili bir soru atılır ("elma olanı seç"). İki kez yanlış seçen gruptan çıkarılır, yeniden katılıp tekrar deneyebilir.',
  },
  {
    value: 'dm',
    label: 'Katılma isteği + özelden doğrulama',
    hint: 'Emojili soru, kişi gruba alınmadan önce özelden sorulur. Doğru seçen içeri alınır; cevap vermeyenin ya da iki kez yanlış seçenin isteği reddedilir. Çalışması için Telegram’da grubun ayarlarından "Yeni üyeleri onayla" açık olmalı ya da davet linki yönetici onaylı oluşturulmalı; bunu bot açamaz. Onay kapalıysa gelenler doğrudan girer ve soru grupta sorulur.',
  },
]
/** A second wrong emoji ends the attempt. */
export const CAPTCHA_TRIES = 2

/** Clock times are Turkey time, `SS:DD`. A window whose end is earlier than its start runs past midnight. */
export type QuietConfig = { enabled: boolean; from: string; to: string; mode: 'lock' | 'text'; announce: boolean }

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/
const TR_OFFSET_MS = 3 * 60 * 60 * 1000

export function clockMinutes(value: string) {
  const m = CLOCK.exec(String(value ?? '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export function inQuietHours(q: QuietConfig | undefined, now = Date.now()) {
  if (!q?.enabled) return false
  const from = clockMinutes(q.from)
  const to = clockMinutes(q.to)
  if (from == null || to == null || from === to) return false
  const d = new Date(now + TR_OFFSET_MS)
  const t = d.getUTCHours() * 60 + d.getUTCMinutes()
  return from < to ? t >= from && t < to : t >= from || t < to
}

export type ReplyButton = { text: string; url: string }
export type ReplyRule = { id: string; enabled: boolean; words: string[]; text: string; buttons: ReplyButton[] }
export type WelcomeConfig = { enabled: boolean; text: string; buttons: ReplyButton[]; deleteMinutes: number }
export type CannedReply = { title: string; text: string }

export const REPLY_RULE_MAX = 30
export const REPLY_WORD_MAX = 10
export const REPLY_BUTTON_MAX = 4
export const CANNED_MAX = 20

/** Empty rows are dropped; the first row that is half filled or has a bad link is reported instead of being silently lost. */
export function readReplyButtons(raw: unknown, max: number): { buttons: ReplyButton[]; problem: string | null } {
  const buttons: ReplyButton[] = []
  let problem: string | null = null
  for (const item of Array.isArray(raw) ? raw : []) {
    const text = String((item as Partial<ReplyButton> | null)?.text ?? '').trim().slice(0, 40)
    const url = String((item as Partial<ReplyButton> | null)?.url ?? '').trim().slice(0, 300)
    if (!text && !url) continue
    if (!text) problem ??= 'Linki yazılmış bir butonun yazısı boş.'
    else if (!/^https:\/\/\S+$/i.test(url)) problem ??= `"${text}" butonunun linki https:// ile başlamalı.`
    else if (buttons.length >= max) problem ??= `En fazla ${max} buton eklenebilir.`
    else buttons.push({ text, url })
  }
  return { buttons, problem }
}

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
  quiet: QuietConfig
  channelJoinAlert: number
  adminAlerts: boolean
  /** Reactions one account may add in a minute before it is muted; 0 means reactions are not listened to at all. */
  reactionLimit: number
  healthAlert: boolean
  memberDropPercent: number
}

/** A drop smaller than this many members never raises the alarm, whatever the percentage says. */
export const MEMBER_DROP_FLOOR = 20

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
  'captchaMode',
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
  'quiet',
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
    captchaMode: CaptchaMode
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
    canned: CannedReply[]
    /** Minutes an unclaimed ticket may wait before the staff group is reminded; 0 switches the reminder off. */
    alertMinutes: number
  }
  report: { enabled: boolean }
  autoReply: {
    enabled: boolean
    cooldownSeconds: number
    siteUrl: string
    siteText: string
    sponsorText: string
    sponsorLimit: number
    rules: ReplyRule[]
    welcome: WelcomeConfig
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

const QUIET_OFF: QuietConfig = { enabled: false, from: '01:00', to: '08:00', mode: 'lock', announce: true }

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
  quiet: QUIET_OFF,
  channelJoinAlert: 0,
  adminAlerts: false,
  reactionLimit: 0,
  healthAlert: false,
  memberDropPercent: 10,
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
  // Closing a group every night is a choice about the community, not a safety default, so it is never pre-filled.
  quiet: QUIET_OFF,
  channelJoinAlert: 50,
  adminAlerts: true,
  // Every reaction would become a webhook call, so listening to them stays a deliberate choice.
  reactionLimit: 0,
  healthAlert: true,
  memberDropPercent: 10,
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
    captchaMode: 'button',
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
    canned: [],
    alertMinutes: 0,
  },
  report: { enabled: true },
  autoReply: {
    enabled: true,
    cooldownSeconds: 120,
    siteUrl: '',
    siteText: 'Güncel Alkanka adresimiz aşağıda. Butona basman yeterli, eski linkleri kullanma.',
    sponsorText: 'Güvenilir sponsorlarımız aşağıda. Alkanka üzerinden girersen bonusların ve görevlerin hesabına işlenir.',
    sponsorLimit: 8,
    rules: [],
    welcome: { enabled: false, text: 'Hoş geldin {isim}! Kuralları görmek için /kurallar yazabilirsin.', buttons: [], deleteMinutes: 5 },
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
  { key: 'join', label: 'Giriş ve baskın', prefixes: ['Giriş', 'Baskın', 'Doğrulanmadı', 'Grup kili', 'Kilit', 'Sessiz saat', 'Kanala toplu giriş', 'Şüpheli isim', 'Yorumlar kapatıldı'] },
  {
    key: 'admin',
    label: 'Bot ve yönetici',
    prefixes: ['Bekçi', 'Yeni yönetici', 'Yönetici çıkarıldı', 'Sohbete erişilemiyor', 'Üye sayısı düştü', 'Kanal adresi', 'Davet linki', 'Ayarlar'],
  },
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
  claimedBy: string | null
  /** Whole minutes since the ticket was opened, counted on the server so the screen needs no clock of its own. */
  waitMin: number
}

export const TICKET_PAGE = 30
export type TicketPage = { rows: TicketRow[]; hasMore: boolean }

/** A group that is inside its quiet hours right now. */
export type QuietRow = { chatId: string; title: string; mode: 'lock' | 'text'; since: string; stuck: boolean }

export type SponsorSupportStat = { sponsor: string; total: number; resolved: number; rejected: number; avgMin: number | null; rating: number | null }

export type LeaderRow = { key: string; name: string; count: number }

export type DmAudience = 'all' | 'linked7' | 'chat7' | 'site7' | 'away30'
export const DM_AUDIENCES: { value: DmAudience; label: string; hint: string }[] = [
  { value: 'all', label: 'Herkes', hint: 'Telegram hesabını siteye bağlamış ve duyuruları kapatmamış tüm üyeler.' },
  { value: 'linked7', label: 'Yeni bağlananlar', hint: 'Telegram hesabını son 7 günde bağlayanlar.' },
  { value: 'chat7', label: 'Grupta yazanlar', hint: 'Son 7 günde korunan gruplardan birinde mesaj yazanlar.' },
  { value: 'site7', label: 'Sitede aktif olanlar', hint: 'Son 7 günde siteye giriş yapmış ya da oturumu açık olanlar.' },
  { value: 'away30', label: 'Uzak kalanlar', hint: '30 gündür siteye girmeyenler.' },
]

export const DM_TEXT_MAX = 3500
/** Telegram's limit for the text under a photo. */
export const DM_CAPTION_MAX = 1024
export const DM_BUTTON_MAX = 6
export const DM_SCHEDULE_MAX_DAYS = 60

/** `sendAt` is `YYYY-AA-GGTSS:DD` in Turkey time, or null to send now. */
export type DmDraft = { text: string; photoPath: string | null; buttons: ReplyButton[]; audience: DmAudience; sendAt: string | null }

export type BroadcastRow = {
  id: number
  text: string
  status: string
  sent: number
  failed: number
  blocked: number
  total: number
  createdAt: string
  sendAt: string | null
  finishedAt: string | null
  audience: DmAudience
  photoPath: string | null
  buttons: ReplyButton[]
  author: string | null
  note: string | null
}

export type DmPanelData = {
  broadcasts: BroadcastRow[]
  audiences: Record<DmAudience, number>
  testChat: string
  /** False when the live chat bot, which sends the announcements, is not connected. */
  botReady: boolean
}
