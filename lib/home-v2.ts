import 'server-only'
import { isArenaGame } from '@/lib/arena'
import { getArenaSettings } from '@/lib/arena-server'
import { getContent } from '@/lib/content'
import { HOME_V2_KEY, mergeHomeV2, type HomeV2Settings } from '@/lib/home-v2-shared'

/** Home settings as visitors see them: a game switched off in the arena panel drops out of the home list. */
export async function getHomeV2(): Promise<HomeV2Settings> {
  const [content, arena] = await Promise.all([getContent(HOME_V2_KEY).catch(() => null), getArenaSettings().catch(() => null)])
  const settings = mergeHomeV2(content)
  if (!arena) return settings
  return { ...settings, home: { ...settings.home, games: settings.home.games.filter((g) => !isArenaGame(g) || arena[g].enabled) } }
}
