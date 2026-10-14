'use server'

import { revalidatePath } from 'next/cache'
import { getMember } from '@/lib/member'
import { linkStream, unlinkStream } from '@/lib/member-streams'
import { STREAM_LABEL, isStreamPlatform } from '@/lib/member-streams-shared'
import type { ActionResult } from './community'

export async function linkStreamAction(platform: string, input: string): Promise<ActionResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  try {
    await linkStream(member.id, platform, input)
    revalidatePath('/profil')
    revalidatePath('/kankatv')
    const label = isStreamPlatform(platform) ? STREAM_LABEL[platform] : 'Kanal'
    return { ok: true, message: `${label} kanalın bağlandı. Yayına geçtiğinde KankaTV'de görünür.` }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Kanal bağlanamadı.' }
  }
}

export async function unlinkStreamAction(platform: string): Promise<ActionResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  await unlinkStream(member.id, platform)
  revalidatePath('/profil')
  revalidatePath('/kankatv')
  return { ok: true, message: 'Kanal bağlantısı kaldırıldı.' }
}
