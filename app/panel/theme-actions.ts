'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import type { ThemeOffer } from '@/lib/table-themes'
import { saveThemeOffer } from '@/lib/table-themes-server'

export async function saveThemeOfferAction(input: ThemeOffer): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await canPanel('market'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    await saveThemeOffer(input)
    revalidatePath('/panel')
    revalidatePath('/market')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}
