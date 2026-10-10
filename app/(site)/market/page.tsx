import type { Metadata } from 'next'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { PointsMarket } from '@/components/alkanka/points-market'

export const metadata: Metadata = { title: 'Puan Marketi | AL KANKA' }

export default function MarketPage() {
  return (
    <>
      <EditableHero slug="market"
        image="/images/heroes/market.png"
        eyebrow="Market"
        title="Puan marketi"
        description="Rozet, ekstra hak ve hediyelik. Nakit yok. Topladığın Kanka Coin ile dilediğini al."
        pose="market"
        speech="Coinlerini burada harca kanka, stoklar sınırlı!"
      />
      <PointsMarket />
    </>
  )
}
