import { pageMeta } from '@/lib/seo'
import { listLiveOdds } from '@/lib/deals'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { OddsBoard } from '@/components/alkanka/partner-sites'
import { LiveOddsBoard } from '@/components/alkanka/live-odds-board'
import { SPECIAL_ODDS } from '@/components/alkanka/data'

export const metadata = pageMeta('ozel-oranlar')
export const revalidate = 120

export default async function OddsPage() {
  const deals = await listLiveOdds()
  const liveOdds = deals.flatMap((d) => d.odds ?? [])
  const hasLive = deals.length > 0
  const stats = hasLive
    ? [
        { label: 'Aktif oran', value: String(liveOdds.length || deals.length) },
        { label: 'Marka', value: String(new Set(deals.map((d) => d.brand)).size) },
        { label: 'En yüksek', value: liveOdds.length ? Math.max(...liveOdds.map((o) => o.newOdd)).toFixed(2) : '-' },
      ]
    : [
        { label: 'Aktif oran', value: String(SPECIAL_ODDS.length) },
        { label: 'Lig', value: String(new Set(SPECIAL_ODDS.map((o) => o.league)).size) },
        { label: 'En yüksek', value: Math.max(...SPECIAL_ODDS.map((o) => o.newOdd)).toFixed(2) },
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
        compact
        stats={stats}
      />
      {hasLive ? <LiveOddsBoard deals={deals} /> : <OddsBoard />}
    </>
  )
}
