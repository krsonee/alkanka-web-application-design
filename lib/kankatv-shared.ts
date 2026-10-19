export type TvConfig = {
  watch: { enabled: boolean; minutes: number; coin: number; dailyCap: number }
  predict: { enabled: boolean; coin: number; dailyLimit: number }
  reactions: boolean
  presence: boolean
  oddsBridge: boolean
  miniPlayer: boolean
  goalBot: { enabled: boolean; targetIds: number[]; template: string; topOnly: boolean; push: boolean }
}

export const DEFAULT_TV: TvConfig = {
  watch: { enabled: true, minutes: 10, coin: 5, dailyCap: 60 },
  predict: { enabled: true, coin: 20, dailyLimit: 10 },
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
  }
}

/** What the public page needs: feature switches and reward numbers, never bot targets. */
export type TvPublic = Omit<TvConfig, 'goalBot'> & { goalAlerts: boolean }

export type TvWatchStatus = { minutes: number; earned: number; cap: number; nextIn: number | null }
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
}

export type TvBotStatus = { lastRunAt: string | null; lastError: string | null; sent: number; tracked: number }
export type TvStats = { watchersToday: number; minutesToday: number; coinsToday: number; predictionsToday: number; openPredictions: number; follows: number }
