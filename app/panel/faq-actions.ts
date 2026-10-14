'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { saveFaq, type FaqInput } from '@/lib/faqs'

type Result = { ok: true; message?: string } | { ok: false; error: string }

export async function saveFaqAction(input: FaqInput): Promise<Result> {
  if (!(await canPanel('faqs'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await saveFaq(input)
    revalidatePath('/panel')
    revalidatePath('/sss')
    return { ok: true, message: input.id ? 'Soru güncellendi.' : 'Soru kaydedildi.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}
