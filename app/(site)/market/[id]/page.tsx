import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { MarketShop } from '@/components/alkanka/market/market-shop'
import { listProducts } from '@/lib/market'
import { productImage } from '@/lib/market-image'
import { recordPath } from '@/lib/record-links'
import { OG_BASE, shareImage } from '@/lib/seo'

export const dynamic = 'force-dynamic'

const readProducts = cache(() => listProducts())

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = decodeURIComponent((await params).id)
  const item = (await readProducts().catch(() => [])).find((p) => p.id === id)
  if (!item) return { title: 'Ürün bulunamadı', robots: { index: false } }
  const url = recordPath('market', item.id)
  const title = `${item.name} · Puan marketi`
  const description = [item.kind === 'sponsor' && item.sponsorName ? `${item.sponsorName} ödülü` : 'AL KANKA ödülü', `${item.price.toLocaleString('tr-TR')} KC`, item.description]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 200)
  const image = shareImage(productImage(item))
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...OG_BASE, title, description, url, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}

export default async function MarketItemPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id)
  const items = await readProducts()
  const item = items.find((p) => p.id === id)
  if (!item) notFound()

  return (
    <div className="flex flex-col gap-5">
      <Link href="/market" className="flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 text-sm font-bold text-foreground hover:bg-secondary">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Puan marketi
      </Link>
      <h1 className="sr-only">{item.name}</h1>
      <MarketShop items={items} focus={item.id} />
    </div>
  )
}
