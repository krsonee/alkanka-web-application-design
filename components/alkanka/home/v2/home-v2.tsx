import { HOME_GAME_LABEL, type HomeV2Config } from '@/lib/home-v2-shared'
import { MemberHeroSlider, type MemberSlide } from './member-hero-slider'
import type { MarketProduct } from '@/lib/market'
import type { MiniStatus } from '@/app/actions/wallet'
import { HeroSlider } from './hero-slider'
import { MarketTabs } from './market-tabs'
import {
  DailyGrid,
  FreeGrid,
  GamesGrid,
  Leaderboard,
  NewbieCard,
  PromoCards,
  SectionHead,
  WalletCard,
  type DailyState,
} from './sections'

type Row = { userId: string; name: string; points: number }

const MINI_BY_HREF: Record<string, keyof Omit<MiniStatus, 'hidden'>> = {
  '/oyunlar/cark': 'cark',
  '/oyunlar/sandik': 'sandik',
  '/oyunlar/zar': 'zar',
}

export function GuestHomeV2({ config, products, weekly, bonus }: { config: HomeV2Config; products: MarketProduct[]; weekly: Row[]; bonus: number }) {
  const primaryLabel = config.guestPrimaryCta.replace('{bonus}', String(bonus))
  return (
    <div className="flex flex-col gap-10">
      <HeroSlider
        slides={config.slides}
        eyebrow={config.guestEyebrow}
        title={config.guestTitle}
        highlight={config.guestHighlight}
        text={config.guestText}
        primary={{ label: primaryLabel, href: config.guestPrimaryHref }}
        secondary={{ label: config.guestSecondaryCta, href: config.guestSecondaryHref }}
      />
      {config.showNewbie && <NewbieCard title={config.newbieTitle} text={config.newbieText} />}

      {config.free.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHead title={config.freeTitle} sub={config.freeSub} />
          <FreeGrid tiles={config.free} />
        </section>
      )}

      {config.games.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHead title={config.gamesTitle} sub={config.gamesSub} link={{ label: 'Tüm oyunlar', href: '/oyunlar' }} />
          <GamesGrid games={config.games} />
        </section>
      )}

      {config.showMarket && products.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHead title={config.marketTitle} sub={config.marketSub} link={{ label: "Market'e git", href: config.marketHref }} />
          <MarketTabs products={products} count={config.marketCount} />
        </section>
      )}

      {(config.promos.length > 0 || config.showLeaderboard) && (
        <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
          {config.promos.length > 0 && <PromoCards promos={config.promos} />}
          {config.showLeaderboard && <Leaderboard title={config.lbTitle} note={config.lbNote} rows={weekly.slice(0, 5)} />}
        </div>
      )}
    </div>
  )
}

export function MemberHomeV2Page({
  config,
  name,
  firstTime = false,
  balance,
  kp,
  weeklyRank,
  weekly,
  meId,
  mini,
  products,
}: {
  config: HomeV2Config
  name: string
  firstTime?: boolean
  balance: number
  kp: number | null
  weeklyRank: number | null
  weekly: Row[]
  meId: string
  mini: MiniStatus | null
  products: MarketProduct[]
}) {
  const hidden = new Set(mini?.hidden ?? [])
  const daily: DailyState[] = config.daily
    .filter((tile) => {
      const k = MINI_BY_HREF[tile.href]
      return !k || !hidden.has(k)
    })
    .map((tile) => {
      const k = MINI_BY_HREF[tile.href]
      return { tile, nextAt: k && mini ? (mini[k] ?? null) : null }
    })
  const readyCount = daily.filter((d) => d.nextAt === null).length
  const dailySub = config.dailySub.replace('{toplam}', String(daily.length)).replace('{hazir}', String(readyCount))

  const byPrice = [...products].sort((a, b) => a.price - b.price)
  const goal = byPrice.find((p) => p.price > balance) ?? null
  const picks = byPrice.filter((p) => p.price <= balance).slice(-3).reverse()
  const lastKey = config.primaryHref.match(/^\/oyunlar\/([\w-]+)/)?.[1] ?? null
  const heroSlides: MemberSlide[] = [
    {
      id: 'last',
      label: lastKey ? (HOME_GAME_LABEL[lastKey] ?? 'Kaldığın yer') : 'Kaldığın yer',
      thumb: lastKey ? `/images/games/${lastKey}.png` : config.heroImage,
      image: config.heroImage,
      eyebrow: config.eyebrow.replace('{ad}', name),
      title: firstTime ? 'İlk masan seni bekliyor' : config.title,
      pills: firstTime ? [] : config.pills,
      primary: firstTime ? { label: 'İlk masanı aç', href: config.primaryHref } : { label: config.primaryCta, href: config.primaryHref },
      secondary: { label: config.secondaryCta, href: config.secondaryHref },
    },
    ...config.slides
      .filter((key) => key !== lastKey)
      .map((key) => ({
        id: key,
        label: HOME_GAME_LABEL[key] ?? key,
        thumb: `/images/games/${key}.png`,
        image: `/images/slides/${key}.png`,
        eyebrow: 'Masalar açık',
        title: `${HOME_GAME_LABEL[key] ?? key} masasına otur, KP topla`,
        pills: [],
        primary: { label: 'Masa aç', href: `/oyunlar/${key}?masa-ac=1` },
        secondary: { label: 'Oyuna göz at', href: `/oyunlar/${key}` },
      })),
  ]
  const top = weekly.slice(0, 3)
  const me = weeklyRank && kp !== null ? { rank: weeklyRank, points: weekly.find((r) => r.userId === meId)?.points ?? 0 } : null

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
        <div className="flex min-w-0 flex-col gap-8">
          <MemberHeroSlider slides={heroSlides} />
          {daily.length > 0 && (
            <section className="flex flex-col gap-4">
              <SectionHead title={config.dailyTitle} sub={dailySub} />
              <DailyGrid items={daily} />
            </section>
          )}
        </div>
        <aside className="flex flex-col gap-4">
          {config.showWallet && <WalletCard balance={balance} kp={kp} weeklyRank={weeklyRank} goal={goal} picks={picks} marketHref={config.marketHref} />}
          {config.showLeaderboard && <Leaderboard title={config.lbTitle} rows={top} me={me} meId={meId} compact />}
        </aside>
      </div>
      {config.games.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHead title={config.gamesTitle} sub={config.memberGamesSub} link={{ label: 'Tüm oyunlar', href: '/oyunlar' }} />
          <GamesGrid games={config.games} />
        </section>
      )}
    </div>
  )
}
