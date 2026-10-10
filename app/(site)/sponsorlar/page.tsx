import type { Metadata } from 'next'
import { PageHero } from '@/components/alkanka/page-hero'
import { MainSponsor, SponsorDirectory } from '@/components/alkanka/partner-sites'
import { SPONSORS } from '@/components/alkanka/data'

export const metadata: Metadata = { title: 'Sponsorlar | AL KANKA' }

export default function SponsorsPage() {
  const vip = SPONSORS.filter((s) => s.tier === 'vip').length
  const trusted = SPONSORS.filter((s) => s.tier === 'guvenilir').length
  return (
    <>
      <PageHero
        eyebrow="Sponsorlar"
        title="Güvenilir sponsorlar"
        description="Lisans, ödeme hızı ve destek kalitesi her gün kontrol edilir. Sadece AL KANKA linkiyle gelenlere özel bonuslar."
        pose="jako"
        speech="Hepsini tek tek kontrol ettim kanka, gönül rahatlığıyla gir."
        stats={[
          { label: 'Toplam sponsor', value: String(SPONSORS.length) },
          { label: 'VIP', value: String(vip) },
          { label: 'Güvenilir', value: String(trusted) },
          { label: 'Ort. çekim', value: '18 dk' },
        ]}
      />
      <MainSponsor />
      <SponsorDirectory />
    </>
  )
}
