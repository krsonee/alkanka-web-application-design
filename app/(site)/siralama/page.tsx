import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Leaderboard } from '@/components/alkanka/leaderboard'
import { WagerBoard } from '@/components/alkanka/wager-board'
import { TopThree } from '@/components/alkanka/top-three'
import { leaderboard } from '@/lib/kanka-puan'

export const revalidate = 300

export const metadata = pageMeta('siralama')

export default async function RankingPage() {
  const podium = await leaderboard(3, 'tum', { readOnly: true }).catch(() => [])
  return (
    <>
      <EditableHero slug="siralama"
        image="/images/heroes/siralama.png"
        highlights={['Günlük · Haftalık · Aylık', 'Şampiyon rozeti', 'Tahmin ligi tablosu']}
        eyebrow="Sıralama"
        title="Günlük, haftalık ve aylık liderler"
        description="Kanka Puan ve tahmin ligi tabloları. Her dönemin birincisi şampiyon rozetini kazanır."
        pose="kazandi"
        speech="Zirvede yer var kanka, çalışmaya devam!"
      />
      <TopThree rows={podium.map((row) => ({ userId: row.userId, name: row.name, points: row.kp }))} />
      <Leaderboard />
      <WagerBoard />
    </>
  )
}
