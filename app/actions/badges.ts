'use server'

import { revalidatePath } from 'next/cache'
import { getMember } from '@/lib/member'
import { savePins } from '@/lib/badge-value'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

export async function savePinsAction(ids: string[]): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  if (!Array.isArray(ids)) return { ok: false, error: 'Geçersiz seçim.' }
  if (await hitRateLimit(`pins:${member.id}`, 10, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  try {
    const saved = await savePins(member.id, ids)
    revalidatePath('/profil')
    revalidatePath('/siralama')
    return { ok: true, ids: saved }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}
