export type TrackingSettings = {
  ga4Id: string
  adsId: string
  adsSignupLabel: string
  adsSponsorLabel: string
  metaPixelId: string
}

export const EMPTY_TRACKING: TrackingSettings = { ga4Id: '', adsId: '', adsSignupLabel: '', adsSponsorLabel: '', metaPixelId: '' }

export const TRACKING_RULES: Record<keyof TrackingSettings, { re: RegExp; example: string; label: string }> = {
  ga4Id: { re: /^G-[A-Z0-9]{4,16}$/, example: 'G-AB12CD34EF', label: 'Google Analytics 4 ölçüm kimliği' },
  adsId: { re: /^AW-\d{6,14}$/, example: 'AW-1234567890', label: 'Google Ads etiket kimliği' },
  adsSignupLabel: { re: /^[A-Za-z0-9_-]{4,40}$/, example: 'AbCdEf12345', label: 'Ads dönüşüm etiketi (üyelik)' },
  adsSponsorLabel: { re: /^[A-Za-z0-9_-]{4,40}$/, example: 'XyZ98765', label: 'Ads dönüşüm etiketi (sponsor tıklaması)' },
  metaPixelId: { re: /^\d{8,20}$/, example: '123456789012345', label: 'Meta Pixel kimliği' },
}

export const CHANNELS = [
  { id: 'telegram', label: 'Telegram' },
  { id: 'x', label: 'X (Twitter)' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'kick', label: 'Kick / Twitch' },
  { id: 'influencer', label: 'Yayıncı / Influencer' },
  { id: 'google-ads', label: 'Google Ads' },
  { id: 'meta-ads', label: 'Meta reklamı' },
  { id: 'forum', label: 'Forum / Topluluk' },
  { id: 'sms', label: 'SMS / E-posta' },
  { id: 'diger', label: 'Diğer' },
] as const

export type ChannelId = (typeof CHANNELS)[number]['id']

export type CampaignView = {
  id: number
  code: string
  name: string
  channel: string
  target: string
  cost: number
  active: boolean
  createdAt: string
  visits: number
  uniques: number
  week: number
  signups: number
  sponsorClicks: number
  daily: number[]
}

export const EARNING_MODELS = [
  { id: 'cpa', label: 'CPA (üye başı)' },
  { id: 'revshare', label: 'RevShare (kayıp payı)' },
  { id: 'hybrid', label: 'Hibrit' },
  { id: 'fixed', label: 'Sabit ücret' },
] as const

export const EARNING_STATUSES = [
  { id: 'pending', label: 'Hesaplanıyor' },
  { id: 'claimed', label: 'Talep edildi' },
  { id: 'paid', label: 'Ödendi' },
  { id: 'rejected', label: 'Reddedildi' },
] as const

export type EarningStatus = (typeof EARNING_STATUSES)[number]['id']

export type EarningView = {
  id: number
  siteId: number
  siteName: string
  period: string
  model: string
  ftd: number
  amount: number
  currency: string
  status: EarningStatus
  note: string
  claimedAt: string | null
  paidAt: string | null
  clicks: number
}

export const BOT_UA = /bot|crawl|spider|preview|facebookexternalhit|telegram|whatsapp|slack|discord|embedly|vkshare|skype/i
