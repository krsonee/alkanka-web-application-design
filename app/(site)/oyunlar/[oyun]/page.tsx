import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Lock } from 'lucide-react'
import { GameStage } from '@/components/alkanka/games/game-stage'
import { ArenaStage } from '@/components/alkanka/arena/arena-stage'
import { GameTabs } from '@/components/alkanka/arena/game-tabs'
import { ARENA_GAMES, ARENA_META, isArenaGame, MINI_GAME_TITLES, type MiniGame } from '@/lib/arena'
import { getArenaSettings } from '@/lib/arena-server'
import { getHomeV2 } from '@/lib/home-v2'
import { isWizardGame } from '@/lib/home-v2-shared'
import { getHidden } from '@/lib/catalog'
import { isHidden } from '@/lib/hidden-shared'
import { breadcrumbLd, DEFAULT_OG, jsonLd, OG_BASE, shareImage, SITE_NAME, SITE_URL } from '@/lib/seo'

type MiniKey = MiniGame

const TITLES: Record<string, string> = {
  ...Object.fromEntries(ARENA_GAMES.map((g) => [g, ARENA_META[g].title])),
  ...MINI_GAME_TITLES,
}

export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(TITLES).map((oyun) => ({ oyun }))
}

const MINI_DESCRIPTIONS: Record<MiniKey, string> = {
  cark: 'Şans Çarkı’nı her gün ücretsiz çevir, Kanka Coin ve sürpriz ödüller kazan. Üye ol, hakkını kullan.',
  sandik: 'Gizemli Sandık’tan birini seç, içindeki Kanka Coin ödülünü anında al. Her gün yeni sandık hakkı.',
  zar: 'Zar At oyununda zarları salla, gelen sayıya göre Kanka Coin kazan. Ücretsiz günlük haklarla oyna.',
}

const MINI_SEO_TITLES: Record<MiniKey, string> = {
  cark: 'Şans Çarkı: Her Gün Ücretsiz Çevir, Coin Kazan',
  sandik: 'Gizemli Sandık: Her Gün Ücretsiz Sandık Aç',
  zar: 'Zar At: Ücretsiz Günlük Zar Oyunu',
}

const describe = (oyun: string) =>
  isArenaGame(oyun)
    ? `${ARENA_META[oyun].short} AL KANKA’da ücretsiz ${TITLES[oyun]} oyna, Kanka Coin kazan.`
    : MINI_DESCRIPTIONS[oyun as MiniKey]

const imageOf = (oyun: string) => (isArenaGame(oyun) ? ARENA_META[oyun].image : DEFAULT_OG)

function gameLd(oyun: string) {
  const path = `/oyunlar/${oyun}`
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: TITLES[oyun],
      description: describe(oyun),
      url: `${SITE_URL}${path}`,
      image: `${SITE_URL}${imageOf(oyun)}`,
      inLanguage: 'tr-TR',
      gamePlatform: 'Web tarayıcı',
      applicationCategory: 'Game',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    },
    breadcrumbLd([
      { name: 'Ana sayfa', path: '/' },
      { name: 'Oyunlar', path: '/oyunlar' },
      { name: TITLES[oyun], path },
    ]),
  ]
}

export async function generateMetadata({ params }: { params: Promise<{ oyun: string }> }): Promise<Metadata> {
  const { oyun } = await params
  if (!(oyun in TITLES)) notFound()
  const title = isArenaGame(oyun) ? `${TITLES[oyun]} Oyna — Ücretsiz, Kanka Coin Kazan` : MINI_SEO_TITLES[oyun as MiniKey]
  const description = describe(oyun)
  const path = `/oyunlar/${oyun}`
  const image = shareImage(imageOf(oyun))
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...OG_BASE, title, description, url: path, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default async function GamePage({ params }: { params: Promise<{ oyun: string }> }) {
  const { oyun } = await params
  if (!(oyun in TITLES)) notFound()
  const [settings, hidden, homeV2] = await Promise.all([
    getArenaSettings(),
    getHidden(),
    isWizardGame(oyun) ? getHomeV2().catch(() => null) : Promise.resolve(null),
  ])
  const isOpen = (k: string) => (isArenaGame(k) ? settings[k].enabled : !isHidden(hidden, 'mini', k))

  return (
    <div data-game-page className="flex min-w-0 flex-col gap-5">
      {isOpen(oyun) && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(gameLd(oyun))} />}
      <div className="flex flex-col gap-3 [body:has([data-table-playing])_&]:hidden">
        <Link href="/oyunlar" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tüm oyunlar
        </Link>
        <GameTabs
          current={oyun}
          items={Object.keys(TITLES)
            .filter(isOpen)
            .map((k) => ({ key: k, title: TITLES[k] }))}
        />
      </div>
      <h1 className="sr-only">{TITLES[oyun]}</h1>
      {isOpen(oyun) ? (
        isArenaGame(oyun) ? (
          <ArenaStage game={oyun} settings={settings[oyun]} setup={homeV2?.setup} />
        ) : (
          <GameStage game={oyun as MiniKey} />
        )
      ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center">
            <Lock className="size-8 text-primary" aria-hidden="true" />
            <p className="font-display text-xl font-bold uppercase text-foreground">{TITLES[oyun]} şu an kapalı</p>
            <p className="text-sm text-muted-foreground">Şu an bakımda. Telegram kanalımızdan duyuruları takip et.</p>
          </div>
      )}
    </div>
  )
}
