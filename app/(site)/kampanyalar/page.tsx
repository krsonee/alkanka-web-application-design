import { Suspense } from 'react'
import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { CampaignHub } from '@/components/alkanka/campaign-hub'
import { AdFrame } from '@/components/alkanka/ad-frame'
import { getCatalog } from '@/lib/catalog'
import { MainSponsorRotator } from '@/components/alkanka/partner-sites'
import { listPublicSponsors, pickFeatured } from '@/lib/sites'

export const metadata = pageMeta('kampanyalar')

export default async function CampaignsPage() {
  const [sponsors, { events: EVENTS, bonuses: BONUSES, campaigns: CAMPAIGNS }] = await Promise.all([
    listPublicSponsors().catch(() => []),
    getCatalog(),
  ])
  const { mains } = pickFeatured(sponsors)
  return (
    <>
      <EditableHero slug="kampanyalar"
        image="/images/heroes/kampanyalar.png"
        eyebrow="Kampanyalar"
        title="Kampanyalar"
        description="AL KANKA etkinlikleri ve sponsor sitelerin bonusları tek yerde. Yeni kampanyalar ilk Telegram kanalına düşer."
        pose="duyuru"
        speech="Yeni kampanya düştü kankalar!"
        compact
        stats={[
          { label: 'AL KANKA etkinliği', value: String(EVENTS.length) },
          { label: 'Sponsor bonusu', value: String(BONUSES.length + CAMPAIGNS.length) },
          { label: 'Bugün bitiyor', value: String(CAMPAIGNS.filter((c) => c.hoursLeft <= 24).length) },
        ]}
      />
      <AdFrame page="kampanyalar">
        {mains.length > 0 && <MainSponsorRotator sponsors={mains} />}
        <Suspense>
          <CampaignHub />
        </Suspense>
      </AdFrame>
    </>
  )
}
