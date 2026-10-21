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

export type CemberConfig = {
  id: string
  enabled: boolean
  title: string
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
  const base = { enabled: true, every: 0, maxPlayers: MAX_PLAYERS_DEFAULT, extraSlots: [] as string[], days: [] as number[] }
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
/** Mascot intro + countdown before the ring starts spinning. */
export const INTRO_SECONDS = 5
/** Winner celebration before the window closes itself (viewers can close it sooner). */
export const RESULT_SECONDS = 6

export type Participant = { id: string; name: string; image: string | null }

export type CemberRound = {
  slot: string
  title: string
  seed: number
  participants: Participant[]
  winner: number | null
  steps: number
  prizeText: string
}

export type CemberStatus = {
  enabled: boolean
  now: string
  title: string
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
