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
import { PushSender } from '@/components/panel/push-sender'
import { MessageSender } from '@/components/panel/message-sender'
import { listSent } from '@/lib/inbox'
import { getCatalog, getHidden, getRewardConfig } from '@/lib/catalog'
import { RewardsEditor } from '@/components/panel/rewards-editor'
import { CatalogEditor } from '@/components/panel/catalog-editor'
import { getCronKey, listBots, listLog, listSources, listTargets } from '@/lib/telegram-mirror'
import { TelegramMirror } from '@/components/panel/telegram-mirror'
import { TelegramChatSetup } from '@/components/panel/telegram-chat-setup'
import { TelegramBotSuite } from '@/components/panel/telegram-bot-suite'
import { DEFAULT_SUITE, getBotSuite, listOddsDeals, shareStatus } from '@/lib/telegram-bots'
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
import { listProducts, listRequests, pendingCount } from '@/lib/market'
import { SitesManager } from '@/components/panel/sites-manager'
import { TasksManager } from '@/components/panel/tasks-manager'
import { FaqsManager } from '@/components/panel/faqs-manager'
import { listFaqs } from '@/lib/faqs'
import { listPendingClaims, listTasks } from '@/lib/tasks'
import { SHARE_KEY, type ShareSettings } from '@/lib/share'
import { AUTO_LABELS, getKpConfig, leaderboard, listSpecialBadges, recentAwards } from '@/lib/kanka-puan'
import { getOnlineConfig } from '@/lib/online-rewards'
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
  const [bots, targets, sources, log, cronKey, chat, invite, channels, suite, shareInfo, oddsDeals] = await Promise.all([
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
    listOddsDeals().catch(() => []),
  ])
  const siteHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? 'siteadresin.com'
  const cronUrl = `https://${siteHost}/api/cron/telegram?key=${cronKey}`
  return (
    <TelegramTabs
      tabs={[
        { id: 'mirror', label: 'Botlar ve aktarım', content: <TelegramMirror bots={bots} targets={targets} sources={sources} log={log} cronUrl={cronUrl} /> },
        { id: 'suite', label: 'Bot paketleri', content: <TelegramBotSuite suite={suite} bots={bots} targets={targets} status={shareInfo} deals={oddsDeals} /> },
        { id: 'chat', label: 'Site sohbeti', content: <TelegramChatSetup bots={bots} status={chat} /> },
        { id: 'channels', label: 'Kanallar', content: <TelegramChannelsSetup usernames={channels} /> },
        { id: 'invite', label: 'Davet linkleri', content: <TelegramInviteSetup bots={bots} status={invite} /> },
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
  const [cfg, badges, awards, board, online] = await Promise.all([getKpConfig(), listSpecialBadges({ includeInactive: true }), recentAwards(), leaderboard(50), getOnlineConfig()])
  return <KpManager levels={cfg.levels} rules={cfg.rules} badges={badges} awards={awards} board={board} autoLabels={AUTO_LABELS} online={online} />
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
    telegram,
    push,
    studio,
    messages,
    rewards,
    catalog,
    users,
  ] = await Promise.all([
    section(session, 'texts', 'Site yazıları', () => <TextsEditor saved={(content[TEXTS_KEY] as SiteTexts | undefined) ?? {}} />),
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
    )),
    section(session, 'community', 'Topluluk', async () => (
      <CommunityManager
        reviews={await pendingReviews().catch(() => [])}
        published={await publishedReviews().catch(() => [])}
        complaints={await adminComplaints().catch(() => [])}
        matches={await listLeagueMatches(null, { admin: true }).catch(() => [])}
        siteNames={Object.fromEntries((await siteOptions()).map((s) => [s.id, s.name]))}
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
    section(session, 'telegram', 'Telegram', telegramPanel),
    section(session, 'push', 'Bildirimler', async () => {
      const stats = await pushStats().catch(() => ({ total: 0, members: 0, log: [] }))
      return <PushSender {...stats} configured={stats.total > 0} />
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

  const marketPending = can('market') ? await pendingCount().catch(() => 0) : 0
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
          allowed={allowed ?? Array.from(new Set(['slide', 'hero', 'texts', 'branding', 'logo', 'seo', 'faqs', 'sponsors', 'growth', 'community', 'badges', 'tasks', 'market', 'social', 'limits', 'games', 'tournaments', 'telegram', 'push', 'messages', 'rewards', 'catalog', 'studio', 'users']))}
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
          marketPending={marketPending}
          social={social}
          limits={limits}
          games={games}
          tournaments={tournaments}
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
