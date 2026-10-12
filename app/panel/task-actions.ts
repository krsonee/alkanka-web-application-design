'use server'

import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'
import { saveTask, type TaskInput } from '@/lib/tasks'

type Result = { ok: true; message?: string } | { ok: false; error: string }

export async function saveTaskAction(input: TaskInput): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await saveTask(input)
    revalidatePath('/panel')
    revalidatePath('/gorevler')
    return { ok: true, message: input.id ? 'Görev güncellendi.' : 'Görev kaydedildi.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}
