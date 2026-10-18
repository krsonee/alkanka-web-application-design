'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { setContent } from '@/lib/content'
import { normalizeReferral, REFERRAL_KEY } from '@/lib/referral-settings'

export type ReferralActionState = { ok?: boolean; message?: string }

export async function saveReferral(_: ReferralActionState, form: FormData): Promise<ReferralActionState> {
  if (!(await canPanel('growth'))) return { message: 'Oturum süresi doldu, tekrar giriş yap.' }
  const value = normalizeReferral({
    referrer: Number(form.get('referrer')),
    referred: Number(form.get('referred')),
    welcome: Number(form.get('welcome')),
    minGames: Number(form.get('minGames')),
  })
  try {
    await setContent(REFERRAL_KEY, value)
    revalidatePath('/profil')
    return { ok: true, message: 'Davet ödülleri kaydedildi.' }
  } catch {
    return { message: 'Kaydedilemedi, tekrar dene.' }
  }
}
