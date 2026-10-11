export type StudioBrand = {
  id: number
  name: string
  domain: string
  logo: string
  logoUrl: string
  colors: string[]
  font: string
  notes: string
}

export type StudioAsset = { id: number; provider: string; game: string; pathname: string; url: string }

export type StudioKind = 'banner' | 'sticker'

export type StudioJob = {
  id: number
  brandId: number | null
  brandName: string
  kind: StudioKind
  format: string
  prompt: string
  url: string
  parentId: number | null
  cost: number
  createdAt: string
}

export const STUDIO_FORMATS = [
  { id: '1:1', label: 'Kare 1:1', hint: 'Gönderi' },
  { id: '9:16', label: 'Dikey 9:16', hint: 'Story / Reels' },
  { id: '16:9', label: 'Yatay 16:9', hint: 'Site banner' },
] as const

export const STUDIO_CATEGORIES = [
  'Casino promo',
  'Spor bahisi',
  'Slot / freespin',
  'Canlı casino',
  'Özel oran',
  'Promo kod',
  'Turnuva',
] as const

export const IMAGE_COST = 0.06
