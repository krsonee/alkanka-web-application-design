import type { Metadata } from 'next'
import { PageHero } from '@/components/alkanka/page-hero'
import { Events } from '@/components/alkanka/events'

export const metadata: Metadata = { title: 'Tahminler | AL KANKA' }

export default function PredictionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Tahminler"
        title="Maç tahminleri"
        description="Skoru bil, Kanka Coin kazan. Tahminler maç başlamadan 10 dakika önce kapanır."
        pose="dusunen"
        speech="Bence bu maç gollü geçer kanka..."
      />
      <Events view="tahminler" />
    </>
  )
}
