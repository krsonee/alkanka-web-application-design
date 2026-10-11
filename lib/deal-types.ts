export type DealKind = 'oran' | 'promo' | 'bonus' | 'cekilis' | 'genel'

export const DEAL_LABELS: Record<DealKind, string> = {
  oran: 'Özel oran',
  promo: 'Promo kod',
  bonus: 'Bonus',
  cekilis: 'Çekiliş',
  genel: 'Duyuru',
}

export type Deal = {
  id: number
  slug: string
  brand: string
  kind: DealKind
  title: string
  body: string
  photo: string | null
  link: string
  createdAt: string
}

export type Verification = { google: string; bing: string; yandex: string }
