export type SupportSponsor = { name: string; chatId: string; title: string }

export type HubConfig = {
  guardBotId: number | null
  supportBotId: number | null
  logChatId: string
  logChatTitle: string
  groups: { chatId: string; title: string }[]
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

export const DEFAULT_HUB: HubConfig = {
  guardBotId: null,
  supportBotId: null,
  logChatId: '',
  logChatTitle: '',
  groups: [],
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

export type HubLogRow = { id: number; action: string; chatTitle: string; who: string; reason: string; createdAt: string }

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

export type BroadcastRow = { id: number; text: string; status: string; sent: number; failed: number; total: number; createdAt: string }
