import 'server-only'
import { isArenaGame } from '@/lib/arena'
import { getArenaSettings } from '@/lib/arena-server'
import { getContent } from '@/lib/content'
import { HOME_V2_KEY, mergeHomeV2, type HomeV2Settings } from '@/lib/home-v2-shared'
import { DEFAULT_TELEGRAM_LINK } from '@/lib/social-shared'
import { getTelegramAddresses } from '@/lib/telegram-channels'

/** A promo card still on the built-in channel link follows the address set in the panel. */
function withChannelAddress(settings: HomeV2Settings, main: string | null): HomeV2Settings {
  if (!main || main === DEFAULT_TELEGRAM_LINK) return settings
  const promos = settings.home.promos.map((p) => (p.href === DEFAULT_TELEGRAM_LINK ? { ...p, href: main } : p))
  return { ...settings, home: { ...settings.home, promos } }
}

/** Home settings as visitors see them: a game switched off in the arena panel drops out of the home list. */
export async function getHomeV2(): Promise<HomeV2Settings> {
  const [content, arena, main] = await Promise.all([
    getContent(HOME_V2_KEY).catch(() => null),
    getArenaSettings().catch(() => null),
    getTelegramAddresses(DEFAULT_TELEGRAM_LINK)
      .then((a) => a.main)
      .catch(() => null),
  ])
  const settings = withChannelAddress(mergeHomeV2(content), main)
  if (!arena) return settings
  return { ...settings, home: { ...settings.home, games: settings.home.games.filter((g) => !isArenaGame(g) || arena[g].enabled) } }
}
