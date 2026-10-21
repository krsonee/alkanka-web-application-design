import 'server-only'
import type { MirrorBot } from '@/lib/telegram-mirror'
import type { TgHubData } from '@/components/panel/tg-hub-manager'
import { DEFAULT_HUB } from '@/lib/tg-hub-shared'
import { chatLeaderboard, getHub, hookStatus, hubStats, listBroadcasts, listGlobalBans, listModLog, listTrustLow, weekStart } from '@/lib/tg-hub'
import { listTickets, sponsorSupportStats } from '@/lib/tg-support'

const EMPTY_STATS = { deletedWeek: 0, mutedWeek: 0, bannedWeek: 0, joinsBlockedWeek: 0, openTickets: 0, resolvedWeek: 0, avgResolveMin: null, globalBans: 0 }

export async function loadTgHub(bots: MirrorBot[], shareBotId: number | null, linkedMembers: number): Promise<TgHubData> {
  const hub = await getHub().catch(() => DEFAULT_HUB)
  const [stats, log, tickets, sponsorStats, leaders, broadcasts, bans, trustLow, guardHook, supportHook, shareHook] = await Promise.all([
    hubStats().catch(() => EMPTY_STATS),
    listModLog(40).catch(() => []),
    listTickets('all', 40).catch(() => []),
    sponsorSupportStats(7).catch(() => []),
    chatLeaderboard(weekStart(), new Date(Date.now() + 60_000).toISOString(), 10).catch(() => []),
    listBroadcasts(10).catch(() => []),
    listGlobalBans(50).catch(() => []),
    listTrustLow(20).catch(() => []),
    hookStatus(hub.guardBotId),
    hookStatus(hub.supportBotId),
    hookStatus(shareBotId),
  ])
  return { hub, bots, stats, log, tickets, sponsorStats, leaders, broadcasts, bans, trustLow, guardHook, supportHook, shareBotId, shareHook, linkedMembers }
}
