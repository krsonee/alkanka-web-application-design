'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { reorderFaqs, saveFaq, type FaqInput } from '@/lib/faqs'

type Result = { ok: true; message?: string } | { ok: false; error: string }

export async function reorderFaqsAction(ids: number[]): Promise<Result> {
  if (!(await canPanel('faqs'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await reorderFaqs(ids)
    revalidatePath('/panel')
    revalidatePath('/sss')
    await logPanel('faqs', 'Soru sırası değişti', null, `${ids.length} soru sürüklenerek sıralandı`)
    return { ok: true, message: 'Sıra kaydedildi.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Sıra kaydedilemedi.' }
  }
}

export async function saveFaqAction(input: FaqInput): Promise<Result> {
  if (!(await canPanel('faqs'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await saveFaq(input)
    revalidatePath('/panel')
    revalidatePath('/sss')
    await logPanel('faqs', input.id ? 'Soru güncellendi' : 'Soru eklendi', input.question)
    return { ok: true, message: input.id ? 'Soru güncellendi.' : 'Soru kaydedildi.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}
