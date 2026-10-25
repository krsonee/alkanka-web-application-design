'use server'

import { cookies, headers } from 'next/headers'
import { hashNetwork, recordOrigin } from '@/lib/growth'
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
  const originDone = store.get('alk_org')?.value
  if (!code && originDone) return { ok: true }
  const member = await getMember()
  if (!member) return { ok: true }
  if (originDone !== member.id) {
    const h = await headers()
    const ip = h.get('x-forwarded-for') ?? h.get('x-real-ip')
    const isNew = await recordOrigin(member.id, store.get('alk_src')?.value ?? 'direkt', hashNetwork(ip)).catch((error) => {
      console.error('[growth] kaynak kaydedilemedi', error)
      return false
    })
    if (isNew) store.set('alk_new', '1', { maxAge: 60 * 10, path: '/', sameSite: 'lax', secure: true })
    store.set('alk_org', member.id, { maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax', secure: true, httpOnly: true })
  }
  if (!code) return { ok: true }
  store.delete('alk_ref')
  const linked = await attachReferral(member.id, code).catch(() => false)
  if (!linked) return { ok: true }
  const { getReferralSettings } = await import('@/lib/referral-settings')
  const s = await getReferralSettings()
  const welcome = s.welcome > 0 ? `Hoş geldin bonusu ${s.welcome} KC hesabında. ` : ''
  return { ok: true, message: `${welcome}${s.minGames} oyun oyna, ikiniz de ekstra KC kazanın.` }
}

export async function claimReferralAction(): Promise<ActionResult> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  const { hitRateLimit, RATE_LIMIT_MESSAGE } = await import('@/lib/rate-limit')
  if (await hitRateLimit(`refclaim:${member.id}`, 5, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  const r = await claimReferralRewards(member.id)
  revalidatePath('/profil')
  if (r.blocked) return { ok: false, error: 'Hesabın incelemede. Davet ödülleri onaydan sonra açılır.' }
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

export async function toggleHelpfulAction(reviewId: number): Promise<{ ok: true; voted: boolean; count: number } | { ok: false; error: string }> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Oy vermek için giriş yapmalısın.' }
  const { hitRateLimit, RATE_LIMIT_MESSAGE } = await import('@/lib/rate-limit')
  if (await hitRateLimit(`helpful:${member.id}`, 30, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  try {
    const { toggleHelpful } = await import('@/lib/trust-extra')
    const r = await toggleHelpful(member.id, Number(reviewId))
    return { ok: true, ...r }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Oy kaydedilemedi.' }
  }
}

export async function sponsorVoteAction(siteId: string) {
  return run(async (m) => {
    const { castSponsorVote } = await import('@/lib/trust-extra')
    await castSponsorVote(m.id, String(siteId))
    return 'Oyun kaydedildi. Ay bitene kadar fikrini değiştirebilirsin.'
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
