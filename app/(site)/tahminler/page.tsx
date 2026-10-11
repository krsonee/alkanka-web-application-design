import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Events } from '@/components/alkanka/events'
import { League } from '@/components/alkanka/community/league'
import { getMember } from '@/lib/member'
import { EXACT_REWARD, OUTCOME_REWARD, leagueTable, listLeagueMatches } from '@/lib/community'

export const metadata = pageMeta('tahminler')
export const dynamic = 'force-dynamic'

export default async function PredictionsPage() {
  const member = await getMember()
  const [matches, week, all] = await Promise.all([
    listLeagueMatches(member?.id ?? null),
    leagueTable('week'),
    leagueTable('all'),
  ])
  return (
    <>
      <EditableHero slug="tahminler"
        image="/images/heroes/tahminler.png"
        highlights={['Tam skor 3 puan', 'Doğru taraf 1 puan', 'Haftalık Kanka Coin ödülü']}
        eyebrow="Tahmin ligi"
        title="Skoru bil, ligde yüksel"
        description="Her hafta seçili maçlara skor tahmini yap. Tam skor 3 puan, doğru taraf 1 puan. Haftanın liderleri Kanka Coin kazanır."
        pose="dusunen"
        speech="Bence bu maç gollü geçer kanka..."
      />
      {matches.length > 0 ? (
        <League matches={matches} week={week} all={all} exactReward={EXACT_REWARD} outcomeReward={OUTCOME_REWARD} meId={member?.id ?? null} />
      ) : (
        <Events view="tahminler" />
      )}
    </>
  )
}
