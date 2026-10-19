export type OddStatus = 'open' | 'filled' | 'expired'
export type OddResult = 'won' | 'lost' | 'void'

export type SpecialOdd = {
  id: number
  sourceId: number | null
  siteName: string
  siteLogo: string | null
  link: string
  match: string
  league: string
  market: string
  oldOdd: number | null
  newOdd: number | null
  kickoff: string
  limit: string
  openedAt: string
  filledAt: string | null
  status: OddStatus
  result: OddResult | null
}

export type OddsDayStats = { total: number; open: number; won: number; lost: number; avgFillMinutes: number | null }

export type OddsSource = {
  id: number
  chatId: string
  title: string
  siteName: string
  siteLink: string
  siteLogo: string | null
  active: boolean
  lastAt: string | null
  total: number
}

export type OddsBotConfig = {
  enabled: boolean
  botId: number | null
  channelId: string
  channelTitle: string
  channelUsername: string
  footer: string
  filledWords: string
  wonWords: string
  lostWords: string
  voidWords: string
  expireMinutes: number
  filledText: string
  wonText: string
  lostText: string
  postResults: boolean
}

export type OddsBotStatus = {
  webhookUrl: string | null
  pending: number
  lastError: string | null
  lastUpdateAt: string | null
  todayTotal: number
}

export type OddsPreview = {
  kind: 'odds' | 'filled' | 'won' | 'lost' | 'void' | 'ignore'
  odds: { match: string; market: string; oldOdd: number | null; newOdd: number }[]
  rewritten: string
}

export const DEFAULT_ODDS_BOT: OddsBotConfig = {
  enabled: false,
  botId: null,
  channelId: '',
  channelTitle: '',
  channelUsername: '',
  footer: 'Tüm özel oranlar: alkanka.com/ozel-oranlar',
  filledWords: 'limit doldu, limiti doldu, kapandı, tükendi, sona erdi',
  wonWords: 'kazandı, kazanan, tuttu, ✅',
  lostWords: 'kaybetti, kaybeden, yattı, tutmadı, ❌',
  voidWords: 'iade, iptal, ertelendi',
  expireMinutes: 60,
  filledText: 'LİMİT DOLDU. Bir sonraki oranı kaçırma.',
  wonText: 'KAZANDI',
  lostText: 'Kaybetti',
  postResults: true,
}

export const ODD_RESULT_LABELS: Record<OddResult, string> = { won: 'Kazandı', lost: 'Kaybetti', void: 'İade' }

export function splitWords(list: string) {
  return list
    .split(',')
    .map((w) => w.trim().toLocaleLowerCase('tr'))
    .filter(Boolean)
}

/** YYYY-MM-DD in Istanbul time. */
export function istanbulDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

export const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

export function fillMinutes(odd: Pick<SpecialOdd, 'openedAt' | 'filledAt'>) {
  if (!odd.filledAt) return null
  return Math.max(1, Math.round((Date.parse(odd.filledAt) - Date.parse(odd.openedAt)) / 60000))
}
