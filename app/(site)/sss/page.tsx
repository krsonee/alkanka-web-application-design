import type { Metadata } from 'next'
import { PageHero } from '@/components/alkanka/page-hero'
import { Faq } from '@/components/alkanka/faq'

export const metadata: Metadata = { title: 'SSS | AL KANKA' }

export default function FaqPage() {
  return (
    <>
      <PageHero
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
