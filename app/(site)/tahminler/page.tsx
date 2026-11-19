import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Events } from '@/components/alkanka/events'
import { League } from '@/components/alkanka/predictions/league'
import type { PeriodView } from '@/components/alkanka/predictions/standings'
import { getMember } from '@/lib/member'
import { getLeagueSettings, lastPaidPeriods, leagueTable, listLeagueMatches } from '@/lib/predictions'
import { periodBounds, type Award, type PeriodKind } from '@/lib/predictions-shared'

export const metadata = pageMeta('tahminler')
export const dynamic = 'force-dynamic'

export default async function PredictionsPage() {
  const member = await getMember()
  const [matches, week, month, all, settings, paid, awards] = await Promise.all([
    listLeagueMatches(member?.id ?? null, { crowd: true }),
    leagueTable('week'),
    leagueTable('month'),
    leagueTable('all'),
    getLeagueSettings(),
    lastPaidPeriods().catch(() => ({})),
    member ? import('@/lib/prediction-awards').then((m) => m.myAwards(member.id)).catch(() => [] as Award[]) : ([] as Award[]),
  ])
  const now = Date.now()
  const period = (kind: PeriodKind): PeriodView => ({ on: settings[kind].on, places: settings[kind].places, label: periodBounds(kind, now).label })
  return (
    <>
      <EditableHero
        slug="tahminler"
        compact
        image="/images/heroes/tahminler.png"
        highlights={['Maça özel sorular', 'Her doğru cevaba ödül', 'Haftalık ve aylık lig']}
        eyebrow="Tahmin ligi"
        title="Maçı bil, ligde yüksel"
        description="Seçili maçların sorularını cevapla: maç sonucu, skor, gol, korner, kart. Her doğru cevap puan ve ödül kazandırır, puanların lig tablosuna yazılır."
        pose="dusunen"
        speech="Bence bu maç gollü geçer kanka..."
      />
      {matches.length > 0 || awards.length > 0 ? (
        <League
          matches={matches}
          tables={{ week, month, all }}
          periods={{ week: period('week'), month: period('month') }}
          paid={paid}
          awards={awards}
          meId={member?.id ?? null}
          serverNow={now}
        />
      ) : (
        <Events view="tahminler" />
      )}
    </>
  )
}
