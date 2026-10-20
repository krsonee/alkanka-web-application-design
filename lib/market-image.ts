import type { MarketProduct } from '@/lib/market'

const BONUS_IMAGES: [RegExp, string][] = [
  [/free\s*spin|freespin|çevirme|spin/i, '/images/market/maskot-freespin.png'],
  [/free\s*bet|freebet|bedava bahis|bahis/i, '/images/market/maskot-freebet.png'],
  [/kasa|sandık|kutu|case/i, '/images/market/maskot-case.png'],
  [/yatırım|deposit|kayıp|cashback|bonus/i, '/images/market/maskot-deposit.png'],
]

export function productImage(item: Pick<MarketProduct, 'image' | 'kind' | 'name' | 'description'>) {
  if (item.image) return item.image
  if (item.kind !== 'sponsor') return '/images/tile-market.png'
  const text = `${item.name} ${item.description ?? ''}`
  return BONUS_IMAGES.find(([re]) => re.test(text))?.[1] ?? '/images/market/maskot-deposit.png'
}
