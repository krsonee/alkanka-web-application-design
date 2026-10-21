export type BoostConfig = {
  happyHour: { on: boolean; start: number; end: number; mult: number }
  weekend: { on: boolean; mult: number }
  derby: { until: string | null; title: string; mult: number }
  flash: { until: string | null; pct: number }
  badgeDay: { day: string | null; badgeId: string; pct: number }
  comeback: { on: boolean; days: number; coin: number }
  birthday: { on: boolean; coin: number }
  streak14: number
  shieldPrice: number
  sponsorWeek: { until: string | null; siteId: string; text: string }
  bestBonus: { on: boolean; siteId: string; title: string; text: string; kp: number }
  cashback: { siteId: string; weekday: number; text: string }[]
  loyaltyDays: number
}

export const DEFAULT_BOOSTS: BoostConfig = {
  happyHour: { on: true, start: 20, end: 22, mult: 2 },
  weekend: { on: true, mult: 1.5 },
  derby: { until: null, title: 'Derbi Gecesi', mult: 3 },
  flash: { until: null, pct: 30 },
  badgeDay: { day: null, badgeId: '', pct: 20 },
  comeback: { on: true, days: 7, coin: 300 },
  birthday: { on: true, coin: 500 },
  streak14: 150,
  shieldPrice: 400,
  sponsorWeek: { until: null, siteId: '', text: '' },
  bestBonus: { on: false, siteId: '', title: 'Bu haftanın en iyi bonusu', text: '', kp: 10 },
  cashback: [],
  loyaltyDays: 30,
}

export const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

/** Sources that happy hour multiplies. Admin, badge and prize sources are never boosted. */
export const HAPPY_SOURCES = ['sure', 'gorev', 'giris', 'online', 'kankatv', 'seri'] as const
export type BoostSource = (typeof HAPPY_SOURCES)[number] | 'arena' | 'tahmin'

export type ActiveBoost = { id: 'happy' | 'weekend' | 'derby' | 'flash' | 'badgeDay' | 'sponsorWeek'; label: string; detail: string; endsAt: string }

const HOUR = 3_600_000
/** Turkey is UTC+3 all year, so shifting by three hours gives Istanbul wall-clock fields via getUTC*. */
const trClock = (now: number) => new Date(now + 3 * HOUR)
const fromTr = (d: Date) => new Date(d.getTime() - 3 * HOUR).toISOString()

export function trDayOf(now = Date.now()) {
  return trClock(now).toISOString().slice(0, 10)
}

function happyWindow(cfg: BoostConfig, now: number) {
  const { on, start, end } = cfg.happyHour
  if (!on || start === end) return null
  const t = trClock(now)
  const h = t.getUTCHours()
  if (start < end ? h >= start && h < end : h >= start || h < end) {
    const e = new Date(t)
    e.setUTCHours(end, 0, 0, 0)
    if (e <= t) e.setUTCDate(e.getUTCDate() + 1)
    return fromTr(e)
  }
  return null
}

/** Friday 18:00 through Sunday 23:59 Istanbul time. */
function weekendWindow(cfg: BoostConfig, now: number) {
  if (!cfg.weekend.on) return null
  const t = trClock(now)
  const day = t.getUTCDay()
  const inside = (day === 5 && t.getUTCHours() >= 18) || day === 6 || day === 0
  if (!inside) return null
  const e = new Date(t)
  e.setUTCDate(e.getUTCDate() + (day === 0 ? 1 : day === 6 ? 2 : 3))
  e.setUTCHours(0, 0, 0, 0)
  return fromTr(e)
}

const future = (iso: string | null, now: number) => (iso && Date.parse(iso) > now ? iso : null)

export function activeBoosts(cfg: BoostConfig, now = Date.now()): ActiveBoost[] {
  const out: ActiveBoost[] = []
  const happy = happyWindow(cfg, now)
  if (happy) out.push({ id: 'happy', label: 'Mutlu Saatler', detail: `Tüm KP ve Coin kazançları x${cfg.happyHour.mult}`, endsAt: happy })
  const weekend = weekendWindow(cfg, now)
  if (weekend) out.push({ id: 'weekend', label: 'Hafta Sonu Festivali', detail: `Arena kazançları x${cfg.weekend.mult}`, endsAt: weekend })
  const derby = future(cfg.derby.until, now)
  if (derby) out.push({ id: 'derby', label: cfg.derby.title || 'Derbi Gecesi', detail: `Tahmin ödülleri ve KankaTV izleme x${cfg.derby.mult}`, endsAt: derby })
  const flash = future(cfg.flash.until, now)
  if (flash) out.push({ id: 'flash', label: 'Market Flash İndirimi', detail: `Tüm Alkanka ürünlerinde %${cfg.flash.pct} indirim`, endsAt: flash })
  if (cfg.badgeDay.day && cfg.badgeDay.badgeId && cfg.badgeDay.day === trDayOf(now)) {
    const e = new Date(`${cfg.badgeDay.day}T00:00:00Z`)
    e.setUTCDate(e.getUTCDate() + 1)
    out.push({ id: 'badgeDay', label: 'Rozet Günü', detail: `Rozet sahiplerine markette %${cfg.badgeDay.pct} indirim`, endsAt: fromTr(e) })
  }
  const sponsor = future(cfg.sponsorWeek.until, now)
  if (sponsor && cfg.sponsorWeek.siteId) out.push({ id: 'sponsorWeek', label: 'Sponsor Haftası', detail: cfg.sponsorWeek.text || 'Bu hafta sponsor görevleri ekstra ödüllü', endsAt: sponsor })
  return out
}

/** Multiplier for one reward source right now. Happy hour stacks with the source-specific boost. */
export function boostFor(cfg: BoostConfig, source: BoostSource, now = Date.now()) {
  let mult = 1
  if ((HAPPY_SOURCES as readonly string[]).includes(source) && happyWindow(cfg, now)) mult *= cfg.happyHour.mult
  if (source === 'arena' && weekendWindow(cfg, now)) mult *= cfg.weekend.mult
  if ((source === 'tahmin' || source === 'kankatv') && future(cfg.derby.until, now)) mult *= cfg.derby.mult
  return Math.max(1, Math.min(mult, 10))
}

export const applyMult = (amount: number, mult: number) => (amount > 0 ? Math.round(amount * mult) : amount)

const num = (v: unknown, d: number, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}
const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)
const iso = (v: unknown) => {
  const s = str(v, 40)
  return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null
}

export function cleanBoosts(input: Partial<BoostConfig> | null | undefined): BoostConfig {
  const d = DEFAULT_BOOSTS
  const i = (input ?? {}) as Partial<BoostConfig>
  return {
    happyHour: {
      on: i.happyHour?.on ?? d.happyHour.on,
      start: Math.trunc(num(i.happyHour?.start, d.happyHour.start, 0, 23)),
      end: Math.trunc(num(i.happyHour?.end, d.happyHour.end, 0, 23)),
      mult: num(i.happyHour?.mult, d.happyHour.mult, 1, 5),
    },
    weekend: { on: i.weekend?.on ?? d.weekend.on, mult: num(i.weekend?.mult, d.weekend.mult, 1, 3) },
    derby: { until: iso(i.derby?.until), title: str(i.derby?.title, 60) || d.derby.title, mult: num(i.derby?.mult, d.derby.mult, 1, 5) },
    flash: { until: iso(i.flash?.until), pct: Math.trunc(num(i.flash?.pct, d.flash.pct, 1, 90)) },
    badgeDay: { day: /^\d{4}-\d{2}-\d{2}$/.test(str(i.badgeDay?.day)) ? str(i.badgeDay?.day) : null, badgeId: str(i.badgeDay?.badgeId, 60), pct: Math.trunc(num(i.badgeDay?.pct, d.badgeDay.pct, 1, 90)) },
    comeback: { on: i.comeback?.on ?? d.comeback.on, days: Math.trunc(num(i.comeback?.days, d.comeback.days, 3, 60)), coin: Math.trunc(num(i.comeback?.coin, d.comeback.coin, 0, 100000)) },
    birthday: { on: i.birthday?.on ?? d.birthday.on, coin: Math.trunc(num(i.birthday?.coin, d.birthday.coin, 0, 100000)) },
    streak14: Math.trunc(num(i.streak14, d.streak14, 0, 100000)),
    shieldPrice: Math.trunc(num(i.shieldPrice, d.shieldPrice, 1, 1000000)),
    sponsorWeek: { until: iso(i.sponsorWeek?.until), siteId: str(i.sponsorWeek?.siteId, 60), text: str(i.sponsorWeek?.text, 160) },
    bestBonus: {
      on: i.bestBonus?.on ?? d.bestBonus.on,
      siteId: str(i.bestBonus?.siteId, 60),
      title: str(i.bestBonus?.title, 80) || d.bestBonus.title,
      text: str(i.bestBonus?.text, 200),
      kp: Math.trunc(num(i.bestBonus?.kp, d.bestBonus.kp, 0, 1000)),
    },
    cashback: (Array.isArray(i.cashback) ? i.cashback : [])
      .map((c) => ({ siteId: str(c?.siteId, 60), weekday: Math.trunc(num(c?.weekday, 1, 0, 6)), text: str(c?.text, 160) }))
      .filter((c) => c.siteId)
      .slice(0, 20),
    loyaltyDays: Math.trunc(num(i.loyaltyDays, d.loyaltyDays, 7, 365)),
  }
}
