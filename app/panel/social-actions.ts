'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import {
  createSocialEvent,
  deleteSocialEvent,
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

export async function saveSocialLinksAction(links: SocialLinks): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  try {
    await saveSocialLinks(links)
    refresh()
    return { ok: true, message: 'Sosyal medya hesapları kaydedildi.' }
  } catch (error) {
    return fail(error)
  }
}

export async function saveSocialApiAction(platform: SocialPlatform, fields: Record<string, string>): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  try {
    const { saveSocialApi } = await import('@/lib/social-verify')
    await saveSocialApi(platform, fields)
    revalidatePath('/panel')
    return { ok: true, message: `${PLATFORM_LABEL[platform]} bağlantısı kaydedildi.` }
  } catch (error) {
    return fail(error)
  }
}

export async function clearSocialApiAction(platform: SocialPlatform): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  try {
    const { clearSocialApi } = await import('@/lib/social-verify')
    await clearSocialApi(platform)
    revalidatePath('/panel')
    return { ok: true, message: `${PLATFORM_LABEL[platform]} bağlantısı kaldırıldı.` }
  } catch (error) {
    return fail(error)
  }
}

export async function reviewSocialAccountAction(userId: string, platform: string, approve: boolean, note: string): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  await setSocialAccountStatus(userId, platform, approve ? 'verified' : 'rejected', note)
  refresh()
  return { ok: true, message: approve ? 'Hesap doğrulandı.' : 'Hesap reddedildi.' }
}

export async function createSocialEventAction(input: EventInput): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  try {
    await createSocialEvent(input)
    refresh()
    return { ok: true, message: 'Etkinlik yayında.' }
  } catch (error) {
    return fail(error)
  }
}

export async function toggleSocialEventAction(id: number, active: boolean): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  await setSocialEventActive(id, active)
  refresh()
  return { ok: true, message: active ? 'Etkinlik açıldı.' : 'Etkinlik kapatıldı.' }
}

export async function deleteSocialEventAction(id: number): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  await deleteSocialEvent(id)
  refresh()
  return { ok: true, message: 'Etkinlik silindi.' }
}

export async function reviewEntryAction(eventId: number, userId: string, approve: boolean, note: string): Promise<Result> {
  if (!(await canPanel('social'))) return denied
  try {
    const paid = await reviewEntry(eventId, userId, approve, note)
    refresh()
    return { ok: true, message: approve ? `Katılım onaylandı${paid ? `, ${paid} KP verildi` : ''}.` : 'Katılım reddedildi.' }
  } catch (error) {
    return fail(error)
  }
}
