import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Leaderboard } from '@/components/alkanka/leaderboard'

export const metadata = pageMeta('siralama')

export default function RankingPage() {
  return (
    <>
      <EditableHero slug="siralama"
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
