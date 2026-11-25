/** Rewards a campaign can multiply. Admin, badge and prize payouts are never boosted. */
export type BoostSource = 'sure' | 'gorev' | 'giris' | 'online' | 'kankatv' | 'seri' | 'arena' | 'tahmin' | 'mini'

export const BOOST_SOURCES: { id: BoostSource; label: string; short: string }[] = [
  { id: 'sure', label: 'Sitede geçen dakika puanı', short: 'Dakika puanı' },
  { id: 'gorev', label: 'Görev ödülü', short: 'Görev' },
  { id: 'giris', label: 'Günlük giriş ödülü', short: 'Günlük giriş' },
  { id: 'online', label: 'Online kalma ödülü', short: 'Online ödülü' },
  { id: 'seri', label: 'Seri bonusu (7, 14, 30 gün)', short: 'Seri bonusu' },
  { id: 'kankatv', label: 'KankaTV izleme, devre arası ve gol sandığı', short: 'KankaTV' },
  { id: 'tahmin', label: 'Tahmin ödülü', short: 'Tahmin ödülü' },
  { id: 'arena', label: 'Oyunda kazanılan kâr: bota karşı maç ve coinli masa (Blackjack ve Rulet hariç)', short: 'Oyun kazancı' },
  { id: 'mini', label: 'Çark, zar ve sandık ödülü', short: 'Çark, zar, sandık' },
]

/** What the old fixed "Mutlu Saatler" box multiplied. */
export const HAPPY_SOURCES: BoostSource[] = ['sure', 'gorev', 'giris', 'online', 'kankatv', 'seri']

export type CampaignKind = 'carpan' | 'indirim' | 'rozet' | 'sponsor'

export const CAMPAIGN_KINDS: { id: CampaignKind; label: string; hint: string }[] = [
  { id: 'carpan', label: 'Kazanç çarpanı', hint: 'Seçtiğin kazanç türleri kampanya süresince çarpanla ödenir.' },
  { id: 'indirim', label: 'Market indirimi (herkese)', hint: 'Alkanka ürünlerinde herkese yüzde indirim.' },
  { id: 'rozet', label: 'Market indirimi (rozet sahiplerine)', hint: 'Sadece seçtiğin rozetin sahiplerine yüzde indirim.' },
  { id: 'sponsor', label: 'Sponsor duyurusu', hint: 'Sitenin üstündeki şeritte geri sayımlı duyuru çıkar; ödeme hesabını değiştirmez.' },
]

/**
 * When a campaign runs. Hours and days are Istanbul time.
 * - saat: on the listed weekdays (none listed means every day) between two hours; the end may pass midnight.
 * - hafta: every week from one weekday and hour to another, for windows longer than a day.
 * - tarih: once, between two moments. Without an end it never runs.
 */
export type CampaignWhen =
  | { type: 'saat'; days: number[]; start: number; end: number }
  | { type: 'hafta'; fromDay: number; fromHour: number; toDay: number; toHour: number }
  | { type: 'tarih'; from: string | null; until: string | null }

export type Campaign = {
  id: string
  name: string
  on: boolean
  kind: CampaignKind
  sources: BoostSource[]
  mult: number
  pct: number
  badgeId: string
  siteId: string
  /** Line under the name in the site strip. Blank falls back to a sentence built from the settings. */
  text: string
  when: CampaignWhen
}

export type BoostConfig = {
  campaigns: Campaign[]
  comeback: { on: boolean; days: number; coin: number }
  birthday: { on: boolean; coin: number }
  streak14: number
  shieldPrice: number
  bestBonus: { on: boolean; siteId: string; title: string; text: string; kp: number }
  cashback: { siteId: string; weekday: number; text: string }[]
  loyaltyDays: number
}

/** The six fixed boxes this list replaced. Their stored values are left untouched, so an older build still reads them. */
export const LEGACY_BOOST_KEYS = ['happyHour', 'weekend', 'derby', 'flash', 'badgeDay', 'sponsorWeek'] as const

type LegacyBoosts = {
  happyHour?: { on?: boolean; start?: number; end?: number; mult?: number }
  weekend?: { on?: boolean; mult?: number }
  derby?: { until?: string | null; title?: string; mult?: number }
  flash?: { until?: string | null; pct?: number }
  badgeDay?: { day?: string | null; badgeId?: string; pct?: number }
  sponsorWeek?: { until?: string | null; siteId?: string; text?: string }
}

export const MAX_CAMPAIGNS = 30
export const MAX_TOTAL_MULT = 10

export const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

export type ActiveBoost = { id: string; kind: CampaignKind; label: string; detail: string; endsAt: string }

const HOUR = 3_600_000
/** Turkey is UTC+3 all year, so shifting by three hours gives Istanbul wall-clock fields via getUTC*. */
const trClock = (now: number) => new Date(now + 3 * HOUR)
const fromTr = (d: Date) => new Date(d.getTime() - 3 * HOUR).toISOString()

export function trDayOf(now = Date.now()) {
  return trClock(now).toISOString().slice(0, 10)
}

/** End of the window the campaign is in right now, or null when it is not running. */
export function campaignWindow(when: CampaignWhen, now = Date.now()): string | null {
  const t = trClock(now)
  const day = t.getUTCDay()
  const hour = t.getUTCHours()
  if (when.type === 'saat') {
    const { start, end, days } = when
    if (start === end) return null
    const runs = (d: number) => !days.length || days.includes(d)
    const sameDay = start < end ? hour >= start && hour < end && runs(day) : hour >= start && runs(day)
    const fromYesterday = start > end && hour < end && runs((day + 6) % 7)
    if (!sameDay && !fromYesterday) return null
    const e = new Date(t)
    e.setUTCHours(end, 0, 0, 0)
    if (e <= t) e.setUTCDate(e.getUTCDate() + 1)
    return fromTr(e)
  }
  if (when.type === 'hafta') {
    const from = when.fromDay * 24 + when.fromHour
    const to = when.toDay * 24 + when.toHour
    const at = day * 24 + hour
    if (from === to) return null
    if (from < to ? at < from || at >= to : at < from && at >= to) return null
    const e = new Date(t)
    e.setUTCMinutes(0, 0, 0)
    e.setUTCHours(e.getUTCHours() + ((to - at + 168) % 168))
    return fromTr(e)
  }
  if (!when.until || Date.parse(when.until) <= now) return null
  if (when.from && Date.parse(when.from) > now) return null
  return when.until
}

/** Why a campaign that is switched on can never run, or null when it is complete. */
export function campaignGap(c: Campaign): string | null {
  if (c.kind === 'carpan' && !c.sources.length) return 'Kazanç türü seçilmedi'
  if (c.kind === 'carpan' && c.mult <= 1) return 'Çarpan 1: kazancı değiştirmez'
  if (c.kind === 'rozet' && !c.badgeId) return 'Rozet seçilmedi'
  if (c.kind === 'sponsor' && !c.siteId) return 'Sponsor seçilmedi'
  if (c.when.type === 'tarih' && !c.when.until) return 'Bitiş tarihi girilmedi'
  if (c.when.type === 'saat' && c.when.start === c.when.end) return 'Başlangıç ve bitiş saati aynı'
  if (c.when.type === 'hafta' && c.when.fromDay === c.when.toDay && c.when.fromHour === c.when.toHour) return 'Başlangıç ve bitiş aynı'
  return null
}

const sourceShort = (id: BoostSource) => BOOST_SOURCES.find((s) => s.id === id)?.short ?? id

export function campaignDetail(c: Campaign): string {
  if (c.kind === 'carpan') {
    const all = HAPPY_SOURCES.every((s) => c.sources.includes(s))
    const what = c.text || (all && c.sources.length === BOOST_SOURCES.length ? 'Tüm kazançlar' : c.sources.map(sourceShort).join(', '))
    return `${what} x${c.mult}`
  }
  if (c.kind === 'indirim') return `${c.text || 'Tüm Alkanka ürünlerinde'} %${c.pct} indirim`
  if (c.kind === 'rozet') return `${c.text || 'Rozet sahiplerine markette'} %${c.pct} indirim`
  return c.text || 'Bu hafta sponsor görevleri ekstra ödüllü'
}

/** Campaigns running right now, each with the moment its current window ends. */
export function runningCampaigns(cfg: BoostConfig, now = Date.now()): { campaign: Campaign; endsAt: string }[] {
  const out: { campaign: Campaign; endsAt: string }[] = []
  for (const campaign of cfg.campaigns) {
    if (!campaign.on || campaignGap(campaign)) continue
    const endsAt = campaignWindow(campaign.when, now)
    if (endsAt) out.push({ campaign, endsAt })
  }
  return out
}

export function activeBoosts(cfg: BoostConfig, now = Date.now()): ActiveBoost[] {
  return runningCampaigns(cfg, now).map(({ campaign, endsAt }) => ({
    id: campaign.id,
    kind: campaign.kind,
    label: campaign.name,
    detail: campaignDetail(campaign),
    endsAt,
  }))
}

/** Multiplier for one reward source right now. Campaigns that cover the same source multiply each other, up to MAX_TOTAL_MULT. */
export function boostFor(cfg: BoostConfig, source: BoostSource, now = Date.now()) {
  let mult = 1
  for (const { campaign } of runningCampaigns(cfg, now)) {
    if (campaign.kind === 'carpan' && campaign.sources.includes(source)) mult *= campaign.mult
  }
  return Math.max(1, Math.min(mult, MAX_TOTAL_MULT))
}

export const applyMult = (amount: number, mult: number) => (amount > 0 ? Math.round(amount * mult) : amount)

const num = (v: unknown, d: number, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}
const whole = (v: unknown, d: number, min: number, max: number) => Math.trunc(num(v, d, min, max))
const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)
const iso = (v: unknown) => {
  const s = str(v, 40)
  return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null
}

function cleanWhen(input: unknown): CampaignWhen {
  const w = (input ?? {}) as Record<string, unknown>
  if (w.type === 'saat') {
    const days = [...new Set((Array.isArray(w.days) ? w.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    return { type: 'saat', days, start: whole(w.start, 20, 0, 23), end: whole(w.end, 22, 0, 23) }
  }
  if (w.type === 'hafta') {
    return { type: 'hafta', fromDay: whole(w.fromDay, 5, 0, 6), fromHour: whole(w.fromHour, 18, 0, 23), toDay: whole(w.toDay, 1, 0, 6), toHour: whole(w.toHour, 0, 0, 23) }
  }
  return { type: 'tarih', from: iso(w.from), until: iso(w.until) }
}

function cleanCampaign(input: unknown, index: number): Campaign {
  const c = (input ?? {}) as Partial<Campaign>
  const kind = CAMPAIGN_KINDS.some((k) => k.id === c.kind) ? (c.kind as CampaignKind) : 'carpan'
  const sources = BOOST_SOURCES.map((s) => s.id).filter((id) => Array.isArray(c.sources) && c.sources.includes(id))
  return {
    id: str(c.id, 40).replace(/[^a-zA-Z0-9_-]/g, '') || `k${index + 1}`,
    name: str(c.name, 60) || 'Kampanya',
    on: Boolean(c.on),
    kind,
    sources,
    mult: num(c.mult, 2, 1, 5),
    pct: whole(c.pct, 20, 1, 90),
    badgeId: str(c.badgeId, 60),
    siteId: str(c.siteId, 60),
    text: str(c.text, 160),
    when: cleanWhen(c.when),
  }
}

/** The six fixed boxes as list rows, with the values they had. Used once: after the first save the list itself is stored. */
export function legacyCampaigns(input: LegacyBoosts): Campaign[] {
  const blank = { sources: [] as BoostSource[], mult: 2, pct: 20, badgeId: '', siteId: '', text: '' }
  const day = /^\d{4}-\d{2}-\d{2}$/.test(str(input.badgeDay?.day)) ? str(input.badgeDay?.day) : null
  const dayStart = day ? new Date(`${day}T00:00:00+03:00`) : null
  return [
    {
      // The strip promised "every earning", so the campaign covers every source a multiplier can reach.
      ...blank, id: 'happy', name: 'Mutlu Saatler', on: input.happyHour?.on ?? true, kind: 'carpan', sources: BOOST_SOURCES.map((s) => s.id),
      mult: num(input.happyHour?.mult, 2, 1, 5), text: 'Görev, giriş, oyun ve çark kazançları',
      when: { type: 'saat', days: [], start: whole(input.happyHour?.start, 20, 0, 23), end: whole(input.happyHour?.end, 22, 0, 23) },
    },
    {
      ...blank, id: 'weekend', name: 'Hafta Sonu Festivali', on: input.weekend?.on ?? true, kind: 'carpan', sources: ['arena'],
      mult: num(input.weekend?.mult, 1.5, 1, 3), text: 'Oyun kazançları',
      when: { type: 'hafta', fromDay: 5, fromHour: 18, toDay: 1, toHour: 0 },
    },
    {
      ...blank, id: 'derby', name: str(input.derby?.title, 60) || 'Derbi Gecesi', on: true, kind: 'carpan', sources: ['tahmin', 'kankatv'],
      mult: num(input.derby?.mult, 3, 1, 5), text: 'Tahmin ödülleri ve KankaTV izleme',
      when: { type: 'tarih', from: null, until: iso(input.derby?.until) },
    },
    {
      ...blank, id: 'flash', name: 'Market Flash İndirimi', on: true, kind: 'indirim', pct: whole(input.flash?.pct, 30, 1, 90),
      when: { type: 'tarih', from: null, until: iso(input.flash?.until) },
    },
    {
      ...blank, id: 'badgeDay', name: 'Rozet Günü', on: true, kind: 'rozet', badgeId: str(input.badgeDay?.badgeId, 60), pct: whole(input.badgeDay?.pct, 20, 1, 90),
      when: { type: 'tarih', from: dayStart ? dayStart.toISOString() : null, until: dayStart ? new Date(dayStart.getTime() + 24 * HOUR).toISOString() : null },
    },
    {
      ...blank, id: 'sponsorWeek', name: 'Sponsor Haftası', on: true, kind: 'sponsor', siteId: str(input.sponsorWeek?.siteId, 60), text: str(input.sponsorWeek?.text, 160),
      when: { type: 'tarih', from: null, until: iso(input.sponsorWeek?.until) },
    },
  ]
}

const DEFAULTS = {
  comeback: { on: true, days: 7, coin: 300 },
  birthday: { on: true, coin: 500 },
  streak14: 150,
  shieldPrice: 400,
  bestBonus: { on: false, siteId: '', title: 'Bu haftanın en iyi bonusu', text: '', kp: 10 },
  loyaltyDays: 30,
}

export const DEFAULT_BOOSTS: BoostConfig = { ...DEFAULTS, cashback: [], campaigns: legacyCampaigns({}) }

export function cleanBoosts(input: (Partial<BoostConfig> & LegacyBoosts) | null | undefined): BoostConfig {
  const d = DEFAULTS
  const i = input ?? {}
  const seen = new Set<string>()
  const campaigns = (Array.isArray(i.campaigns) ? i.campaigns.slice(0, MAX_CAMPAIGNS).map(cleanCampaign) : legacyCampaigns(i)).map((c) => {
    let id = c.id
    for (let n = 2; seen.has(id); n++) id = `${c.id}-${n}`
    seen.add(id)
    return { ...c, id }
  })
  return {
    campaigns,
    comeback: { on: i.comeback?.on ?? d.comeback.on, days: whole(i.comeback?.days, d.comeback.days, 3, 60), coin: whole(i.comeback?.coin, d.comeback.coin, 0, 100000) },
    birthday: { on: i.birthday?.on ?? d.birthday.on, coin: whole(i.birthday?.coin, d.birthday.coin, 0, 100000) },
    streak14: whole(i.streak14, d.streak14, 0, 100000),
    shieldPrice: whole(i.shieldPrice, d.shieldPrice, 1, 1000000),
    bestBonus: {
      on: i.bestBonus?.on ?? d.bestBonus.on,
      siteId: str(i.bestBonus?.siteId, 60),
      title: str(i.bestBonus?.title, 80) || d.bestBonus.title,
      text: str(i.bestBonus?.text, 200),
      kp: whole(i.bestBonus?.kp, d.bestBonus.kp, 0, 1000),
    },
    cashback: (Array.isArray(i.cashback) ? i.cashback : [])
      .map((c) => ({ siteId: str(c?.siteId, 60), weekday: whole(c?.weekday, 1, 0, 6), text: str(c?.text, 160) }))
      .filter((c) => c.siteId)
      .slice(0, 20),
    loyaltyDays: whole(i.loyaltyDays, d.loyaltyDays, 7, 365),
  }
}

const two = (n: number) => String(n).padStart(2, '0')
const shortDate = (value: string) =>
  new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** "Her gün 20:00 - 22:00", "Cuma 18:00 → Pazartesi 00:00", "3 Ara 21:00'e kadar". */
export function whenLabel(when: CampaignWhen): string {
  if (when.type === 'saat') {
    const days = when.days.length && when.days.length < 7 ? when.days.map((d) => WEEKDAYS[d]).join(', ') : 'Her gün'
    return `${days} ${two(when.start)}:00 - ${two(when.end)}:00`
  }
  if (when.type === 'hafta') return `Her hafta ${WEEKDAYS[when.fromDay]} ${two(when.fromHour)}:00 → ${WEEKDAYS[when.toDay]} ${two(when.toHour)}:00`
  if (!when.until) return 'Tarih girilmedi'
  return when.from ? `${shortDate(when.from)} → ${shortDate(when.until)}` : `${shortDate(when.until)} tarihine kadar`
}
