export const AD_PAGES = [
  { id: 'sponsorlar', label: 'Sponsorlar sayfası' },
  { id: 'kampanyalar', label: 'Kampanyalar sayfası' },
  { id: 'kankatv', label: 'KankaTV ve canlı skor' },
] as const

export const AD_POSITIONS = [
  { id: 'top', label: 'Üst banner', size: '1200 × 150 (geniş, GIF olabilir)' },
  { id: 'left', label: 'Sol kule', size: '160 × 600' },
  { id: 'right', label: 'Sağ kule', size: '160 × 600' },
] as const

export type AdPage = (typeof AD_PAGES)[number]['id']
export type AdPosition = (typeof AD_POSITIONS)[number]['id']
export type AdSlot = { image: string; href: string; alt: string }
export type AdMap = Partial<Record<`${AdPage}:${AdPosition}`, AdSlot>>

export const ADS_KEY = 'ads:slots'
