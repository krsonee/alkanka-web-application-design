import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { MainSponsor, SponsorDirectory } from '@/components/alkanka/partner-sites'
import { AdFrame } from '@/components/alkanka/ad-frame'
import { listPublicSponsors, pickFeatured } from '@/lib/sites'

export const metadata = pageMeta('sponsorlar')
export const dynamic = 'force-dynamic'

export default async function SponsorsPage() {
  const sponsors = await listPublicSponsors().catch(() => [])
  const featured = pickFeatured(sponsors)
  const vip = sponsors.filter((site) => site.tier === 'vip').length
  const trusted = sponsors.filter((site) => site.tier === 'guvenilir').length
  const minutes = sponsors.map((site) => Number.parseInt(site.payout, 10)).filter((value) => value > 0)
  const average = minutes.length ? `${Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length)} dk` : '—'
  return (
    <>
      <EditableHero slug="sponsorlar"
        image="/images/heroes/sponsorlar.png"
        eyebrow="Sponsorlar"
        title="Güvenilir sponsorlar"
        description="Liste, logo, bonus ve sıra paneldeki Sponsorlar menüsünden gelir. Sadece panelde aktif olan siteler görünür."
        pose="jako"
        speech="Hepsini paneldeki listeden okudum kanka."
        stats={[
          { label: 'Toplam sponsor', value: String(sponsors.length) },
          { label: 'VIP', value: String(vip) },
          { label: 'Güvenilir', value: String(trusted) },
          { label: 'Ort. çekim', value: average },
        ]}
      />
      <AdFrame page="sponsorlar">
        {featured.main ? <MainSponsor sponsor={featured.main} /> : null}
        <SponsorDirectory sponsors={sponsors} mainId={featured.main?.id} />
      </AdFrame>
    </>
  )
}
