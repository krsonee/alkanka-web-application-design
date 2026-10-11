'use server'

import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'
import {
  addLeagueMatch,
  autoSettleLeague,
  deleteComplaint,
  deleteLeagueMatch,
  deleteReview,
  importLeagueFixtures,
  publishedFixtureIds,
  setReviewStatus,
  settleLeagueMatch,
  updateComplaint,
  type Complaint,
  type FixtureInput,
} from '@/lib/community'
import { getFinalScore, getFixtures, type Fixture } from '@/lib/kankatv'

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

export async function removeReview(id: number) {
  return guard(async () => {
    await deleteReview(id)
    return 'Yorum silindi.'
  })
}

export async function removeComplaint(id: number) {
  return guard(async () => {
    await deleteComplaint(id)
    return 'Şikâyet kaldırıldı.'
  })
}

export async function answerComplaint(id: number, status: Complaint['status'], reply: string) {
  return guard(() => updateComplaint(id, status, reply))
}

export async function createLeagueMatch(input: { league: string; home: string; away: string; kickoff: string }) {
  return guard(() => addLeagueMatch(input))
}

export async function loadFixtures(day: string): Promise<{ ok: true; fixtures: Fixture[]; published: number[] } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: 'Geçerli bir tarih seç.' }
  const [fixtures, published] = await Promise.all([getFixtures(day), publishedFixtureIds()])
  return { ok: true, fixtures, published }
}

export async function publishFixtures(list: FixtureInput[]) {
  return guard(async () => {
    const added = await importLeagueFixtures(list)
    return added ? `${added} maç sitede yayınlandı.` : 'Seçilen maçlar zaten yayında veya başlamış.'
  })
}

export async function autoSettleMatches() {
  return guard(async () => {
    const r = await autoSettleLeague(getFinalScore)
    return r.checked ? `${r.checked} maç kontrol edildi, ${r.settled} tanesi sonuçlandırıldı.` : 'Sonucu bekleyen fikstür maçı yok.'
  })
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
