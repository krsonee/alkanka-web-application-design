import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { adminConfigured } from '@/lib/admin-auth'
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
import { SLIDES } from '@/components/alkanka/data'
import { CUSTOM_SLIDES_KEY, readCustomSlides } from '@/lib/custom-slides'
import { LoginForm, LogoutButton } from '@/components/panel/login-form'
import { ContentEditor } from '@/components/panel/content-editor'
import { LogoEditor } from '@/components/panel/logo-editor'
import { LOGO_TEAMS, listLogoSponsors } from '@/lib/logo-registry'
import { ArenaSettingsEditor } from '@/components/panel/arena-settings-editor'
import { TournamentManager } from '@/components/panel/tournament-manager'
import { mergeArena, type ArenaSettings } from '@/lib/arena'
import { listTournaments } from '@/lib/tournaments'
import { pushStats } from '@/lib/push'
import { getQuestConfig, questWinnersThisWeek } from '@/lib/kp-extras'
import { PushSender } from '@/components/panel/push-sender'
import { AppRewardsEditor } from '@/components/panel/app-rewards-editor'
import { getAppSettings } from '@/lib/app-settings'
import { MessageSender } from '@/components/panel/message-sender'
import { listSent } from '@/lib/inbox'
import { getCatalog, getHidden, getRewardConfig } from '@/lib/catalog'
import { RewardsEditor } from '@/components/panel/rewards-editor'
import { CatalogEditor } from '@/components/panel/catalog-editor'
import { getCronKey, listBots, listLog, listSources, listTargets } from '@/lib/telegram-mirror'
import { TelegramMirror } from '@/components/panel/telegram-mirror'
import { TelegramChatSetup } from '@/components/panel/telegram-chat-setup'
import { ApprovalSection, ShareSection } from '@/components/panel/telegram-bot-suite'
import { OddsBotManager } from '@/components/panel/odds-bot-manager'
import { getOddsBotConfig, listAdminOdds, listOddsSources, oddsBotStatus } from '@/lib/special-odds'
import { DEFAULT_ODDS_BOT } from '@/lib/special-odds-shared'
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
import { getChannelUsernames } from '@/lib/telegram-channels'
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
import { KpManager } from '@/components/panel/kp-manager'
import { AdsEditor } from '@/components/panel/ads-editor'
import { ADS_KEY, type AdMap } from '@/lib/ads'
import { ShareEditor } from '@/components/panel/share-editor'
import { MarketManager } from '@/components/panel/market-manager'
import { GrowthManager } from '@/components/panel/growth-manager'
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
import { pendingDetail } from '@/lib/panel-pending'
import { SHARE_KEY, type ShareSettings } from '@/lib/share'
import { AUTO_LABELS, getKpConfig, leaderboard, listSpecialBadges, recentAwards } from '@/lib/kanka-puan'
import { getOnlineConfig, getTickerConfig } from '@/lib/online-rewards'
import { BrandingEditor } from '@/components/panel/branding-editor'
import { getBranding } from '@/lib/branding'
import { LimitsManager } from '@/components/panel/limits-manager'
import { listLimits } from '@/lib/member-limits'
import { StaffManager, type StaffRow } from '@/components/panel/staff-manager'
import { AccountSettings } from '@/components/panel/account-settings'
import { cleanPermissions } from '@/lib/panel-modules'
import { MembersManager } from '@/components/panel/members-manager'
import { AuditLog } from '@/components/panel/audit-log'
import { PanelDashboard } from '@/components/panel/dashboard'
import { TelegramTabs } from '@/components/panel/telegram-tabs'
import { listAudit, listMembers } from '@/lib/members-admin'
import { levelMap } from '@/lib/kanka-puan'
import { AvatarManager } from '@/components/panel/avatar-manager'
import { COVERS, avatarStats, listCatalog } from '@/lib/avatars'
import { getHouseWinRate } from '@/app/actions/wallet'

async function usersPanel() {
  const [{ members, counts }, levels, cfg] = await Promise.all([listMembers(), levelMap().catch(() => ({}) as Record<string, number>), getKpConfig()])
  const names = Object.fromEntries(Object.entries(levels).map(([id, n]) => [id, cfg.levels[n - 1]?.name ?? 'Çaylak']))
  return <MembersManager initial={members} counts={counts} levels={names} />
}

function failed(label: string) {
  return <p className="text-sm text-destructive">{label} yüklenemedi.</p>
}

type SectionCtx = { session: PanelSession; active: string }

/** Loads a panel section only when it is the open one and the account may see it, so other sections never query their data. */
async function section({ session, active }: SectionCtx, module: PanelModule, label: string, load: () => Promise<ReactNode> | ReactNode): Promise<ReactNode> {
  if (active !== module) return null
  if (!session.isOwner && !session.permissions.includes(module)) return null
  try {
    return await load()
  } catch (error) {
    console.error(`[panel:${module}]`, error)
    return failed(label)
  }
}

async function telegramPanel() {
  const [oddsConfig, oddsStatus, oddsSources, oddsList] = await Promise.all([
    getOddsBotConfig().catch(() => DEFAULT_ODDS_BOT),
    oddsBotStatus().catch(() => ({ webhookUrl: null, pending: 0, lastError: null, lastUpdateAt: null, todayTotal: 0 })),
    listOddsSources().catch(() => []),
    listAdminOdds().catch(() => []),
  ])
  const [bots, targets, sources, log, cronKey, chat, invite, channels, suite, shareInfo] = await Promise.all([
    listBots().catch(() => []),
    listTargets().catch(() => []),
    listSources().catch(() => []),
    listLog().catch(() => []),
    getCronKey().catch(() => 'ANAHTAR'),
    chatStatus().catch(() => null),
    getInviteConfig().catch(() => null),
    getChannelUsernames().catch(() => null),
    getBotSuite().catch(() => DEFAULT_SUITE),
    shareStatus().catch(() => ({ lastError: null, lastRunAt: null, shared: 0 })),
  ])
  const [tvConfig, tvStatus, tvToday] = await Promise.all([
    getTvConfig().catch(() => DEFAULT_TV),
    tvBotStatus().catch(() => ({ lastRunAt: null, lastError: null, sent: 0, tracked: 0 })),
    tvStats().catch(() => ({ watchersToday: 0, minutesToday: 0, coinsToday: 0, predictionsToday: 0, openPredictions: 0, follows: 0 })),
  ])
  const [betsConfig, betsStatus, betsToday, betsMarkets, betsHistory] = await Promise.all([
    getBetsConfig().catch(() => DEFAULT_BETS),
    betsBotStatus().catch(() => ({ lastRunAt: null, lastError: null, sent: 0, opened: 0, settled: 0, voided: 0 })),
    betsStats().catch(() => ({ betsToday: 0, stakedToday: 0, paidToday: 0, burnedToday: 0, openMarkets: 0, openStake: 0, players: 0 })),
    adminMarkets().catch(() => []),
    betsLog().catch(() => []),
  ])
  const siteHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? 'siteadresin.com'
  const cronUrl = `https://${siteHost}/api/cron/telegram?key=${cronKey}`
  const tvCronUrl = `https://${siteHost}/api/cron/kankatv?key=${cronKey}`
  const light = (ok: boolean) => (ok ? 'on' : 'off') as 'on' | 'off'
  return (
    <TelegramTabs
      tabs={[
        { id: 'mirror', label: 'Bağlantı & Cron', status: light(bots.length > 0 && sources.length > 0), content: <TelegramMirror bots={bots} targets={targets} sources={sources} log={log} cronUrl={cronUrl} /> },
        { id: 'chat', label: 'Canlı Sohbet', status: light(Boolean(chat?.webhook?.url) && !chat?.webhook?.lastError), content: <TelegramChatSetup bots={bots} status={chat} /> },
        { id: 'odds', label: 'Özel Oran Botu', status: light(oddsConfig.enabled && Boolean(oddsStatus.webhookUrl) && !oddsStatus.lastError), content: <OddsBotManager config={oddsConfig} status={oddsStatus} bots={bots} sources={oddsSources} odds={oddsList} /> },
        {
          id: 'kankatv',
          label: 'KankaTV Gol Botu',
          status: light((tvConfig.goalBot.enabled || tvConfig.goalBot.push) && !tvStatus.lastError),
          content: <KankaTvManager config={tvConfig} status={tvStatus} stats={tvToday} targets={targets} cronUrl={tvCronUrl} />,
        },
        {
          id: 'tvbets',
          label: 'KankaTV Canlı Etkinlik',
          status: light(betsConfig.enabled && !betsStatus.lastError),
          content: <TvBetsManager config={betsConfig} status={betsStatus} stats={betsToday} markets={betsMarkets} log={betsHistory} targets={targets} />,
        },
        { id: 'approvals', label: 'Bildirim Botu', status: light(suite.approvals.enabled && suite.approvals.botId != null && Boolean(suite.approvals.chatId)), content: <ApprovalSection suite={suite} bots={bots} /> },
        { id: 'share', label: 'Post Paylaşım', status: light(suite.share.enabled && suite.share.botId != null && !shareInfo.lastError), content: <ShareSection suite={suite} bots={bots} targets={targets} status={shareInfo} /> },
        { id: 'invite', label: 'Davet linkleri', status: light(invite != null), content: <TelegramInviteSetup bots={bots} status={invite} /> },
        { id: 'channels', label: 'Kanallar', content: <TelegramChannelsSetup usernames={channels} /> },
      ]}
    />
  )
}

async function marketPanel() {
  const [products, requests, sites] = await Promise.all([listProducts({ includeInactive: true }), listRequests(), listSites()])
  const sponsors = sites.filter((site) => site.slug).map((site) => ({ id: String(site.id), name: site.name }))
  const [avatars, stats, coverRows] = await Promise.all([
    listCatalog({ includeInactive: true }),
    avatarStats(),
    rows<{ id: string; n: string }>(sql`SELECT cover_id AS id, count(*) AS n FROM member_look WHERE cover_id IS NOT NULL GROUP BY cover_id`).catch(() => []),
  ])
  const coverUsage = Object.fromEntries(coverRows.map((r) => [r.id, Number(r.n)]))
  return (
    <TelegramTabs
      label="Market bölümleri"
      tabs={[
        { id: 'products', label: `Ürünler & talepler${requests.length ? ` (${requests.length})` : ''}`, content: <MarketManager products={products} requests={requests} sponsors={sponsors} /> },
        { id: 'avatars', label: 'Avatarlar & kapaklar', content: <AvatarManager avatars={avatars} stats={stats} covers={COVERS} coverUsage={coverUsage} /> },
      ]}
    />
  )
}

async function kpPanel() {
  const [cfg, badges, awards, board, online, ticker, quest, questWinners] = await Promise.all([getKpConfig(), listSpecialBadges({ includeInactive: true }), recentAwards(), leaderboard(50), getOnlineConfig(), getTickerConfig(), getQuestConfig(), questWinnersThisWeek()])
  return <KpManager levels={cfg.levels} rules={cfg.rules} badges={badges} awards={awards} board={board} autoLabels={AUTO_LABELS} online={online} ticker={ticker} quest={quest} questWinners={questWinners} />
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
  }))
  return <StaffManager accounts={accounts} />
}

export const metadata: Metadata = { title: 'Yönetim paneli | AL KANKA', robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } } }

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const [session, params] = await Promise.all([getPanelSession(), searchParams])
  if (!session) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4">
        <LoginForm configured={adminConfigured()} />
      </main>
    )
  }

  const content = await getAllContent()
  const can = (m: PanelModule) => session.isOwner || session.permissions.includes(m)
  const allowed = session.isOwner ? null : session.permissions
  const active = params.b || 'dashboard'
  const ctx: SectionCtx = { session, active }

  const slides = can('slide')
    ? SLIDES.map((s) => ({
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
          saved: { eyebrow: s.eyebrow, title: s.title, description: s.description, cta: s.cta, image: s.image, href: s.href },
        })),
      )
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
      const logoSponsors = await listLogoSponsors()
      return (
        <TelegramTabs
          label="Paylaşım, reklam ve logolar"
          tabs={[
            { id: 'share', label: 'Paylaşım görseli', content: <ShareEditor saved={(content[SHARE_KEY] as ShareSettings | undefined) ?? {}} /> },
            { id: 'ads', label: 'Reklam alanları', content: <AdsEditor saved={(content[ADS_KEY] as AdMap | undefined) ?? {}} /> },
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
    section(ctx, 'seo', 'SEO', async () => (
      <SeoManager
        posts={await listPosts({ includeDrafts: true })}
        deals={await listDeals(30)}
        publishing={await dealsPublishing()}
        verification={await getVerification().catch(() => ({ google: '', bing: '', yandex: '' }))}
        siteUrl={SITE_URL}
      />
    )),
    section(ctx, 'faqs', 'Sorular', async () => <FaqsManager faqs={await listFaqs()} />),
    section(ctx, 'tour', 'Site turu', async () => {
      const { getTourSettings, tourStats } = await import('@/lib/tour')
      const { TourSettingsEditor } = await import('@/components/panel/tour-settings-editor')
      const [settings, stats] = await Promise.all([
        getTourSettings(),
        tourStats().catch(() => ({ done: 0, rewarded: 0, blocked: 0, paidTotal: 0, recentBlocked: [] })),
      ])
      return <TourSettingsEditor settings={settings} stats={stats} />
    }),
    section(ctx, 'sponsors', 'Sponsorlar', async () => <SitesManager sites={await listSites()} />),
    section(ctx, 'growth', 'Büyüme', async () => {
      const [referral, ambient, options, allSites, links, followers, report, flagged, accounts, affLinks] = await Promise.all([
        getReferralSettings(),
        getAmbientSettings(),
        siteOptions(),
        listSites().catch(() => []),
        getSiteLinks().catch(() => ({})),
        followerCounts().catch(() => ({})),
        trafficReport(30).catch(() => ({ days: 30, sources: [], sites: [], totalClicks: 0, totalSignups: 0 })),
        flaggedMembers().catch(() => []),
        adminSponsorAccounts().catch(() => []),
        affLinkViews().catch(() => []),
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
            { id: 'ambient', label: 'Masa doluluğu', content: <AmbientEditor settings={ambient} /> },
          ]}
        />
      )
    }),
    section(ctx, 'community', 'Topluluk', async () => (
      <CommunityManager
        reviews={await pendingReviews().catch(() => [])}
        published={await publishedReviews().catch(() => [])}
        complaints={await adminComplaints().catch(() => [])}
        matches={await listLeagueMatches(null, { admin: true }).catch(() => [])}
        siteNames={Object.fromEntries((await siteOptions()).map((s) => [s.id, s.name]))}
        withdraw={await (async () => {
          const w = await import('@/lib/withdrawals')
          const [shares, settings, siteRewards, sites, blocks] = await Promise.all([
            w.adminWithdrawals().catch(() => []),
            w.getWithdrawSettings().catch(() => w.WITHDRAW_DEFAULTS),
            w.listSiteRewards().catch(() => []),
            siteOptions().catch(() => []),
            w.listWithdrawBlocks().catch(() => []),
          ])
          return { shares, settings, siteRewards, sites: sites.map((s) => ({ id: s.id, name: s.name })), blocks }
        })()}
      />
    )),
    section(ctx, 'badges', 'Rozet sistemi', kpPanel),
    section(ctx, 'tasks', 'Görevler', async () => {
      const [list, claims, sites] = await Promise.all([listTasks(), listPendingClaims(), siteOptions().catch(() => [])])
      return <TasksManager tasks={list} claims={claims} sites={sites.map((x) => ({ id: x.id, name: x.name }))} />
    }),
    section(ctx, 'market', 'Market', marketPanel),
    section(ctx, 'social', 'Sosyal medya', async () => (
      <SocialManager
        links={await getSocialLinks().catch(() => ({}) as SocialLinks)}
        channels={await getChannelUsernames().catch(() => null)}
        accounts={await adminSocialAccounts().catch(() => [])}
        events={await listSocialEvents({ includeInactive: true }).catch(() => [])}
        entries={await adminEntries().catch(() => [])}
        api={await import('@/lib/social-verify')
          .then(async (m) => ({ summary: await m.socialApiSummary(), fields: m.API_FIELDS }))
          .catch(() => undefined)}
      />
    )),
    section(ctx, 'limits', 'Kısıtlamalar', async () => <LimitsManager limits={await listLimits()} />),
    section(ctx, 'games', 'Oyun ayarları', () => (
      <ArenaSettingsEditor
        settings={mergeArena(content['arena:settings'] as Partial<ArenaSettings> | undefined)}
        winRate={Number((content['arena:house'] as { winRate?: number } | undefined)?.winRate ?? 40)}
      />
    )),
    section(ctx, 'tournaments', 'Turnuvalar', async () => <TournamentManager tournaments={await listTournaments()} />),
    section(ctx, 'cember', 'Jako Çemberi', async () => <CemberPanel />),
    section(ctx, 'telegram', 'Telegram', telegramPanel),
    section(ctx, 'push', 'Bildirimler', async () => {
      const [stats, appSettings] = await Promise.all([
        pushStats().catch(() => ({ total: 0, members: 0, log: [] })),
        getAppSettings(),
      ])
      return (
        <TelegramTabs
          label="Bildirim bölümleri"
          tabs={[
            { id: 'send', label: 'Bildirim gönder', content: <PushSender {...stats} configured={stats.total > 0} /> },
            { id: 'app-rewards', label: 'Uygulama ödülleri', content: <AppRewardsEditor settings={appSettings} /> },
          ]}
        />
      )
    }),
    section(ctx, 'studio', 'Stüdyo', async () => (
      <Studio
        brands={await listBrands().catch(() => [])}
        assets={await listAssets().catch(() => [])}
        jobs={await listJobs().catch(() => [])}
        spend={await studioSpend().catch(() => ({ total: 0, month: 0, count: 0 }))}
      />
    )),
    section(ctx, 'messages', 'Site içi mesajlar', async () => <MessageSender sent={await listSent()} />),
    section(ctx, 'rewards', 'Ödül ayarları', async () => {
      const [config, hidden, winRate] = await Promise.all([getRewardConfig(), getHidden(), getHouseWinRate()])
      return <RewardsEditor initial={config} hidden={hidden.mini ?? []} winRate={winRate} />
    }),
    section(ctx, 'catalog', 'Etkinlik ve kampanyalar', async () => {
      const [{ rewards: _rewards, ...catalog }, hidden, options] = await Promise.all([getCatalog({ includeHidden: true }), getHidden(), siteOptions()])
      return <CatalogEditor catalog={catalog} sponsors={options.map((s) => ({ id: String(s.id), name: s.name }))} library={IMAGE_LIBRARY} hidden={hidden} />
    }),
    section(ctx, 'users', 'Tüm üyeler', usersPanel),
  ])
  const audit = session.isOwner && active === 'audit' ? await listAudit().then((e) => <AuditLog entries={e} />).catch((error) => (console.error('[panel:audit]', error), failed('İşlem logları'))) : null

  const onDash = active === 'dashboard'
  const [detail, dashCounts, dashRecent] = await Promise.all([
    pendingDetail(can).catch(() => ({ reviews: 0, complaints: 0, withdrawals: 0, claims: 0, market: 0 })),
    onDash && can('users') ? listMembers({ limit: 1 }).then((r) => r.counts).catch(() => null) : null,
    onDash && session.isOwner ? listAudit(8).catch(() => []) : [],
  ])
  const pending: Record<string, number> = { community: detail.reviews + detail.complaints + detail.withdrawals, tasks: detail.claims, market: detail.market }
  const dashboard = onDash ? <PanelDashboard counts={dashCounts} pending={detail} recent={dashRecent} /> : null
  const staff = session.isOwner && active === 'staff' ? await staffPanel().catch((error) => (console.error('[panel:staff]', error), failed('Personel listesi'))) : null

  return (
    <main className="min-h-dvh overflow-x-auto bg-background">
        <ContentEditor
          key={active}
          initialTab={active}
          userName={session.displayName}
          siteUrl={SITE_URL}
          logout={<LogoutButton />}
          allowed={allowed ?? Array.from(new Set(['slide', 'hero', 'texts', 'branding', 'logo', 'seo', 'faqs', 'tour', 'sponsors', 'growth', 'community', 'badges', 'tasks', 'market', 'social', 'limits', 'games', 'tournaments', 'cember', 'telegram', 'push', 'messages', 'rewards', 'catalog', 'studio', 'users']))}
          users={users}
          audit={audit}
          dashboard={dashboard}
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
          community={community}
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
