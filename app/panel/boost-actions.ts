'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { saveBoostConfig } from '@/lib/boosts'
import type { BoostConfig } from '@/lib/boosts-shared'

export async function saveBoostsAction(input: BoostConfig) {
  if (!(await canPanel('badges'))) return { ok: false as const, error: 'Yetkin yok.' }
  try {
    const cfg = await saveBoostConfig(input)
    revalidatePath('/', 'layout')
    return { ok: true as const, cfg }
  } catch (e) {
    return { ok: false as const, error: (e as Error).message }
  }
}
