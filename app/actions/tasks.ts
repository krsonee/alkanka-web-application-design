'use server'

import { revalidatePath } from 'next/cache'
import { getMember } from '@/lib/member'
import { awardTask, bundleTarget, canClaim, codeMatches, officialSocialLinks, requestTaskApproval, taskProgress } from '@/lib/tasks'
import { checkIn } from '@/lib/checkin'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

export async function checkInAction(): Promise<
  { ok: true; claimed: boolean; streak: number; reward: number; balance: number } | { ok: false; error: string }
> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Ödül için giriş yapmalısın.' }
  if (await hitRateLimit(`checkin:${member.id}`, 5, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  try {
    const result = await checkIn(member.id)
    revalidatePath('/gorevler')
    return { ok: true, ...result }
  } catch {
    return { ok: false, error: 'Ödül alınamadı, biraz sonra tekrar dene.' }
  }
}

export async function completeTaskAction(taskId: number, code?: string): Promise<
  | { ok: true; awarded: boolean; pending: boolean; points: number; balance?: number; message: string }
  | { ok: false; error: string }
> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Puan için giriş yapmalısın.' }
  if (await hitRateLimit(`task:${member.id}`, 10, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  try {
    const gate = await canClaim(member.id, taskId)
    if (!gate.ok) return { ok: false, error: gate.error }
    const task = gate.task
    if (task.kind === 'secret_code') {
      if (await hitRateLimit(`task-code:${member.id}`, 5, 300)) return { ok: false, error: 'Çok fazla deneme yaptın, 5 dakika sonra tekrar dene.' }
      if (!codeMatches(task.param, String(code ?? ''))) return { ok: false, error: 'Kod yanlış kanka. Telegram kanalına tekrar bak.' }
    } else if (task.kind === 'bundle') {
      const progress = await taskProgress(member.id, task)
      const target = bundleTarget(task, gate.visible)
      if (progress < target) return { ok: false, error: `Önce diğer görevleri bitir: ${progress}/${target}.` }
    } else if (task.kind === 'social_follow' || task.kind === 'social_like') {
      if (await hitRateLimit(`social-check:${member.id}`, 6, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
      const { checkSocialTask } = await import('@/lib/social-verify')
      const official = await officialSocialLinks()
      const check = await checkSocialTask(member.id, task, official[task.param ?? ''] ?? '')
      if (check === 'review') {
        const claim = await requestTaskApproval(member.id, taskId, member.name, true)
        revalidatePath('/gorevler')
        revalidatePath('/panel')
        if (claim.status === 'beklemede') return { ok: true, awarded: false, pending: true, points: claim.points, message: 'Kontrol için onaya gönderildi.' }
        if (claim.status === 'onaylandi') return { ok: true, awarded: false, pending: false, points: claim.points, message: 'Bu görevin puanı zaten yazılmış.' }
        return { ok: true, awarded: false, pending: false, points: claim.points, message: 'Bu görev reddedildi.' }
      }
    } else if (task.kind !== 'manual') {
      const progress = await taskProgress(member.id, task)
      if (progress < task.target) {
        return { ok: false, error: task.target > 1 ? `Henüz bitmedi: ${progress}/${task.target}. Tamamlayınca ödülü al.` : 'Görev henüz tamamlanmadı. Önce görevi yap, sonra ödülü al.' }
      }
    } else if (task.needsApproval) {
      const claim = await requestTaskApproval(member.id, taskId, member.name)
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
      message: result.awarded ? `+${result.points} yazıldı.` : 'Bu görevin puanı zaten yazılmış.',
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Görev tamamlanamadı.' }
  }
}
