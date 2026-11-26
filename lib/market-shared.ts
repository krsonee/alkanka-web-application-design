export type DeliveryMode = 'auto' | 'manual'
export type RewardKind = 'kc' | 'kp' | 'cark' | 'zar' | 'sandik' | 'kalkan' | 'rozet'
export type Reward = { kind: RewardKind; amount: number; ref: string | null }

type RewardMeta = { id: RewardKind; label: string; unit: string; max: number; hint: string }

export const REWARD_KINDS: RewardMeta[] = [
  { id: 'kc', label: 'Kanka Coin', unit: 'KC', max: 1_000_000, hint: 'Satın alınca bakiyeye eklenir. Ödül, ürünün fiyatından az olmalı.' },
  { id: 'kp', label: 'Kanka Puan', unit: 'KP', max: 100_000, hint: 'Satın alınca puana eklenir, sıralamaya sayılır.' },
  { id: 'cark', label: 'Çark hakkı', unit: 'çark hakkı', max: 100, hint: 'Günlük ücretsiz hakka ek çevirme hakkı.' },
  { id: 'zar', label: 'Zar hakkı', unit: 'zar hakkı', max: 100, hint: 'Zar oyununda ek atış hakkı.' },
  { id: 'sandik', label: 'Sandık hakkı', unit: 'sandık hakkı', max: 100, hint: 'Sandık oyununda ek açma hakkı.' },
  { id: 'kalkan', label: 'Seri kalkanı', unit: 'seri kalkanı', max: 30, hint: 'Kaçırılan günde giriş serisini korur.' },
  { id: 'rozet', label: 'Rozet', unit: 'rozet', max: 1, hint: 'Seçtiğin rozet üyenin profiline takılır. Üye aynı rozeti ikinci kez alamaz.' },
]

export const rewardMeta = (kind: RewardKind) => REWARD_KINDS.find((r) => r.id === kind) ?? REWARD_KINDS[0]

export const isRewardKind = (v: unknown): v is RewardKind => REWARD_KINDS.some((r) => r.id === v)

/** "+3 çark hakkı", shown wherever a product says what lands on the account. */
export function rewardText(reward: Reward, badgeName?: string | null) {
  if (reward.kind === 'rozet') return badgeName ? `${badgeName} rozeti` : 'Rozet'
  return `+${reward.amount.toLocaleString('tr-TR')} ${rewardMeta(reward.kind).unit}`
}

export type MarketCategory = 'firsat' | 'sponsor' | 'alkanka' | 'avatar' | 'tema'

/** 'firsat' lists the products that are cheaper for members who finished a task; the site hides the tab while there are none. */
export const MARKET_CATEGORIES: { id: MarketCategory; label: string }[] = [
  { id: 'firsat', label: 'Görevli fırsatlar' },
  { id: 'sponsor', label: 'Sponsor ödülleri' },
  { id: 'alkanka', label: 'Site içi ödüller' },
  { id: 'avatar', label: 'Avatar & kapak' },
  { id: 'tema', label: 'Masa temaları' },
]

export const isMarketCategory = (v: unknown): v is MarketCategory => MARKET_CATEGORIES.some((c) => c.id === v)

export const FEATURED_SLOTS = 4

// --- Discount campaigns and task prices ------------------------------------

export type SaleScope = 'all' | 'alkanka' | 'sponsor' | 'items'

export const SALE_SCOPES: { id: SaleScope; label: string; hint: string }[] = [
  { id: 'all', label: 'Bütün ürünler', hint: 'Marketteki her ürün indirime girer.' },
  { id: 'alkanka', label: 'Site içi ürünler', hint: 'Sadece site içi ürünler indirime girer.' },
  { id: 'sponsor', label: 'Sponsor ödülleri', hint: 'Sadece sponsor ödülleri indirime girer.' },
  { id: 'items', label: 'Seçtiğim ürünler', hint: 'Sadece aşağıda işaretlediğin ürünler indirime girer.' },
]

export const SALE_MIN_PCT = 1
export const SALE_MAX_PCT = 90
export const SALE_MAX_ITEMS = 500

export type MarketSale = {
  id: number
  name: string
  pct: number
  startsAt: string
  endsAt: string
  scope: SaleScope
  itemIds: string[]
  active: boolean
}

/** `startsAt` and `endsAt` arrive as the panel's date fields hold them: Turkey time, "2026-11-21T20:00". */
export type SaleInput = Omit<MarketSale, 'id'> & { id: number | null }

export type SaleState = 'kapali' | 'bekliyor' | 'yayinda' | 'bitti'

export function saleState(sale: Pick<MarketSale, 'active' | 'startsAt' | 'endsAt'>, now = Date.now()): SaleState {
  if (Date.parse(sale.endsAt) <= now) return 'bitti'
  if (!sale.active) return 'kapali'
  return Date.parse(sale.startsAt) > now ? 'bekliyor' : 'yayinda'
}

type Priced = { id: string; kind: 'alkanka' | 'sponsor'; reward: Reward | null }

/**
 * A product that hands out Kanka Coin is never discounted: a cheaper price could drop below the coins
 * it gives and turn the product into free money.
 */
export const givesCoin = (item: Pick<Priced, 'reward'>) => item.reward?.kind === 'kc'

export function saleCovers(sale: Pick<MarketSale, 'scope' | 'itemIds'>, item: Priced) {
  if (givesCoin(item)) return false
  if (sale.scope === 'all') return true
  if (sale.scope === 'items') return sale.itemIds.includes(item.id)
  return sale.scope === item.kind
}

/** The campaign a product is sold under right now: of the ones running, the biggest discount. */
export function bestSale<S extends MarketSale>(sales: S[], item: Priced, now = Date.now()): S | null {
  let best: S | null = null
  for (const sale of sales) {
    if (saleState(sale, now) !== 'yayinda' || !saleCovers(sale, item)) continue
    if (!best || sale.pct > best.pct) best = sale
  }
  return best
}

export const afterPct = (price: number, pct: number) => (pct > 0 ? Math.max(1, Math.floor((price * (100 - pct)) / 100)) : price)

type Payable = { salePrice: number; dealTaskId: number | null; dealPrice: number; dealTask: { live: boolean } | null }

/** Whether the task price is the cheaper way to buy this product, for a member who finished the task. */
export const dealWins = (item: Payable) => Boolean(item.dealTaskId && item.dealTask && item.dealPrice > 0 && item.dealPrice < item.salePrice)

/** What a member pays before any personal discount: the campaign price, or the task price when the task is done and cheaper. */
export const payable = (item: Payable, taskDone: boolean) => (taskDone && dealWins(item) ? item.dealPrice : item.salePrice)

/** A task price is shown to members who can still do the task, and to those who already did it. */
export const dealShown = (item: Payable, taskDone: boolean) => dealWins(item) && (taskDone || Boolean(item.dealTask?.live))

/** How many units the task price covers, said the way a member reads it. */
export function dealUsesText(item: { dealUses: number; dealTask: { repeats: boolean } | null }) {
  return item.dealTask?.repeats ? `Görevi her tamamlayışında ${item.dealUses} adet bu fiyata alınır.` : `Bu fiyata ${item.dealUses} adet alınır.`
}

/** What a member who has used up the task price is told. */
/** A finished task that does not open the task price yet: what was done since the task was linked, out of what it asks for. */
export type DealWait = { have: number; need: number }

/** Said to a member whose task was done (wholly or partly) before the discount existed. */
export function dealWaitText(item: { dealPrice: number; dealTask: { repeats: boolean } | null }, wait: DealWait) {
  const price = `${item.dealPrice.toLocaleString('tr-TR')} KC`
  if (wait.need > 0) {
    return `İndirim, ürüne bağlandıktan sonra yaptıklarını sayar: ${wait.have} / ${wait.need}. Kalan ${wait.need - wait.have} tamamlanınca fiyat ${price} olur.`
  }
  return item.dealTask?.repeats
    ? `Bu görevi indirim başlamadan önce tamamlamıştın. Görevi yeniden tamamlayınca fiyat ${price} olur.`
    : 'Bu görevi indirim başlamadan önce tamamlamıştın; indirim görevi sonradan tamamlayanlara açık.'
}

export function dealSpentText(item: { dealUses: number; dealTask: { repeats: boolean } | null }) {
  return item.dealTask?.repeats
    ? `Görev indirimini kullandın. Görevi yeniden tamamlayınca ${item.dealUses} adet daha indirimli alırsın.`
    : 'Görev indirimini kullandın, fiyat normale döndü.'
}
