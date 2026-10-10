import type { Metadata } from 'next'
import { PageHero } from '@/components/alkanka/page-hero'
import { Events } from '@/components/alkanka/events'

export const metadata: Metadata = { title: 'Biletler | AL KANKA' }

export default function TicketsPage() {
  return (
    <>
      <PageHero
        image="/images/heroes/biletler.png"
        eyebrow="Biletler"
        title="Bilet çekilişleri"
        description="Haftalık bilet çekilişi ve günlük turnuvalar. Katıl, Kanka Coin havuzundan payını al."
        pose="kazandi"
        speech="Pazar 21:00 canlı çekiliş, kaçırma!"
        tone="accent"
      />
      <Events view="biletler" />
    </>
  )
}
