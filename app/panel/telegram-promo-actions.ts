'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { saveTelegramPromo } from '@/lib/telegram-promo'
import type { ActionState } from './actions'

export async function saveTelegramPromoAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await canPanel('telegram'))) return { message: 'Oturum süresi doldu, tekrar giriş yap.' }
  const rawUrl = String(form.get('url') ?? '').trim()
  try {
    const saved = await saveTelegramPromo({
      enabled: form.get('enabled') === 'on',
      text: String(form.get('text') ?? ''),
      cta: String(form.get('cta') ?? ''),
      url: rawUrl,
      reward: Number(form.get('reward')),
      reshowDays: Number(form.get('reshowDays')),
    })
    revalidatePath('/', 'layout')
    if (rawUrl && !saved.url) return { ok: true, message: 'Kaydedildi, ama link geçersiz olduğu için ana kanal linki kullanılacak. t.me/... ya da @kullaniciadi gir.' }
    return { ok: true, message: saved.enabled ? 'Kaydedildi, şerit sitede yayında.' : 'Kaydedildi, şerit kapalı.' }
  } catch {
    return { message: 'Kaydedilemedi, tekrar dene.' }
  }
}
