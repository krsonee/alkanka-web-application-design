'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getBalance, getMember } from '@/lib/member'
import {
  addAlert,
  addComplaint,
  addReview,
  attachReferral,
  claimReferralRewards,
  removeAlert,
  savePick,
} from '@/lib/community'

export type ActionResult = { ok: true; message?: string; balance?: number } | { ok: false; error: string }

async function run(fn: (m: { id: string; name: string }) => Promise<string | void>, path?: string): Promise<ActionResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Bu işlem için giriş yapmalısın.' }
  try {
    const message = await fn(member)
    if (path) revalidatePath(path)
    return { ok: true, message: message || undefined }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' }
  }
}

export async function linkReferralAction(): Promise<ActionResult> {
  const store = await cookies()
  const code = store.get('alk_ref')?.value
  if (!code) return { ok: true }
  const member = await getMember()
  if (!member) return { ok: true }
  store.delete('alk_ref')
  const linked = await attachReferral(member.id, code).catch(() => false)
  return { ok: true, message: linked ? 'Davet bağlandı. 3 oyun oyna, ikiniz de KC kazanın.' : undefined }
}

export async function claimReferralAction(): Promise<ActionResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  const r = await claimReferralRewards(member.id)
  revalidatePath('/profil')
  if (!r.count) return { ok: false, error: 'Henüz ödül hak eden davet yok.' }
  return { ok: true, message: `${r.count} davet için ${r.total} KC hesabına eklendi.`, balance: await getBalance(member.id) }
}

export async function addReviewAction(siteId: string, rating: number, body: string) {
  return run(async (m) => {
    await addReview(m, siteId, rating, body)
    return 'Yorumun alındı, moderasyon sonrası yayınlanacak.'
  }, '/guven')
}

export async function addComplaintAction(siteId: string, title: string, body: string) {
  return run(async (m) => {
    await addComplaint(m, siteId, title, body)
    return 'Şikâyetin kaydedildi. Durumunu profilinden takip edebilirsin.'
  }, '/guven')
}

export async function addAlertAction(keyword: string) {
  return run((m) => addAlert(m.id, keyword), '/profil')
}

export async function removeAlertAction(keyword: string) {
  return run((m) => removeAlert(m.id, keyword), '/profil')
}

export async function savePickAction(matchId: number, home: number, away: number) {
  return run(async (m) => {
    await savePick(m, matchId, home, away)
    return 'Tahminin kaydedildi.'
  }, '/tahminler')
}
