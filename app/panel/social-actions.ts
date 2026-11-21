'use server'

import { logPanel, memberTag } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel, isPanelOwner } from '@/lib/admin-auth'
import {
  createSocialEvent,
  deleteSocialEvent,
  getSocialLinks,
  reviewEntry,
  saveSocialLinks,
  setSocialAccountStatus,
  setSocialEventActive,
  type EventInput,
  type SocialLinks,
} from '@/lib/social'
import { PLATFORM_LABEL, type SocialPlatform } from '@/lib/social-shared'

type Result = { ok: boolean; message: string }
const denied: Result = { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
const fail = (error: unknown): Result => ({ ok: false, message: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' })

function refresh() {
  revalidatePath('/panel')
  revalidatePath('/', 'layout')
}

export async function getSocialLinksAction(): Promise<SocialLinks> {
  if (!(await canPanel('social'))) return {}
  return getSocialLinks().catch(() => ({}))
}

export async function saveSocialLinksAction(links: SocialLinks): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  try {
    await saveSocialLinks(links)
    refresh()
    await logPanel('social', 'Sosyal medya hesapları kaydedildi')
    return { ok: true, message: 'Sosyal medya hesapları kaydedildi.' }
  } catch (error) {
    return fail(error)
  }
}

const ownerOnly: Result = { ok: false, message: 'API anahtarlarını sadece ana yönetici görür ve değiştirir.' }

export async function saveSocialApiAction(platform: SocialPlatform, fields: Record<string, string>): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  if (!(await isPanelOwner())) return ownerOnly
  try {
    const { saveSocialApi } = await import('@/lib/social-verify')
    await saveSocialApi(platform, fields)
    revalidatePath('/panel')
    await logPanel('social', 'Sosyal doğrulama bağlantısı kaydedildi', PLATFORM_LABEL[platform])
    return { ok: true, message: `${PLATFORM_LABEL[platform]} bağlantısı kaydedildi.` }
  } catch (error) {
    return fail(error)
  }
}

export async function clearSocialApiAction(platform: SocialPlatform): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  if (!(await isPanelOwner())) return ownerOnly
  try {
    const { clearSocialApi } = await import('@/lib/social-verify')
    await clearSocialApi(platform)
    revalidatePath('/panel')
    await logPanel('social', 'Sosyal doğrulama bağlantısı kaldırıldı', PLATFORM_LABEL[platform])
    return { ok: true, message: `${PLATFORM_LABEL[platform]} bağlantısı kaldırıldı.` }
  } catch (error) {
    return fail(error)
  }
}

export async function reviewSocialAccountAction(userId: string, platform: string, approve: boolean, note: string): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  await setSocialAccountStatus(userId, platform, approve ? 'verified' : 'rejected', note)
  refresh()
  await logPanel('social', approve ? 'Sosyal hesap doğrulandı' : 'Sosyal hesap reddedildi', await memberTag(userId), `${platform}${note ? ` · ${note}` : ''}`)
  return { ok: true, message: approve ? 'Hesap doğrulandı.' : 'Hesap reddedildi.' }
}

export async function createSocialEventAction(input: EventInput): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  try {
    await createSocialEvent(input)
    refresh()
    await logPanel('social', 'Sosyal etkinlik açıldı', input.title, `${input.platform} · ${input.reward} KP`)
    return { ok: true, message: 'Etkinlik yayında.' }
  } catch (error) {
    return fail(error)
  }
}

export async function toggleSocialEventAction(id: number, active: boolean): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  await setSocialEventActive(id, active)
  refresh()
  await logPanel('social', active ? 'Sosyal etkinlik açıldı' : 'Sosyal etkinlik kapatıldı', `Etkinlik #${id}`)
  return { ok: true, message: active ? 'Etkinlik açıldı.' : 'Etkinlik kapatıldı.' }
}

export async function deleteSocialEventAction(id: number): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  await deleteSocialEvent(id)
  refresh()
  await logPanel('social', 'Sosyal etkinlik silindi', `Etkinlik #${id}`)
  return { ok: true, message: 'Etkinlik silindi.' }
}

export async function reviewEntryAction(eventId: number, userId: string, approve: boolean, note: string): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  try {
    const paid = await reviewEntry(eventId, userId, approve, note)
    refresh()
    await logPanel('social', approve ? 'Etkinlik katılımı onaylandı' : 'Etkinlik katılımı reddedildi', await memberTag(userId), `Etkinlik #${eventId}${note ? ` · ${note}` : ''}`)
    return { ok: true, message: approve ? `Katılım onaylandı${paid ? `, ${paid} KP verildi` : ''}.` : 'Katılım reddedildi.' }
  } catch (error) {
    return fail(error)
  }
}
