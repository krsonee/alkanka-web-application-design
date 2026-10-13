import { jsonLd, pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Faq } from '@/components/alkanka/faq'
import { listPublicFaqs } from '@/lib/faqs'

export const metadata = pageMeta('sss')
export const dynamic = 'force-dynamic'

export default async function FaqPage() {
  const groups = await listPublicFaqs().catch(() => [])
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap((group) => group.items).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
  return (
    <>
      {groups.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd)} />}
      <EditableHero slug="sss"
        image="/images/heroes/sss.png"
        highlights={['Kanka Coin', 'Market ve ödüller', 'Hesap güvenliği']}
        eyebrow="Yardım"
        title="Sıkça sorulan sorular"
        description="Kanka Coin, market, Telegram ve hesap güvenliği hakkında en çok sorulanlar."
        pose="telegram"
        speech="Cevabı bulamazsan Telegram'dan yaz kanka."
      />
      <Faq groups={groups} />
    </>
  )
}
