import type { Metadata } from 'next'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { GamesHub } from '@/components/alkanka/games/games-hub'
import { getArenaSettings } from '@/lib/arena-server'

export const metadata: Metadata = { title: 'Oyunlar | AL KANKA' }

export default async function GamesPage() {
  const arena = await getArenaSettings()
  return (
    <>
      <EditableHero slug="oyunlar"
        image="/images/heroes/oyunlar.png"
        eyebrow="Oyunlar"
        title="Tavla · Okey · Bilardo"
        description="Kanka Coin ile masaya otur, rakibini yen, kazancını katla. Ücretsiz çark ve sandık da seni bekliyor."
        pose="zar"
        speech="Hangisinden başlıyoruz kanka?"
      />
      <GamesHub arena={arena} />
    </>
  )
}
