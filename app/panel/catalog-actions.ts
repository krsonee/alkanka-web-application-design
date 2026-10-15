'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/panel-auth'
import { deleteContent, setContent } from '@/lib/content'
import {
  CATALOG_KEYS,
  cleanBonuses,
  cleanCampaigns,
  cleanEvents,
  cleanPredictions,
} from '@/lib/catalog-shared'
import { mergeRewards, type RewardConfig } from '@/lib/rewards-shared'

type Result = { ok: true; message: string } | { ok: false; error: string }
type ListKind = 'events' | 'predictions' | 'campaigns' | 'bonuses'

const CLEANERS: Record<ListKind, (raw: unknown) => unknown[]> = {
  events: cleanEvents,
  predictions: cleanPredictions,
  campaigns: cleanCampaigns,
  bonuses: cleanBonuses,
}

export async function saveRewards(input: RewardConfig): Promise<Result> {
  if (!(await canPanel('rewards'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    await setContent(CATALOG_KEYS.rewards, mergeRewards(input))
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Ödüller kaydedildi, sitede hemen geçerli.' }
  } catch (error) {
    console.error('[rewards] kaydedilemedi', error)
    return { ok: false, error: 'Kaydedilemedi.' }
  }
}

export async function saveCatalogList(kind: ListKind, items: unknown): Promise<Result> {
  if (!(await canPanel('catalog'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  const clean = CLEANERS[kind]
  if (!clean) return { ok: false, error: 'Geçersiz bölüm.' }
  try {
    await setContent(CATALOG_KEYS[kind], clean(items))
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Kaydedildi, sitede hemen geçerli.' }
  } catch (error) {
    console.error(`[catalog:${kind}] kaydedilemedi`, error)
    return { ok: false, error: 'Kaydedilemedi.' }
  }
}

export async function resetCatalog(kind: ListKind | 'rewards'): Promise<Result> {
  if (!(await canPanel(kind === 'rewards' ? 'rewards' : 'catalog'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    await deleteContent(CATALOG_KEYS[kind])
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Varsayılana döndürüldü.' }
  } catch (error) {
    console.error(`[catalog:${kind}] sıfırlanamadı`, error)
    return { ok: false, error: 'Sıfırlanamadı.' }
  }
}
