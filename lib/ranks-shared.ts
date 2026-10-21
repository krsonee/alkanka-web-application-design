export type Rank = { id: 'bronz' | 'altin' | 'elmas' | 'efsane'; name: string; fromLevel: number; multiplier: number; perks: string[] }

/**
 * Kademe = rozet malzemesi. Rozet ve lig aynı dili konuşur: seviye rozetinin kademesi
 * kalıcı kariyerdir, haftalık lig aynı adlarla yarışır ama kariyeri düşürmez.
 * fromLevel is a 0-based level index and matches levelTier() bands (1-5, 6-10, 11-15, 16+).
 */
export const RANKS: Rank[] = [
  { id: 'bronz', name: 'Bronz', fromLevel: 0, multiplier: 1, perks: ['Tüm oyunlar ve market', 'Bronz rozet çerçevesi'] },
  { id: 'altin', name: 'Altın', fromLevel: 5, multiplier: 1.1, perks: ['Davet ödülü x1.1', 'Market öncelikli teslim', 'Altın rozet çerçevesi'] },
  { id: 'elmas', name: 'Elmas', fromLevel: 10, multiplier: 1.25, perks: ['Davet ödülü x1.25', 'Özel çekilişlere katılım', 'Elmas rozet çerçevesi'] },
  { id: 'efsane', name: 'Efsane', fromLevel: 15, multiplier: 1.5, perks: ['Davet ödülü x1.5', 'Aynı gün market teslimi', 'Efsane rozet çerçevesi'] },
]

export function rankForLevel(levelIndex: number): Rank {
  return [...RANKS].reverse().find((r) => levelIndex >= r.fromLevel) ?? RANKS[0]
}

export function nextRank(levelIndex: number): Rank | null {
  return RANKS.find((r) => r.fromLevel > levelIndex) ?? null
}
