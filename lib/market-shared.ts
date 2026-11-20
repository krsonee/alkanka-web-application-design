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

export type MarketCategory = 'sponsor' | 'alkanka' | 'avatar' | 'tema'

export const MARKET_CATEGORIES: { id: MarketCategory; label: string }[] = [
  { id: 'sponsor', label: 'Sponsor ödülleri' },
  { id: 'alkanka', label: 'Site içi ödüller' },
  { id: 'avatar', label: 'Avatar & kapak' },
  { id: 'tema', label: 'Masa temaları' },
]

export const isMarketCategory = (v: unknown): v is MarketCategory => MARKET_CATEGORIES.some((c) => c.id === v)

export const FEATURED_SLOTS = 4
