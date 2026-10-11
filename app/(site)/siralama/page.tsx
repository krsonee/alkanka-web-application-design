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
        title="Günlük, haftalık ve aylık liderler"
        description="Kanka Puan ve tahmin ligi tabloları. Her dönemin birincisi şampiyon rozetini kazanır."
        pose="kazandi"
        speech="Zirvede yer var kanka, çalışmaya devam!"
      />
      <Leaderboard />
    </>
  )
}
