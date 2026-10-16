import { BannerCarousel } from '@/components/alkanka/banner-carousel'
import { QuickTiles } from '@/components/alkanka/quick-tiles'
import { ActivityTicker } from '@/components/alkanka/activity-ticker'
import { EndingCampaigns, FeaturedSponsors } from '@/components/alkanka/partner-sites'
import { TopThree } from '@/components/alkanka/top-three'
import { SLIDES, TELEGRAM_URL } from '@/components/alkanka/data'
import { CUSTOM_SLIDES_KEY, readCustomSlides } from '@/lib/custom-slides'
import { jsonLd, pageMeta, SITE_NAME, SITE_URL } from '@/lib/seo'
import { getAllContent, withoutEmpty, type SlideOverride } from '@/lib/content'
import { listPublicSponsors, pickFeatured } from '@/lib/sites'
import { HIDDEN_KEY, readHidden, withoutHidden } from '@/lib/hidden-shared'
import { readLeaderboard, sumKpPoints } from '@/lib/kanka-puan'

export const metadata = pageMeta('anasayfa')
export const dynamic = 'force-dynamic'

const SITE_LD = [
  { '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/app-icon-512.png`, sameAs: [TELEGRAM_URL] },
  { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE_URL, inLanguage: 'tr-TR' },
]

function SiteJsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(SITE_LD)} />
}

export default async function HomePage() {
  const [content, sponsors, podium, distributed] = await Promise.all([
    getAllContent(),
    listPublicSponsors().catch(() => []),
    readLeaderboard(3),
    sumKpPoints(),
  ])
  const featured = pickFeatured(sponsors)
  const hidden = readHidden(content[HIDDEN_KEY])
  const slides = withoutHidden(SLIDES, hidden, 'slide')
    .map((s) => ({ ...s, ...withoutEmpty(content[`slide:${s.id}`] as SlideOverride | undefined) }))
    .concat(withoutHidden(readCustomSlides(content[CUSTOM_SLIDES_KEY]), hidden, 'slide'))

  return (
    <>
      <SiteJsonLd />
      <h1 className="sr-only">AL KANKA: sponsorlar, kampanyalar ve ücretsiz mini oyunlar</h1>
      <div className="flex flex-col gap-4">
        <BannerCarousel slides={slides} />
        <QuickTiles distributed={distributed} />
        <ActivityTicker />
      </div>
      <FeaturedSponsors main={featured.main} mains={featured.mains} cards={featured.cards} total={featured.total} />
      <EndingCampaigns />
      <TopThree rows={podium.map((row) => ({ userId: row.userId, name: row.name, points: row.kp }))} />
    </>
  )
}
