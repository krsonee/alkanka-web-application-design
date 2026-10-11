import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { CampaignBoard } from '@/components/alkanka/partner-sites'
import { CAMPAIGNS } from '@/components/alkanka/data'

export const metadata = pageMeta('kampanyalar')

export default function CampaignsPage() {
  return (
    <>
      <EditableHero slug="kampanyalar"
        image="/images/heroes/kampanyalar.png"
        eyebrow="Kampanyalar"
        title="Kampanyalar"
        description="Turnuvalar, iadeler, freespin yağmurları ve çekilişler. Yeni kampanyalar ilk Telegram kanalına düşer."
        pose="duyuru"
        speech="Yeni kampanya düştü kankalar!"
        stats={[
          { label: 'Aktif kampanya', value: String(CAMPAIGNS.length) },
          { label: 'Bugün bitiyor', value: String(CAMPAIGNS.filter((c) => c.hoursLeft <= 24).length) },
          { label: 'Kategori', value: String(new Set(CAMPAIGNS.map((c) => c.tag)).size) },
        ]}
      />
      <CampaignBoard />
    </>
  )
}
