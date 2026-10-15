import 'server-only'
import { getAllContent, getContent } from './content'
import { CATALOG_KEYS, mergeCatalog, type Catalog } from './catalog-shared'
import { mergeRewards, type RewardConfig } from './rewards-shared'
import { HIDDEN_KEY, readHidden, withoutHidden, type HiddenMap } from './hidden-shared'

/** The public catalog leaves out anything the panel has hidden; the panel asks for everything. */
export async function getCatalog(opts: { includeHidden?: boolean } = {}): Promise<Catalog> {
  const all = await getAllContent().catch(() => ({}) as Record<string, unknown>)
  const catalog = mergeCatalog(all)
  if (opts.includeHidden) return catalog
  const hidden = readHidden(all[HIDDEN_KEY])
  return {
    ...catalog,
    events: withoutHidden(catalog.events, hidden, 'event'),
    predictions: withoutHidden(catalog.predictions, hidden, 'prediction'),
    campaigns: withoutHidden(catalog.campaigns, hidden, 'campaign'),
    bonuses: withoutHidden(catalog.bonuses, hidden, 'bonus'),
  }
}

export async function getHidden(): Promise<HiddenMap> {
  return readHidden(await getContent(HIDDEN_KEY).catch(() => null))
}

export async function getRewardConfig(): Promise<RewardConfig> {
  return mergeRewards(await getContent(CATALOG_KEYS.rewards).catch(() => null))
}
