import type { Metadata } from 'next'
import { PageHero } from '@/components/alkanka/page-hero'
import { OddsBoard } from '@/components/alkanka/partner-sites'
import { SPECIAL_ODDS } from '@/components/alkanka/data'

export const metadata: Metadata = { title: 'Özel Oranlar | AL KANKA' }

export default function OddsPage() {
  return (
    <>
      <PageHero
        eyebrow="Özel oranlar"
        title="Artırılmış oranlar"
        description="Sponsorlarımızın sadece AL KANKA üyelerine açtığı yükseltilmiş oranlar. Süre ve limit dolmadan kuponunu yap."
        pose="dusunen"
        speech="Saat dolmadan kuponunu yap, sonra pişman olma."
        tone="accent"
        stats={[
          { label: 'Aktif oran', value: String(SPECIAL_ODDS.length) },
          { label: 'Lig', value: String(new Set(SPECIAL_ODDS.map((o) => o.league)).size) },
          { label: 'En yüksek', value: Math.max(...SPECIAL_ODDS.map((o) => o.newOdd)).toFixed(2) },
        ]}
      />
      <OddsBoard />
    </>
  )
}
