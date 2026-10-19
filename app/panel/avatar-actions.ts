'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { deleteAvatar, saveAvatar, type AvatarInput } from '@/lib/avatars'

type Result = { ok: true; message: string } | { ok: false; error: string }

export async function saveAvatarAction(input: AvatarInput): Promise<Result> {
  if (!(await canPanel('market'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    await saveAvatar(input)
    revalidatePath('/panel')
    revalidatePath('/profil')
    return { ok: true, message: input.id ? 'Avatar güncellendi.' : 'Yeni avatar eklendi.' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Kaydedilemedi.' }
  }
}

export async function deleteAvatarAction(id: string): Promise<Result> {
  if (!(await canPanel('market'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  try {
    const message = await deleteAvatar(String(id))
    revalidatePath('/panel')
    revalidatePath('/profil')
    return { ok: true, message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Silinemedi.' }
  }
}
