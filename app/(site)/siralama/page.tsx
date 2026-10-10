import type { Metadata } from 'next'
import { PageHero } from '@/components/alkanka/page-hero'
import { Leaderboard } from '@/components/alkanka/leaderboard'

export const metadata: Metadata = { title: 'Sıralama | AL KANKA' }

export default function RankingPage() {
  return (
    <>
      <PageHero
        image="/images/heroes/siralama.png"
        eyebrow="Sıralama"
        title="Haftalık liderler"
        description="Her pazartesi sıfırlanır. İlk 3 VIP sandık kazanır, ilk 10 rozet alır."
        pose="kazandi"
        speech="Zirvede yer var kanka, çalışmaya devam!"
      />
      <Leaderboard />
    </>
  )
}
