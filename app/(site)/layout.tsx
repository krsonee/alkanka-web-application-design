import { BrandProvider } from '@/components/alkanka/brand-context'
import { PointsProvider } from '@/components/alkanka/points-context'
import { Sidebar } from '@/components/alkanka/sidebar'
import { Topbar } from '@/components/alkanka/topbar'
import { LiveRail } from '@/components/alkanka/live-rail'
import { TelegramBubble } from '@/components/alkanka/telegram-bubble'
import { MobileNav } from '@/components/alkanka/mobile-nav'
import { Footer } from '@/components/alkanka/footer'
import { AuthModal } from '@/components/alkanka/auth-modal'
import { GuestGate } from '@/components/alkanka/guest-gate'
import { LogoProvider } from '@/components/alkanka/logo-context'
import { getLogos } from '@/lib/content'
import { getSiteTexts } from '@/lib/site-texts'
import { getSocialLinks } from '@/lib/social'
import { listPublicSponsors } from '@/lib/sites'
import { TextsProvider } from '@/components/alkanka/texts-context'
import { PwaProvider } from '@/components/alkanka/app/pwa-provider'
import { AppPrompts } from '@/components/alkanka/app/app-prompts'
import { SiteTour } from '@/components/alkanka/app/site-tour'
import { ReferralLinker } from '@/components/alkanka/community/referral-linker'
import { KpHeartbeat } from '@/components/alkanka/kp/heartbeat'
import { WinnersTicker } from '@/components/alkanka/kp/winners-ticker'
import { JakoAlerts } from '@/components/alkanka/jako-alerts'
import { CatalogProvider } from '@/components/alkanka/catalog-context'
import { getCatalog } from '@/lib/catalog'
import { CemberOverlay } from '@/components/alkanka/cember/cember-overlay'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [logos, texts, social, sponsors, catalog] = await Promise.all([
    getLogos(),
    getSiteTexts(),
    getSocialLinks().catch(() => ({})),
    listPublicSponsors().catch(() => []),
    getCatalog(),
  ])
  const searchSponsors = sponsors.map((s) => ({ id: s.id, name: s.name, welcome: s.welcome }))
  return (
    <TextsProvider value={texts}>
    <CatalogProvider value={catalog}>
    <LogoProvider value={logos}>
    <BrandProvider>
      <PointsProvider>
      <PwaProvider>
        <Sidebar social={social} />
        <LiveRail />
        <div className="min-h-dvh lg:pl-64 xl:pr-80">
          <Topbar social={social} sponsors={searchSponsors} />
          <WinnersTicker />
          <main className="mx-auto flex max-w-screen-2xl flex-col gap-10 px-4 py-5 pb-24 lg:px-6 lg:pb-5">
            {children}
            <Footer />
          </main>
        </div>
        <MobileNav />
        <TelegramBubble />
        <AuthModal />
        <GuestGate />
        <AppPrompts />
        <SiteTour />
        <ReferralLinker />
        <KpHeartbeat />
        <JakoAlerts />
        <CemberOverlay />
      </PwaProvider>
      </PointsProvider>
    </BrandProvider>
    </LogoProvider>
    </CatalogProvider>
    </TextsProvider>
  )
}
