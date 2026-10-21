'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { setContent } from '@/lib/content'
import { APP_SETTINGS_KEY, normalizeAppSettings } from '@/lib/app-config'
import type { ActionState } from './actions'

export async function saveAppSettings(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('push'))) return { message: 'Oturum süresi doldu, tekrar giriş yap.' }
  const value = normalizeAppSettings({
    installBonus: Number(form.get('installBonus')),
    pushBonus: Number(form.get('pushBonus')),
    comboBonus: Number(form.get('comboBonus')),
  })
  try {
    await setContent(APP_SETTINGS_KEY, value)
    revalidatePath('/', 'layout')
    return { ok: true, message: `Kaydedildi: kurulum ${value.installBonus} KC, bildirim ${value.pushBonus} KC, ikisi birden +${value.comboBonus} KC.` }
  } catch {
    return { message: 'Kaydedilemedi, tekrar dene.' }
  }
}
