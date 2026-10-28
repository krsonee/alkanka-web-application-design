export const CONDITION_KINDS = {
  gorev: { label: 'Görev tamamla', unit: 'görev', counted: true, param: 'task' },
  oyun: { label: 'Oyun oyna', unit: 'oyun', counted: true, param: 'game' },
  galibiyet: { label: 'Oyun kazan', unit: 'galibiyet', counted: true, param: 'game' },
  giris: { label: 'Günlük girişi yap', unit: '', counted: false, param: null },
  kp: { label: 'Kanka Puan kazan', unit: 'KP', counted: true, param: null },
  online: { label: 'Kesintisiz online ödülü al', unit: 'ödül', counted: true, param: null },
  davet: { label: 'Arkadaş davet et', unit: 'davet', counted: true, param: null },
  telegram: { label: 'Telegram hesabını bağla', unit: '', counted: false, param: null },
  tahmin: { label: 'Maç tahmini yap', unit: 'tahmin', counted: true, param: null },
  tv: { label: 'KankaTV izle', unit: 'dk', counted: true, param: null },
  tgkod: { label: 'Telegram gizli kodunu gir', unit: '', counted: false, param: null },
  sponsor: { label: 'Sponsora kayıtlı ol', unit: '', counted: false, param: 'site' },
  haftalik: { label: 'Haftalık görev bitir', unit: 'haftalık görev', counted: true, param: null },
} as const

export type ConditionKind = keyof typeof CONDITION_KINDS
export type ConditionWindow = 'gun' | 'hafta' | 'tum'

export const WINDOW_LABEL: Record<ConditionWindow, string> = { gun: 'bugün', hafta: 'bu hafta', tum: 'şimdiye kadar' }

export type CemberCondition = { id: string; kind: ConditionKind; target: number; window: ConditionWindow; param: string | null; label: string }

export type PrizeType = 'coin' | 'kp' | 'badge' | 'market'
export type CemberPrize = { id: string; type: PrizeType; amount: number; ref: string | null; label: string }

export type CemberGame = 'cember' | 'karadelik' | 'survival'
export const GAME_META: Record<CemberGame, { label: string; short: string }> = {
  cember: { label: 'Jako Çemberi', short: 'Çember' },
  karadelik: { label: 'Kara Delik Arenası', short: 'Kara Delik' },
  survival: { label: 'Survival Arena', short: 'Survival' },
}
export const asGame = (g: unknown): CemberGame => (typeof g === 'string' && g in GAME_META ? (g as CemberGame) : 'cember')

/** Survival Arena rules: solo or gold-vs-blue, last-standing or majority, teammate goal shield. */
export type SurvivalRule = 'last' | 'most'
export type SurvivalOpts = { teams: 0 | 2 | 5; rule: SurvivalRule; shield: boolean; captain: boolean }
export const DEFAULT_SURVIVAL: SurvivalOpts = { teams: 0, rule: 'last', shield: true, captain: false }

/**
 * Pre-round powers (Survival + Kara Delik). Earned, never bought:
 * shield = did more tasks today than the event asks; revive = wrote in the Telegram group today/yesterday.
 */
export type PowerOpts = { shield: boolean; revive: boolean }
export const DEFAULT_POWERS: PowerOpts = { shield: true, revive: true }
export const POWER_NONE = 0
export const POWER_SHIELD = 1
export const POWER_REVIVE = 2
export const POWER_LABEL: Record<1 | 2, string> = { 1: 'Görev kalkanı', 2: 'Telegram dönüşü' }

/** Fills thin rounds with bots so the arena never looks empty; bots never win or get paid. */
export type BotConfig = { enabled: boolean; target: number; max: number; /** Show a small "bot" mark next to bot names. */ tag: boolean }
export const DEFAULT_BOTS: BotConfig = { enabled: true, target: 50, max: 50, tag: false }
export const BOT_TAG = ' · bot'
export const MAX_BOTS = 120

/** "From `min` real players up, `winners` people win." Highest matching row applies. */
export type WinnerTier = { min: number; winners: number }
export const DEFAULT_TIERS: WinnerTier[] = [
  { min: 1, winners: 1 },
  { min: 16, winners: 3 },
  { min: 41, winners: 5 },
  { min: 81, winners: 10 },
]
export const MAX_WINNERS = 10
export const KD_DURATIONS = [30, 45, 60, 90, 120, 180, 240] as const

export type CemberConfig = {
  id: string
  enabled: boolean
  title: string
  game: CemberGame
  /** Kara Delik: seconds before the Final Battle starts. */
  duration: number
  winnerMode: 'fixed' | 'tiers'
  winners: number
  tiers: WinnerTier[]
  /** each = every winner gets the full prize list; split = KC/KP amounts are shared between winners. */
  prizeSplit: 'each' | 'split'
  /** pool = an unpaid prize stays in the pool; carry = its KC/KP is added to this event's next round. */
  leftover: 'pool' | 'carry'
  /** Survival Arena only. */
  survival: SurvivalOpts
  /** Survival Arena + Kara Delik only. */
  powers: PowerOpts
  bots: BotConfig
  /** KP per correct "who makes the top 3" pick made during the intro; 0 turns predictions off. */
  predictKp: number
  hours: number[]
  /** Weekdays the event runs (0 = Pazartesi … 6 = Pazar); empty = every day. */
  days: number[]
  minute: number
  /** Minutes between rounds inside each selected hour; 0 = once per hour at `minute`. */
  every: number
  maxPlayers: number
  conditions: CemberCondition[]
  prizes: CemberPrize[]
  /** One-off extra rounds (ISO), e.g. a test round started from the panel. */
  extraSlots: string[]
}

export const DEFAULT_CEMBER: CemberConfig = {
  id: 'e1',
  enabled: true,
  title: 'Jako Çemberi',
  game: 'cember',
  duration: 90,
  winnerMode: 'fixed',
  winners: 1,
  tiers: DEFAULT_TIERS,
  prizeSplit: 'each',
  leftover: 'pool',
  survival: DEFAULT_SURVIVAL,
  powers: DEFAULT_POWERS,
  bots: DEFAULT_BOTS,
  predictKp: 25,
  hours: Array.from({ length: 24 }, (_, h) => h),
  days: [],
  minute: 0,
  every: 0,
  maxPlayers: 500,
  conditions: [{ id: 'c1', kind: 'gorev', target: 1, window: 'gun', param: null, label: '' }],
  prizes: [{ id: 'p1', type: 'coin', amount: 25, ref: null, label: '' }],
  extraSlots: [],
}

export const WEEKDAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const

/**
 * Önerilen günlük 5 seans + hafta sonu Mega Çember. Her seansın amacı farklı:
 * site içi tahmin, Telegram, sponsor, KankaTV, arena. Ödüller panelden değiştirilebilir.
 */
export function recommendedCemberEvents(opts: { badgeId?: string | null; itemId?: string | null } = {}): CemberConfig[] {
  const base = {
    enabled: true,
    every: 0,
    maxPlayers: MAX_PLAYERS_DEFAULT,
    extraSlots: [] as string[],
    days: [] as number[],
    game: 'cember' as CemberGame,
    duration: 90,
    winnerMode: 'fixed' as const,
    winners: 1,
    tiers: DEFAULT_TIERS,
    prizeSplit: 'each' as const,
    survival: DEFAULT_SURVIVAL,
    powers: DEFAULT_POWERS,
    bots: DEFAULT_BOTS,
    predictKp: 25,
  }
  const cond = (id: string, kind: ConditionKind, target = 1, param: string | null = null): CemberCondition => ({ id, kind, target, window: 'gun', param, label: '' })
  const coin = (id: string, amount: number): CemberPrize => ({ id, type: 'coin', amount, ref: null, label: '' })
  const market = (id: string, fallbackCoin: number): CemberPrize =>
    opts.itemId ? { id, type: 'market', amount: 0, ref: opts.itemId, label: '' } : coin(id, fallbackCoin)
  return [
    { ...base, id: 'ogle', title: 'Öğle Çemberi', hours: [12], minute: 0, conditions: [cond('c1', 'tahmin', 3)], prizes: [coin('p1', 150)] },
    { ...base, id: 'telegram', title: 'Telegram Çemberi', hours: [15], minute: 0, conditions: [cond('c1', 'tgkod')], prizes: [market('p1', 300)] },
    { ...base, id: 'sponsor', title: 'Sponsor Çemberi', hours: [18], minute: 0, conditions: [cond('c1', 'sponsor')], prizes: [coin('p1', 1000)] },
    {
      ...base,
      id: 'primetime',
      title: 'Prime Time Çemberi',
      hours: [21],
      minute: 0,
      conditions: [cond('c1', 'tv', 20)],
      prizes: [...(opts.badgeId ? [{ id: 'p0', type: 'badge' as const, amount: 0, ref: opts.badgeId, label: '' }] : []), coin('p1', 200)],
    },
    { ...base, id: 'gecekurdu', title: 'Gece Kurdu Çemberi', hours: [23], minute: 30, conditions: [cond('c1', 'oyun', 5)], prizes: [market('p1', 300)] },
    {
      ...base,
      id: 'mega',
      title: 'Mega Çember',
      hours: [20],
      minute: 30,
      days: [5, 6],
      conditions: [{ id: 'c1', kind: 'haftalik', target: 4, window: 'hafta', param: null, label: '' }],
      prizes: [coin('p1', 2500)],
    },
  ]
}

const MAX_PLAYERS_DEFAULT = 500
export const MAX_PLAYERS = 500
export const MAX_EVENTS = 30
/** Rounds of different events must be at least this far apart so two windows never overlap. */
export const MIN_SLOT_GAP_MIN = 3
/** Site + Telegram heads-up this many minutes before each round. */
export const NOTICE_MINUTES = 3

export const EVERY_OPTIONS = [0, 5, 10, 15, 20, 30] as const

/** Minutes within an hour at which a round starts. */
export function slotMinutes(cfg: Pick<CemberConfig, 'minute' | 'every'>): number[] {
  if (!cfg.every) return [cfg.minute]
  const out: number[] = []
  for (let m = cfg.minute % cfg.every; m < 60; m += cfg.every) out.push(m)
  return out
}
/**
 * Intro + countdown before the round plays. Doubles as the prediction window: the server withholds the seed and
 * results until it ends, so nobody can replay the round locally and "predict" a known outcome.
 */
export const INTRO_SECONDS = 20
/** Predictions close this long before the reveal so a late request can't race the seed going out. */
export const PREDICT_GRACE_SECONDS = 2
export const PREDICT_PICKS = 3
/** All three picks landing in the top 3 doubles the payout. */
export const PREDICT_PERFECT_MULT = 2
/** Winner celebration before the window closes itself (viewers can close it sooner). */
export const RESULT_SECONDS = 6

/** How many people win with `real` real players in the round (bots never count, and never more than the real players). */
export function resolveWinners(cfg: Pick<CemberConfig, 'game' | 'winnerMode' | 'winners' | 'tiers'>, real: number) {
  if (cfg.game === 'cember' || real <= 0) return Math.min(1, real)
  let k = cfg.winners
  if (cfg.winnerMode === 'tiers') {
    k = 1
    for (const t of [...cfg.tiers].sort((a, b) => a.min - b.min)) if (real >= t.min) k = t.winners
  }
  return Math.max(1, Math.min(MAX_WINNERS, k, real))
}

/** How long a round stays on screen (intro + play + a little slack); also the "late joiners" window. */
export function liveSeconds(cfg: Pick<CemberConfig, 'game' | 'duration'> & { maxPlayers?: number }) {
  // Survival also drains its waiting queue before the clock runs; above 60 solo entrants it adds heats plus a final.
  const heats = (cfg.maxPlayers ?? 0) > 60 ? 240 : 0
  return INTRO_SECONDS + (cfg.game === 'karadelik' ? cfg.duration + 75 : cfg.game === 'survival' ? cfg.duration + 150 + heats : 75)
}

export type Participant = { id: string; name: string; image: string | null }

export type CemberRound = {
  slot: string
  title: string
  game: CemberGame
  duration: number
  seed: number
  participants: Participant[]
  winner: number | null
  /** Every winning ball index (Kara Delik can have up to 10). */
  winners: number[]
  steps: number
  prizeText: string
  /** Survival Arena rules the round was simulated with. */
  survival: SurvivalOpts | null
  /** Survival team mode: 0 = Altın, 1 = Mavi. */
  winningTeam: number
  /** Power per participant slot (POWER_*), fed to the engine so every viewer replays the same round. */
  powers: number[]
  /** Participant ids that finished in the top 3 (winners first, then the last ones out). */
  podium: string[]
  /** KP per correct prediction this round (0 = predictions were off). */
  predictKp: number
}

/** What viewers get during the intro: who is playing, but no seed or result yet. */
export type CemberPreview = {
  slot: string
  title: string
  game: CemberGame
  participants: Participant[]
  predictKp: number
  closesAt: string
}

export type CemberStatus = {
  enabled: boolean
  now: string
  title: string
  game: CemberGame
  /** Seconds the next round stays live; the overlay keeps late visitors in for this long. */
  liveSeconds: number
  nextSlot: string | null
  eventId: string | null
  prizeText: string
  conditions: string[]
  /** Next few rounds across all events, soonest first. */
  upcoming: { slot: string; title: string; prizeText: string }[]
  last: { slot: string; winnerName: string; prizeText: string; players: number } | null
}

export type CemberMe = { signedIn: boolean; userId: string | null; eligible: boolean; progress: { label: string; done: boolean; value: number; target: number }[] }

export function conditionText(c: CemberCondition, taskTitle?: string | null, gameLabel?: string | null) {
  if (c.label.trim()) return c.label.trim()
  const meta = CONDITION_KINDS[c.kind]
  const when = WINDOW_LABEL[c.window]
  if (c.kind === 'giris') return 'Bugün günlük girişini yap'
  if (c.kind === 'telegram') return 'Telegram hesabını bağla'
  if (c.kind === 'tgkod') return 'Bugünkü Telegram gizli kodunu gir'
  if (c.kind === 'sponsor') return c.param ? `${c.param} sponsoruna kayıtlı ol` : 'Bir sponsora kayıtlı ol'
  if (c.kind === 'tv') return `${when[0].toUpperCase()}${when.slice(1)} KankaTV'de ${c.target} dk izle`
  if (c.kind === 'tahmin') return `${when[0].toUpperCase()}${when.slice(1)} ${c.target} maç tahmini yap`
  if (c.kind === 'haftalik') return `Bu haftanın ${c.target} haftalık görevini bitir`
  if (c.kind === 'gorev' && taskTitle) return `${when[0].toUpperCase()}${when.slice(1)} "${taskTitle}" görevini tamamla`
  const what = gameLabel ? `${gameLabel} ` : ''
  return `${when[0].toUpperCase()}${when.slice(1)} ${c.target} ${what}${meta.unit}${c.kind === 'kp' ? ' kazan' : ''}`.replace(/\s+/g, ' ').trim()
    + (c.kind === 'gorev' ? ' tamamla' : c.kind === 'oyun' ? ' oyna' : c.kind === 'galibiyet' ? ' al' : c.kind === 'online' ? ' al' : c.kind === 'davet' ? ' yap' : '')
}

export function prizeText(prizes: CemberPrize[], names: Record<string, string> = {}) {
  return prizes
    .map((p) => {
      if (p.label.trim()) return p.label.trim()
      if (p.type === 'coin') return `${p.amount.toLocaleString('tr-TR')} KC`
      if (p.type === 'kp') return `${p.amount.toLocaleString('tr-TR')} KP`
      if (p.type === 'badge') return `${names[`b:${p.ref}`] ?? 'Özel'} rozeti`
      return names[`m:${p.ref}`] ?? 'Market ödülü'
    })
    .join(' + ')
}
