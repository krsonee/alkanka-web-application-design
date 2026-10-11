export type Rank = { id: 'bronz' | 'gumus' | 'altin' | 'plat'; name: string; fromLevel: number; multiplier: number; perks: string[] }

/** Permanent status ladder on top of KP levels. Multiplier boosts invite rewards. */
export const RANKS: Rank[] = [
  { id: 'bronz', name: 'Bronz', fromLevel: 0, multiplier: 1, perks: ['Tüm oyunlar ve market'] },
  { id: 'gumus', name: 'Gümüş', fromLevel: 3, multiplier: 1.1, perks: ['Davet ödülü x1.1', 'Market öncelikli teslim'] },
  { id: 'altin', name: 'Altın', fromLevel: 6, multiplier: 1.25, perks: ['Davet ödülü x1.25', 'Özel çekilişlere katılım'] },
  { id: 'plat', name: 'Plat', fromLevel: 9, multiplier: 1.5, perks: ['Davet ödülü x1.5', 'Aynı gün market teslimi', 'Plat rozeti'] },
]

export function rankForLevel(levelIndex: number): Rank {
  return [...RANKS].reverse().find((r) => levelIndex >= r.fromLevel) ?? RANKS[0]
}

export function nextRank(levelIndex: number): Rank | null {
  return RANKS.find((r) => r.fromLevel > levelIndex) ?? null
}
