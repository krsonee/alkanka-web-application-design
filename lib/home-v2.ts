import 'server-only'
import { getContent } from '@/lib/content'
import { HOME_V2_KEY, mergeHomeV2, type HomeV2Settings } from '@/lib/home-v2-shared'

export async function getHomeV2(): Promise<HomeV2Settings> {
  return mergeHomeV2(await getContent(HOME_V2_KEY).catch(() => null))
}
