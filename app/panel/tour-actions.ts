'use server'

import { logPanel, memberTag } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { clearTourBlock, getTourSettings, reshowTour, resetTourFunnel, saveTourSettings } from '@/lib/tour'
import { tourSteps } from '@/lib/tour-config'
import type { ActionState } from './actions'

const MAX_PAYLOAD = 40_000

export async function saveTourSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('tour'))) return { message: 'Oturum süresi doldu, tekrar giriş yap.' }
  const text = String(form.get('payload') ?? '')
  if (!text || text.length > MAX_PAYLOAD) return { message: 'Tur ayarları okunamadı, sayfayı yenileyip tekrar dene.' }
  let draft: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape')
    draft = parsed as Record<string, unknown>
  } catch {
    return { message: 'Tur ayarları okunamadı, sayfayı yenileyip tekrar dene.' }
  }
  try {
    // The version only moves with "yeniden göster"; a form opened before a re-show must not wind it back.
    const { version, versionNote } = await getTourSettings()
    const saved = await saveTourSettings({ ...draft, version, versionNote })
    revalidatePath('/', 'layout')
    const counts = saved.split
      ? `misafir ${tourSteps(saved, 'guest').length} adım, üye ${tourSteps(saved, 'member').length} adım`
      : `${tourSteps(saved, 'member').length} adım`
    await logPanel('tour', 'Site turu ayarları kaydedildi', null, `${counts}, bitirme ödülü ${saved.reward} KC`)
    return { ok: true, message: `Kaydedildi: ${counts}, bitirme ödülü ${saved.reward.toLocaleString('tr-TR')} KC.` }
  } catch {
    return { message: 'Kaydedilemedi, tekrar dene.' }
  }
}

export async function reshowTourAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('tour'))) return { message: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const saved = await reshowTour(String(form.get('note') ?? ''))
    revalidatePath('/', 'layout')
    await logPanel('tour', 'Site turu yeniden gösterime alındı', null, `sürüm ${saved.version}${saved.versionNote ? `, ${saved.versionNote}` : ''}`)
    return { ok: true, message: `Tur, daha önce görenlere de bir kez daha gösterilecek (sürüm ${saved.version}). Ödül yeniden verilmez.` }
  } catch {
    return { message: 'Yapılamadı, tekrar dene.' }
  }
}

export async function resetTourFunnelAction(): Promise<ActionState> {
  if (!(await canPanel('tour'))) return { message: 'Yetkin yok.' }
  try {
    await resetTourFunnel()
    revalidatePath('/panel')
    await logPanel('tour', 'Site turu adım sayımı sıfırlandı')
    return { ok: true, message: 'Sayım sıfırlandı.' }
  } catch {
    return { message: 'Sıfırlanamadı, tekrar dene.' }
  }
}

export async function clearTourBlockAction(userId: string): Promise<ActionState> {
  if (!(await canPanel('tour'))) return { message: 'Yetkin yok.' }
  await clearTourBlock(String(userId).slice(0, 100))
  revalidatePath('/panel')
  await logPanel('tour', 'Tur ödül engeli kaldırıldı', await memberTag(userId))
  return { ok: true, message: 'Engel kaldırıldı, üye ödülü tekrar alabilir.' }
}
