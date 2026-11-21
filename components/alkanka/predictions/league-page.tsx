import { EditableHero } from '@/components/alkanka/editable-hero'
import { LEAGUE_SPORT_PARAM, LEAGUE_TAB_PARAM, LEAGUE_TABLE_PARAM } from '@/lib/record-links'
import { LeagueView, type LeagueAddress } from './league-view'

type Query = Record<string, string | string[] | undefined>

const word = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined)

/** The tab, table period and sport a shared address asks for. */
export const leagueAddress = (query: Query): LeagueAddress => ({ tab: word(query[LEAGUE_TAB_PARAM]), table: word(query[LEAGUE_TABLE_PARAM]), sport: word(query[LEAGUE_SPORT_PARAM]) })

/**
 * /tahminler and every league's own page draw the same screen, so choosing a league on the page
 * can change the address in place without the page looking like a different one after a reload.
 */
export function LeaguePage({ league, address }: { league?: number; address: LeagueAddress }) {
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
      <LeagueView league={league} {...address} />
    </>
  )
}
