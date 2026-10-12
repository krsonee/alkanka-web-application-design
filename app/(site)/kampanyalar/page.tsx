import { Suspense } from 'react'
import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { CampaignHub } from '@/components/alkanka/campaign-hub'
import { AdFrame } from '@/components/alkanka/ad-frame'
import { bonusesFrom, listCatalog } from '@/lib/sponsor-catalog'
import { listPublicCampaigns, publicTournaments } from '@/lib/public-boards'

export const metadata = pageMeta('kampanyalar')
export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const [sponsors, campaigns, tournaments] = await Promise.all([
    listCatalog().catch(() => []),
    listPublicCampaigns().catch(() => []),
    publicTournaments().catch(() => []),
  ])
  const bonuses = bonusesFrom(sponsors)
  return (
    <>
      <EditableHero slug="kampanyalar"
        image="/images/heroes/kampanyalar.png"
        eyebrow="Kampanyalar"
        title="Kampanyalar"
        description="AL KANKA etkinlikleri ve sponsor sitelerin bonusları tek yerde. Yeni kampanyalar ilk Telegram kanalına düşer."
        pose="duyuru"
        speech="Yeni kampanya düştü kankalar!"
        stats={[
          { label: 'AL KANKA etkinliği', value: String(tournaments.length) },
          { label: 'Sponsor bonusu', value: String(bonuses.length + campaigns.length) },
          { label: 'Yayındaki kampanya', value: String(campaigns.length) },
        ]}
      />
      <AdFrame page="kampanyalar">
        <Suspense>
          <CampaignHub
            sponsors={sponsors}
            bonuses={bonuses}
            campaigns={campaigns}
            events={tournaments.map((item) => ({
              id: String(item.id),
              title: item.title,
              detail: item.description || item.prizeNote || item.status,
              href: '/turnuvalar',
            }))}
          />
        </Suspense>
      </AdFrame>
    </>
  )
}
