import { BannerCarousel } from '@/components/alkanka/banner-carousel'
import { QuickTiles } from '@/components/alkanka/quick-tiles'
import { ActivityTicker } from '@/components/alkanka/activity-ticker'
import { EndingCampaigns, FeaturedSponsors } from '@/components/alkanka/partner-sites'
import { TopThree } from '@/components/alkanka/top-three'
import { SLIDES } from '@/components/alkanka/data'
import { getAllContent, withoutEmpty, type SlideOverride } from '@/lib/content'

export default async function HomePage() {
  const content = await getAllContent()
  const slides = SLIDES.map((s) => ({ ...s, ...withoutEmpty(content[`slide:${s.id}`] as SlideOverride | undefined) }))

  return (
    <>
      <h1 className="sr-only">AL KANKA: sponsorlar, kampanyalar ve ücretsiz mini oyunlar</h1>
      <div className="flex flex-col gap-4">
        <BannerCarousel slides={slides} />
        <QuickTiles />
        <ActivityTicker />
      </div>
      <FeaturedSponsors />
      <EndingCampaigns />
      <TopThree />
    </>
  )
}
