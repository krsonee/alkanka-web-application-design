import type { Metadata } from 'next'
import { isAuthenticated } from '@/lib/admin-gate'
import { panelConfigured } from '@/app/panel/actions'
import { extraHeroes, extraSlideIds, getAllContent, type HeroOverride, type SlideOverride } from '@/lib/content'
import { TEXTS_KEY, type SiteTexts } from '@/lib/site-texts-shared'
import { TextsEditor } from '@/components/panel/texts-editor'
import { HERO_PAGES, IMAGE_LIBRARY } from '@/lib/site-registry'
import { SLIDES } from '@/components/alkanka/data'
import { LoginForm } from '@/components/panel/login-form'
import { ContentEditor } from '@/components/panel/content-editor'
import { PanelShell } from '@/components/panel/panel-shell'
import { LogoEditor } from '@/components/panel/logo-editor'
import { LOGO_TEAMS } from '@/lib/logo-registry'
import { ArenaSettingsEditor } from '@/components/panel/arena-settings-editor'
import { TournamentManager } from '@/components/panel/tournament-manager'
import { mergeArena, type ArenaSettings } from '@/lib/arena'
import { listTournaments } from '@/lib/tournaments'
import { pushStats } from '@/lib/push'
import { PushSender } from '@/components/panel/push-sender'
import { getCronKey, listBots, listLog, listSources, listTargets } from '@/lib/telegram-mirror'
import { TelegramMirror } from '@/components/panel/telegram-mirror'
import { TelegramChatSetup } from '@/components/panel/telegram-chat-setup'
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
import { listCatalog } from '@/lib/sponsor-catalog'
import { listAssets, listBrands, listJobs, studioSpend } from '@/lib/studio'
import { KpManager } from '@/components/panel/kp-manager'
import { AdsEditor } from '@/components/panel/ads-editor'
import { ADS_KEY, type AdMap } from '@/lib/ads'
import { ShareEditor } from '@/components/panel/share-editor'
import { MarketManager } from '@/components/panel/market-manager'
import { GrowthManager } from '@/components/panel/growth-manager'
import { SocialManager } from '@/components/panel/social-manager'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { DesignContentPanel } from '@/components/admin/DesignContentPanel'
import { HomeVisualsPanel } from '@/components/admin/HomeVisualsPanel'
import { StatisticsPanel } from '@/components/admin/StatisticsPanel'
import { PointsDesk } from '@/components/admin/PointsDesk'
import { MembersPanel } from '@/components/admin/MembersPanel'
import { ShortLinksPanel } from '@/components/admin/ShortLinksPanel'
import { EmailTemplatesPanel } from '@/components/admin/EmailTemplatesPanel'
import { adminEntries, adminSocialAccounts, getSocialLinks, listSocialEvents, type SocialLinks } from '@/lib/social'
import { adminSponsorAccounts, currentPeriod, flaggedMembers, followerCounts, getSiteLinks, trafficReport } from '@/lib/growth'
import { listProducts, listRequests, pendingCount } from '@/lib/market'
import { SHARE_KEY, type ShareSettings } from '@/lib/share'
import { AUTO_LABELS, getKpConfig, leaderboard, listSpecialBadges, recentAwards } from '@/lib/kanka-puan'

async function marketPanel(sponsors: { id: string; name: string }[]) {
  try {
    const [products, requests] = await Promise.all([listProducts({ includeInactive: true }), listRequests()])
    return <MarketManager products={products} requests={requests} sponsors={sponsors} />
  } catch (error) {
    console.error('[market-panel]', error)
    return <p className="text-sm text-destructive">Market yüklenemedi.</p>
  }
}

async function kpPanel() {
  try {
    const [cfg, badges, awards, board] = await Promise.all([getKpConfig(), listSpecialBadges({ includeInactive: true }), recentAwards(), leaderboard(50)])
    return <KpManager levels={cfg.levels} rules={cfg.rules} badges={badges} awards={awards} board={board} autoLabels={AUTO_LABELS} />
  } catch (error) {
    console.error('[kp-panel]', error)
    return <p className="text-sm text-destructive">Rozet sistemi yüklenemedi.</p>
  }
}

export const metadata: Metadata = { title: 'Yönetim paneli | AL KANKA', robots: { index: false } }

export default async function PanelPage() {
  if (!(await isAuthenticated())) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <LoginForm configured={await panelConfigured()} />
      </main>
    )
  }

  const content = await getAllContent()
  const push = await pushStats().catch(() => ({ total: 0, members: 0, log: [] }))
  const [tgBots, tgTargets, tgSources, tgLog, cronKey, tgChat, tgInvite, tgChannels] = await Promise.all([
    listBots().catch(() => []),
    listTargets().catch(() => []),
    listSources().catch(() => []),
    listLog().catch(() => []),
    getCronKey().catch(() => 'ANAHTAR'),
    chatStatus().catch(() => null),
    getInviteConfig().catch(() => null),
    getChannelUsernames().catch(() => null),
  ])
  const siteHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? 'siteadresin.com'
  const cronUrl = `https://${siteHost}/api/cron/telegram?key=${cronKey}`

  const slides = [
    ...SLIDES.map((s) => ({
      kind: 'slide' as const,
      id: s.id,
      label: s.eyebrow,
      path: '/',
      defaults: { eyebrow: s.eyebrow, title: s.title, description: s.description, cta: s.cta, image: s.image, href: s.href },
      saved: (content[`slide:${s.id}`] as SlideOverride | undefined) ?? null,
    })),
    ...extraSlideIds(content).map((id) => {
      const saved = (content[`slide:${id}`] as SlideOverride | undefined) ?? null
      return {
        kind: 'slide' as const,
        id,
        label: saved?.title || 'Ek slayt',
        path: '/',
        custom: true,
        defaults: { eyebrow: '', title: '', description: '', cta: 'İncele', image: '', href: '/' },
        saved,
      }
    }),
  ]

  const heroes = [
    ...HERO_PAGES.map((p) => ({
      kind: 'hero' as const,
      id: p.slug,
      label: p.label,
      path: p.path,
      defaults: { title: p.title, image: p.image },
      saved: (content[`hero:${p.slug}`] as HeroOverride | undefined) ?? null,
    })),
    ...extraHeroes(content).map((p) => ({
      kind: 'hero' as const,
      id: p.slug,
      label: p.label,
      path: p.path,
      custom: true,
      defaults: { title: p.label, image: '' },
      saved: (content[`hero:${p.slug}`] as HeroOverride | undefined) ?? null,
    })),
  ]

  const catalog = await listCatalog().catch(() => [])
  const sponsorOptions = catalog.map((site) => ({ id: site.id, name: site.name }))
  const sponsorNames = Object.fromEntries(sponsorOptions.map((site) => [site.id, site.name]))
  const marketPending = await pendingCount().catch(() => 0)

  return (
    <PanelShell
      sections={[
        {
          id: 'growth',
          group: 'Büyüme',
          label: 'Trafik ve büyüme',
          body: (
            <GrowthManager
              sites={sponsorOptions}
              links={await getSiteLinks().catch(() => ({}))}
              followers={await followerCounts().catch(() => ({}))}
              report={await trafficReport(30).catch(() => ({ days: 30, sources: [], sites: [], totalClicks: 0, totalSignups: 0 }))}
              flagged={await flaggedMembers().catch(() => [])}
              accounts={await adminSponsorAccounts().catch(() => [])}
              period={currentPeriod()}
              siteUrl={SITE_URL}
            />
          ),
        },
        {
          id: 'social',
          group: 'Büyüme',
          label: 'Sosyal medya',
          body: (
            <SocialManager
              links={await getSocialLinks().catch(() => ({}) as SocialLinks)}
              accounts={await adminSocialAccounts().catch(() => [])}
              events={await listSocialEvents({ includeInactive: true }).catch(() => [])}
              entries={await adminEntries().catch(() => [])}
            />
          ),
        },
        { id: 'market', group: 'Büyüme', label: 'Market', badge: marketPending, body: await marketPanel(sponsorOptions) },
        { id: 'badges', group: 'Üyeler', label: 'Rozetler', body: await kpPanel() },
        { id: 'points', group: 'Üyeler', label: 'Puan', body: <PointsDesk /> },
        { id: 'members', group: 'Üyeler', label: 'Üyeler', body: <MembersPanel /> },
        { id: 'sites', group: 'İçerik', label: 'Sponsorlar', body: <AdminDashboard bare initialTab="sites" /> },
        {
          id: 'slide',
          group: 'İçerik',
          label: 'Slider',
          body: <ContentEditor only="slide" slides={slides} heroes={heroes} library={IMAGE_LIBRARY} />,
        },
        {
          id: 'hero',
          group: 'İçerik',
          label: 'Sayfa başlıkları',
          body: <ContentEditor only="hero" slides={slides} heroes={heroes} library={IMAGE_LIBRARY} />,
        },
        { id: 'texts', group: 'İçerik', label: 'Site metinleri', body: <TextsEditor saved={(content[TEXTS_KEY] as SiteTexts | undefined) ?? {}} /> },
        {
          id: 'logos',
          group: 'İçerik',
          label: 'Logolar',
          body: (
            <>
              <ShareEditor saved={(content[SHARE_KEY] as ShareSettings | undefined) ?? {}} />
              <AdsEditor saved={(content[ADS_KEY] as AdMap | undefined) ?? {}} />
              <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                Sponsor logoları Sponsorlar menüsündeki Logo yükle butonuyla kaydedilir. Bu ekrandaki takım logoları tahmin kartları içindir.
              </p>
              <LogoEditor
                kind="teams"
                title={`Takım logoları (${LOGO_TEAMS.length})`}
                hint="Özel oranlar ve maç tahminlerinde takım adının yanında görünür."
                items={LOGO_TEAMS}
                saved={(content['logos:teams'] as Record<string, string> | undefined) ?? {}}
              />
            </>
          ),
        },
        { id: 'design', group: 'İçerik', label: 'Site içeriği', body: <DesignContentPanel /> },
        { id: 'home', group: 'İçerik', label: 'Ana sayfa', body: <HomeVisualsPanel /> },
        {
          id: 'games',
          group: 'Oyunlar',
          label: 'Oyunlar',
          body: <ArenaSettingsEditor settings={mergeArena(content['arena:settings'] as Partial<ArenaSettings> | undefined)} />,
        },
        { id: 'tournaments', group: 'Oyunlar', label: 'Turnuvalar', body: <TournamentManager tournaments={await listTournaments()} /> },
        {
          id: 'community',
          group: 'Topluluk',
          label: 'Topluluk',
          body: (
            <CommunityManager
              reviews={await pendingReviews().catch(() => [])}
              published={await publishedReviews().catch(() => [])}
              complaints={await adminComplaints().catch(() => [])}
              matches={await listLeagueMatches(null, { admin: true }).catch(() => [])}
              siteNames={sponsorNames}
            />
          ),
        },
        {
          id: 'studio',
          group: 'Topluluk',
          label: 'Stüdyo',
          body: (
            <Studio
              brands={await listBrands().catch(() => [])}
              assets={await listAssets().catch(() => [])}
              jobs={await listJobs().catch(() => [])}
              spend={await studioSpend().catch(() => ({ total: 0, month: 0, count: 0 }))}
            />
          ),
        },
        {
          id: 'seo',
          group: 'Topluluk',
          label: 'SEO ve rehber',
          body: (
            <SeoManager
              posts={await listPosts({ includeDrafts: true })}
              deals={await listDeals(30)}
              publishing={await dealsPublishing()}
              verification={await getVerification().catch(() => ({ google: '', bing: '', yandex: '' }))}
              siteUrl={SITE_URL}
            />
          ),
        },
        { id: 'push', group: 'İletişim', label: 'Bildirimler', body: <PushSender {...push} configured={push.total > 0} /> },
        {
          id: 'telegram',
          group: 'İletişim',
          label: 'Telegram',
          body: (
            <div className="flex flex-col gap-6">
              <TelegramMirror bots={tgBots} targets={tgTargets} sources={tgSources} log={tgLog} cronUrl={cronUrl} />
              <TelegramChatSetup bots={tgBots} status={tgChat} />
              <TelegramChannelsSetup usernames={tgChannels} />
              <TelegramInviteSetup bots={tgBots} status={tgInvite} />
            </div>
          ),
        },
        { id: 'email', group: 'İletişim', label: 'E-posta', body: <EmailTemplatesPanel /> },
        { id: 'news', group: 'İletişim', label: 'Duyurular', body: <AdminDashboard bare initialTab="news" /> },
        { id: 'popups', group: 'İletişim', label: 'Pop-up', body: <AdminDashboard bare initialTab="popups" /> },
        { id: 'stats', group: 'Yönetim', label: 'İstatistikler', body: <StatisticsPanel /> },
        { id: 'links', group: 'Yönetim', label: 'Kısa link', body: <ShortLinksPanel /> },
        { id: 'faq', group: 'Yönetim', label: 'SSS', body: <AdminDashboard bare initialTab="faq" /> },
        { id: 'settings', group: 'Yönetim', label: 'Ayarlar', body: <AdminDashboard bare initialTab="settings" /> },
      ]}
    />
  )
}
