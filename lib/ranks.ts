import 'server-only'
import { getKpStatus } from '@/lib/kanka-puan'
import { RANKS, rankForLevel, type Rank } from '@/lib/ranks-shared'

export { RANKS, rankForLevel, type Rank }

export async function rankForUser(userId: string): Promise<Rank & { levelIndex: number }> {
  try {
    const status = await getKpStatus(userId)
    return { ...rankForLevel(status.level.index), levelIndex: status.level.index }
  } catch {
    return { ...RANKS[0], levelIndex: 0 }
  }
}
