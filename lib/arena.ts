export const ARENA_GAMES = ['tavla', 'okey', 'okey101', 'batak', 'monopoly', 'bilardo', 'blackjack', 'rulet', 'kafa-topu', 'kafa-basketbolu'] as const
/** Seat games run entirely on kanka tables; empty seats can be filled with server bots. */
export const SEAT_TABLE_GAMES = ['okey101', 'batak', 'monopoly'] as const
export type ArenaGame = (typeof ARENA_GAMES)[number]

export type GameMode = 'bot' | 'pvp' | 'local'

export const MODE_LABEL: Record<GameMode, string> = {
  bot: 'Bota karşı',
  pvp: 'Oyuncuya karşı',
  local: 'Aynı cihazda 2 kişi',
}

export type ArenaMeta = {
  title: string
  short: string
  image: string
  players: string
  group: number
  category: 'masa' | 'casino' | 'arcade'
  modes: GameMode[]
}

export const ARENA_META: Record<ArenaGame, ArenaMeta> = {
  tavla: {
    title: 'Tavla',
    short: 'Klasik tavla, gerçek kurallar. Pulları topla, rakibinden önce bitir.',
    image: '/images/games/tavla.png',
    players: '1v1',
    group: 2,
    category: 'masa',
    modes: ['bot', 'pvp'],
  },
  okey: {
    title: 'Okey',
    short: 'Gösterge ve okey taşıyla klasik masa. Elini ilk açan kazanır.',
    image: '/images/games/okey.png',
    players: 'Bot masası 4, kanka masası 1v1',
    group: 2,
    category: 'masa',
    modes: ['bot', 'pvp'],
  },
  okey101: {
    title: '101 Okey',
    short: '101 sayıyla el aç, çift git, işle. Eli bitir, en az cezayla masadan kalk.',
    image: '/images/games/okey101.png',
    players: '2 ya da 4 kişi, boş koltuğa bot',
    group: 2,
    category: 'masa',
    modes: ['pvp'],
  },
  batak: {
    title: 'Batak',
    short: 'İhaleli batak. İhaleyi al, kozu seç, sözünü tut; batan ihalesi kadar yer.',
    image: '/images/games/batak.png',
    players: '4 kişi, boş koltuğa bot',
    group: 2,
    category: 'masa',
    modes: ['pvp'],
  },
  monopoly: {
    title: 'Monopoly',
    short: 'Zar at, mülk al, ev ve otel dik. Rakiplerini iflas ettiren son patron kazanır.',
    image: '/images/games/monopoly.png',
    players: '2-4 kişi, boş koltuğa bot',
    group: 2,
    category: 'masa',
    modes: ['pvp'],
  },
  bilardo: {
    title: 'Bilardo',
    short: '8 top bilardo. Grubunu temizle, siyahı son deliğe yolla.',
    image: '/images/games/bilardo.png',
    players: '1v1',
    group: 2,
    category: 'masa',
    modes: ['bot', 'pvp'],
  },
  blackjack: {
    title: 'Blackjack',
    short: '21’e en yakın el kazanır. Kart çek, dur ya da ikiye katla.',
    image: '/images/games/blackjack.png',
    players: 'Krupiyeye karşı',
    group: 2,
    category: 'casino',
    modes: ['bot', 'pvp'],
  },
  rulet: {
    title: 'Rulet',
    short: 'Avrupa ruleti. Renk, tek-çift ya da sayına oyna, top nereye düşecek?',
    image: '/images/games/rulet.png',
    players: 'Masaya karşı',
    group: 2,
    category: 'casino',
    modes: ['bot', 'pvp'],
  },
  'kafa-topu': {
    title: 'Kafa Topu',
    short: 'Koca kafalı futbol. Zıpla, kafa vur, 60 saniyede rakibinden fazla gol at.',
    image: '/images/games/kafa-topu.png',
    players: '1v1',
    group: 2,
    category: 'arcade',
    modes: ['bot', 'local', 'pvp'],
  },
  'kafa-basketbolu': {
    title: 'Kafa Basketbolu',
    short: 'Koca kafalı basket. Topu kap, potaya kafayla smaç bas, sayıyı kaptır.',
    image: '/images/games/kafa-basketbolu.png',
    players: '1v1',
    group: 2,
    category: 'arcade',
    modes: ['bot', 'local', 'pvp'],
  },
}

export type ArenaGameSettings = {
  enabled: boolean
  pvpEnabled: boolean
  bets: number[]
  multiplier: number
  commission: number
}
export type ArenaSettings = Record<ArenaGame, ArenaGameSettings>

const base = { enabled: true, pvpEnabled: true, bets: [25, 50, 100, 250], commission: 10 }

export const DEFAULT_ARENA: ArenaSettings = {
  tavla: { ...base, multiplier: 2 },
  okey: { ...base, multiplier: 3 },
  okey101: { ...base, multiplier: 2 },
  batak: { ...base, multiplier: 2 },
  monopoly: { ...base, multiplier: 2 },
  bilardo: { ...base, multiplier: 2 },
  blackjack: { ...base, multiplier: 2 },
  rulet: { ...base, multiplier: 1 },
  'kafa-topu': { ...base, multiplier: 2 },
  'kafa-basketbolu': { ...base, multiplier: 2 },
}

export function isArenaGame(value: string): value is ArenaGame {
  return (ARENA_GAMES as readonly string[]).includes(value)
}

export function mergeArena(saved: Partial<Record<string, Partial<ArenaGameSettings>>> | null | undefined): ArenaSettings {
  const out = { ...DEFAULT_ARENA }
  for (const g of ARENA_GAMES) {
    const s = saved?.[g]
    if (!s) continue
    const d = DEFAULT_ARENA[g]
    out[g] = {
      enabled: typeof s.enabled === 'boolean' ? s.enabled : d.enabled,
      pvpEnabled: typeof s.pvpEnabled === 'boolean' ? s.pvpEnabled : d.pvpEnabled,
      bets: Array.isArray(s.bets) && s.bets.length ? s.bets.filter((b) => Number.isInteger(b) && b > 0) : d.bets,
      multiplier: typeof s.multiplier === 'number' && s.multiplier >= 1 ? s.multiplier : d.multiplier,
      commission: typeof s.commission === 'number' && s.commission >= 0 && s.commission <= 50 ? s.commission : d.commission,
    }
  }
  return out
}

/** Seconds a player has for each action at a kanka table; when it runs out the server plays for them. */
export const TURN_SECONDS: Partial<Record<ArenaGame, number>> = { tavla: 40, okey: 30, okey101: 40, batak: 25, monopoly: 45, bilardo: 35 }

export const RESULT_LABEL: Record<string, string> = { win: 'Kazandı', loss: 'Kaybetti', draw: 'Berabere', refund: 'İade' }
