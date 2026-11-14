import { getContent } from './content'
import { isScheduledLive } from './schedule'

export const AD_PAGES = [
  { id: 'sponsorlar', label: 'Sponsorlar sayfası' },
  { id: 'kampanyalar', label: 'Kampanyalar sayfası' },
  { id: 'kankatv', label: 'KankaTV ve canlı skor' },
] as const

export const AD_POSITIONS = [
  { id: 'top', label: 'Üst banner', size: '1200 × 150' },
  { id: 'left', label: 'Sol kule', size: '160 × 600' },
  { id: 'right', label: 'Sağ kule', size: '160 × 600' },
] as const

export type AdPage = (typeof AD_PAGES)[number]['id']
export type AdPosition = (typeof AD_POSITIONS)[number]['id']
/** `w` and `h` are the creative's own pixel size, measured in the panel when the image is picked. */
export type AdSlot = { image: string; href: string; alt: string; startAt?: string; endAt?: string; w?: number; h?: number }
export type AdMap = Partial<Record<`${AdPage}:${AdPosition}`, AdSlot>>

export const AD_MAX_HEIGHT = 600
export const AD_TOWER_MAX_WIDTH = 160

/** Size a creative is drawn at: its own size, scaled down (never up) to fit the slot. The page width can shrink it further. */
export function adDisplaySize(position: AdPosition, slot: Pick<AdSlot, 'w' | 'h'>) {
  if (!slot.w || !slot.h) return null
  const scale = Math.min(1, AD_MAX_HEIGHT / slot.h, position === 'top' ? 1 : AD_TOWER_MAX_WIDTH / slot.w)
  return { width: Math.round(slot.w * scale), height: Math.round(slot.h * scale) }
}

export const ADS_KEY = 'ads:slots'

export async function getAds(): Promise<AdMap> {
  try {
    return (await getContent<AdMap>(ADS_KEY)) ?? {}
  } catch {
    return {}
  }
}

export async function getPageAds(page: AdPage) {
  const all = await getAds()
  const live = (slot?: AdSlot) => (slot && isScheduledLive(slot) ? slot : undefined)
  return {
    top: live(all[`${page}:top`]),
    left: live(all[`${page}:left`]),
    right: live(all[`${page}:right`]),
  }
}
