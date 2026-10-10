import type { Metadata } from 'next'
import { PageHero } from '@/components/alkanka/page-hero'
import { Tasks } from '@/components/alkanka/tasks'

export const metadata: Metadata = { title: 'Görevler | AL KANKA' }

export default function TasksPage() {
  return (
    <>
      <PageHero
        image="/images/heroes/gorevler.png"
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
