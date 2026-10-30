const BOT_NAME_POOL = [
  'Baykuş', 'Aslan', 'Goril', 'Kartal', 'Şahin', 'Tilki', 'Bozkurt', 'Kaplan',
  'Panter', 'Atmaca', 'Doğan', 'Leopar', 'Ayı', 'Kunduz', 'Yaban', 'Jaguar',
  'Efe', 'Reis', 'Kaptan', 'Usta', 'Paşa', 'Dayı', 'Hoca', 'Kanka',
]

export const DEFAULT_BOT_NAMES = ['Baykuş', 'Aslan', 'Goril']

/** Returns `n` distinct random bot names for a fresh table. */
export function pickBotNames(n: number): string[] {
  const pool = [...BOT_NAME_POOL]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return Array.from({ length: n }, (_, i) => pool[i % pool.length])
}
