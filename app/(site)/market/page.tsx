import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { PointsMarket } from '@/components/alkanka/points-market'
import { listProducts } from '@/lib/market'

export const metadata = pageMeta('market')
export const dynamic = 'force-dynamic'

export default async function MarketPage() {
  const items = await listProducts().catch((e) => {
    console.error('[market] ürünler okunamadı', e)
    return []
  })
  return (
    <>
      <EditableHero slug="market"
        image="/images/heroes/market.png"
        highlights={['Sponsor bonusları', 'Rozet ve ekstra hak', 'Ekip onaylı teslim']}
        eyebrow="Market"
        title="Puan marketi"
        description="Sponsor site bonusları, rozetler, ekstra haklar ve hediyeler. Topladığın Kanka Coin ile talep et, ekip onaylasın."
        pose="market"
        speech="Coinlerini burada harca kanka, stoklar sınırlı!"
      />
      <PointsMarket items={items} />
    </>
  )
}
