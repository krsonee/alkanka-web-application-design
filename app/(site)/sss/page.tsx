import { jsonLd, pageMeta } from '@/lib/seo'
import { FAQ } from '@/components/alkanka/data'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Faq } from '@/components/alkanka/faq'

export const metadata = pageMeta('sss')

export default function FaqPage() {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.flatMap((g) => g.items).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd)} />
      <EditableHero slug="sss"
        image="/images/heroes/sss.png"
        highlights={['Kanka Coin', 'Market ve ödüller', 'Hesap güvenliği']}
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
