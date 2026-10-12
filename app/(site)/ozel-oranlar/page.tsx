import { pageMeta } from '@/lib/seo'
import { listLiveOdds } from '@/lib/deals'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { OddsBoard } from '@/components/alkanka/partner-sites'
import { LiveOddsBoard } from '@/components/alkanka/live-odds-board'
import { listPublicOdds } from '@/lib/public-boards'

export const metadata = pageMeta('ozel-oranlar')
export const dynamic = 'force-dynamic'

export default async function OddsPage() {
  const [deals, cards] = await Promise.all([listLiveOdds().catch(() => []), listPublicOdds().catch(() => [])])
  const liveOdds = deals.flatMap((d) => d.odds ?? [])
  const hasLive = deals.length > 0
  const stats = hasLive
    ? [
        { label: 'Aktif oran', value: String(liveOdds.length || deals.length) },
        { label: 'Marka', value: String(new Set(deals.map((d) => d.brand)).size) },
        { label: 'En yüksek', value: liveOdds.length ? Math.max(...liveOdds.map((o) => o.newOdd)).toFixed(2) : '-' },
      ]
    : [
        { label: 'Aktif kart', value: String(cards.length) },
        { label: 'Site', value: String(new Set(cards.map((card) => card.siteName)).size) },
        { label: 'Kaynak', value: 'Panel' },
      ]

  return (
    <>
      <EditableHero slug="ozel-oranlar"
        image="/images/heroes/ozel-oranlar.png"
        eyebrow="Özel oranlar"
        title="Artırılmış oranlar"
        description="Sponsorlarımızın sadece AL KANKA üyelerine açtığı yükseltilmiş oranlar. Süre ve limit dolmadan kuponunu yap."
        pose="dusunen"
        speech="Saat dolmadan kuponunu yap, sonra pişman olma."
        tone="accent"
        stats={stats}
      />
      {hasLive ? <LiveOddsBoard deals={deals} /> : <OddsBoard cards={cards} />}
    </>
  )
}
