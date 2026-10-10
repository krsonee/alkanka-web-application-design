import type { Metadata } from 'next'
import { PageHero } from '@/components/alkanka/page-hero'
import { GamesHub } from '@/components/alkanka/games/games-hub'

export const metadata: Metadata = { title: 'Oyunlar | AL KANKA' }

export default function GamesPage() {
  return (
    <>
      <PageHero
        image="/images/heroes/oyunlar.png"
        eyebrow="Oyunlar"
        title="Çark · Zar · Sandık"
        description="Tamamen ücretsiz mini oyunlar. Kazandığın Kanka Coin anında bakiyene eklenir ve markette harcanır."
        pose="zar"
        speech="Hangisinden başlıyoruz kanka?"
      />
      <GamesHub />
    </>
  )
}
