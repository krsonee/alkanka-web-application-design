import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { GamesHub } from '@/components/alkanka/games/games-hub'
import { getArenaSettings } from '@/lib/arena-server'
import { getHidden } from '@/lib/catalog'

export const metadata = pageMeta('oyunlar')

export default async function GamesPage() {
  const [arena, hidden] = await Promise.all([getArenaSettings(), getHidden()])
  return (
    <>
      <EditableHero slug="oyunlar"
        compact
        image="/images/heroes/oyunlar.png"
        highlights={['Canlı rakiplerle masa', 'Ücretsiz çark ve sandık', 'Kazancını katla']}
        eyebrow="Oyunlar"
        title="Tavla · Okey · Bilardo"
        description="Kanka Coin ile masaya otur, rakibini yen, kazancını katla. Ücretsiz çark ve sandık da seni bekliyor."
        pose="zar"
        speech="Hangisinden başlıyoruz kanka?"
      />
      <GamesHub arena={arena} hiddenMini={hidden.mini ?? []} />
    </>
  )
}
