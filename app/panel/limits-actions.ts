'use server'

import { logPanel, memberTag } from '@/lib/panel-log'
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
    const result = await saveLimit(String(userId), input, session?.username ?? '')
    revalidatePath('/panel')
    const cleared = result === 'cleared'
    await logPanel('limits', cleared ? 'Gizli kısıtlama kaldırıldı' : 'Gizli kısıtlama kaydedildi', await memberTag(userId))
    return { ok: true, message: cleared ? 'Tüm alanlar boş olduğu için bu üyenin kısıtlaması kaldırıldı.' : 'Kısıtlama kaydedildi.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Kaydedilemedi.' }
  }
}

export async function deleteMemberLimit(userId: string): Promise<Result> {
  if (!(await canPanel('limits'))) return DENIED
  await removeLimit(String(userId))
  revalidatePath('/panel')
  await logPanel('limits', 'Gizli kısıtlama kaldırıldı', await memberTag(userId))
  return { ok: true, message: 'Kısıtlama kaldırıldı.' }
}
