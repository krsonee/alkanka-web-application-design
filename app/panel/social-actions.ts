'use server'

import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'
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

type Result = { ok: boolean; message: string }
const denied: Result = { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
const fail = (error: unknown): Result => ({ ok: false, message: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' })

function refresh() {
  revalidatePath('/panel')
  revalidatePath('/', 'layout')
}

export async function saveSocialLinksAction(links: SocialLinks): Promise<Result> {
  if (!(await isAdmin())) return denied
  try {
    await saveSocialLinks(links)
    refresh()
    return { ok: true, message: 'Sosyal medya hesapları kaydedildi.' }
  } catch (error) {
    return fail(error)
  }
}

export async function reviewSocialAccountAction(userId: string, platform: string, approve: boolean, note: string): Promise<Result> {
  if (!(await isAdmin())) return denied
  await setSocialAccountStatus(userId, platform, approve ? 'verified' : 'rejected', note)
  refresh()
  return { ok: true, message: approve ? 'Hesap doğrulandı.' : 'Hesap reddedildi.' }
}

export async function createSocialEventAction(input: EventInput): Promise<Result> {
  if (!(await isAdmin())) return denied
  try {
    await createSocialEvent(input)
    refresh()
    return { ok: true, message: 'Etkinlik yayında.' }
  } catch (error) {
    return fail(error)
  }
}

export async function toggleSocialEventAction(id: number, active: boolean): Promise<Result> {
  if (!(await isAdmin())) return denied
  await setSocialEventActive(id, active)
  refresh()
  return { ok: true, message: active ? 'Etkinlik açıldı.' : 'Etkinlik kapatıldı.' }
}

export async function deleteSocialEventAction(id: number): Promise<Result> {
  if (!(await isAdmin())) return denied
  await deleteSocialEvent(id)
  refresh()
  return { ok: true, message: 'Etkinlik silindi.' }
}

export async function reviewEntryAction(eventId: number, userId: string, approve: boolean, note: string): Promise<Result> {
  if (!(await isAdmin())) return denied
  try {
    const paid = await reviewEntry(eventId, userId, approve, note)
    refresh()
    return { ok: true, message: approve ? `Katılım onaylandı${paid ? `, ${paid} KP verildi` : ''}.` : 'Katılım reddedildi.' }
  } catch (error) {
    return fail(error)
  }
}
