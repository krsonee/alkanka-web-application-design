import { getContent } from './content'
import { mergeArena, type ArenaSettings } from './arena'

export async function getArenaSettings() {
  return mergeArena(await getContent<Partial<ArenaSettings>>('arena:settings'))
}
