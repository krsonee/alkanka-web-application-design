import type { Metadata } from 'next'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { GamesHub } from '@/components/alkanka/games/games-hub'

export const metadata: Metadata = { title: 'Oyunlar | AL KANKA' }

export default function GamesPage() {
  return (
    <>
      <EditableHero slug="oyunlar"
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
