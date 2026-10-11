import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Events } from '@/components/alkanka/events'

export const metadata = pageMeta('tahminler')

export default function PredictionsPage() {
  return (
    <>
      <EditableHero slug="tahminler"
        image="/images/heroes/tahminler.png"
        eyebrow="Tahminler"
        title="Maç tahminleri"
        description="Skoru bil, Kanka Coin kazan. Tahminler maç başlamadan 10 dakika önce kapanır."
        pose="dusunen"
        speech="Bence bu maç gollü geçer kanka..."
      />
      <Events view="tahminler" />
    </>
  )
}
