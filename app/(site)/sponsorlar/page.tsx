import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { MainSponsorRotator, SponsorDirectory } from '@/components/alkanka/partner-sites'
import { AdFrame } from '@/components/alkanka/ad-frame'
import { listPublicSponsors, pickFeatured } from '@/lib/sites'

export const metadata = pageMeta('sponsorlar')
export const dynamic = 'force-dynamic'

export default async function SponsorsPage() {
  const sponsors = await listPublicSponsors().catch(() => [])
  const featured = pickFeatured(sponsors)
  const premium = sponsors.filter((site) => site.tier === 'ana' || site.tier === 'elit' || site.tier === 'vip').length
  const trusted = sponsors.filter((site) => site.tier === 'guvenilir').length
  const minutes = sponsors.map((site) => Number.parseInt(site.payout, 10)).filter((value) => value > 0)
  const average = minutes.length ? `${Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length)} dk` : '—'
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
          { label: 'Toplam sponsor', value: String(sponsors.length) },
          { label: 'Ana · Elit · VIP', value: String(premium) },
          { label: 'Güvenilir', value: String(trusted) },
          { label: 'Ort. çekim', value: average },
        ]}
      />
      <AdFrame page="sponsorlar">
        {featured.mains.length > 0 ? <MainSponsorRotator sponsors={featured.mains} /> : null}
        <SponsorDirectory sponsors={sponsors} mainId={featured.main?.id} />
      </AdFrame>
    </>
  )
}
