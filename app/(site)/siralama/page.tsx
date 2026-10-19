import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Leaderboard } from '@/components/alkanka/leaderboard'
import { WagerBoard } from '@/components/alkanka/wager-board'

export const revalidate = 300

export const metadata = pageMeta('siralama')

export default function RankingPage() {
  return (
    <>
      <EditableHero slug="siralama"
        image="/images/heroes/siralama.png"
        compact
        eyebrow="Sıralama"
        title="Zirveye oyna kanka"
        description="Oyun oyna, görev yap, tahmin tut. Haftalık ve aylık şampiyonlar rozet ve KP bonusu kazanır."
        pose="kazandi"
      />
      <Leaderboard />
      <WagerBoard />
    </>
  )
}
