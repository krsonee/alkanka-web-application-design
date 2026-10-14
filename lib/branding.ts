import { getContent, setContent } from '@/lib/content'

export const BRANDING_KEY = 'site:branding'
export const ICON_SIZES = [512, 192, 180] as const
export type IconSize = (typeof ICON_SIZES)[number]

export type Branding = {
  logoUrl?: string
  logoHeight?: number
  icons?: Partial<Record<`${IconSize}`, string>>
  iconVersion?: number
}

export async function getBranding(): Promise<Branding> {
  return (await getContent<Branding>(BRANDING_KEY)) ?? {}
}

export async function updateBranding(patch: Partial<Branding>) {
  const current = await getBranding()
  const next = { ...current, ...patch }
  await setContent(BRANDING_KEY, next)
  return next
}

export function iconHref(size: IconSize, branding: Branding) {
  return branding.icons?.[`${size}`] ? `/app-icon/${size}?v=${branding.iconVersion ?? 0}` : null
}
