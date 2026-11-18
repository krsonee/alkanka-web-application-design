import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { TournamentLive } from '@/components/alkanka/arena/tournament-live'
import { siteTournaments } from '@/lib/tournaments-site'

export const metadata = pageMeta('turnuvalar')

export default async function TournamentsPage() {
  const list = await siteTournaments().catch((error) => {
    console.error('[tournaments] liste okunamadı', error)
    return []
  })

  return (
    <>
      <EditableHero
        slug="turnuvalar"
        compact
        image="/images/heroes/turnuvalar.png"
        highlights={['Tavla · Okey · Bilardo', 'Canlı eşleşme ağacı', 'Ödül havuzu']}
        eyebrow="Turnuvalar"
        title="Kanka turnuvaları"
        description="Tavla, okey ve bilardo turnuvalarına kaydol. Ücret kayıtta bir kez kesilir, maçın açılınca tek tıkla masana girersin; eşleşmeler canlı güncellenir, ödüller sıralamaya göre dağıtılır."
        pose="kazandi"
        speech="Masada görüşürüz kanka!"
      />
      <TournamentLive initial={list} />
    </>
  )
}
