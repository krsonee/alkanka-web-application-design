import { BannerCarousel } from '@/components/alkanka/banner-carousel'
import { QuickTiles } from '@/components/alkanka/quick-tiles'
import { ActivityTicker } from '@/components/alkanka/activity-ticker'
import { EndingCampaigns, FeaturedSponsors } from '@/components/alkanka/partner-sites'
import { TopThree } from '@/components/alkanka/top-three'
import { SLIDES, TELEGRAM_URL } from '@/components/alkanka/data'
import { jsonLd, pageMeta, SITE_NAME, SITE_URL } from '@/lib/seo'
import { getAllContent, withoutEmpty, type SlideOverride } from '@/lib/content'

export const metadata = pageMeta('anasayfa')

const SITE_LD = [
  { '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/app-icon-512.png`, sameAs: [TELEGRAM_URL] },
  { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE_URL, inLanguage: 'tr-TR' },
]

function SiteJsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(SITE_LD)} />
}

export default async function HomePage() {
  const content = await getAllContent()
  const slides = SLIDES.map((s) => ({ ...s, ...withoutEmpty(content[`slide:${s.id}`] as SlideOverride | undefined) }))

  return (
    <>
      <SiteJsonLd />
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
