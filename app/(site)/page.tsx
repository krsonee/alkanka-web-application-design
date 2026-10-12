import { BannerCarousel } from '@/components/alkanka/banner-carousel'
import { QuickTiles } from '@/components/alkanka/quick-tiles'
import { ActivityTicker } from '@/components/alkanka/activity-ticker'
import { EndingCampaigns, FeaturedSponsors } from '@/components/alkanka/partner-sites'
import { TopThree } from '@/components/alkanka/top-three'
import { SLIDES, TELEGRAM_URL } from '@/components/alkanka/data'
import { listCatalog, pickFeatured } from '@/lib/sponsor-catalog'
import { distributedCoins, listPublicCampaigns, tickerFromAnnouncements } from '@/lib/public-boards'
import { jsonLd, pageMeta, SITE_NAME, SITE_URL } from '@/lib/seo'
import { extraSlideIds, getAllContent, withoutEmpty, type SlideOverride } from '@/lib/content'

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
  const content = await getAllContent()
  const [sponsors, campaigns, ticker, coins] = await Promise.all([
    listCatalog().catch(() => []),
    listPublicCampaigns().catch(() => []),
    tickerFromAnnouncements().catch(() => []),
    distributedCoins().catch(() => 0),
  ])
  const featured = pickFeatured(sponsors)
  const slides = [
    ...SLIDES.flatMap((s) => {
      const saved = content[`slide:${s.id}`] as SlideOverride | undefined
      if (saved?.hidden) return []
      const href = saved?.href?.trim()
      return [{ ...s, ...withoutEmpty(saved), ...(href ? { href } : {}) }]
    }),
    ...extraSlideIds(content).flatMap((id) => {
      const saved = content[`slide:${id}`] as SlideOverride | undefined
      if (!saved || saved.hidden || !saved.title?.trim()) return []
      return [{
        id,
        eyebrow: saved.eyebrow || 'Slayt',
        title: saved.title,
        description: saved.description || '',
        cta: saved.cta || 'İncele',
        href: saved.href?.trim() || '/',
        image: saved.image || '/images/banner-events.png',
      }]
    }),
  ]

  return (
    <>
      <SiteJsonLd />
      <h1 className="sr-only">AL KANKA: sponsorlar, kampanyalar ve ücretsiz mini oyunlar</h1>
      <div className="flex flex-col gap-4">
        <BannerCarousel slides={slides} />
        <QuickTiles coins={coins} />
        <ActivityTicker events={ticker} />
      </div>
      <FeaturedSponsors main={featured.main} cards={featured.cards} total={featured.total} />
      <EndingCampaigns campaigns={campaigns} sponsors={sponsors} />
      <TopThree />
    </>
  )
}
