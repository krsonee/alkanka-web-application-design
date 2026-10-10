import { BrandProvider } from '@/components/alkanka/brand-context'
import { PointsProvider } from '@/components/alkanka/points-context'
import { Sidebar } from '@/components/alkanka/sidebar'
import { Topbar } from '@/components/alkanka/topbar'
import { LiveRail } from '@/components/alkanka/live-rail'
import { MobileNav } from '@/components/alkanka/mobile-nav'
import { BannerCarousel } from '@/components/alkanka/banner-carousel'
import { QuickTiles } from '@/components/alkanka/quick-tiles'
import { ActivityTicker } from '@/components/alkanka/activity-ticker'
import { PartnerSites } from '@/components/alkanka/partner-sites'
import { GamesHub } from '@/components/alkanka/games/games-hub'
import { PointsMarket } from '@/components/alkanka/points-market'
import { Tasks } from '@/components/alkanka/tasks'
import { Events } from '@/components/alkanka/events'
import { Leaderboard } from '@/components/alkanka/leaderboard'
import { Faq } from '@/components/alkanka/faq'
import { Footer } from '@/components/alkanka/footer'

export default function Page() {
  return (
    <BrandProvider>
      <PointsProvider>
        <Sidebar />
        <LiveRail />
        <div className="min-h-dvh lg:pl-64 xl:pr-80">
          <Topbar />
          <main id="anasayfa" className="mx-auto flex max-w-screen-2xl scroll-mt-20 flex-col gap-12 px-4 py-5 lg:px-6">
            <div className="flex flex-col gap-4">
              <BannerCarousel />
              <QuickTiles />
              <ActivityTicker />
            </div>
            <PartnerSites />
            <GamesHub />
            <PointsMarket />
            <Tasks />
            <Events />
            <Leaderboard />
            <Faq />
            <Footer />
          </main>
        </div>
        <MobileNav />
      </PointsProvider>
    </BrandProvider>
  )
}
