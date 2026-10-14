'use server'

import { revalidatePath } from 'next/cache'
import { canPanel, getPanelSession } from '@/lib/panel-auth'
import { findMember, removeLimit, saveLimit, type LimitInput } from '@/lib/member-limits'

type Result = { ok: true; message?: string } | { ok: false; error: string }
const DENIED: Result = { ok: false, error: 'Bu bölüm için yetkin yok.' }

export async function searchMembersForLimit(query: string) {
  if (!(await canPanel('limits'))) return []
  return findMember(String(query ?? '').slice(0, 100))
}

export async function saveMemberLimit(userId: string, input: LimitInput): Promise<Result> {
  if (!(await canPanel('limits'))) return DENIED
  const session = await getPanelSession()
  try {
    await saveLimit(String(userId), input, session?.username ?? '')
    revalidatePath('/panel')
    return { ok: true, message: 'Kısıtlama kaydedildi.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Kaydedilemedi.' }
  }
}

export async function deleteMemberLimit(userId: string): Promise<Result> {
  if (!(await canPanel('limits'))) return DENIED
  await removeLimit(String(userId))
  revalidatePath('/panel')
  return { ok: true, message: 'Kısıtlama kaldırıldı.' }
}
