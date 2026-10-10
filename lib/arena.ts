export const ARENA_GAMES = ['tavla', 'okey', 'bilardo'] as const
export type ArenaGame = (typeof ARENA_GAMES)[number]

export const ARENA_META: Record<ArenaGame, { title: string; short: string; image: string; players: string; group: number }> = {
  tavla: { title: 'Tavla', short: 'Klasik tavla, gerçek kurallar. Pulları topla, rakibinden önce bitir.', image: '/images/games/tavla.png', players: '1v1', group: 2 },
  okey: { title: 'Okey', short: 'Dört kişilik masa, gösterge ve okey taşı. Elini ilk açan kazanır.', image: '/images/games/okey.png', players: '4 kişilik masa', group: 4 },
  bilardo: { title: 'Bilardo', short: '8 top bilardo. Grubunu temizle, siyahı son deliğe yolla.', image: '/images/games/bilardo.png', players: '1v1', group: 2 },
}

export type ArenaGameSettings = { enabled: boolean; bets: number[]; multiplier: number }
export type ArenaSettings = Record<ArenaGame, ArenaGameSettings>

export const DEFAULT_ARENA: ArenaSettings = {
  tavla: { enabled: true, bets: [25, 50, 100, 250], multiplier: 2 },
  okey: { enabled: true, bets: [25, 50, 100, 250], multiplier: 3 },
  bilardo: { enabled: true, bets: [25, 50, 100, 250], multiplier: 2 },
}

export function isArenaGame(value: string): value is ArenaGame {
  return (ARENA_GAMES as readonly string[]).includes(value)
}

export function mergeArena(saved: Partial<ArenaSettings> | null | undefined): ArenaSettings {
  const out = { ...DEFAULT_ARENA }
  for (const g of ARENA_GAMES) {
    const s = saved?.[g]
    if (!s) continue
    out[g] = {
      enabled: typeof s.enabled === 'boolean' ? s.enabled : DEFAULT_ARENA[g].enabled,
      bets: Array.isArray(s.bets) && s.bets.length ? s.bets : DEFAULT_ARENA[g].bets,
      multiplier: typeof s.multiplier === 'number' && s.multiplier >= 1 ? s.multiplier : DEFAULT_ARENA[g].multiplier,
    }
  }
  return out
}
