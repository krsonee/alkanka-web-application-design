export const TELEGRAM_URL = 'https://t.me/AlkankaOfficial'

export type TickerEvent = {
  id: string
  kind: 'telegram' | 'claim' | 'drop'
  text: string
  time: string
}

export const TICKER_EVENTS: TickerEvent[] = [
  { id: 't1', kind: 'telegram', text: 'New promo code dropped in Telegram channel', time: '1m ago' },
  { id: 't2', kind: 'claim', text: 'mert_k claimed 250 Pts on the Lucky Wheel', time: '2m ago' },
  { id: 't3', kind: 'drop', text: 'VIP Reward Pool refilled — 500 slots open', time: '3m ago' },
  { id: 't4', kind: 'claim', text: 'aylin.dev opened a Gold Chest — 2x Boost', time: '4m ago' },
  { id: 't5', kind: 'telegram', text: 'Weekly poll is live: vote for next campaign', time: '6m ago' },
  { id: 't6', kind: 'claim', text: 'kaan_88 rolled double sixes — Mystery Box', time: '7m ago' },
  { id: 't7', kind: 'drop', text: 'Traffic Booster campaign extended 48 hours', time: '9m ago' },
  { id: 't8', kind: 'claim', text: 'selin.x hit a 7-day streak — VIP Pass', time: '11m ago' },
  { id: 't9', kind: 'telegram', text: 'Pinned: Exclusive partner bonus link for members', time: '14m ago' },
  { id: 't10', kind: 'claim', text: 'emre.tr spun Free Code on the Lucky Wheel', time: '16m ago' },
]

export type CampaignCategory = 'exclusive' | 'traffic' | 'vip'

export type Campaign = {
  id: string
  partner: string
  title: string
  description: string
  category: CampaignCategory
  multiplier: string
  tone: 'cyan' | 'purple' | 'gold'
  claimed: number
  hot?: boolean
}

export const CAMPAIGNS: Campaign[] = [
  { id: 'c1', partner: 'NovaReach', title: 'Welcome Reward Pack', description: 'Unlock a stacked welcome pack and bonus points on first sign-up.', category: 'exclusive', multiplier: '3x', tone: 'cyan', claimed: 82, hot: true },
  { id: 'c2', partner: 'PulseAds', title: 'Traffic Surge Booster', description: 'Amplify your campaign reach with a 72h boosted traffic window.', category: 'traffic', multiplier: '2.5x', tone: 'purple', claimed: 64 },
  { id: 'c3', partner: 'Apex Club', title: 'VIP Tier Accelerator', description: 'Skip a tier and access members-only reward drops instantly.', category: 'vip', multiplier: '5x', tone: 'gold', claimed: 91, hot: true },
  { id: 'c4', partner: 'Orbitly', title: 'Referral Multiplier', description: 'Every invited friend earns you a multiplied bonus for 30 days.', category: 'exclusive', multiplier: '2x', tone: 'cyan', claimed: 47 },
  { id: 'c5', partner: 'Clickwave', title: 'Daily Visit Streaks', description: 'Earn compounding rewards for consecutive verified visits.', category: 'traffic', multiplier: '1.8x', tone: 'purple', claimed: 58 },
  { id: 'c6', partner: 'Luxe Rewards', title: 'Concierge Bonus Vault', description: 'Hand-picked high-value bonuses reserved for VIP members.', category: 'vip', multiplier: '4x', tone: 'gold', claimed: 73 },
]

export const CAMPAIGN_TABS: { id: 'all' | CampaignCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'exclusive', label: 'Exclusive Bonuses' },
  { id: 'traffic', label: 'Traffic Boosters' },
  { id: 'vip', label: 'VIP Rewards' },
]
