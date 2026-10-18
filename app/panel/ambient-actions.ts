'use server'

import { canPanel } from '@/lib/admin-auth'
import { setContent } from '@/lib/content'
import { AMBIENT_KEY, clearAmbientCache, normalizeAmbient } from '@/lib/ambient-tables'

export type AmbientActionState = { ok?: boolean; message?: string }

export async function saveAmbient(_: AmbientActionState, form: FormData): Promise<AmbientActionState> {
  if (!(await canPanel('growth'))) return { message: 'Oturum süresi doldu, tekrar giriş yap.' }
  const value = normalizeAmbient({
    enabled: form.get('enabled') === 'on',
    startHour: Number(form.get('startHour')),
    endHour: Number(form.get('endHour')),
    perGame: Number(form.get('perGame')),
  })
  try {
    await setContent(AMBIENT_KEY, value)
    clearAmbientCache()
    return { ok: true, message: 'Kaydedildi. Diğer sunucularda en geç 1 dakikada uygulanır.' }
  } catch {
    return { message: 'Kaydedilemedi, tekrar dene.' }
  }
}
