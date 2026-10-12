'use server'

import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'
import { saveSite } from '@/lib/sites'
import type { SiteInput } from '@/lib/sites-shared'

type Result = { ok: true; message?: string } | { ok: false; error: string }

export async function saveSiteAction(input: SiteInput): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await saveSite(input)
    revalidatePath('/panel')
    revalidatePath('/')
    revalidatePath('/sponsorlar')
    return { ok: true, message: input.id ? 'Sponsor güncellendi.' : 'Sponsor kaydedildi.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}
