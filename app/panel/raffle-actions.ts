'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { drawBadgeRaffle } from '@/lib/badge-value'

export async function drawRaffleAction(badgeId: string, prize: number, note: string) {
  if (!(await canPanel('badges'))) return { ok: false as const, error: 'Yetkin yok.' }
  if (typeof badgeId !== 'string' || !badgeId) return { ok: false as const, error: 'Rozet seç.' }
  try {
    const winner = await drawBadgeRaffle(badgeId, prize, String(note ?? ''))
    revalidatePath('/rozetler')
    revalidatePath('/panel')
    return { ok: true as const, winner }
  } catch (e) {
    return { ok: false as const, error: (e as Error).message }
  }
}
