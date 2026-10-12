'use server'

import { revalidatePath } from 'next/cache'
import { getMember } from '@/lib/member'
import { joinSocialEvent, linkSocialAccount, removeSocialAccount } from '@/lib/social'
import type { ActionResult } from './community'

const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

export async function linkSocialAccountAction(platform: string, handle: string): Promise<ActionResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  try {
    await linkSocialAccount(member.id, platform, handle)
    revalidatePath('/profil')
    return { ok: true, message: 'Hesap eklendi. Doğrulama kodunu profil açıklamana (bio) yaz, ekibimiz onaylasın.' }
  } catch (error) {
    return { ok: false, error: message(error, 'Hesap bağlanamadı.') }
  }
}

export async function removeSocialAccountAction(platform: string): Promise<ActionResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  await removeSocialAccount(member.id, platform)
  revalidatePath('/profil')
  return { ok: true, message: 'Bağlantı kaldırıldı.' }
}

export async function joinSocialEventAction(eventId: number, commentUrl: string): Promise<ActionResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  try {
    await joinSocialEvent(member.id, eventId, commentUrl)
    revalidatePath('/profil')
    return { ok: true, message: 'Katılımın alındı. Takip ve yorum kontrol edilince KP hesabına geçer.' }
  } catch (error) {
    return { ok: false, error: message(error, 'Katılım gönderilemedi.') }
  }
}
