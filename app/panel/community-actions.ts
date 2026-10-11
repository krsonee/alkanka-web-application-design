'use server'

import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'
import {
  addLeagueMatch,
  deleteLeagueMatch,
  setReviewStatus,
  settleLeagueMatch,
  updateComplaint,
  type Complaint,
} from '@/lib/community'

type Result = { ok: true; message?: string } | { ok: false; error: string }

async function guard(fn: () => Promise<string | void>): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const message = await fn()
    revalidatePath('/panel')
    revalidatePath('/guven')
    revalidatePath('/tahminler')
    return { ok: true, message: message || undefined }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}

export async function moderateReview(id: number, status: 'approved' | 'rejected') {
  return guard(() => setReviewStatus(id, status))
}

export async function answerComplaint(id: number, status: Complaint['status'], reply: string) {
  return guard(() => updateComplaint(id, status, reply))
}

export async function createLeagueMatch(input: { league: string; home: string; away: string; kickoff: string }) {
  return guard(() => addLeagueMatch(input))
}

export async function removeLeagueMatch(id: number) {
  return guard(() => deleteLeagueMatch(id))
}

export async function finishLeagueMatch(id: number, home: number, away: number) {
  return guard(async () => {
    const r = await settleLeagueMatch(id, home, away)
    return `${r.picks} tahmin puanlandı, ${r.winners} kişi KC kazandı.`
  })
}
