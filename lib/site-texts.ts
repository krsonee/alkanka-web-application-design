import 'server-only'
import { getContent } from '@/lib/content'
import { TEXTS_KEY, mergeTexts, parseBonus, type SiteTexts } from '@/lib/site-texts-shared'

export async function getSiteTexts() {
  return mergeTexts(await getContent<SiteTexts>(TEXTS_KEY))
}

export async function getSignupBonus() {
  return parseBonus(await getSiteTexts())
}
