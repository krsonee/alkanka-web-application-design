'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { clearTourBlock, saveTourSettings } from '@/lib/tour'
import { TOUR_STEP_IDS } from '@/lib/tour-config'
import type { ActionState } from './actions'

export async function saveTourSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('tour'))) return { message: 'Oturum süresi doldu, tekrar giriş yap.' }
  const steps = Object.fromEntries(
    TOUR_STEP_IDS.map((id) => [
      id,
      { enabled: form.get(`${id}.enabled`) === 'on', title: String(form.get(`${id}.title`) ?? ''), body: String(form.get(`${id}.body`) ?? '') },
    ]),
  )
  try {
    const saved = await saveTourSettings({
      enabled: form.get('enabled') === 'on',
      autoStart: form.get('autoStart') === 'on',
      autoStartDelay: Number(form.get('autoStartDelay')),
      reward: Number(form.get('reward')),
      steps,
    })
    revalidatePath('/', 'layout')
    return { ok: true, message: `Kaydedildi. Bitirme ödülü: ${saved.reward} KC.` }
  } catch {
    return { message: 'Kaydedilemedi, tekrar dene.' }
  }
}

export async function clearTourBlockAction(userId: string): Promise<ActionState> {
  if (!(await canPanel('tour'))) return { message: 'Yetkin yok.' }
  await clearTourBlock(String(userId).slice(0, 100))
  revalidatePath('/panel')
  return { ok: true, message: 'Engel kaldırıldı, üye ödülü tekrar alabilir.' }
}
