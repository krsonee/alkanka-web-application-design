import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
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
import { pendingCounts } from '@/lib/panel-pending'
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

async function usersPanel() {
  const [{ members, counts }, levels, cfg] = await Promise.all([listMembers(), levelMap().catch(() => ({}) as Record<string, number>), getKpConfig()])
  const names = Object.fromEntries(Object.entries(levels).map(([id, n]) => [id, cfg.levels[n - 1]?.name ?? 'Çaylak']))
  return <MembersManager initial={members} counts={counts} levels={names} />
}

function failed(label: string) {
  return <p className="text-sm text-destructive">{label} yüklenemedi.</p>
}

/** Loads a panel section only when the signed-in account may see it, so hidden sections never query their data. */
async function section(session: PanelSession, module: PanelModule, label: string, load: () => Promise<ReactNode> | ReactNode): Promise<ReactNode> {
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
  return <MarketManager products={products} requests={requests} sponsors={sponsors} />
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

export default async function PanelPage() {
  const session = await getPanelSession()
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
    section(session, 'texts', 'Site yazıları', () => (
      <div className="flex flex-col gap-10">
        <TextsEditor saved={(content[TEXTS_KEY] as SiteTexts | undefined) ?? {}} />
        <LegalEditor docs={mergeLegal(content[LEGAL_KEY] as LegalOverrides | undefined)} />
      </div>
    )),
    section(session, 'branding', 'Logo ayarları', async () => {
      const b = await getBranding()
      return <BrandingEditor logoUrl={b.logoUrl ?? ''} logoHeight={b.logoHeight ?? 36} iconSrc={b.icons?.['192'] ? `/app-icon/192?v=${b.iconVersion ?? 0}` : '/icon-192.png'} hasCustomIcon={!!b.icons?.['192']} />
    }),
    section(session, 'logo', 'Logolar', async () => {
      const logoSponsors = await listLogoSponsors()
      return (
      <>
        <ShareEditor saved={(content[SHARE_KEY] as ShareSettings | undefined) ?? {}} />
        <AdsEditor saved={(content[ADS_KEY] as AdMap | undefined) ?? {}} />
        <LogoEditor
          kind="sponsors"
          title={`Site logoları (${logoSponsors.length})`}
          hint="Sponsor kartlarında baş harflerin yerine görünür. Kare ya da şeffaf PNG/SVG logo linki yapıştır."
          items={logoSponsors}
          saved={(content['logos:sponsors'] as Record<string, string> | undefined) ?? {}}
        />
        <LogoEditor
          kind="teams"
          title={`Takım logoları (${LOGO_TEAMS.length})`}
          hint="Özel oranlar ve maç tahminlerinde takım adının yanında görünür."
          items={LOGO_TEAMS}
          saved={(content['logos:teams'] as Record<string, string> | undefined) ?? {}}
        />
      </>
      )
    }),
    section(session, 'seo', 'SEO', async () => (
      <SeoManager
        posts={await listPosts({ includeDrafts: true })}
        deals={await listDeals(30)}
        publishing={await dealsPublishing()}
        verification={await getVerification().catch(() => ({ google: '', bing: '', yandex: '' }))}
        siteUrl={SITE_URL}
      />
    )),
    section(session, 'faqs', 'Sorular', async () => <FaqsManager faqs={await listFaqs()} />),
    section(session, 'sponsors', 'Sponsorlar', async () => <SitesManager sites={await listSites()} />),
    section(session, 'growth', 'Büyüme', async () => (
      <div className="flex flex-col gap-6">
      <ReferralEditor settings={await getReferralSettings()} />
      <AmbientEditor settings={await getAmbientSettings()} />
      <GrowthManager
        sites={(await siteOptions()).map((s) => ({ id: s.id, name: s.name }))}
        recordNames={Object.fromEntries((await listSites().catch(() => [])).map((site) => [String(site.id), site.name]))}
        links={await getSiteLinks().catch(() => ({}))}
        followers={await followerCounts().catch(() => ({}))}
        report={await trafficReport(30).catch(() => ({ days: 30, sources: [], sites: [], totalClicks: 0, totalSignups: 0 }))}
        flagged={await flaggedMembers().catch(() => [])}
        accounts={await adminSponsorAccounts().catch(() => [])}
        period={currentPeriod()}
        siteUrl={SITE_URL}
        affLinks={await affLinkViews().catch(() => [])}
        affSites={(await listSites().catch(() => [])).map((s) => ({ id: s.id, name: s.name, slug: s.slug, active: s.active }))}
      />
      </div>
    )),
    section(session, 'community', 'Topluluk', async () => (
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
    section(session, 'badges', 'Rozet sistemi', kpPanel),
    section(session, 'tasks', 'Görevler', async () => {
      const [list, claims, sites] = await Promise.all([listTasks(), listPendingClaims(), siteOptions().catch(() => [])])
      return <TasksManager tasks={list} claims={claims} sites={sites.map((x) => ({ id: x.id, name: x.name }))} />
    }),
    section(session, 'market', 'Market', marketPanel),
    section(session, 'social', 'Sosyal medya', async () => (
      <SocialManager
        links={await getSocialLinks().catch(() => ({}) as SocialLinks)}
        accounts={await adminSocialAccounts().catch(() => [])}
        events={await listSocialEvents({ includeInactive: true }).catch(() => [])}
        entries={await adminEntries().catch(() => [])}
        api={await import('@/lib/social-verify')
          .then(async (m) => ({ summary: await m.socialApiSummary(), fields: m.API_FIELDS }))
          .catch(() => undefined)}
      />
    )),
    section(session, 'limits', 'Kısıtlamalar', async () => <LimitsManager limits={await listLimits()} />),
    section(session, 'games', 'Oyun ayarları', () => (
      <ArenaSettingsEditor
        settings={mergeArena(content['arena:settings'] as Partial<ArenaSettings> | undefined)}
        winRate={Number((content['arena:house'] as { winRate?: number } | undefined)?.winRate ?? 40)}
      />
    )),
    section(session, 'tournaments', 'Turnuvalar', async () => <TournamentManager tournaments={await listTournaments()} />),
    section(session, 'cember', 'Jako Çemberi', async () => <CemberPanel />),
    section(session, 'telegram', 'Telegram', telegramPanel),
    section(session, 'push', 'Bildirimler', async () => {
      const [stats, appSettings] = await Promise.all([
        pushStats().catch(() => ({ total: 0, members: 0, log: [] })),
        getAppSettings(),
      ])
      return (
        <div className="flex flex-col gap-6">
          <AppRewardsEditor settings={appSettings} />
          <PushSender {...stats} configured={stats.total > 0} />
        </div>
      )
    }),
    section(session, 'studio', 'Stüdyo', async () => (
      <Studio
        brands={await listBrands().catch(() => [])}
        assets={await listAssets().catch(() => [])}
        jobs={await listJobs().catch(() => [])}
        spend={await studioSpend().catch(() => ({ total: 0, month: 0, count: 0 }))}
      />
    )),
    section(session, 'messages', 'Site içi mesajlar', async () => <MessageSender sent={await listSent()} />),
    section(session, 'rewards', 'Ödül ayarları', async () => {
      const [config, hidden] = await Promise.all([getRewardConfig(), getHidden()])
      return <RewardsEditor initial={config} hidden={hidden.mini ?? []} />
    }),
    section(session, 'catalog', 'Etkinlik ve kampanyalar', async () => {
      const [{ rewards: _rewards, ...catalog }, hidden, options] = await Promise.all([getCatalog({ includeHidden: true }), getHidden(), siteOptions()])
      return <CatalogEditor catalog={catalog} sponsors={options.map((s) => ({ id: String(s.id), name: s.name }))} library={IMAGE_LIBRARY} hidden={hidden} />
    }),
    section(session, 'users', 'Tüm üyeler', usersPanel),
  ])
  const audit = session.isOwner ? await listAudit().then((e) => <AuditLog entries={e} />).catch((error) => (console.error('[panel:audit]', error), failed('İşlem logları'))) : null

  const pending = await pendingCounts(can).catch(() => ({}) as Record<string, number>)
  const marketPending = pending.market ?? 0
  const dashCounts = can('users') ? await listMembers({ limit: 1 }).then((r) => r.counts).catch(() => null) : null
  const dashRecent = session.isOwner ? await listAudit(8).catch(() => []) : []
  const dashboard = <PanelDashboard counts={dashCounts} marketPending={marketPending} recent={dashRecent} />
  const staff = session.isOwner ? await staffPanel().catch((error) => (console.error('[panel:staff]', error), failed('Personel listesi'))) : null

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold uppercase tracking-tight text-foreground">AL KANKA panel</span>
            <span className="text-xs text-muted-foreground">
              {session.displayName}
              {session.isOwner ? ' · Ana yönetici' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={SITE_URL} target="_blank" rel="noopener" className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary">
              Siteyi aç
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <ContentEditor
          allowed={allowed ?? Array.from(new Set(['slide', 'hero', 'texts', 'branding', 'logo', 'seo', 'faqs', 'sponsors', 'growth', 'community', 'badges', 'tasks', 'market', 'social', 'limits', 'games', 'tournaments', 'cember', 'telegram', 'push', 'messages', 'rewards', 'catalog', 'studio', 'users']))}
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
      </div>
    </main>
  )
}
