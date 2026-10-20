export type TvConfig = {
  watch: { enabled: boolean; minutes: number; coin: number; dailyCap: number }
  predict: { enabled: boolean; coin: number; dailyLimit: number }
  reactions: boolean
  presence: boolean
  oddsBridge: boolean
  miniPlayer: boolean
  goalBot: { enabled: boolean; targetIds: number[]; template: string; topOnly: boolean; push: boolean }
  /** TV1: one-off bonus chests when daily watch time crosses each tier. */
  chests: { enabled: boolean; tiers: WatchTier[] }
  /** TV2: predictions made within N seconds after kickoff or a goal pay a multiplier. */
  flash: { enabled: boolean; seconds: number; multiplier: number }
  /** TV3: random coin for members watching right when a goal goes in. */
  goalChest: { enabled: boolean; min: number; max: number; dailyLimit: number; topOnly: boolean }
  /** TV4: push to followers when their team's match kicks off. */
  kickoffPush: boolean
  /** TV5: weekly top watchers, paid every Monday. */
  weekly: { enabled: boolean; prizes: number[] }
  /** TV6: watch at least minMinutes on N consecutive days. */
  streak: { enabled: boolean; days: number; minMinutes: number; coin: number }
  /** TV7: one scratch card per live match during half-time. */
  halftime: { enabled: boolean; min: number; max: number }
}

export type WatchTier = { minutes: number; coin: number }

export const DEFAULT_TV: TvConfig = {
  watch: { enabled: true, minutes: 10, coin: 5, dailyCap: 60 },
  predict: { enabled: true, coin: 20, dailyLimit: 10 },
  chests: {
    enabled: true,
    tiers: [
      { minutes: 15, coin: 10 },
      { minutes: 30, coin: 20 },
      { minutes: 60, coin: 40 },
      { minutes: 90, coin: 75 },
    ],
  },
  flash: { enabled: true, seconds: 60, multiplier: 2 },
  goalChest: { enabled: true, min: 3, max: 25, dailyLimit: 5, topOnly: true },
  kickoffPush: true,
  weekly: { enabled: true, prizes: [500, 300, 150] },
  streak: { enabled: true, days: 3, minMinutes: 15, coin: 100 },
  halftime: { enabled: true, min: 5, max: 50 },
  reactions: true,
  presence: true,
  oddsBridge: true,
  miniPlayer: true,
  goalBot: {
    enabled: false,
    targetIds: [],
    template: 'GOL! {takim}\n\n{ev} {skor} {dep}\n{lig} · {dakika}\n\nCanlı izle: {link}',
    topOnly: true,
    push: true,
  },
}

export const TV_LIMITS = { minutes: [1, 120], coin: [0, 10000], dailyCap: [0, 100000], predictCoin: [0, 10000], dailyLimit: [1, 100] } as const

export const REACTIONS = ['gol', 'ates', 'kahkaha', 'alkis', 'sok', 'kalp'] as const
export type Reaction = (typeof REACTIONS)[number]
export const REACTION_LABELS: Record<Reaction, string> = {
  gol: 'GOL',
  ates: 'Ateş',
  kahkaha: 'Kahkaha',
  alkis: 'Alkış',
  sok: 'Şok',
  kalp: 'Kalp',
}

export const REACTION_EMOJI: Record<Reaction, string> = {
  gol: '⚽',
  ates: '🔥',
  kahkaha: '😂',
  alkis: '👏',
  sok: '😱',
  kalp: '❤️',
}

export type PredictPick = 'home' | 'away' | 'none'
export const PICK_LABELS: Record<PredictPick, string> = { home: 'Ev sahibi', away: 'Deplasman', none: 'Gol yok' }

const clamp = (v: unknown, [min, max]: readonly [number, number], fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

export function cleanTvConfig(raw: unknown): TvConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const d = DEFAULT_TV
  const w = r.watch ?? {}
  const p = r.predict ?? {}
  const g = r.goalBot ?? {}
  const ch = r.chests ?? {}
  const fl = r.flash ?? {}
  const gc = r.goalChest ?? {}
  const wk = r.weekly ?? {}
  const st = r.streak ?? {}
  const ht = r.halftime ?? {}
  const gcMin = clamp(gc.min, TV_LIMITS.coin, d.goalChest.min)
  const htMin = clamp(ht.min, TV_LIMITS.coin, d.halftime.min)
  return {
    watch: {
      enabled: bool(w.enabled, d.watch.enabled),
      minutes: clamp(w.minutes, TV_LIMITS.minutes, d.watch.minutes),
      coin: clamp(w.coin, TV_LIMITS.coin, d.watch.coin),
      dailyCap: clamp(w.dailyCap, TV_LIMITS.dailyCap, d.watch.dailyCap),
    },
    predict: {
      enabled: bool(p.enabled, d.predict.enabled),
      coin: clamp(p.coin, TV_LIMITS.predictCoin, d.predict.coin),
      dailyLimit: clamp(p.dailyLimit, TV_LIMITS.dailyLimit, d.predict.dailyLimit),
    },
    reactions: bool(r.reactions, d.reactions),
    presence: bool(r.presence, d.presence),
    oddsBridge: bool(r.oddsBridge, d.oddsBridge),
    miniPlayer: bool(r.miniPlayer, d.miniPlayer),
    goalBot: {
      enabled: bool(g.enabled, d.goalBot.enabled),
      targetIds: Array.isArray(g.targetIds) ? g.targetIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0) : [],
      template: typeof g.template === 'string' && g.template.trim() ? g.template.slice(0, 1000) : d.goalBot.template,
      topOnly: bool(g.topOnly, d.goalBot.topOnly),
      push: bool(g.push, d.goalBot.push),
    },
    chests: {
      enabled: bool(ch.enabled, d.chests.enabled),
      tiers: Array.isArray(ch.tiers)
        ? ch.tiers
            .map((t: any) => ({ minutes: clamp(t?.minutes, [1, 600], 0), coin: clamp(t?.coin, TV_LIMITS.coin, 0) }))
            .filter((t: WatchTier) => t.minutes > 0 && t.coin > 0)
            .sort((a: WatchTier, b: WatchTier) => a.minutes - b.minutes)
            .filter((t: WatchTier, i: number, all: WatchTier[]) => i === 0 || all[i - 1].minutes !== t.minutes)
            .slice(0, 6)
        : d.chests.tiers,
    },
    flash: {
      enabled: bool(fl.enabled, d.flash.enabled),
      seconds: clamp(fl.seconds, [15, 600], d.flash.seconds),
      multiplier: clamp(fl.multiplier, [1, 10], d.flash.multiplier),
    },
    goalChest: {
      enabled: bool(gc.enabled, d.goalChest.enabled),
      min: gcMin,
      max: Math.max(gcMin, clamp(gc.max, TV_LIMITS.coin, d.goalChest.max)),
      dailyLimit: clamp(gc.dailyLimit, [1, 100], d.goalChest.dailyLimit),
      topOnly: bool(gc.topOnly, d.goalChest.topOnly),
    },
    kickoffPush: bool(r.kickoffPush, d.kickoffPush),
    weekly: {
      enabled: bool(wk.enabled, d.weekly.enabled),
      prizes: Array.isArray(wk.prizes)
        ? wk.prizes.map((p: unknown) => clamp(p, TV_LIMITS.coin, 0)).filter((p: number) => p > 0).slice(0, 10)
        : d.weekly.prizes,
    },
    streak: {
      enabled: bool(st.enabled, d.streak.enabled),
      days: clamp(st.days, [2, 30], d.streak.days),
      minMinutes: clamp(st.minMinutes, [1, 600], d.streak.minMinutes),
      coin: clamp(st.coin, TV_LIMITS.coin, d.streak.coin),
    },
    halftime: {
      enabled: bool(ht.enabled, d.halftime.enabled),
      min: htMin,
      max: Math.max(htMin, clamp(ht.max, TV_LIMITS.coin, d.halftime.max)),
    },
  }
}

/** "15:10, 30:20" → tiers. Used by the panel form. */
export function parseTiers(text: string): WatchTier[] {
  return text
    .split(/[,\n]/)
    .map((part) => part.split(/[:=]/).map((x) => Number(x.trim())))
    .filter(([m, c]) => Number.isFinite(m) && Number.isFinite(c))
    .map(([minutes, coin]) => ({ minutes, coin }))
}

export const tiersText = (tiers: WatchTier[]) => tiers.map((t) => `${t.minutes}:${t.coin}`).join(', ')

/** What the public page needs: feature switches and reward numbers, never bot targets. */
export type TvPublic = Omit<TvConfig, 'goalBot'> & { goalAlerts: boolean }

export type TvWatchStatus = {
  minutes: number
  earned: number
  cap: number
  nextIn: number | null
  /** Chest tiers with whether today's watch time has opened them. */
  chests: (WatchTier & { opened: boolean })[]
  /** Consecutive days (ending today or yesterday) with enough watch time. */
  streak: number
  /** Coins from a goal chest in the last few minutes, so the player can celebrate it. */
  goalChest: { coin: number; at: string } | null
}

export type TvHalftime = { gameId: number; home: string; away: string; played: boolean }
export type TvFlash = { gameId: number; until: string }
export type TvWeeklyRow = { userId: string; name: string; minutes: number }
export type TvPrediction = {
  id: number
  gameId: number
  home: string
  away: string
  pick: PredictPick
  status: 'open' | 'won' | 'lost'
  coin: number
  createdAt: string
}
export type TvOdd = { match: string; siteName: string; market: string; newOdd: number | null; oldOdd: number | null; link: string }

export type TvEngage = {
  config: TvPublic
  member: boolean
  watch: TvWatchStatus | null
  viewers: number
  reactions: { id: number; kind: Reaction }[]
  predictions: TvPrediction[]
  follows: number[]
  odds: TvOdd[]
  halftime: TvHalftime[]
  flash: TvFlash[]
}

export type TvBotStatus = { lastRunAt: string | null; lastError: string | null; sent: number; tracked: number }
export type TvStats = { watchersToday: number; minutesToday: number; coinsToday: number; predictionsToday: number; openPredictions: number; follows: number }
