import type { Metadata } from 'next'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { BonusBoard } from '@/components/alkanka/partner-sites'
import { BONUSES } from '@/components/alkanka/data'

export const metadata: Metadata = { title: 'Bonuslar | AL KANKA' }

export default function BonusesPage() {
  return (
    <>
      <EditableHero slug="bonuslar"
        image="/images/heroes/bonuslar.png"
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
