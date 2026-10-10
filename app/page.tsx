import { BrandProvider } from '@/components/alkanka/brand-context'
import { LogoSelector } from '@/components/alkanka/logo-selector'
import { SiteHeader } from '@/components/alkanka/site-header'
import { Hero } from '@/components/alkanka/hero'
import { ActivityTicker } from '@/components/alkanka/activity-ticker'
import { GamesHub } from '@/components/alkanka/games/games-hub'
import { Campaigns } from '@/components/alkanka/campaigns'
import { TelegramFeed } from '@/components/alkanka/telegram-feed'
import { StreakTracker } from '@/components/alkanka/streak-tracker'
import { SiteFooter } from '@/components/alkanka/site-footer'

export default function Page() {
  return (
    <BrandProvider>
      <LogoSelector />
      <SiteHeader />
      <main>
        <Hero />
        <ActivityTicker />
        <GamesHub />
        <Campaigns />
        <TelegramFeed />
        <StreakTracker />
      </main>
      <SiteFooter />
    </BrandProvider>
  )
}
