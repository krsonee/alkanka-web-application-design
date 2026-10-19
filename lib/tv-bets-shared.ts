export const BET_KINDS = ['ms', 'ou', 'btts', 'next', 'corners', 'red'] as const
export type BetKind = (typeof BET_KINDS)[number]

export const BET_KIND_LABELS: Record<BetKind, string> = {
  ms: 'Maç sonucu (1-X-2)',
  ou: 'Toplam gol alt/üst',
  btts: 'Karşılıklı gol',
  next: 'Sıradaki golü kim atar',
  corners: 'Toplam korner alt/üst',
  red: 'Kırmızı kart çıkar mı',
}

export type BetPhase = 'pre' | 'live'
export type BetMode = 'pool' | 'fixed'
export type MarketStatus = 'open' | 'locked' | 'settled' | 'void'
export type BetStatus = 'open' | 'won' | 'lost' | 'refund'

export type BetsConfig = {
  enabled: boolean
  pre: boolean
  live: boolean
  kinds: Record<BetKind, boolean>
  /** Percent of the losing side burned before winners are paid. */
  rake: number
  minStake: number
  maxStake: number
  /** Total coins a member may stake per Istanbul day; 0 = unlimited. */
  dailyCap: number
  /** Minutes the member must have watched KankaTV today before betting. */
  minActive: number
  /** Live events lock at this match minute. */
  closeMinute: number
  /** Seconds every market of a game stays locked after a goal. */
  suspendSeconds: number
  /** Bets placed this many seconds before a detected goal are refunded (delayed-stream protection). */
  lateWindow: number
  goalLine: number
  cornerLine: number
  /** Max total payout a fixed-odds option may owe. */
  fixedExposure: number
  bot: { enabled: boolean; targetIds: number[]; announceOpen: boolean; announceSettle: boolean; openTemplate: string; settleTemplate: string }
}

export const DEFAULT_BETS: BetsConfig = {
  enabled: false,
  pre: true,
  live: true,
  kinds: { ms: true, ou: true, btts: true, next: true, corners: true, red: false },
  rake: 8,
  minStake: 10,
  maxStake: 500,
  dailyCap: 2000,
  minActive: 10,
  closeMinute: 80,
  suspendSeconds: 90,
  lateWindow: 45,
  goalLine: 2.5,
  cornerLine: 9.5,
  fixedExposure: 20000,
  bot: {
    enabled: false,
    targetIds: [],
    announceOpen: true,
    announceSettle: true,
    openTemplate: '🔴 CANLI ETKİNLİK AÇILDI\n{ev} {skor} {dep} · {dakika}\n\n{etkinlikler}\n\nKanka coin ile katıl 👉 {link}',
    settleTemplate: '✅ ETKİNLİK SONUÇLANDI\n{ev} - {dep}\n{etkinlik}: {sonuc}\n{kazanan} kazanan · {dagitilan} coin dağıtıldı',
  },
}

export const BETS_LIMITS = {
  rake: [0, 30],
  stake: [1, 100000],
  dailyCap: [0, 1000000],
  minActive: [0, 240],
  closeMinute: [30, 90],
  suspendSeconds: [0, 600],
  lateWindow: [0, 300],
  fixedExposure: [100, 10000000],
} as const

const clamp = (v: unknown, [lo, hi]: readonly [number, number], fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
}
const half = (v: unknown, fallback: number) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0.5 || n > 30) return fallback
  return Math.floor(n) + 0.5
}
const text = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.slice(0, 1500) : fallback)

export function cleanBetsConfig(raw: unknown): BetsConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<BetsConfig> & Record<string, unknown>
  const d = DEFAULT_BETS
  const kinds = (r.kinds ?? {}) as Partial<Record<BetKind, unknown>>
  const bot = (r.bot ?? {}) as Partial<BetsConfig['bot']>
  const minStake = clamp(r.minStake, BETS_LIMITS.stake, d.minStake)
  return {
    enabled: r.enabled === true,
    pre: r.pre !== false,
    live: r.live !== false,
    kinds: Object.fromEntries(BET_KINDS.map((k) => [k, typeof kinds[k] === 'boolean' ? kinds[k] : d.kinds[k]])) as Record<BetKind, boolean>,
    rake: clamp(r.rake, BETS_LIMITS.rake, d.rake),
    minStake,
    maxStake: Math.max(minStake, clamp(r.maxStake, BETS_LIMITS.stake, d.maxStake)),
    dailyCap: clamp(r.dailyCap, BETS_LIMITS.dailyCap, d.dailyCap),
    minActive: clamp(r.minActive, BETS_LIMITS.minActive, d.minActive),
    closeMinute: clamp(r.closeMinute, BETS_LIMITS.closeMinute, d.closeMinute),
    suspendSeconds: clamp(r.suspendSeconds, BETS_LIMITS.suspendSeconds, d.suspendSeconds),
    lateWindow: clamp(r.lateWindow, BETS_LIMITS.lateWindow, d.lateWindow),
    goalLine: half(r.goalLine, d.goalLine),
    cornerLine: half(r.cornerLine, d.cornerLine),
    fixedExposure: clamp(r.fixedExposure, BETS_LIMITS.fixedExposure, d.fixedExposure),
    bot: {
      enabled: bot.enabled === true,
      targetIds: Array.isArray(bot.targetIds) ? bot.targetIds.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 20) : [],
      announceOpen: bot.announceOpen !== false,
      announceSettle: bot.announceSettle !== false,
      openTemplate: text(bot.openTemplate, d.bot.openTemplate),
      settleTemplate: text(bot.settleTemplate, d.bot.settleTemplate),
    },
  }
}

export type MarketOption = { key: string; label: string; pool: number; count: number; odd: number | null }

export type TvMarket = {
  id: number
  gameId: number
  home: string
  away: string
  league: string
  kind: BetKind
  title: string
  phase: BetPhase
  mode: BetMode
  status: MarketStatus
  options: MarketOption[]
  total: number
  kickoff: string
  closeMinute: number
  suspendedUntil: string | null
  result: string | null
}

export type TvBet = {
  id: number
  marketId: number
  title: string
  match: string
  pick: string
  stake: number
  odd: number | null
  payout: number
  status: BetStatus
  createdAt: string
}

export type TvGameState = { gameId: number; home: string; away: string; league: string; minute: number; score: string; state: 'pre' | 'in' | 'post'; kickoff: string }

export type BetsPublic = Pick<BetsConfig, 'enabled' | 'rake' | 'minStake' | 'maxStake' | 'dailyCap' | 'minActive'>

export type BetsState = {
  config: BetsPublic
  member: boolean
  balance: number | null
  eligibility: { ok: boolean; minutes: number; need: number; stakedToday: number }
  games: TvGameState[]
  markets: TvMarket[]
  bets: TvBet[]
}

export type BetsBotStatus = { lastRunAt: string | null; lastError: string | null; sent: number; opened: number; settled: number; voided: number }

export type BetsStats = { betsToday: number; stakedToday: number; paidToday: number; burnedToday: number; openMarkets: number; openStake: number; players: number }

export type AdminMarket = TvMarket & { bets: number; createdAt: string }

export type BetsLog = { id: number; actor: string; action: string; detail: string; createdAt: string }

/** Pool payout multiplier an option would pay right now, including your stake. */
export function poolMultiplier(market: Pick<TvMarket, 'total' | 'options'>, key: string, rake: number, stake = 0) {
  const opt = market.options.find((o) => o.key === key)
  if (!opt) return null
  const mine = opt.pool + stake
  if (mine <= 0) return null
  const losers = market.total + stake - mine
  return 1 + (losers * (1 - rake / 100)) / mine
}
