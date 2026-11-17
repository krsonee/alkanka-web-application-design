'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { approveClaim, archiveTask, rejectClaim, saveTask, type TaskInput } from '@/lib/tasks'

type Result = { ok: true; message?: string } | { ok: false; error: string }

function done(pathMessage: string): Result {
  revalidatePath('/panel')
  revalidatePath('/gorevler')
  return { ok: true, message: pathMessage }
}

export async function saveTaskAction(input: TaskInput): Promise<Result> {
  if (!(await canPanel('tasks'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await saveTask(input)
    await logPanel('tasks', input.id ? 'Görev güncellendi' : 'Görev eklendi', input.title, `${input.points} KP`)
    return done(input.id ? 'Görev güncellendi.' : 'Görev kaydedildi.')
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}

export async function archiveTaskAction(id: number, archived: boolean): Promise<Result> {
  if (!(await canPanel('tasks'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const title = await archiveTask(Number(id), Boolean(archived))
    await logPanel('tasks', archived ? 'Görev arşivlendi' : 'Görev arşivden çıkarıldı', title)
    return done(archived ? 'Görev arşive alındı; sitede görünmez.' : 'Görev arşivden çıktı. Gizli duruyor; yayına almak için göz düğmesine bas.')
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}

export async function approveClaimAction(claimId: number): Promise<Result> {
  if (!(await canPanel('tasks'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await approveClaim(claimId)
    await logPanel('tasks', 'Görev talebi onaylandı', `Talep #${claimId}`)
    return done('Puan yazıldı.')
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Talep onaylanamadı.' }
  }
}

export async function rejectClaimAction(claimId: number, note = ''): Promise<Result> {
  if (!(await canPanel('tasks'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await rejectClaim(claimId, String(note ?? ''))
    await logPanel('tasks', 'Görev talebi reddedildi', `Talep #${claimId}`, String(note ?? '').trim() || null)
    return done('Talep reddedildi, üyeye mesajla bildirildi.')
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Talep reddedilemedi.' }
  }
}
