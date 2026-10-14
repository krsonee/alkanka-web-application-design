'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { approveClaim, rejectClaim, saveTask, type TaskInput } from '@/lib/tasks'

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
    return done(input.id ? 'Görev güncellendi.' : 'Görev kaydedildi.')
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}

export async function approveClaimAction(claimId: number): Promise<Result> {
  if (!(await canPanel('tasks'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await approveClaim(claimId)
    return done('Puan yazıldı.')
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Talep onaylanamadı.' }
  }
}

export async function rejectClaimAction(claimId: number): Promise<Result> {
  if (!(await canPanel('tasks'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await rejectClaim(claimId)
    return done('Talep reddedildi.')
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Talep reddedilemedi.' }
  }
}
