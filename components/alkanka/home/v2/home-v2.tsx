import { HOME_GAME_LABEL, type HomeV2Config } from '@/lib/home-v2-shared'
import { MemberHeroSlider, type MemberSlide } from './member-hero-slider'
import type { MarketProduct } from '@/lib/market'
import type { MiniGame, MiniStatus } from '@/app/actions/wallet'
import type { HomeTournament } from '@/lib/home-events'
import type { LeagueMatch } from '@/lib/predictions'
import { HeroSlider } from './hero-slider'
import type { HeroSlide } from './hero-slides'
import { MarketTabs } from './market-tabs'
import { StreakStrip } from './streak-strip'
import { UpNext } from './up-next'
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

const MINI_BY_HREF: Record<string, MiniGame> = {
  '/oyunlar/cark': 'cark',
  '/oyunlar/sandik': 'sandik',
  '/oyunlar/zar': 'zar',
}

export function GuestHomeV2({
  config,
  slides,
  products,
  weekly,
  bonus,
  tournaments = [],
}: {
  config: HomeV2Config
  slides: HeroSlide[]
  products: MarketProduct[]
  weekly: Row[]
  bonus: number
  tournaments?: HomeTournament[]
}) {
  const primaryLabel = config.guestPrimaryCta.replace('{bonus}', String(bonus))
  return (
    <div className="flex flex-col gap-10 max-sm:gap-8">
      <HeroSlider
        slides={slides}
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

      {tournaments.length > 0 && (
        <div className="sm:hidden">
          <UpNext match={null} tournaments={tournaments} />
        </div>
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
  slides,
  name,
  firstTime = false,
  balance,
  kp,
  weeklyRank,
  weekly,
  meId,
  mini,
  products,
  streak,
  match = null,
  tournaments = [],
}: {
  config: HomeV2Config
  slides: HeroSlide[]
  name: string
  firstTime?: boolean
  balance: number
  kp: number | null
  weeklyRank: number | null
  weekly: Row[]
  meId: string
  mini: MiniStatus | null
  products: MarketProduct[]
  streak?: { days: number; checkedToday: boolean }
  match?: LeagueMatch | null
  tournaments?: HomeTournament[]
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
  const resume: MemberSlide[] = config.showResume
    ? [
        {
          kind: 'text',
          id: 'last',
          label: lastKey ? (HOME_GAME_LABEL[lastKey] ?? 'Kaldığın yer') : 'Kaldığın yer',
          thumb: lastKey ? `/images/games/${lastKey}.png` : config.heroImage,
          image: config.heroImage,
          eyebrow: config.eyebrow.replace('{ad}', name),
          title: firstTime ? 'İlk masan seni bekliyor' : config.title,
          pills: firstTime ? [] : config.pills,
          primary: { label: firstTime ? 'İlk masanı aç' : config.primaryCta, href: config.primaryHref, play: true },
          secondary: { label: config.secondaryCta, href: config.secondaryHref },
        },
      ]
    : []
  const heroSlides: MemberSlide[] = [
    ...resume,
    ...slides
      // The game the member is sent back to already leads the slider.
      .filter((s) => !(resume.length && s.look === 'cover' && s.game === lastKey))
      .map((s): MemberSlide => {
        const shared = { id: s.id, label: s.label, thumb: s.thumb, image: s.image, mobileImage: s.mobileImage }
        if (s.look === 'plain') return { ...shared, kind: 'banner', href: s.href, name: s.name }
        if (s.look === 'cover' && s.game) {
          return {
            ...shared,
            kind: 'text',
            eyebrow: 'Masalar açık',
            title: `${s.label} masasına otur, KP topla`,
            pills: [],
            primary: { label: 'Masa aç', href: `/oyunlar/${s.game}?masa-ac=1`, play: true },
            secondary: { label: 'Oyuna göz at', href: `/oyunlar/${s.game}` },
          }
        }
        return { ...shared, kind: 'text', eyebrow: s.eyebrow, title: s.title, description: s.description, pills: [], primary: { label: s.cta, href: s.href }, tracked: true }
      }),
  ]
  const top = weekly.slice(0, 3)
  const me = weeklyRank && kp !== null ? { rank: weeklyRank, points: weekly.find((r) => r.userId === meId)?.points ?? 0 } : null

  return (
    <div className="flex flex-col gap-8">
      {/* Below the desktop width the two columns dissolve into one list so the balance can lead and the board can close it. */}
      <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
        <div className="flex min-w-0 flex-col gap-8 max-lg:contents">
          <div className="min-w-0 max-lg:order-2">
            <MemberHeroSlider slides={heroSlides} />
          </div>
          {daily.length > 0 && (
            <section className="flex min-w-0 flex-col gap-4 max-lg:order-3">
              <SectionHead title={config.dailyTitle} sub={dailySub} />
              <DailyGrid items={daily} />
            </section>
          )}
        </div>
        <aside className="flex flex-col gap-4 max-lg:contents">
          {config.showWallet && (
            <div className="min-w-0 max-lg:order-1">
              <WalletCard balance={balance} kp={kp} weeklyRank={weeklyRank} goal={goal} picks={picks} marketHref={config.marketHref} />
            </div>
          )}
          {/* The phone leads with what is due today; wider screens keep the two columns as they are. */}
          {streak && (
            <div className="min-w-0 max-lg:order-1 sm:hidden">
              <StreakStrip streak={streak.days} checkedToday={streak.checkedToday} />
            </div>
          )}
          {(match || tournaments.length > 0) && (
            <div className="min-w-0 max-lg:order-3 sm:hidden">
              <UpNext match={match} tournaments={tournaments} />
            </div>
          )}
          {config.showLeaderboard && (
            <div className="min-w-0 max-lg:order-4">
              <Leaderboard title={config.lbTitle} rows={top} me={me} meId={meId} compact />
            </div>
          )}
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
