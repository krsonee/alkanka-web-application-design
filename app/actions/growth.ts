'use server'

import { revalidatePath } from 'next/cache'
import { getMember } from '@/lib/member'
import { linkSponsorAccount, removeSponsorAccount, toggleFollow } from '@/lib/growth'
import type { ActionResult } from './community'

export async function toggleFollowAction(siteId: string): Promise<ActionResult & { following?: boolean }> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Adres alarmı için giriş yapmalısın.' }
  try {
    const following = await toggleFollow(member.id, siteId)
    revalidatePath('/profil')
    return {
      ok: true,
      following,
      message: following ? 'Takiptesin. Adres değişince bildirim ve Telegram mesajı gelir.' : 'Takibi bıraktın.',
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' }
  }
}

export async function linkSponsorAccountAction(siteId: string, username: string): Promise<ActionResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  try {
    await linkSponsorAccount(member.id, siteId, username)
    revalidatePath('/profil')
    return { ok: true, message: 'Hesap gönderildi. Onaylanınca çevrim sıralamasında görünürsün.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Hesap bağlanamadı.' }
  }
}

export async function removeSponsorAccountAction(siteId: string): Promise<ActionResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  await removeSponsorAccount(member.id, siteId)
  revalidatePath('/profil')
  return { ok: true, message: 'Bağlantı kaldırıldı.' }
}
