import { breadcrumbLd, jsonLd, pageMeta, SITE_NAME, SITE_URL } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { GamesHub } from '@/components/alkanka/games/games-hub'
import { ARENA_GAMES, ARENA_META, MINI_GAME_TITLES } from '@/lib/arena'
import { getArenaSettings } from '@/lib/arena-server'
import { getHidden } from '@/lib/catalog'
import { isHidden } from '@/lib/hidden-shared'

export const metadata = pageMeta('oyunlar')

export default async function GamesPage() {
  const [arena, hidden] = await Promise.all([getArenaSettings(), getHidden()])
  const openGames = [
    ...ARENA_GAMES.filter((g) => arena[g].enabled).map((g) => ({ slug: g as string, name: ARENA_META[g].title })),
    ...Object.entries(MINI_GAME_TITLES)
      .filter(([slug]) => !isHidden(hidden, 'mini', slug))
      .map(([slug, name]) => ({ slug, name })),
  ]
  const listLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${SITE_NAME} oyunları`,
      itemListElement: openGames.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.name, url: `${SITE_URL}/oyunlar/${g.slug}` })),
    },
    breadcrumbLd([
      { name: 'Ana sayfa', path: '/' },
      { name: 'Oyunlar', path: '/oyunlar' },
    ]),
  ]
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(listLd)} />
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
