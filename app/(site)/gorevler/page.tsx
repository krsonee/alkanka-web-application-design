import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Tasks } from '@/components/alkanka/tasks'

export const metadata = pageMeta('gorevler')

export default function TasksPage() {
  return (
    <>
      <EditableHero slug="gorevler"
        image="/images/heroes/gorevler.png"
        highlights={['Günlük giriş serisi', '7. gün VIP sandık', 'Ekstra Kanka Coin']}
        eyebrow="Görevler"
        title="Günlük görevler"
        description="Her gün giriş yap, seriyi koru. 7. günde VIP ödül sandığı açılır. Görevler ekstra Kanka Coin kazandırır."
        pose="dusunen"
        speech="Seriyi bozma kanka, 7. gün VIP sandık seni bekliyor."
      />
      <Tasks />
    </>
  )
}
