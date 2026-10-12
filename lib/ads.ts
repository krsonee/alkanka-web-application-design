import { getContent } from './content'
import { ADS_KEY, type AdMap, type AdPage } from './ads-shared'

export { AD_PAGES, AD_POSITIONS, ADS_KEY, type AdMap, type AdPage, type AdPosition, type AdSlot } from './ads-shared'

export async function getAds(): Promise<AdMap> {
  try {
    return (await getContent<AdMap>(ADS_KEY)) ?? {}
  } catch {
    return {}
  }
}

export async function getPageAds(page: AdPage) {
  const all = await getAds()
  return {
    top: all[`${page}:top`],
    left: all[`${page}:left`],
    right: all[`${page}:right`],
  }
}
