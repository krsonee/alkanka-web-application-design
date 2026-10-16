export type OnlineTier = { hour: number; label: string; coin: number; kp: number }

export type OnlineConfig = {
  enabled: boolean
  /** Breaks longer than this reset the uninterrupted session. */
  graceMinutes: number
  tiers: OnlineTier[]
  /** Paid every hour after the last tier. */
  extra: { coin: number; kp: number }
}

export type OnlineGrant = OnlineTier

export type OnlineNext = { tier: OnlineTier; minutesLeft: number; progress: number }

export type OnlineStatus = {
  enabled: boolean
  member: boolean
  active: boolean
  minutes: number
  graceMinutes: number
  tiers: OnlineTier[]
  extra: { coin: number; kp: number }
  next: OnlineNext | null
  granted: OnlineGrant[]
}

export type TickerKinds = { gorev: boolean; rozet: boolean; online: boolean }
export type TickerAnnouncement = { id: string; text: string }
export type TickerConfig = {
  enabled: boolean
  toast: boolean
  kinds: TickerKinds
  announcements: TickerAnnouncement[]
}

export const MAX_ANNOUNCEMENTS = 10
export const DEFAULT_TICKER: TickerConfig = {
  enabled: true,
  toast: true,
  kinds: { gorev: true, rozet: true, online: true },
  announcements: [],
}

export function cleanTickerConfig(input: Partial<TickerConfig> | null | undefined): TickerConfig {
  const k = input?.kinds ?? DEFAULT_TICKER.kinds
  return {
    enabled: input?.enabled ?? true,
    toast: input?.toast ?? true,
    kinds: { gorev: k.gorev !== false, rozet: k.rozet !== false, online: k.online !== false },
    announcements: (Array.isArray(input?.announcements) ? input.announcements : [])
      .map((a) => ({ id: String(a?.id || '').slice(0, 40), text: String(a?.text || '').trim().slice(0, 140) }))
      .filter((a) => a.id && a.text)
      .slice(0, MAX_ANNOUNCEMENTS),
  }
}

export const IDLE_MINUTES = 10
export const MAX_ONLINE_HOURS = 48

export const DEFAULT_ONLINE: OnlineConfig = {
  enabled: true,
  graceMinutes: 5,
  tiers: [
    { hour: 1, label: 'Isınma turu', coin: 10, kp: 0 },
    { hour: 2, label: 'Masaya oturdu', coin: 0, kp: 50 },
    { hour: 3, label: 'Ritmi yakaladı', coin: 30, kp: 0 },
    { hour: 4, label: 'Sıcak seri', coin: 0, kp: 120 },
    { hour: 5, label: 'Yarım mesai', coin: 60, kp: 60 },
    { hour: 6, label: 'Demirbaş', coin: 0, kp: 250 },
    { hour: 7, label: 'Gece kuşu', coin: 100, kp: 0 },
    { hour: 8, label: 'Maratoncu', coin: 0, kp: 400 },
    { hour: 9, label: 'Durdurulamaz', coin: 150, kp: 150 },
    { hour: 10, label: 'Efsane mesai', coin: 0, kp: 600 },
    { hour: 11, label: 'Ustalar ustası', coin: 250, kp: 0 },
    { hour: 12, label: 'Maraton kralı', coin: 500, kp: 1000 },
  ],
  extra: { coin: 50, kp: 100 },
}

export const lastTierHour = (cfg: OnlineConfig) => cfg.tiers.reduce((m, t) => Math.max(m, t.hour), 0)

export function rewardForHour(cfg: OnlineConfig, hour: number): OnlineTier | null {
  const tier = cfg.tiers.find((t) => t.hour === hour)
  if (tier) return tier
  if (hour > lastTierHour(cfg) && (cfg.extra.coin > 0 || cfg.extra.kp > 0)) {
    return { hour, label: 'Maraton bonusu', coin: cfg.extra.coin, kp: cfg.extra.kp }
  }
  return null
}

export function nextReward(cfg: OnlineConfig, minutes: number): OnlineNext | null {
  const earned = Math.floor(minutes / 60)
  for (let h = earned + 1; h <= MAX_ONLINE_HOURS; h++) {
    const tier = rewardForHour(cfg, h)
    if (!tier) continue
    let prev = 0
    for (let p = h - 1; p >= 1; p--) {
      if (rewardForHour(cfg, p)) {
        prev = p
        break
      }
    }
    const span = (h - prev) * 60
    return { tier, minutesLeft: h * 60 - minutes, progress: Math.min(1, Math.max(0, (minutes - prev * 60) / span)) }
  }
  return null
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} dk`
  return m ? `${h} sa ${m} dk` : `${h} sa`
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function cleanOnlineConfig(input: Partial<OnlineConfig> | null | undefined): OnlineConfig {
  const raw = input ?? {}
  const seen = new Set<number>()
  const tiers = (Array.isArray(raw.tiers) ? raw.tiers : DEFAULT_ONLINE.tiers)
    .map((t) => ({
      hour: clampInt(t?.hour, 1, MAX_ONLINE_HOURS, 0),
      label: String(t?.label ?? '').trim().slice(0, 30) || 'Ödül',
      coin: clampInt(t?.coin, 0, 100000, 0),
      kp: clampInt(t?.kp, 0, 100000, 0),
    }))
    .filter((t) => t.hour > 0 && (t.coin > 0 || t.kp > 0) && !seen.has(t.hour) && seen.add(t.hour))
    .sort((a, b) => a.hour - b.hour)
    .slice(0, 24)
  return {
    enabled: raw.enabled ?? DEFAULT_ONLINE.enabled,
    graceMinutes: clampInt(raw.graceMinutes, 2, 30, DEFAULT_ONLINE.graceMinutes),
    tiers,
    extra: {
      coin: clampInt(raw.extra?.coin, 0, 100000, DEFAULT_ONLINE.extra.coin),
      kp: clampInt(raw.extra?.kp, 0, 100000, DEFAULT_ONLINE.extra.kp),
    },
  }
}
