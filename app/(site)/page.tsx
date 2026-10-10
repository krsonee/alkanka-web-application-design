import { BannerCarousel } from '@/components/alkanka/banner-carousel'
import { QuickTiles } from '@/components/alkanka/quick-tiles'
import { ActivityTicker } from '@/components/alkanka/activity-ticker'
import { EndingCampaigns, FeaturedSponsors } from '@/components/alkanka/partner-sites'
import { TopThree } from '@/components/alkanka/top-three'

export default function HomePage() {
  return (
    <>
      <h1 className="sr-only">AL KANKA: sponsorlar, kampanyalar ve ücretsiz mini oyunlar</h1>
      <div className="flex flex-col gap-4">
        <BannerCarousel />
        <QuickTiles />
        <ActivityTicker />
      </div>
      <FeaturedSponsors />
      <EndingCampaigns />
      <TopThree />
    </>
  )
}
