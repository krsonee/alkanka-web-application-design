export const CONDITION_KINDS = {
  gorev: { label: 'Görev tamamla', unit: 'görev', counted: true, param: 'task' },
  oyun: { label: 'Oyun oyna', unit: 'oyun', counted: true, param: 'game' },
  galibiyet: { label: 'Oyun kazan', unit: 'galibiyet', counted: true, param: 'game' },
  giris: { label: 'Günlük girişi yap', unit: '', counted: false, param: null },
  kp: { label: 'Kanka Puan kazan', unit: 'KP', counted: true, param: null },
  online: { label: 'Kesintisiz online ödülü al', unit: 'ödül', counted: true, param: null },
  davet: { label: 'Arkadaş davet et', unit: 'davet', counted: true, param: null },
  telegram: { label: 'Telegram hesabını bağla', unit: '', counted: false, param: null },
} as const

export type ConditionKind = keyof typeof CONDITION_KINDS
export type ConditionWindow = 'gun' | 'hafta' | 'tum'

export const WINDOW_LABEL: Record<ConditionWindow, string> = { gun: 'bugün', hafta: 'bu hafta', tum: 'şimdiye kadar' }

export type CemberCondition = { id: string; kind: ConditionKind; target: number; window: ConditionWindow; param: string | null; label: string }

export type PrizeType = 'coin' | 'kp' | 'badge' | 'market'
export type CemberPrize = { id: string; type: PrizeType; amount: number; ref: string | null; label: string }

export type CemberConfig = {
  enabled: boolean
  title: string
  hours: number[]
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
  enabled: true,
  title: 'Jako Çemberi',
  hours: Array.from({ length: 24 }, (_, h) => h),
  minute: 0,
  every: 0,
  maxPlayers: 500,
  conditions: [{ id: 'c1', kind: 'gorev', target: 1, window: 'gun', param: null, label: '' }],
  prizes: [{ id: 'p1', type: 'coin', amount: 25, ref: null, label: '' }],
  extraSlots: [],
}

export const MAX_PLAYERS = 500

export const EVERY_OPTIONS = [0, 5, 10, 15, 20, 30] as const

/** Minutes within an hour at which a round starts. */
export function slotMinutes(cfg: Pick<CemberConfig, 'minute' | 'every'>): number[] {
  if (!cfg.every) return [cfg.minute]
  const out: number[] = []
  for (let m = cfg.minute % cfg.every; m < 60; m += cfg.every) out.push(m)
  return out
}
/** Mascot intro + countdown before the ring starts spinning. */
export const INTRO_SECONDS = 9
/** Winner celebration before the window closes itself. */
export const RESULT_SECONDS = 9

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
  prizeText: string
  conditions: string[]
  last: { slot: string; winnerName: string; prizeText: string; players: number } | null
}

export type CemberMe = { signedIn: boolean; userId: string | null; eligible: boolean; progress: { label: string; done: boolean; value: number; target: number }[] }

export function conditionText(c: CemberCondition, taskTitle?: string | null, gameLabel?: string | null) {
  if (c.label.trim()) return c.label.trim()
  const meta = CONDITION_KINDS[c.kind]
  const when = WINDOW_LABEL[c.window]
  if (c.kind === 'giris') return 'Bugün günlük girişini yap'
  if (c.kind === 'telegram') return 'Telegram hesabını bağla'
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
