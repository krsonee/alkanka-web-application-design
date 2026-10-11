import { getContent } from '@/lib/content'

export const SHARE_KEY = 'share'

export type ShareSettings = { title?: string; description?: string; image?: string; siteName?: string }

export async function getShare(): Promise<ShareSettings> {
  try {
    return (await getContent<ShareSettings>(SHARE_KEY)) ?? {}
  } catch {
    return {}
  }
}
