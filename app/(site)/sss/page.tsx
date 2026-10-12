import { jsonLd, pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { Faq, type FaqGroup } from '@/components/alkanka/faq'
import { getFaqs } from '@/lib/data'

export const metadata = pageMeta('sss')
export const dynamic = 'force-dynamic'

export default async function FaqPage() {
  const rows = await getFaqs().catch(() => [])
  const groups: FaqGroup[] = []
  for (const row of rows) {
    const label = row.category || 'Genel'
    const id = label.toLocaleLowerCase('tr-TR').replace(/\s+/g, '-')
    let group = groups.find((item) => item.id === id)
    if (!group) {
      group = { id, label, items: [] }
      groups.push(group)
    }
    group.items.push({ q: row.question, a: row.answer })
  }
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap((g) => g.items).map((item) => ({
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
      <Faq groups={groups} />
    </>
  )
}
