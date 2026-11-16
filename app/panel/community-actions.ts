'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
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
  if (!(await canPanel('community'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
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
  return guard(async () => {
    const message = await setReviewStatus(id, status)
    await logPanel('community', status === 'approved' ? 'Yorum yayınlandı' : 'Yorum reddedildi', `Yorum #${id}`)
    return message
  })
}

export async function decideReviewProof(id: number, ok: boolean) {
  return guard(async () => {
    const { decideProof } = await import('@/lib/trust-extra')
    await decideProof(id, ok)
    await logPanel('community', ok ? 'Yorum kanıtı onaylandı' : 'Yorum kanıtı reddedildi', `Yorum #${id}`)
    return ok ? 'Yorum doğrulandı, rozet ve KP verildi.' : 'Kanıt reddedildi.'
  })
}

export async function postKarneNow() {
  return guard(async () => {
    const { weeklyKarne, karneText } = await import('@/lib/trust-extra')
    const { broadcastPodium } = await import('@/lib/telegram-bots')
    const list = await weeklyKarne()
    if (!list.length) return 'Son 7 günde karneye girecek veri yok.'
    const posted = await broadcastPodium((origin) => karneText(list, origin))
    if (posted) await logPanel('community', 'Haftalık karne gönderildi', null, `${posted} kanal`)
    return posted ? `Karne ${posted} kanala gönderildi.` : 'Bağlı aktif kanal bulunamadı.'
  })
}

export async function removeReview(id: number) {
  return guard(async () => {
    await deleteReview(id)
    await logPanel('community', 'Yorum silindi', `Yorum #${id}`)
    return 'Yorum silindi.'
  })
}

export async function removeComplaint(id: number) {
  return guard(async () => {
    await deleteComplaint(id)
    await logPanel('community', 'Şikâyet kaldırıldı', `Şikâyet #${id}`)
    return 'Şikâyet kaldırıldı.'
  })
}

export async function answerComplaint(id: number, status: Complaint['status'], reply: string) {
  return guard(async () => {
    const message = await updateComplaint(id, status, reply)
    await logPanel('community', 'Şikâyet yanıtlandı', `Şikâyet #${id}`, `${status}${reply ? ` · ${String(reply).slice(0, 200)}` : ''}`)
    return message
  })
}

export async function createLeagueMatch(input: { league: string; home: string; away: string; kickoff: string; closesAt?: string }) {
  return guard(async () => {
    const message = await addLeagueMatch(input)
    await logPanel('community', 'Tahmin maçı eklendi', `${input.home} - ${input.away}`, input.league)
    return message
  })
}

export async function loadFixtures(day: string): Promise<{ ok: true; fixtures: Fixture[]; published: number[] } | { ok: false; error: string }> {
  if (!(await canPanel('community'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: 'Geçerli bir tarih seç.' }
  const [fixtures, published] = await Promise.all([getFixtures(day), publishedFixtureIds()])
  return { ok: true, fixtures, published }
}

export async function publishFixtures(list: FixtureInput[]) {
  return guard(async () => {
    const added = await importLeagueFixtures(list)
    if (added) await logPanel('community', 'Fikstür maçları yayınlandı', null, `${added} maç`)
    return added ? `${added} maç sitede yayınlandı.` : 'Seçilen maçlar zaten yayında veya başlamış.'
  })
}

export async function autoSettleMatches() {
  return guard(async () => {
    const r = await autoSettleLeague(getFinalScore)
    if (r.settled) await logPanel('community', 'Maçlar otomatik sonuçlandırıldı', null, `${r.settled} maç`)
    return r.checked ? `${r.checked} maç kontrol edildi, ${r.settled} tanesi sonuçlandırıldı.` : 'Sonucu bekleyen fikstür maçı yok.'
  })
}

export async function removeLeagueMatch(id: number) {
  return guard(async () => {
    const message = await deleteLeagueMatch(id)
    await logPanel('community', 'Tahmin maçı silindi', `Maç #${id}`)
    return message
  })
}

export async function finishLeagueMatch(id: number, home: number, away: number) {
  return guard(async () => {
    const r = await settleLeagueMatch(id, home, away)
    await logPanel('community', 'Maç sonucu girildi ve puanlandı', `Maç #${id}`, `${home}-${away} · ${r.picks} tahmin · ${r.winners} kazanan`)
    return `${r.picks} tahmin puanlandı, ${r.winners} kişi KC kazandı.`
  })
}
