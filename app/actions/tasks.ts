'use server'

import { revalidatePath } from 'next/cache'
import { getMember } from '@/lib/member'
import { awardTask, listPublicTasks, requestTaskApproval } from '@/lib/tasks'

export async function completeTaskAction(taskId: number): Promise<
  | { ok: true; awarded: boolean; pending: boolean; points: number; balance?: number; message: string }
  | { ok: false; error: string }
> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Puan için giriş yapmalısın.' }
  try {
    const task = (await listPublicTasks()).find((item) => item.id === taskId)
    if (!task) return { ok: false, error: 'Görev bulunamadı.' }
    if (task.needsApproval) {
      const claim = await requestTaskApproval(member.id, taskId)
      revalidatePath('/gorevler')
      revalidatePath('/panel')
      if (claim.status === 'beklemede') return { ok: true, awarded: false, pending: true, points: claim.points, message: 'Onay bekliyor.' }
      if (claim.status === 'onaylandi') return { ok: true, awarded: false, pending: false, points: claim.points, message: 'Bu görevin puanı zaten yazılmış.' }
      return { ok: true, awarded: false, pending: false, points: claim.points, message: 'Bu görev reddedildi.' }
    }
    const result = await awardTask(member.id, taskId)
    revalidatePath('/gorevler')
    return {
      ok: true,
      awarded: result.awarded,
      pending: false,
      points: result.points,
      balance: result.balance,
      message: result.awarded ? 'Puan yazıldı.' : 'Bu görevin puanı zaten yazılmış.',
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Görev tamamlanamadı.' }
  }
}
