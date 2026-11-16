import type { Metadata } from 'next'
import { cache, type ReactNode } from 'react'
import { adminConfigured, canPanel } from '@/lib/admin-auth'
import { getPanelSession, type PanelSession } from '@/lib/panel-auth'
import type { PanelModule } from '@/lib/panel-modules'
import { rows, sql } from '@/lib/db'
import { getAllContent, type HeroOverride, type SlideOverride } from '@/lib/content'
import { TEXTS_KEY, type SiteTexts } from '@/lib/site-texts-shared'
import { TextsEditor } from '@/components/panel/texts-editor'
import { LegalEditor } from '@/components/panel/legal-editor'
import { ReferralEditor } from '@/components/panel/referral-editor'
import { getReferralSettings } from '@/lib/referral-settings'
import { AmbientEditor } from '@/components/panel/ambient-editor'
import { CemberPanel } from '@/components/panel/cember-panel'
import { getAmbientSettings } from '@/lib/ambient-tables'
import { LEGAL_KEY, mergeLegal, type LegalOverrides } from '@/lib/legal-shared'
import { HERO_PAGES, IMAGE_LIBRARY } from '@/lib/site-registry'
import { SLIDES, TELEGRAM_URL } from '@/components/alkanka/data'
import { CUSTOM_SLIDES_KEY, readCustomSlides, readSlideOrder, SLIDE_ORDER_KEY, sortByOrder } from '@/lib/custom-slides'
import { readPromoTotals } from '@/lib/promo-stats'
import { LoginForm, LogoutButton } from '@/components/panel/login-form'
import { ContentEditor } from '@/components/panel/content-editor'
import { LogoEditor } from '@/components/panel/logo-editor'
import { LOGO_TEAMS, listLogoSponsors } from '@/lib/logo-registry'
import { ArenaSettingsEditor } from '@/components/panel/arena-settings-editor'
import { OpenTables } from '@/components/panel/open-tables'
import { GameStats } from '@/components/panel/game-stats'
import { TableMetrics } from '@/components/panel/table-metrics'
import { TournamentManager } from '@/components/panel/tournament-manager'
import { mergeArena, type ArenaSettings } from '@/lib/arena'
import { listTournaments } from '@/lib/tournaments'
import { pushStats } from '@/lib/push'
import { getQuestConfig, questWinnersThisWeek } from '@/lib/kp-extras'
import { PushSender } from '@/components/panel/push-sender'
import { AppRewardsEditor } from '@/components/panel/app-rewards-editor'
import { MobilePanel } from '@/components/panel/mobile-panel'
import { MOBILE_SEGMENTS, mobileCounts, PUSH_TOPICS } from '@/lib/mobile'
import { getAppSettings } from '@/lib/app-settings'
import { MessageSender } from '@/components/panel/message-sender'
import { listSent } from '@/lib/inbox'
import { listOutbox, listTemplates } from '@/lib/outbox'
import { getCatalog, getHidden, getRewardConfig } from '@/lib/catalog'
import { RewardsEditor } from '@/components/panel/rewards-editor'
import { CatalogEditor } from '@/components/panel/catalog-editor'
import { getCronKey, listBots, listLog, listSources, listTargets } from '@/lib/telegram-mirror'
import { TelegramMirror } from '@/components/panel/telegram-mirror'
import { TelegramChatSetup } from '@/components/panel/telegram-chat-setup'
import { ApprovalSection, ShareSection } from '@/components/panel/telegram-bot-suite'
import { OddsBotManager } from '@/components/panel/odds-bot-manager'
import { getOddsBotConfig, listOddsSources, oddsBotStatus, searchAdminOdds } from '@/lib/special-odds'
import { DEFAULT_ODDS_BOT, EMPTY_ODDS_STATUS } from '@/lib/special-odds-shared'
import { KankaTvManager } from '@/components/panel/kankatv-manager'
import { getTvConfig, tvBotStatus, tvStats } from '@/lib/kankatv-engage'
import { DEFAULT_TV } from '@/lib/kankatv-shared'
import { TvBetsManager } from '@/components/panel/tv-bets-manager'
import { adminMarkets, betsBotStatus, betsLog, betsStats, getBetsConfig } from '@/lib/tv-bets'
import { DEFAULT_BETS } from '@/lib/tv-bets-shared'
import { DEFAULT_SUITE, getBotSuite, shareStatus } from '@/lib/telegram-bots'
import { chatStatus } from '@/lib/telegram-chat'
import { getInviteConfig } from '@/lib/table-invite'
import { TelegramInviteSetup } from '@/components/panel/telegram-invite-setup'
import { getChannelUsernames, getTelegramAddresses } from '@/lib/telegram-channels'
import { TelegramChannelsSetup } from '@/components/panel/telegram-channels-setup'
import { SeoManager } from '@/components/panel/seo-manager'
import { listPosts } from '@/lib/blog'
import { dealsPublishing, getVerification, listDeals } from '@/lib/deals'
import { SITE_URL } from '@/lib/seo'
import { Studio } from '@/components/panel/studio'
import { CommunityManager } from '@/components/panel/community'
import { adminComplaints, listLeagueMatches, pendingReviews, publishedReviews } from '@/lib/community'
import { siteOptions } from '@/lib/sites'
import { listAssets, listBrands, listJobs, studioSpend } from '@/lib/studio'
import { getStudioCap } from '@/lib/studio-budget'
import { KpManager } from '@/components/panel/kp-manager'
import { BoostManager } from '@/components/panel/boost-manager'
import { getBoostConfig } from '@/lib/boosts'
import { recentRaffles } from '@/lib/badge-value'
import { BadgeRaffle } from '@/components/panel/badge-raffle'
import { AdsEditor } from '@/components/panel/ads-editor'
import { ADS_KEY, type AdMap } from '@/lib/ads'
import { ShareEditor } from '@/components/panel/share-editor'
import { HomeV2Editor } from '@/components/panel/home-v2-editor'
import { HOME_V2_KEY, mergeHomeV2 } from '@/lib/home-v2-shared'
import { MarketManager } from '@/components/panel/market-manager'
import { ThemeManager } from '@/components/panel/theme-manager'
import { getThemeCatalog } from '@/lib/table-themes-server'
import { DEFAULT_OFFERS } from '@/lib/table-themes'
import { GrowthManager } from '@/components/panel/growth-manager'
import { CampaignsManager, EarningsManager, TrackingEditor } from '@/components/panel/marketing-manager'
import { MarketingGuide } from '@/components/panel/area-guides'
import { getTracking, listCampaigns, listEarnings } from '@/lib/marketing'
import { SocialManager } from '@/components/panel/social-manager'
import { adminEntries, adminSocialAccounts, getSocialLinks, listSocialEvents, type SocialLinks } from '@/lib/social'
import { affLinkViews } from '@/lib/aff-links'
import { adminSponsorAccounts, currentPeriod, flaggedMembers, followerCounts, getSiteLinks, trafficReport } from '@/lib/growth'
import { listSites } from '@/lib/sites'
import { listProducts, listRequests } from '@/lib/market'
import { SitesManager } from '@/components/panel/sites-manager'
import { TasksManager } from '@/components/panel/tasks-manager'
import { FaqsManager } from '@/components/panel/faqs-manager'
import { listFaqs } from '@/lib/faqs'
import { listPendingClaims, listTasks } from '@/lib/tasks'
import { EMPTY_PENDING, moderationTotal, pendingDetail, type PendingDetail } from '@/lib/panel-pending'
import { ModerationQueue, type ModerationItem } from '@/components/panel/moderation-queue'

/** Per-request tally of lists that could not be read and fell back to "empty". */
const dataGaps = cache(() => ({ count: 0 }))

/**
 * Fallback for a read that failed. The section still opens, but the admin is told that an empty
 * list on this screen may be a read error rather than "no records".
 */
function miss<T>(fallback: T) {
  return (error: unknown): T => {
    console.error('[panel:veri]', error)
    dataGaps().count++
    return fallback
  }
}

async function moderationItems(can: (id: 'community' | 'tasks' | 'market') => boolean): Promise<ModerationItem[]> {
  const { pendingProofs } = await import('@/lib/trust-extra')
  const shares = can('community')
    ? await import('@/lib/withdrawals').then((w) => w.adminWithdrawals()).catch(miss([]))
    : []
  const [proofs, reviews, complaints, claims, requests, sites] = await Promise.all([
    can('community') ? pendingProofs().catch(miss([])) : [],
    can('community') ? pendingReviews().catch(miss([])) : [],
    can('community') ? adminComplaints().catch(miss([])) : [],
    can('tasks') ? listPendingClaims().catch(miss([])) : [],
    can('market') ? listRequests().catch(miss([])) : [],
    can('community') ? siteOptions().catch(miss([])) : [],
  ])
  const siteName = (id: string) => sites.find((s) => String(s.id) === id)?.name ?? id
  return [
    ...proofs.map((p): ModerationItem => ({
      key: `proof-${p.reviewId}`,
      kind: 'proof',
      id: p.reviewId,
      title: siteName(p.siteId),
      who: p.userName,
      detail: p.body,
      image: `/api/guven/kanit/${encodeURIComponent(p.proofPath.split('/').pop() ?? '')}`,
    })),
    ...reviews.map((r): ModerationItem => ({ key: `review-${r.id}`, kind: 'review', id: r.id, title: `${siteName(r.siteId)} · ${r.rating}/5`, who: r.userName, detail: r.body, createdAt: r.createdAt })),
    ...shares
      .filter((s) => s.status === 'pending')
      .map((s): ModerationItem => ({
        key: `withdraw-${s.id}`,
        kind: 'withdraw',
        id: s.id,
        title: `${s.siteName || siteName(s.siteId)} · ${s.amount.toLocaleString('tr-TR')} TL`,
        who: `${s.userName} (${s.fullUsername})`,
        detail: '',
        createdAt: s.createdAt,
        image: s.image,
      })),
    ...claims.map((c): ModerationItem => ({ key: `claim-${c.id}`, kind: 'claim', id: c.id, title: c.taskTitle, who: c.userName, detail: c.email, createdAt: c.createdAt })),
    ...requests
      .filter((r) => r.status === 'beklemede')
      .map((r): ModerationItem => ({
        key: `market-${r.id}`,
        kind: 'market',
        id: r.id,
        title: `${r.itemName}${r.sponsorName ? ` · ${r.sponsorName}` : ''}`,
        who: `${r.userName}${r.siteUsername ? ` (${r.siteUsername})` : ''}`,
        detail: `${r.price} coin`,
        createdAt: r.createdAt,
      })),
    ...complaints
      .filter((c) => c.status === 'open')
      .map((c): ModerationItem => ({ key: `complaint-${c.id}`, kind: 'complaint', id: c.id, title: `${siteName(c.siteId)} · ${c.title}`, who: c.userName, detail: c.body, createdAt: c.createdAt })),
  ]
}
import { SHARE_KEY, type ShareSettings } from '@/lib/share'
import { AUTO_LABELS, getKpConfig, leaderboard, listSpecialBadges, recentAwards } from '@/lib/kanka-puan'
import { getOnlineConfig, getTickerConfig } from '@/lib/online-rewards'
import { BrandingEditor } from '@/components/panel/branding-editor'
import { getBranding } from '@/lib/branding'
import { LimitsManager } from '@/components/panel/limits-manager'
import { listLimits } from '@/lib/member-limits'
import { StaffManager, type StaffRow } from '@/components/panel/staff-manager'
import { AccountSettings } from '@/components/panel/account-settings'
import { cleanPermissions, movedAddress, rowPermission, tabHome, telegramAccess, type PanelView, type TelegramAccess } from '@/lib/panel-modules'
import { redirect } from 'next/navigation'
import { WithdrawManager } from '@/components/panel/withdraw-manager'
import { MembersManager } from '@/components/panel/members-manager'
import { AuditLog } from '@/components/panel/audit-log'
import { PanelDashboard } from '@/components/panel/dashboard'
import { SystemStatus } from '@/components/panel/system-status'
import { loadSystemStatus } from '@/lib/system-status'
import { dashStats, parseQuery } from '@/lib/panel-stats'
import { TelegramTabs } from '@/components/panel/telegram-tabs'
import { TgGuide } from '@/components/panel/tg-guide'
import { TgHubManager } from '@/components/panel/tg-hub-manager'
import { DmPanel } from '@/components/panel/tg-dm-panel'
import { TgPanelProvider } from '@/components/panel/tg-hub-ui'
import { StatusSection } from '@/components/panel/tg-status-panel'
import { ResilienceSection } from '@/components/panel/tg-resilience-panel'
import { StatsSection } from '@/components/panel/tg-stats-panel'
import { getHub } from '@/lib/tg-hub'
import { loadDmPanel } from '@/lib/tg-broadcast'
import { uniqueChats } from '@/lib/tg-hub-shared'
import { STATUS_TAB } from '@/lib/tg-status-shared'
import { loadTgHub } from '@/lib/tg-hub-panel'
import { PostComposer, PostList } from '@/components/panel/tg-post-center'
import { ScheduledPosts } from '@/components/panel/tg-post-plans'
import { ChannelRules } from '@/components/panel/tg-post-rules'
import { loadPostCenter } from '@/lib/tg-posts'
import { listMembers, memberCounts } from '@/lib/members-admin'
import { lastLoginAddresses, recentAudit, searchAudit } from '@/lib/panel-log'
import { listContentHistory } from '@/lib/content-history'
import { ContentHistory } from '@/components/panel/content-history'
import { levelMap, listRoles, roleMap } from '@/lib/kanka-puan'
import { getSignupGate } from '@/lib/signup-gate'
import { AccessManager } from '@/components/panel/access-manager'
import { AvatarManager } from '@/components/panel/avatar-manager'
import { COVERS, avatarStats, listCatalog } from '@/lib/avatars'
import { getHouseWinRate } from '@/app/actions/wallet'
import { TelegramPromoEditor } from '@/components/panel/telegram-promo-editor'
import { getTelegramPromo } from '@/lib/telegram-promo'
import { TELEGRAM_PROMO_DEFAULTS } from '@/lib/telegram-promo-config'

async function usersPanel() {
  const [{ members, counts }, levels, cfg, roles, held, gate, canRoles, canMessage] = await Promise.all([
    listMembers(),
    levelMap().catch(miss(({}) as Record<string, number>)),
    getKpConfig(),
    listRoles(),
    roleMap().catch(miss(({}) as Awaited<ReturnType<typeof roleMap>>)),
    getSignupGate(),
    canPanel('roles'),
    canPanel('messages'),
  ])
  const names = Object.fromEntries(Object.entries(levels).map(([id, n]) => [id, cfg.levels[n - 1]?.name ?? 'Çaylak']))
  for (const [id, role] of Object.entries(held)) names[id] = role.name
  return (
    <div className="flex flex-col gap-6">
      <AccessManager gate={gate} roles={roles} canRoles={canRoles} />
      <MembersManager initial={members} counts={counts} levels={names} canMessage={canMessage} />
    </div>
  )
}

function failed(label: string) {
  return <p className="text-sm text-destructive">{label} yüklenemedi.</p>
}

type SectionCtx = { session: PanelSession; active: string }

/** Loads a panel section only when it is the open one and the account may see it, so other sections never query their data. */
async function section({ session, active }: SectionCtx, id: PanelModule | PanelView, label: string, load: () => Promise<ReactNode> | ReactNode): Promise<ReactNode> {
  if (active !== id) return null
  if (!session.isOwner && !session.permissions.includes(rowPermission(id))) return null
  try {
    return await load()
  } catch (error) {
    console.error(`[panel:${id}]`, error)
    return failed(label)
  }
}

type TgTab = { id: string; group?: string; label: string; status?: 'on' | 'off' | 'idle' | null; issue?: string | null; content: ReactNode }

// The first failing check decides the light: 'idle' for switched off or never set up, 'off' for switched on but failing.
function tabState(...checks: Array<[bad: boolean, issue: string, as: 'off' | 'idle']>) {
  const hit = checks.find(([bad]) => bad)
  return hit ? { status: hit[2], issue: hit[1] } : { status: 'on' as const, issue: null }
}

const lastErr = (e: unknown) => (e ? `Son hata: ${String(e).slice(0, 160)}` : '')

type TgShared = {
  bots: Awaited<ReturnType<typeof listBots>>
  targets: Awaited<ReturnType<typeof listTargets>>
  suite: Awaited<ReturnType<typeof getBotSuite>>
  chat: Awaited<ReturnType<typeof chatStatus>> | null
}

/** Bots, automations and channel settings: the tabs that need the setup permission, and the data only they use. */
async function telegramSetupTabs({ bots, targets, suite, chat }: TgShared): Promise<{ tabs: TgTab[]; chats: Array<{ chatId?: string | null; title?: string | null }> }> {
  const [oddsConfig, oddsStatus, oddsSources, oddsPage] = await Promise.all([
    getOddsBotConfig().catch(miss(DEFAULT_ODDS_BOT)),
    oddsBotStatus().catch(miss(EMPTY_ODDS_STATUS)),
    listOddsSources().catch(miss([])),
    searchAdminOdds({}).catch(miss({ rows: [], hasMore: false })),
  ])
  const [sources, log, cronKey, invite, addresses, shareInfo] = await Promise.all([
    listSources().catch(miss([])),
    listLog().catch(miss([])),
    getCronKey().catch(miss('ANAHTAR')),
    getInviteConfig().catch(miss(null)),
    getTelegramAddresses(TELEGRAM_URL).catch(miss(null)),
    shareStatus().catch(miss({ lastError: null, lastRunAt: null, shared: 0 })),
  ])
  const [tvConfig, tvStatus, tvToday] = await Promise.all([
    getTvConfig().catch(miss(DEFAULT_TV)),
    tvBotStatus().catch(miss({ lastRunAt: null, lastError: null, sent: 0, tracked: 0 })),
    tvStats().catch(miss({ watchersToday: 0, minutesToday: 0, coinsToday: 0, predictionsToday: 0, openPredictions: 0, follows: 0 })),
  ])
  const [betsConfig, betsStatus, betsToday, betsMarkets, betsHistory] = await Promise.all([
    getBetsConfig().catch(miss(DEFAULT_BETS)),
    betsBotStatus().catch(miss({ lastRunAt: null, lastError: null, sent: 0, opened: 0, settled: 0, voided: 0 })),
    betsStats().catch(miss({ betsToday: 0, stakedToday: 0, paidToday: 0, burnedToday: 0, openMarkets: 0, openStake: 0, players: 0 })),
    adminMarkets().catch(miss([])),
    betsLog().catch(miss([])),
  ])
  const tgPromo = await getTelegramPromo().catch(miss(TELEGRAM_PROMO_DEFAULTS))
  const siteHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? 'siteadresin.com'
  const cronUrl = `https://${siteHost}/api/cron/telegram?key=${cronKey}`
  const tvCronUrl = `https://${siteHost}/api/cron/kankatv?key=${cronKey}`
  return {
    chats: [
      { chatId: invite?.chatId, title: invite?.title },
      { chatId: oddsConfig.channelId, title: oddsConfig.channelTitle },
    ],
    tabs: [
      { id: 'mirror', group: 'Otomasyonlar', label: 'Bağlantı & Cron', ...tabState([bots.length === 0, 'Hiç bot eklenmemiş', 'idle'], [sources.length === 0, 'Kaynak kanal eklenmemiş, aktarılacak bir şey yok', 'idle']), content: <TelegramMirror bots={bots} targets={targets} sources={sources} log={log} cronUrl={cronUrl} /> },
      { id: 'chat', group: 'Botlar', label: 'Canlı Sohbet', ...tabState([!chat?.webhook?.url, 'Webhook kurulmamış', 'idle'], [Boolean(chat?.webhook?.lastError), lastErr(chat?.webhook?.lastError), 'off']), content: <TelegramChatSetup bots={bots} status={chat} /> },
      {
        id: 'odds',
        group: 'Botlar',
        label: 'Özel Oran Botu',
        ...tabState(
          [!oddsConfig.enabled, 'Kapalı', 'idle'],
          [Boolean(oddsStatus.lastError), lastErr(oddsStatus.lastError), 'off'],
          [Boolean(oddsStatus.channelError), 'Bot kanalda yönetici değil', 'off'],
          [Boolean(oddsStatus.publishError), 'Son oran kanala gönderilemedi', 'off'],
          [oddsStatus.activeSources === 0, 'Kaynak kanal eklenmemiş', 'off'],
          [!oddsStatus.webhookUrl, 'Webhook kurulmamış', 'off'],
        ),
        content: <OddsBotManager config={oddsConfig} status={oddsStatus} bots={bots} sources={oddsSources} odds={oddsPage} />,
      },
      {
        id: 'kankatv',
        group: 'Otomasyonlar',
        label: 'KankaTV Gol Botu',
        ...tabState(
          [!(tvConfig.goalBot.enabled || tvConfig.goalBot.push), 'Kapalı (Telegram ve bildirim gönderimi ikisi de kapalı)', 'idle'],
          [Boolean(tvStatus.lastError), lastErr(tvStatus.lastError), 'off'],
        ),
        content: <KankaTvManager config={tvConfig} status={tvStatus} stats={tvToday} targets={targets} cronUrl={tvCronUrl} />,
      },
      {
        id: 'tvbets',
        group: 'Otomasyonlar',
        label: 'KankaTV Canlı Etkinlik',
        ...tabState([!betsConfig.enabled, 'Kapalı', 'idle'], [Boolean(betsStatus.lastError), lastErr(betsStatus.lastError), 'off']),
        content: <TvBetsManager config={betsConfig} status={betsStatus} stats={betsToday} markets={betsMarkets} log={betsHistory} targets={targets} />,
      },
      { id: 'approvals', group: 'Botlar', label: 'Bildirim Botu', ...tabState([!suite.approvals.enabled, 'Kapalı', 'idle'], [suite.approvals.botId == null, 'Bot seçilmemiş', 'off'], [!suite.approvals.chatId, 'Bildirimin gideceği sohbet seçilmemiş', 'off']), content: <ApprovalSection suite={suite} bots={bots} /> },
      { id: 'share', group: 'Otomasyonlar', label: 'Post Paylaşım', ...tabState([!suite.share.enabled, 'Kapalı', 'idle'], [Boolean(shareInfo.lastError), lastErr(shareInfo.lastError), 'off'], [suite.share.botId == null, 'Paylaşım botu seçilmemiş', 'off']), content: <ShareSection suite={suite} bots={bots} targets={targets} status={shareInfo} /> },
      { id: 'invite', group: 'Kanallar', label: 'Davet linkleri', ...tabState([invite == null, 'Davet linki ayarı yapılmamış', 'idle']), content: <TelegramInviteSetup bots={bots} status={invite} /> },
      { id: 'channels', group: 'Kanallar', label: 'Kanallar', content: <TelegramChannelsSetup usernames={addresses?.usernames ?? null} /> },
      {
        id: 'strip',
        group: 'Kanallar',
        label: 'Site şeridi',
        ...tabState([!tgPromo.enabled, 'Kapalı', 'idle']),
        content: (
          <TelegramPromoEditor
            settings={tgPromo}
            fallbackUrl={addresses?.main ?? TELEGRAM_URL}
          />
        ),
      },
    ],
  }
}

/** One section for all three Telegram permissions; each tab is built only for an account that may use it. */
async function telegramPanel(access: TelegramAccess) {
  const [bots, targets, suite, chat, savedHub] = await Promise.all([
    listBots().catch(miss([])),
    listTargets().catch(miss([])),
    getBotSuite().catch(miss(DEFAULT_SUITE)),
    chatStatus().catch(miss(null)),
    getHub().catch(miss(null)),
  ])
  const linkedMembers = chat?.linkedMembers ?? 0
  const hubData = access.mod ? await loadTgHub(bots, suite.share.botId ?? null, linkedMembers) : null
  const postData = access.posts
    ? await loadPostCenter(bots).catch((error) => {
        console.error('[panel:tg-posts]', error)
        return null
      })
    : null
  const dmData = access.posts
    ? await loadDmPanel().catch((error) => {
        console.error('[panel:tg-dm]', error)
        return null
      })
    : null
  const setup = access.setup ? await telegramSetupTabs({ bots, targets, suite, chat }) : { tabs: [], chats: [] }

  const hub = hubData?.hub ?? savedHub
  const chats = uniqueChats([
    ...(hub?.groups ?? []),
    { chatId: hub?.logChatId, title: hub?.logChatTitle },
    { chatId: hub?.support.staffChatId, title: hub?.support.staffChatTitle },
    ...(hub?.support.sponsors ?? []),
    ...targets,
    { chatId: suite.approvals.chatId, title: suite.approvals.chatTitle },
    { chatId: chat?.chatId, title: chat?.title },
    ...setup.chats,
  ])

  const tabs: TgTab[] = []
  if (access.posts) {
    tabs.push(
      { id: 'post-new', group: 'Postlar', label: 'Yeni post', content: postData ? <PostComposer data={postData} /> : failed('Post Merkezi') },
      { id: 'post-list', group: 'Postlar', label: 'Gönderilenler', content: postData ? <PostList data={postData} /> : failed('Gönderilen postlar') },
      { id: 'post-plans', group: 'Postlar', label: 'Zamanlı postlar', content: postData ? <ScheduledPosts data={postData} /> : failed('Zamanlı postlar') },
      { id: 'post-rules', group: 'Postlar', label: 'Elle atılan postlar', content: postData ? <ChannelRules data={postData} /> : failed('Elle atılan postlar') },
      { id: 'post-dm', group: 'Postlar', label: 'DM duyuru', content: dmData ? <DmPanel data={dmData} /> : failed('DM duyuru') },
    )
  }
  const afterPosts = tabs.length
  if (hubData) {
    const h = hubData.hub
    tabs.push({
      id: 'hub',
      group: 'Botlar',
      label: 'Telegram Merkezi',
      ...tabState(
        [!(h.guard.enabled || h.support.enabled), 'Koruma ve destek botu ikisi de kapalı', 'idle'],
        [h.guard.enabled && !(h.guardBotId && h.groups.length), 'Bekçi açık ama bot ya da korunan grup seçilmemiş', 'off'],
        [h.guard.enabled && hubData.guardHook != null && !hubData.guardHook.ok, 'Bekçi botunun bildirim adresi kurulu değil', 'off'],
        [h.support.enabled && !h.supportBotId, 'Destek açık ama bot seçilmemiş', 'off'],
        [h.support.enabled && hubData.supportHook != null && !hubData.supportHook.ok, 'Destek botunun bildirim adresi kurulu değil', 'off'],
      ),
      content: <TgHubManager data={hubData} />,
    })
  }
  tabs.push(...setup.tabs)
  if (access.mod) {
    // The status screen is the one place failing sections are listed, so its own light only ever warns.
    const failing = tabs.filter((t) => t.status === 'off').length
    tabs.splice(afterPosts, 0, {
      id: STATUS_TAB,
      group: 'Durum',
      label: 'Durum',
      status: failing ? 'off' : null,
      issue: failing ? `${failing} bölümde hata var` : null,
      content: <StatusSection canRepair={access.setup} />,
    })
    tabs.splice(
      afterPosts + 1,
      0,
      { id: 'resilience', group: 'Durum', label: 'Dayanıklılık', content: <ResilienceSection canSetup={access.setup} /> },
      { id: 'tg-stats', group: 'Durum', label: 'İstatistik', content: <StatsSection /> },
    )
  }
  return (
    <TgPanelProvider access={access} chats={chats}>
      <div className="flex flex-col gap-4">
        <TgGuide access={access} />
        <TelegramTabs issues={access.mod ? 'none' : 'box'} tabs={tabs} />
      </div>
    </TgPanelProvider>
  )
}

/** Telegram opens with any of its three permissions, so it cannot use the single-module check in section(). */
async function telegramSection({ session, active }: SectionCtx): Promise<ReactNode> {
  if (active !== 'telegram') return null
  const access = telegramAccess(session)
  if (!access.posts && !access.mod) return null
  try {
    return await telegramPanel(access)
  } catch (error) {
    console.error('[panel:telegram]', error)
    return failed('Telegram')
  }
}

async function marketPanel(themesHere: boolean) {
  const [products, requests, sites] = await Promise.all([listProducts({ includeInactive: true }), listRequests(), listSites()])
  const sponsors = sites.filter((site) => site.slug).map((site) => ({ id: String(site.id), name: site.name }))
  const themeCatalog = themesHere ? await getThemeCatalog().catch(miss(DEFAULT_OFFERS)) : null
  const [avatars, stats, coverRows] = await Promise.all([
    listCatalog({ includeInactive: true }),
    avatarStats(),
    rows<{ id: string; n: string }>(sql`SELECT cover_id AS id, count(*) AS n FROM member_look WHERE cover_id IS NOT NULL GROUP BY cover_id`).catch(miss([])),
  ])
  const coverUsage = Object.fromEntries(coverRows.map((r) => [r.id, Number(r.n)]))
  return (
    <TelegramTabs
      label="Market bölümleri"
      tabs={[
        { id: 'products', label: `Ürünler & talepler${requests.length ? ` (${requests.length})` : ''}`, content: <MarketManager products={products} requests={requests} sponsors={sponsors} /> },
        { id: 'avatars', label: 'Avatarlar & kapaklar', content: <AvatarManager avatars={avatars} stats={stats} covers={COVERS} coverUsage={coverUsage} /> },
        ...(themeCatalog ? [{ id: 'themes', label: 'Masa temaları', content: <ThemeManager catalog={themeCatalog} /> }] : []),
      ]}
    />
  )
}

async function kpPanel() {
  const [cfg, badges, awards, board, online, ticker, quest, questWinners, boosts, raffles] = await Promise.all([getKpConfig(), listSpecialBadges({ includeInactive: true }), recentAwards(), leaderboard(50), getOnlineConfig(), getTickerConfig(), getQuestConfig(), questWinnersThisWeek(), getBoostConfig(), recentRaffles().catch(miss([]))])
  return (
    <div className="flex flex-col gap-10">
      <KpManager levels={cfg.levels} rules={cfg.rules} badges={badges} awards={awards} board={board} autoLabels={AUTO_LABELS} online={online} ticker={ticker} quest={quest} questWinners={questWinners} />
      <BadgeRaffle badges={badges.map((b) => ({ id: b.id, name: b.name, holders: b.holders }))} recent={raffles} />
      <BoostManager initial={boosts} />
    </div>
  )
}

async function staffPanel() {
  const list = await rows<{
    id: number
    username: string
    display_name: string
    is_owner: boolean
    permissions: unknown
    totp_enabled: boolean
    totp_required: boolean
    active: boolean
    last_login_at: string | null
  }>(sql`SELECT id, username, display_name, is_owner, permissions, totp_enabled, totp_required, active, last_login_at FROM panel_accounts ORDER BY is_owner DESC, username`)
  const addresses = await lastLoginAddresses().catch(miss<Record<string, string>>({}))
  const accounts: StaffRow[] = list.map((a) => ({
    id: Number(a.id),
    username: a.username,
    displayName: a.display_name,
    isOwner: a.is_owner,
    permissions: cleanPermissions(a.permissions),
    totpEnabled: a.totp_enabled,
    totpRequired: a.totp_required,
    active: a.active,
    lastLoginAt: a.last_login_at ? new Date(a.last_login_at).toISOString() : null,
    lastLoginIp: addresses[a.username.toLowerCase()] ?? null,
  }))
  return <StaffManager accounts={accounts} />
}

export const metadata: Metadata = { title: { absolute: 'Yönetim paneli | AL KANKA' }, robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } } }

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ b?: string; s?: string; r?: string; from?: string; to?: string }> }) {
  const [session, params] = await Promise.all([getPanelSession(), searchParams])
  if (!session) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4">
        <LoginForm configured={adminConfigured()} />
      </main>
    )
  }

  const can = (m: PanelModule) => session.isOwner || session.permissions.includes(m)
  const moved = movedAddress(params.b, params.s, can)
  if (moved) {
    const next = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    next.set('b', moved.b)
    if (moved.s) next.set('s', moved.s)
    else next.delete('s')
    redirect(`/panel?${next}`)
  }

  const content = await getAllContent()
  const allowed = session.isOwner ? null : session.permissions
  const adsTab = (stats: Awaited<ReturnType<typeof readPromoTotals>>) => ({
    id: 'ads',
    label: 'Reklam alanları',
    content: <AdsEditor saved={(content[ADS_KEY] as AdMap | undefined) ?? {}} stats={stats} />,
  })
  const active = params.b || 'dashboard'
  const ctx: SectionCtx = { session, active }

  const slideStats = can('slide') && active === 'slide' ? await readPromoTotals('slide') : {}
  const slides = can('slide')
    ? sortByOrder(SLIDES.map((s) => ({
        kind: 'slide' as const,
        id: s.id,
        label: s.eyebrow,
        path: '/',
        defaults: { eyebrow: s.eyebrow, title: s.title, description: s.description, cta: s.cta, image: s.image },
        saved: (content[`slide:${s.id}`] as SlideOverride | undefined) ?? null,
      })).concat(
        readCustomSlides(content[CUSTOM_SLIDES_KEY]).map((s) => ({
          kind: 'slide' as const,
          id: s.id,
          label: s.eyebrow || s.title,
          path: '/',
          custom: true,
          defaults: { eyebrow: s.eyebrow, title: s.title, description: s.description, cta: s.cta, image: s.image, href: s.href },
          saved: { eyebrow: s.eyebrow, title: s.title, description: s.description, cta: s.cta, image: s.image, href: s.href, startAt: s.startAt, endAt: s.endAt },
        })),
      ), readSlideOrder(content[SLIDE_ORDER_KEY])).map((s) => ({ ...s, stats: slideStats[s.id] ?? { views: 0, clicks: 0 } }))
    : []

  const heroes = can('hero')
    ? HERO_PAGES.map((p) => ({
        kind: 'hero' as const,
        id: p.slug,
        label: p.label,
        path: p.path,
        defaults: { title: p.title, image: p.image },
        saved: (content[`hero:${p.slug}`] as HeroOverride | undefined) ?? null,
      }))
    : []

  const [
    texts,
    branding,
    logos,
    seo,
    faqs,
    tour,
    sponsors,
    growth,
    marketing,
    community,
    badges,
    tasks,
    market,
    social,
    limits,
    games,
    tournaments,
    cember,
    telegram,
    push,
    studio,
    messages,
    rewards,
    catalog,
    users,
    home,
    withdrawals,
  ] = await Promise.all([
    section(ctx, 'texts', 'Site yazıları', () => (
      <TelegramTabs
        label="Site yazıları"
        tabs={[
          { id: 'texts', label: 'Site yazıları', content: <TextsEditor saved={(content[TEXTS_KEY] as SiteTexts | undefined) ?? {}} /> },
          { id: 'legal', label: 'Yasal metinler', content: <LegalEditor docs={mergeLegal(content[LEGAL_KEY] as LegalOverrides | undefined)} /> },
        ]}
      />
    )),
    section(ctx, 'branding', 'Logo ayarları', async () => {
      const b = await getBranding()
      return <BrandingEditor logoUrl={b.logoUrl ?? ''} logoHeight={b.logoHeight ?? 36} iconSrc={b.icons?.['192'] ? `/app-icon/192?v=${b.iconVersion ?? 0}` : '/icon-192.png'} hasCustomIcon={!!b.icons?.['192']} />
    }),
    section(ctx, 'logo', 'Logolar', async () => {
      const [logoSponsors, adStats] = await Promise.all([listLogoSponsors(), tabHome('ads', can) === 'logo' ? readPromoTotals('ad') : null])
      return (
        <TelegramTabs
          label="Paylaşım ve logolar"
          tabs={[
            { id: 'share', label: 'Paylaşım görseli', content: <ShareEditor saved={(content[SHARE_KEY] as ShareSettings | undefined) ?? {}} /> },
            ...(adStats ? [adsTab(adStats)] : []),
            {
              id: 'sponsor-logos',
              label: `Sponsor logoları (${logoSponsors.length})`,
              content: (
                <LogoEditor
                  kind="sponsors"
                  title={`Site logoları (${logoSponsors.length})`}
                  hint="Sponsor kartlarında baş harflerin yerine görünür. Kare ya da şeffaf PNG/SVG logo linki yapıştır."
                  items={logoSponsors}
                  saved={(content['logos:sponsors'] as Record<string, string> | undefined) ?? {}}
                />
              ),
            },
            {
              id: 'team-logos',
              label: `Takım logoları (${LOGO_TEAMS.length})`,
              content: (
                <LogoEditor
                  kind="teams"
                  title={`Takım logoları (${LOGO_TEAMS.length})`}
                  hint="Özel oranlar ve maç tahminlerinde takım adının yanında görünür."
                  items={LOGO_TEAMS}
                  saved={(content['logos:teams'] as Record<string, string> | undefined) ?? {}}
                />
              ),
            },
          ]}
        />
      )
    }),
    section(ctx, 'seo', 'SEO', async () => {
      const { seoHealth, list404, listRedirects, weeklyCare } = await import('@/lib/seo-health')
      const { getSiteSeo } = await import('@/lib/site-seo')
      return (
        <SeoManager
          siteSeo={await getSiteSeo()}
          care={await weeklyCare().catch(miss([]))}
          posts={await listPosts({ includeDrafts: true })}
          deals={await listDeals(30)}
          publishing={await dealsPublishing()}
          verification={await getVerification().catch(miss({ google: '', bing: '', yandex: '', meta: '' }))}
          siteUrl={SITE_URL}
          issues={await seoHealth().catch(miss([]))}
          notFound={await list404().catch(miss([]))}
          redirects={await listRedirects().catch(miss([]))}
        />
      )
    }),
    section(ctx, 'faqs', 'Sorular', async () => <FaqsManager faqs={await listFaqs()} />),
    section(ctx, 'tour', 'Site turu', async () => {
      const { getTourSettings, tourStats } = await import('@/lib/tour')
      const { TourSettingsEditor } = await import('@/components/panel/tour-settings-editor')
      const [settings, stats] = await Promise.all([
        getTourSettings(),
        tourStats().catch(miss({ done: 0, rewarded: 0, blocked: 0, paidTotal: 0, recentBlocked: [] })),
      ])
      return <TourSettingsEditor settings={settings} stats={stats} />
    }),
    section(ctx, 'sponsors', 'Sponsorlar', async () => <SitesManager sites={await listSites()} />),
    section(ctx, 'growth', 'Büyüme', async () => {
      const [referral, ambient, options, allSites, links, followers, report, flagged, accounts, affLinks] = await Promise.all([
        getReferralSettings(),
        tabHome('ambient', can) === 'growth' ? getAmbientSettings() : null,
        siteOptions(),
        listSites().catch(miss([])),
        getSiteLinks().catch(miss({})),
        followerCounts().catch(miss({})),
        trafficReport(30).catch(miss({ days: 30, sources: [], sites: [], totalClicks: 0, totalSignups: 0 })),
        flaggedMembers().catch(miss([])),
        adminSponsorAccounts().catch(miss([])),
        affLinkViews().catch(miss([])),
      ])
      return (
        <TelegramTabs
          label="Büyüme bölümleri"
          tabs={[
            {
              id: 'traffic',
              label: 'Trafik & hesaplar',
              content: (
                <GrowthManager
                  sites={options.map((s) => ({ id: s.id, name: s.name }))}
                  recordNames={Object.fromEntries(allSites.map((site) => [String(site.id), site.name]))}
                  links={links}
                  followers={followers}
                  report={report}
                  flagged={flagged}
                  accounts={accounts}
                  period={currentPeriod()}
                  siteUrl={SITE_URL}
                  affLinks={affLinks}
                  affSites={allSites.map((s) => ({ id: s.id, name: s.name, slug: s.slug, active: s.active }))}
                />
              ),
            },
            { id: 'referral', label: 'Davet sistemi', content: <ReferralEditor settings={referral} /> },
            ...(ambient ? [{ id: 'ambient', label: 'Masa doluluğu', content: <AmbientEditor settings={ambient} /> }] : []),
          ]}
        />
      )
    }),
    section(ctx, 'marketing', 'Pazarlama', async () => {
      const [tracking, campaigns, earnings, mSites, adStats] = await Promise.all([
        getTracking(),
        listCampaigns().catch(miss([])),
        listEarnings().catch(miss([])),
        listSites().catch(miss([])),
        tabHome('ads', can) === 'marketing' ? readPromoTotals('ad').catch(miss<Awaited<ReturnType<typeof readPromoTotals>>>({})) : null,
      ])
      const opts = mSites.map((s) => ({ id: s.id, name: s.name, slug: s.slug, active: s.active }))
      return (
        <div className="flex flex-col gap-5">
          <MarketingGuide />
          <TelegramTabs
            label="Pazarlama bölümleri"
            tabs={[
              { id: 'campaigns', label: 'Kampanya linkleri', content: <CampaignsManager campaigns={campaigns} sites={opts} siteUrl={SITE_URL} /> },
              ...(adStats ? [adsTab(adStats)] : []),
              { id: 'earnings', label: 'Affiliate hakediş', content: <EarningsManager earnings={earnings} sites={opts} /> },
              { id: 'tracking', label: 'Ölçüm etiketleri', content: <TrackingEditor settings={tracking} /> },
            ]}
          />
        </div>
      )
    }),
    section(ctx, 'community', 'Topluluk', async () => (
      <CommunityManager
        reviews={await pendingReviews().catch(miss([]))}
        published={await publishedReviews().catch(miss([]))}
        proofs={await (await import('@/lib/trust-extra')).pendingProofs().catch(miss([]))}
        complaints={await adminComplaints().catch(miss([]))}
        matches={await listLeagueMatches(null, { admin: true }).catch(miss([]))}
        siteNames={Object.fromEntries((await siteOptions()).map((s) => [s.id, s.name]))}
      />
    )),
    section(ctx, 'badges', 'Rozet sistemi', kpPanel),
    section(ctx, 'tasks', 'Görevler', async () => {
      const [list, claims, sites] = await Promise.all([listTasks(), listPendingClaims(), siteOptions().catch(miss([]))])
      return <TasksManager tasks={list} claims={claims} sites={sites.map((x) => ({ id: x.id, name: x.name }))} />
    }),
    section(ctx, 'market', 'Market', () => marketPanel(tabHome('themes', can) === 'market')),
    section(ctx, 'social', 'Sosyal medya', async () => (
      <SocialManager
        links={await getSocialLinks().catch(miss(({}) as SocialLinks))}
        channels={await getChannelUsernames().catch(miss(null))}
        accounts={await adminSocialAccounts().catch(miss([]))}
        events={await listSocialEvents({ includeInactive: true }).catch(miss([]))}
        entries={await adminEntries().catch(miss([]))}
        api={await import('@/lib/social-verify')
          .then(async (m) => ({ summary: await m.socialApiSummary(), fields: m.API_FIELDS }))
          .catch(miss(undefined))}
      />
    )),
    section(ctx, 'limits', 'Kısıtlamalar', async () => <LimitsManager limits={await listLimits().catch(miss([]))} />),
    section(ctx, 'games', 'Oyun ayarları', async () => {
      const [openTables, ambient, themeCatalog] = await Promise.all([
        import('@/lib/pvp/tables')
          .then((m) => m.listOpenTables())
          .then((list) =>
            list.map((t) => ({
              id: t.id,
              game: t.game,
              status: t.status as 'bekliyor' | 'oynaniyor',
              stake: t.stake,
              seats: t.seats,
              players: t.players.map((pl) => ({ name: pl.name, bot: Boolean(pl.bot) })),
              updatedAt: t.updatedAt,
              createdAt: t.createdAt,
            })),
          )
          .catch(miss([])),
        tabHome('ambient', can) === 'games' ? getAmbientSettings().catch(miss(null)) : null,
        tabHome('themes', can) === 'games' ? getThemeCatalog().catch(miss(DEFAULT_OFFERS)) : null,
      ])
      const tables = (
        <div className="flex flex-col gap-6">
          <GameStats />
          <TableMetrics />
          <OpenTables now={Date.now()} tables={openTables} />
          <ArenaSettingsEditor
            settings={mergeArena(content['arena:settings'] as Partial<ArenaSettings> | undefined)}
            winRate={Number((content['arena:house'] as { winRate?: number } | undefined)?.winRate ?? 40)}
          />
        </div>
      )
      if (!ambient && !themeCatalog) return tables
      return (
        <TelegramTabs
          label="Oyun bölümleri"
          tabs={[
            { id: 'tables', label: 'Ayarlar & masalar', content: tables },
            ...(ambient ? [{ id: 'ambient', label: 'Masa doluluğu', content: <AmbientEditor settings={ambient} /> }] : []),
            ...(themeCatalog ? [{ id: 'themes', label: 'Masa temaları', content: <ThemeManager catalog={themeCatalog} /> }] : []),
          ]}
        />
      )
    }),
    section(ctx, 'tournaments', 'Turnuvalar', async () => {
      const { listTournamentTemplates } = await import('@/lib/tournament-templates')
      const [tournaments, templates] = await Promise.all([listTournaments(), listTournamentTemplates().catch(miss([]))])
      return <TournamentManager tournaments={tournaments} templates={templates} />
    }),
    section(ctx, 'cember', 'Jako Çemberi', async () => <CemberPanel />),
    telegramSection(ctx),
    section(ctx, 'push', 'Bildirimler', async () => {
      const [stats, pushOutbox, appSettings, mCounts] = await Promise.all([
        pushStats().catch(miss({ total: 0, members: 0, log: [] })),
        listOutbox('push').catch(miss([])),
        getAppSettings(),
        mobileCounts().catch(miss({ total: 0, installed: 0, push: 0, both: 0, none: 0, opensToday: 0, turnedOff: 0 })),
      ])
      const topicLabels = Object.fromEntries(PUSH_TOPICS.map((t) => [t.value, t.label]))
      return (
        <TelegramTabs
          label="Bildirim bölümleri"
          tabs={[
            { id: 'send', label: 'Bildirim gönder', content: <PushSender {...stats} configured={stats.total > 0} outbox={pushOutbox} /> },
            { id: 'mobile', label: 'Mobil', content: <MobilePanel counts={mCounts} segments={MOBILE_SEGMENTS} topicLabels={topicLabels} /> },
            { id: 'app-rewards', label: 'Uygulama ödülleri', content: <AppRewardsEditor settings={appSettings} /> },
          ]}
        />
      )
    }),
    section(ctx, 'studio', 'Stüdyo', async () => (
      <Studio
        brands={await listBrands().catch(miss([]))}
        assets={await listAssets().catch(miss([]))}
        jobs={await listJobs().catch(miss([]))}
        spend={await studioSpend().catch(miss({ total: 0, month: 0, count: 0 }))}
        budget={{ cap: await getStudioCap().catch(miss(null)), canEdit: session.isOwner }}
      />
    )),
    section(ctx, 'messages', 'Site içi mesajlar', async () => {
      const [sent, outbox, templates] = await Promise.all([listSent(), listOutbox('message').catch(miss([])), listTemplates().catch(miss([]))])
      return <MessageSender sent={sent} outbox={outbox} templates={templates} />
    }),
    section(ctx, 'rewards', 'Ödül ayarları', async () => {
      const [config, hidden, winRate] = await Promise.all([getRewardConfig(), getHidden(), getHouseWinRate()])
      return <RewardsEditor initial={config} hidden={hidden.mini ?? []} winRate={winRate} />
    }),
    section(ctx, 'catalog', 'Etkinlik ve kampanyalar', async () => {
      const [{ rewards: _rewards, ...catalog }, hidden, options, cups] = await Promise.all([
        getCatalog({ includeHidden: true }),
        getHidden(),
        siteOptions(),
        listTournaments().catch(miss([])),
      ])
      return (
        <CatalogEditor
          catalog={catalog}
          sponsors={options.map((s) => ({ id: String(s.id), name: s.name }))}
          library={IMAGE_LIBRARY}
          hidden={hidden}
          tournaments={cups.map((t) => ({ id: t.id, title: t.title, startsAt: t.startsAt, status: t.status }))}
        />
      )
    }),
    section(ctx, 'users', 'Tüm üyeler', usersPanel),
    section(ctx, 'home', 'Ana sayfa ayarları', () => <HomeV2Editor initial={mergeHomeV2(content[HOME_V2_KEY])} />),
    section(ctx, 'withdrawals', 'Çekim paylaşımları', async () => {
      const w = await import('@/lib/withdrawals')
      const [shares, settings, siteRewards, sites, blocks] = await Promise.all([
        w.adminWithdrawals().catch(miss([])),
        w.getWithdrawSettings().catch(miss(w.WITHDRAW_DEFAULTS)),
        w.listSiteRewards().catch(miss([])),
        siteOptions().catch(miss([])),
        w.listWithdrawBlocks().catch(miss([])),
      ])
      return <WithdrawManager shares={shares} settings={settings} siteRewards={siteRewards} sites={sites.map((s) => ({ id: s.id, name: s.name }))} blocks={blocks} />
    }),
  ])
  const audit =
    session.isOwner && active === 'audit'
      ? await Promise.all([searchAudit(), listContentHistory()])
          .then(([log, history]) => (
            <TelegramTabs
              label="Log bölümleri"
              legend={false}
              tabs={[
                { id: 'log', label: 'İşlemler', content: <AuditLog initial={log} /> },
                { id: 'history', label: 'Ayar geçmişi', content: <ContentHistory initial={history} /> },
              ]}
            />
          ))
          .catch((error) => (console.error('[panel:audit]', error), failed('İşlem logları')))
      : null

  const onDash = active === 'dashboard'
  const [detail, dashCounts, dashRecent, dashStatsData, sysStatus] = await Promise.all([
    pendingDetail(can).catch(miss<PendingDetail>(EMPTY_PENDING)),
    onDash && can('users') ? memberCounts().catch(miss(null)) : null,
    onDash && session.isOwner ? recentAudit(8).catch(miss([])) : null,
    onDash && session.isOwner ? dashStats(parseQuery(params)).catch(miss(null)) : null,
    onDash && session.isOwner ? loadSystemStatus({ totpEnabled: session.totpEnabled }).catch(miss(null)) : null,
  ])
  const pending: Record<string, number> = {
    community: detail.reviews + detail.complaints + (detail.proofs ?? 0),
    withdrawals: detail.withdrawals,
    tasks: detail.claims,
    market: detail.market,
    growth: detail.sponsorAccounts ?? 0,
    social: (detail.socialAccounts ?? 0) + (detail.socialEntries ?? 0),
    moderation: moderationTotal(detail),
  }
  const dashboard = onDash ? (
    <div className="flex flex-col gap-6">
      {sysStatus ? <SystemStatus items={sysStatus} /> : null}
      <PanelDashboard counts={dashCounts} pending={detail} recent={dashRecent} stats={dashStatsData} />
    </div>
  ) : null
  const canModerate = can('community') || can('tasks') || can('market')
  const moderation = !canModerate
    ? null
    : active !== 'moderation'
      ? undefined
      : await moderationItems(can).then((items) => <ModerationQueue items={items} />).catch((error) => (console.error('[panel:moderation]', error), failed('Moderasyon kuyruğu')))
  const staff = session.isOwner && active === 'staff' ? await staffPanel().catch((error) => (console.error('[panel:staff]', error), failed('Personel listesi'))) : null

  return (
    <main className="min-h-dvh overflow-x-auto bg-background">
        <ContentEditor
          key={active}
          initialTab={active}
          dataGaps={dataGaps().count}
          userName={session.displayName}
          siteUrl={SITE_URL}
          logout={<LogoutButton />}
          allowed={allowed ?? Array.from(new Set(['slide', 'hero', 'texts', 'branding', 'logo', 'seo', 'faqs', 'tour', 'sponsors', 'growth', 'marketing', 'community', 'badges', 'tasks', 'market', 'social', 'limits', 'games', 'tournaments', 'cember', 'telegram', 'push', 'messages', 'rewards', 'catalog', 'studio', 'users']))}
          users={users}
          audit={audit}
          dashboard={dashboard}
          moderation={moderation === undefined ? <></> : moderation}
          isOwner={session.isOwner}
          slides={slides}
          heroes={heroes}
          library={IMAGE_LIBRARY}
          texts={texts}
          rewards={rewards}
          catalog={catalog}
          branding={branding}
          logos={logos}
          seo={seo}
          faqs={faqs}
          tour={tour}
          sponsors={sponsors}
          growth={growth}
          marketing={marketing}
          community={community}
          home={home}
          withdrawals={withdrawals}
          badges={badges}
          tasks={tasks}
          market={market}
          pending={pending}
          social={social}
          limits={limits}
          games={games}
          tournaments={tournaments}
          cember={cember}
          telegram={telegram}
          push={push}
          messages={messages}
          studio={studio}
          staff={staff}
          account={<AccountSettings username={session.username} isOwner={session.isOwner} totpEnabled={session.totpEnabled} totpRequired={session.totpRequired} />}
        />
    </main>
  )
}
