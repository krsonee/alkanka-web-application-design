'use server'

import { revalidatePath } from 'next/cache'
import { getMember } from '@/lib/member'
import { awardTask } from '@/lib/tasks'

export async function completeTaskAction(taskId: number): Promise<{ ok: true; awarded: boolean; points: number; message: string } | { ok: false; error: string }> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Puan için giriş yapmalısın.' }
  try {
    const result = await awardTask(member.id, taskId)
    revalidatePath('/gorevler')
    return {
      ok: true,
      awarded: result.awarded,
      points: result.points,
      message: result.awarded ? 'Puan yazıldı.' : 'Bu görevin puanı zaten yazılmış.',
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Görev tamamlanamadı.' }
  }
}
