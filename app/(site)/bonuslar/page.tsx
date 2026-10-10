import type { Metadata } from 'next'
import { PageHero } from '@/components/alkanka/page-hero'
import { BonusBoard } from '@/components/alkanka/partner-sites'
import { BONUSES } from '@/components/alkanka/data'

export const metadata: Metadata = { title: 'Bonuslar | AL KANKA' }

export default function BonusesPage() {
  return (
    <>
      <PageHero
        eyebrow="Bonuslar"
        title="Bonus kodları"
        description="Kodu kopyala, kayıt olurken yapıştır. Bonuslar sadece AL KANKA linkiyle gelenlere tanımlanır."
        pose="market"
        speech="Kodu kopyalamayı unutma kanka!"
        stats={[
          { label: 'Aktif bonus', value: String(BONUSES.length) },
          { label: 'Kodlu', value: String(BONUSES.filter((b) => b.code).length) },
          { label: 'En yüksek', value: '%300' },
        ]}
      />
      <BonusBoard />
    </>
  )
}
