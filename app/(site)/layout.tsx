import { BrandProvider } from '@/components/alkanka/brand-context'
import { PointsProvider } from '@/components/alkanka/points-context'
import { Sidebar } from '@/components/alkanka/sidebar'
import { Topbar } from '@/components/alkanka/topbar'
import { LiveRail } from '@/components/alkanka/live-rail'
import { TelegramBubble } from '@/components/alkanka/telegram-bubble'
import { getChatConfig } from '@/lib/telegram-chat'
import { getChannelUsernames } from '@/lib/telegram-channels'
import { TELEGRAM_URL, type TelegramLinks } from '@/components/alkanka/data'
import { MobileNav } from '@/components/alkanka/mobile-nav'
import { Footer } from '@/components/alkanka/footer'
import { AuthModal } from '@/components/alkanka/auth-modal'
import { GuestGate } from '@/components/alkanka/guest-gate'
import { LogoProvider } from '@/components/alkanka/logo-context'
import { getLogos } from '@/lib/content'
import { getSiteTexts } from '@/lib/site-texts'
import { getSocialLinks } from '@/lib/social'
import type { SocialLinks } from '@/lib/social-shared'
import { listPublicSponsors } from '@/lib/sites'
import { TextsProvider } from '@/components/alkanka/texts-context'
import { getAppSettings } from '@/lib/app-settings'
import { PwaProvider } from '@/components/alkanka/app/pwa-provider'
import { AppPrompts } from '@/components/alkanka/app/app-prompts'
import { SiteTour } from '@/components/alkanka/app/site-tour'
import { getTourSettings } from '@/lib/tour'
import { ReferralLinker } from '@/components/alkanka/community/referral-linker'
import { KpHeartbeat } from '@/components/alkanka/kp/heartbeat'
import { WinnersTicker } from '@/components/alkanka/kp/winners-ticker'
import { JakoAlerts } from '@/components/alkanka/jako-alerts'
import { CatalogProvider } from '@/components/alkanka/catalog-context'
import { getCatalog } from '@/lib/catalog'
import { CemberOverlay } from '@/components/alkanka/cember/cember-overlay'
import { SessionGuard } from '@/components/alkanka/session-guard'
import { TvDockProvider } from '@/components/alkanka/kankatv/tv-dock'
import { BoostStrip } from '@/components/alkanka/boost-strip'
import { currentBoosts } from '@/lib/boosts'
import { after } from 'next/server'
import { runAutoTick } from '@/lib/auto-tick'
import { MarketingTags } from '@/components/alkanka/marketing-tags'
import { getTracking } from '@/lib/marketing'
import { EMPTY_TRACKING } from '@/lib/marketing-shared'
import { TelegramStrip } from '@/components/alkanka/telegram-strip'
import { getTelegramPromo } from '@/lib/telegram-promo'
import { TELEGRAM_PROMO_DEFAULTS } from '@/lib/telegram-promo-config'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  after(() => runAutoTick())
  const [logos, texts, social, sponsors, catalog, chatConfig, appSettings, tourSettings] = await Promise.all([
    getLogos(),
    getSiteTexts(),
    getSocialLinks().catch((): SocialLinks => ({})),
    listPublicSponsors().catch(() => []),
    getCatalog(),
    getChatConfig().catch(() => null),
    getAppSettings(),
    getTourSettings(),
  ])
  const [boosts, tracking, tgPromo] = await Promise.all([
    currentBoosts().catch(() => []),
    getTracking().catch(() => EMPTY_TRACKING),
    getTelegramPromo().catch(() => TELEGRAM_PROMO_DEFAULTS),
  ])
  const chatLive = Boolean(chatConfig)
  const searchSponsors = sponsors.map((s) => ({ id: s.id, name: s.name, welcome: s.welcome }))
  const channels = await getChannelUsernames().catch(() => null)
  const tgUrl = (username?: string | null) => (username ? `https://t.me/${username.replace(/^@/, '')}` : TELEGRAM_URL)
  const telegram: TelegramLinks = {
    duyuru: tgUrl(channels?.duyuru),
    sohbet: social.telegram || chatConfig?.inviteUrl || TELEGRAM_URL,
    ozelOran: tgUrl(channels?.['ozel-oran']),
    promo: tgUrl(channels?.promo),
  }
  return (
    <TextsProvider value={texts}>
    <CatalogProvider value={catalog}>
    <LogoProvider value={logos}>
    <BrandProvider>
      <PointsProvider>
      <PwaProvider settings={appSettings}>
      <TvDockProvider>
        <Sidebar social={social} telegram={telegram} />
        {chatLive && <LiveRail />}
        <div
          className={
            chatLive
              ? 'min-h-dvh transition-[padding] duration-200 lg:pl-[var(--sidebar-w)] xl:pr-80'
              : 'min-h-dvh transition-[padding] duration-200 lg:pl-[var(--sidebar-w)]'
          }
        >
          {tgPromo.enabled && (
            <TelegramStrip
              text={tgPromo.text}
              cta={tgPromo.cta}
              reward={tgPromo.reward}
              href={tgPromo.url || telegram.duyuru}
              reshowDays={tgPromo.reshowDays}
            />
          )}
          <Topbar social={social} sponsors={searchSponsors} telegram={telegram} />
          <WinnersTicker />
          <main className="mx-auto flex max-w-screen-2xl flex-col gap-10 px-4 py-5 pb-24 lg:px-6 lg:pb-5">
            {boosts.length > 0 && <BoostStrip boosts={boosts} />}
            {children}
            <Footer />
          </main>
        </div>
        <MobileNav />
        {chatLive && <TelegramBubble />}
        <AuthModal />
        <GuestGate />
        <AppPrompts />
        <SiteTour settings={tourSettings} />
        <ReferralLinker />
        <KpHeartbeat />
        <JakoAlerts />
        <CemberOverlay />
        <SessionGuard />
        <MarketingTags settings={tracking} />
      </TvDockProvider>
      </PwaProvider>
      </PointsProvider>
    </BrandProvider>
    </LogoProvider>
    </CatalogProvider>
    </TextsProvider>
  )
}
