import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Events } from '@/components/alkanka/events'

export const metadata = pageMeta('biletler')

export default function TicketsPage() {
  return (
    <>
      <EditableHero slug="biletler"
        image="/images/heroes/biletler.png"
        eyebrow="Biletler"
        title="Bilet çekilişleri"
        description="Haftalık bilet çekilişi ve günlük turnuvalar. Katıl, Kanka Coin havuzundan payını al."
        pose="kazandi"
        speech="Pazar 21:00 canlı çekiliş, kaçırma!"
        tone="accent"
      />
      <Events view="biletler" />
    </>
  )
}
