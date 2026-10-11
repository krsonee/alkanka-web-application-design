import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { MainSponsor, SponsorDirectory } from '@/components/alkanka/partner-sites'
import { SPONSORS } from '@/components/alkanka/data'
import { AdFrame } from '@/components/alkanka/ad-frame'

export const metadata = pageMeta('sponsorlar')

export default function SponsorsPage() {
  const vip = SPONSORS.filter((s) => s.tier === 'vip').length
  const trusted = SPONSORS.filter((s) => s.tier === 'guvenilir').length
  return (
    <>
      <EditableHero slug="sponsorlar"
        image="/images/heroes/sponsorlar.png"
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
      <AdFrame page="sponsorlar">
        <MainSponsor />
        <SponsorDirectory />
      </AdFrame>
    </>
  )
}
