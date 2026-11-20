import { pageMeta } from '@/lib/seo'
import { EditableHero } from '@/components/alkanka/editable-hero'
import { MarketShop } from '@/components/alkanka/market/market-shop'
import { listProducts } from '@/lib/market'
import { MARKET_KIND_PARAM } from '@/lib/record-links'

export const metadata = pageMeta('market')
export const dynamic = 'force-dynamic'

export default async function MarketPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const kind = (await searchParams)[MARKET_KIND_PARAM]
  const items = await listProducts().catch((e) => {
    console.error('[market] ürünler okunamadı', e)
    return []
  })
  return (
    <>
      <EditableHero slug="market"
        compact
        image="/images/heroes/market.png"
        highlights={['Sponsor ödülleri', 'Anında teslim edilen haklar', 'Avatar ve masa temaları']}
        eyebrow="Market"
        title="Puan marketi"
        description="Sponsor ödülleri, ekstra haklar, avatarlar ve masa temaları. Topladığın Kanka Coin ile al; site içi ödüller anında hesabına eklenir."
        pose="market"
        speech="Coinlerini burada harca kanka, stoklar sınırlı!"
      />
      <MarketShop items={items} kind={typeof kind === 'string' ? kind : undefined} />
    </>
  )
}
