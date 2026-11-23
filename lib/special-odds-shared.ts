import type { PostButton } from '@/lib/tg-buttons'

export type OddStatus = 'open' | 'filled' | 'expired'

/** Which posts of a source channel are shared to our channel. */
export type OddsPassMode = 'odds' | 'keyword' | 'all'

export const ODDS_PASS_OPTIONS: { value: OddsPassMode; label: string; hint: string }[] = [
  { value: 'odds', label: 'Sadece oran içerenler', hint: 'Maçı ve oranı okunamayan post paylaşılmaz, "atlandı" diye kayda düşer.' },
  { value: 'keyword', label: 'Anahtar kelime geçenler', hint: 'Yazdığın kelimelerden biri geçen her post paylaşılır, oran olmasa da.' },
  { value: 'all', label: 'Hepsi', hint: 'Kanaldaki her post paylaşılır. Duyuru ve reklam postları da gider.' },
]

export const toOddsPassMode = (v: unknown): OddsPassMode => (v === 'keyword' || v === 'all' ? v : 'odds')

/** What happens to a post whose photo, video or album could not be carried over. */
export type OddsMediaFallback = 'text' | 'hold'
export const toMediaFallback = (v: unknown): OddsMediaFallback => (v === 'hold' ? 'hold' : 'text')

export type OddsQueueState = 'skipped' | 'held' | 'sent'

export type OddsQueueItem = {
  id: number
  sourceId: number | null
  siteName: string
  state: OddsQueueState
  reason: string
  text: string
  hasMedia: boolean
  at: string
}
export type OddResult = 'won' | 'lost' | 'void'

export type SpecialOdd = {
  id: number
  sourceId: number | null
  siteName: string
  siteLogo: string | null
  tag: OddsTag
  tagText: string
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

/** `pending` keeps only closed odds that still have no result. */
export type OddsFilter = { q?: string; pending?: boolean }
export type OddsPage = { rows: SpecialOdd[]; hasMore: boolean }

export const ODDS_PAGE = 30
/** The panel list grows a page at a time up to this many rows; older odds are reached by searching. */
export const ODDS_MAX = 300

export type OddsSource = {
  id: number
  chatId: string
  title: string
  siteName: string
  siteLink: string
  siteLogo: string | null
  replacements: string
  footer: string
  tag: OddsTag
  tagText: string
  passMode: OddsPassMode
  passWords: string
  buttons: PostButton[]
  /** Also carry the source post's own buttons, with their links passed through the rules. */
  carryButtons: boolean
  active: boolean
  lastAt: string | null
  total: number
  webError: string | null
}

export type OddsTag = 'sponsor' | 'trusted' | 'none'

export const ODDS_TAG_OPTIONS: { value: OddsTag; label: string; defaultText: string }[] = [
  { value: 'sponsor', label: 'Sponsorumuz', defaultText: 'SPONSORUMUZ' },
  { value: 'trusted', label: 'Sponsor dışı · Güvenilir site', defaultText: 'SPONSOR DIŞI · GÜVENİLİR SİTE' },
  { value: 'none', label: 'Etiket yok', defaultText: '' },
]

export const toOddsTag = (v: unknown): OddsTag => (v === 'sponsor' || v === 'trusted' ? v : 'none')

/** Text shown on the post and on the site card; a custom text overrides the preset. */
export function oddsTagText(tag: OddsTag, custom: string) {
  if (tag === 'none') return ''
  return custom.trim() || ODDS_TAG_OPTIONS.find((o) => o.value === tag)!.defaultText
}

/** The tag as a quiet line under the post's headline: the preset in sentence case, a custom text as typed. */
export function oddsTagLine(tag: OddsTag, custom: string) {
  if (tag === 'none') return ''
  return custom.trim() || ODDS_TAG_OPTIONS.find((o) => o.value === tag)!.label
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
  mediaFallback: OddsMediaFallback
}

export type OddsBotStatus = {
  /** Posts waiting in the panel because their media could not be carried over. */
  held: number
  webhookUrl: string | null
  pending: number
  lastError: string | null
  lastUpdateAt: string | null
  todayTotal: number
  /** Set when the bot can no longer post to our channel (removed, demoted, posting right off). */
  channelError: string | null
  /** Last failed attempt to publish an odd to our channel. Cleared by the next successful post. */
  publishError: { at: string; message: string } | null
  activeSources: number
}

export const EMPTY_ODDS_STATUS: OddsBotStatus = {
  held: 0,
  webhookUrl: null,
  pending: 0,
  lastError: null,
  lastUpdateAt: null,
  todayTotal: 0,
  channelError: null,
  publishError: null,
  activeSources: 0,
}

export type OddsPreview = {
  kind: 'odds' | 'filled' | 'won' | 'lost' | 'void' | 'ignore'
  odds: { match: string; market: string; oldOdd: number | null; newOdd: number }[]
  rewritten: string
  /** Whether the source's rule lets this post through. Null for "limit doldu" and result posts. */
  verdict: 'send' | 'skip' | null
  reason: string
}

// "1.85" or "2,10" standing alone: not part of "1.500", not money ("500,00 TL", "₺99,90") and not a percentage.
const ODD_NUMBER = /(?<![\d.,₺$€%])\d{1,3}[.,]\d{2}(?![\d.,])(?!\s*(?:tl\b|try\b|usd\b|eur\b|bin\b|lira|₺|\$|€|%))/iu

export const hasOddNumber = (text: string) => ODD_NUMBER.test(text)

/** The first number written like an odd ("2,10"), or null. */
export function firstOddNumber(text: string) {
  const found = text.match(ODD_NUMBER)?.[0]
  return found ? Number(found.replace(',', '.')) : null
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
  mediaFallback: 'text',
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
