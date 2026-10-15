'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/panel-auth'
import type { PanelModule } from '@/lib/panel-modules'
import { getContent, setContent } from '@/lib/content'
import { rows, sql } from '@/lib/db'
import { HIDDEN_KEY, readHidden, type HiddenScope } from '@/lib/hidden-shared'
import { isArenaGame, type ArenaSettings } from '@/lib/arena'
import { setSocialEventActive } from '@/lib/social'

export type VisibilityKind =
  | 'sponsor'
  | 'task'
  | 'faq'
  | 'market'
  | 'badge'
  | 'social'
  | 'arena'
  | HiddenScope

type Result = { ok: true; message: string } | { ok: false; error: string }

const MODULE: Record<VisibilityKind, PanelModule> = {
  sponsor: 'sponsors',
  task: 'tasks',
  faq: 'faqs',
  market: 'market',
  badge: 'badges',
  social: 'social',
  arena: 'games',
  slide: 'slide',
  mini: 'games',
  event: 'catalog',
  prediction: 'catalog',
  campaign: 'catalog',
  bonus: 'catalog',
  tournament: 'tournaments',
}

async function toggleListed(scope: HiddenScope, id: string, visible: boolean) {
  const map = readHidden(await getContent(HIDDEN_KEY))
  const set = new Set(map[scope] ?? [])
  if (visible) set.delete(id)
  else set.add(id)
  await setContent(HIDDEN_KEY, { ...map, [scope]: [...set] })
}

export async function setVisibility(kind: VisibilityKind, rawId: string | number, visible: boolean): Promise<Result> {
  const module = MODULE[kind]
  if (!module) return { ok: false, error: 'Geçersiz bölüm.' }
  if (!(await canPanel(module))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  const id = String(rawId).slice(0, 120)
  if (!id) return { ok: false, error: 'Kayıt bulunamadı.' }

  try {
    switch (kind) {
      case 'sponsor':
        await rows(sql`UPDATE sites SET active = ${visible} WHERE id = ${Number(id)}`)
        break
      case 'task':
        await rows(sql`UPDATE tasks SET active = ${visible} WHERE id = ${Number(id)}`)
        break
      case 'faq':
        await rows(sql`UPDATE faqs SET active = ${visible} WHERE id = ${Number(id)}`)
        break
      case 'market':
        await rows(sql`UPDATE market_items SET active = ${visible} WHERE id = ${id}`)
        break
      case 'badge':
        await rows(sql`UPDATE kp_badges SET active = ${visible} WHERE id = ${id}`)
        break
      case 'social':
        await setSocialEventActive(Number(id), visible)
        break
      case 'arena': {
        if (!isArenaGame(id)) return { ok: false, error: 'Oyun bulunamadı.' }
        const saved = (await getContent<Partial<ArenaSettings>>('arena:settings')) ?? {}
        await setContent('arena:settings', { ...saved, [id]: { ...(saved[id] ?? {}), enabled: visible } })
        break
      }
      default:
        await toggleListed(kind, id, visible)
    }
    revalidatePath('/', 'layout')
    return { ok: true, message: visible ? 'Sitede tekrar görünüyor.' : 'Siteden gizlendi, üyeler göremez.' }
  } catch (error) {
    console.error(`[visibility:${kind}]`, error)
    return { ok: false, error: 'Değiştirilemedi.' }
  }
}
