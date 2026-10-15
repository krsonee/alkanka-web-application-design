export type WheelTone = 'cyan' | 'purple' | 'gold' | 'muted'
export type WheelSegment = { short: string; label: string; points: number; tone: WheelTone }
export type ChestConfig = { name: string; odds: string; rewards: number[] }

export type RewardConfig = {
  wheel: { cooldownHours: number; segments: WheelSegment[] }
  chest: { dailyPlays: number; chests: ChestConfig[] }
  dice: { dailyPlays: number; jackpot: number; doubleX: number; highMin: number; highX: number; lowX: number }
}

export const WHEEL_SEGMENT_COUNT = 8
export const CHEST_IDS = ['bronze', 'gold', 'silver'] as const
export const WHEEL_TONES: { id: WheelTone; label: string }[] = [
  { id: 'gold', label: 'Altın' },
  { id: 'purple', label: 'Mor' },
  { id: 'cyan', label: 'Turkuaz' },
  { id: 'muted', label: 'Koyu' },
]

export const DEFAULT_REWARDS: RewardConfig = {
  wheel: {
    cooldownHours: 6,
    segments: [
      { short: '50', label: '50 Kanka Coin', points: 50, tone: 'gold' },
      { short: '2x', label: '2x Boost', points: 120, tone: 'muted' },
      { short: 'VIP', label: 'VIP Geçiş', points: 300, tone: 'purple' },
      { short: '10', label: 'Teselli: 10 Kanka Coin', points: 10, tone: 'muted' },
      { short: '100', label: '100 Kanka Coin', points: 100, tone: 'gold' },
      { short: 'Kod', label: 'Ücretsiz Promo Kod', points: 150, tone: 'muted' },
      { short: '250', label: '250 Kanka Coin', points: 250, tone: 'gold' },
      { short: 'Kutu', label: 'Gizemli Kutu', points: 200, tone: 'muted' },
    ],
  },
  chest: {
    dailyPlays: 1,
    chests: [
      { name: 'Bronz Sandık', odds: 'Sık', rewards: [40, 60, 75, 90] },
      { name: 'Altın Sandık', odds: 'Nadir', rewards: [150, 200, 300, 500] },
      { name: 'Gümüş Sandık', odds: 'Orta', rewards: [75, 100, 120, 150] },
    ],
  },
  dice: { dailyPlays: 3, jackpot: 400, doubleX: 40, highMin: 10, highX: 10, lowX: 5 },
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const text = (v: unknown, max: number, fallback: string) => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : ''
  return s || fallback
}

/** Fills gaps in a saved config with defaults and clamps every number to a safe range. */
export function mergeRewards(raw: unknown): RewardConfig {
  const r = (raw ?? {}) as Partial<RewardConfig>
  const d = DEFAULT_REWARDS
  const segs = Array.isArray(r.wheel?.segments) ? r.wheel.segments : []
  const chests = Array.isArray(r.chest?.chests) ? r.chest.chests : []
  return {
    wheel: {
      cooldownHours: clampInt(r.wheel?.cooldownHours, 1, 168, d.wheel.cooldownHours),
      segments: d.wheel.segments.map((def, i) => {
        const s = (segs[i] ?? {}) as Partial<WheelSegment>
        return {
          short: text(s.short, 6, def.short),
          label: text(s.label, 60, def.label),
          points: clampInt(s.points, 0, 100000, def.points),
          tone: WHEEL_TONES.some((t) => t.id === s.tone) ? (s.tone as WheelTone) : def.tone,
        }
      }),
    },
    chest: {
      dailyPlays: clampInt(r.chest?.dailyPlays, 1, 20, d.chest.dailyPlays),
      chests: d.chest.chests.map((def, i) => {
        const c = (chests[i] ?? {}) as Partial<ChestConfig>
        const rewards = Array.isArray(c.rewards)
          ? c.rewards.map((v) => clampInt(v, 0, 100000, 0)).filter((v) => v > 0).slice(0, 8)
          : []
        return {
          name: text(c.name, 30, def.name),
          odds: text(c.odds, 20, def.odds),
          rewards: [...(rewards.length >= 2 ? rewards : def.rewards)].sort((a, b) => a - b),
        }
      }),
    },
    dice: {
      dailyPlays: clampInt(r.dice?.dailyPlays, 1, 50, d.dice.dailyPlays),
      jackpot: clampInt(r.dice?.jackpot, 0, 100000, d.dice.jackpot),
      doubleX: clampInt(r.dice?.doubleX, 0, 10000, d.dice.doubleX),
      highMin: clampInt(r.dice?.highMin, 3, 12, d.dice.highMin),
      highX: clampInt(r.dice?.highX, 0, 10000, d.dice.highX),
      lowX: clampInt(r.dice?.lowX, 0, 10000, d.dice.lowX),
    },
  }
}

export function diceReward(a: number, b: number, d: RewardConfig['dice']) {
  if (a === 6 && b === 6) return { label: `Düşeş! Jackpot ${d.jackpot} KC`, points: d.jackpot, big: true }
  if (a === b) return { label: `Çift! ${a * d.doubleX} Kanka Coin`, points: a * d.doubleX, big: true }
  const sum = a + b
  if (sum >= d.highMin) return { label: `Yüksek atış — ${sum * d.highX} Kanka Coin`, points: sum * d.highX, big: true }
  return { label: `${sum * d.lowX} Kanka Coin`, points: sum * d.lowX, big: false }
}

/** Indices of the wheel's top-paying half; the house win rate decides whether one of these lands. */
export function wheelBigIndices(segments: WheelSegment[]) {
  const sorted = segments.map((s, i) => ({ i, p: s.points })).sort((a, b) => b.p - a.p)
  return new Set(sorted.slice(0, Math.ceil(segments.length / 2)).map((x) => x.i))
}
