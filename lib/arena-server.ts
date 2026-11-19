import { getContent } from '@/lib/content'
import { mergeArena, type ArenaSettings } from '@/lib/arena'

export async function getArenaSettings() {
  return mergeArena(await getContent<Partial<ArenaSettings>>('arena:settings'))
}
