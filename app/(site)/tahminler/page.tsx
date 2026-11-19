import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { LeagueView } from '@/components/alkanka/predictions/league-view'
import { LEAGUE_TAB_PARAM } from '@/lib/record-links'

export const metadata = pageMeta('tahminler')
export const dynamic = 'force-dynamic'

export default async function PredictionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tab = (await searchParams)[LEAGUE_TAB_PARAM]
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
      <LeagueView tab={typeof tab === 'string' ? tab : undefined} />
    </>
  )
}
