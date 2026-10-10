import type { Metadata } from 'next'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Faq } from '@/components/alkanka/faq'

export const metadata: Metadata = { title: 'SSS | AL KANKA' }

export default function FaqPage() {
  return (
    <>
      <EditableHero slug="sss"
        image="/images/heroes/sss.png"
        eyebrow="Yardım"
        title="Sıkça sorulan sorular"
        description="Kanka Coin, market, Telegram ve hesap güvenliği hakkında en çok sorulanlar."
        pose="telegram"
        speech="Cevabı bulamazsan Telegram'dan yaz kanka."
      />
      <Faq />
    </>
  )
}
