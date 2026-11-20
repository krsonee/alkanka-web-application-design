'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { logPanel } from '@/lib/panel-log'
import {
  addGoalMatch,
  deleteGoalEvent,
  deleteGoalMatch,
  goalBoard,
  goalPicks,
  goalSummaryText,
  importGoalFixtures,
  retryGoalPayment,
  saveGoalEvent,
  setGoalApproval,
  setGoalDelivered,
  settleGoalMatch,
  voidGoalMatch,
  type GoalFixture,
} from '@/lib/goal-rewards'
import type { LeaguePin } from '@/lib/prediction-book-shared'
import { goalAmount, isGoalApproval, type GoalApproval, type GoalEvent, type GoalEventView, type GoalMatch, type GoalPickRow } from '@/lib/goal-rewards-shared'

type Result = { ok: true; message?: string } | { ok: false; error: string }

const EXPIRED = 'Oturum süresi doldu, tekrar giriş yap.'

/** Managed where the prediction league is managed, under the same permission. */
const allowed = () => canPanel('community')

async function guard(fn: () => Promise<string | void>): Promise<Result> {
  if (!(await allowed())) return { ok: false, error: EXPIRED }
  try {
    const message = await fn()
    revalidatePath('/panel')
    revalidatePath('/tahminler')
    return { ok: true, message: message || undefined }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}

/** `pins` are the football leagues pinned on the prediction league screen; the calendar picker offers them first. */
export type GoalAdminData = { events: GoalEventView[]; sites: { id: string; name: string }[]; pins: LeaguePin[] }

export async function loadGoalAdmin(): Promise<{ ok: true; data: GoalAdminData } | { ok: false; error: string }> {
  if (!(await allowed())) return { ok: false, error: EXPIRED }
  try {
    const [{ siteOptions }, { getLeagueBook }] = await Promise.all([import('@/lib/sites'), import('@/lib/prediction-book')])
    const [events, sites, pins] = await Promise.all([
      goalBoard(null, { admin: true }),
      siteOptions().catch(() => []),
      getLeagueBook().then(
        (book) => book.pins.filter((p) => p.sport === 'football'),
        () => [],
      ),
    ])
    return { ok: true, data: { events, sites: sites.map((s) => ({ id: String(s.id), name: s.name })), pins } }
  } catch (error) {
    console.error('[goal] panel listesi okunamadı', (error as Error).message)
    return { ok: false, error: 'Gol başı ödül etkinlikleri okunamadı.' }
  }
}

export async function saveGoalEventAction(input: unknown) {
  return guard(async () => {
    const isNew = !(input as { id?: unknown })?.id
    const e = await saveGoalEvent(input)
    await logPanel('community', isNew ? 'Gol başı ödül etkinliği açıldı' : 'Gol başı ödül etkinliği güncellendi', e.title, `${e.category === 'sponsor' ? `Sponsor: ${e.siteName}` : 'Alkanka'} · gol başı ${goalAmount(e.perGoal, e.unit)}${e.active ? '' : ' · kapalı'}`)
    return isNew ? 'Etkinlik açıldı. Şimdi maç ekle; maçı olmayan etkinlik sitede görünmez.' : 'Etkinlik kaydedildi.'
  })
}

export async function removeGoalEvent(id: number, title: string) {
  return guard(async () => {
    await deleteGoalEvent(Number(id))
    await logPanel('community', 'Gol başı ödül etkinliği silindi', String(title).slice(0, 80))
    return 'Etkinlik silindi.'
  })
}

export async function createGoalMatch(eventId: number, input: { league: string; home: string; away: string; kickoff: string }) {
  return guard(async () => {
    await addGoalMatch(Number(eventId), input)
    await logPanel('community', 'Gol başı ödül maçı eklendi', `${input.home} - ${input.away}`, `Etkinlik #${eventId}`)
    return 'Maç eklendi.'
  })
}

export async function importGoalMatches(eventId: number, list: GoalFixture[]) {
  return guard(async () => {
    const picked = Array.isArray(list) ? list : []
    const added = await importGoalFixtures(Number(eventId), picked)
    if (!added) return 'Seçilen maçlar bu etkinlikte zaten var ya da başlamış.'
    await logPanel('community', 'Gol başı ödül maçları takvimden eklendi', `Etkinlik #${eventId}`, `${added} maç`)
    return added === picked.length ? `${added} maç eklendi.` : `${added} maç eklendi; ${picked.length - added} maç zaten vardı ya da başlamıştı.`
  })
}

export async function removeGoalMatch(id: number) {
  return guard(async () => {
    await deleteGoalMatch(Number(id))
    await logPanel('community', 'Gol başı ödül maçı silindi', `Maç #${id}`)
    return 'Maç silindi.'
  })
}

export async function cancelGoalMatch(id: number) {
  return guard(async () => {
    await voidGoalMatch(Number(id))
    await logPanel('community', 'Gol başı ödül maçı iptal edildi', `Maç #${id}`, 'Ödül verilmez')
    return 'Maç iptal edildi. Bu maçtan ödül verilmez; seçim yapan üyeler kartta iptal yazısını görür.'
  })
}

export async function finishGoalMatch(id: number, home: number | string, away: number | string) {
  return guard(async () => {
    const summary = await settleGoalMatch(Number(id), home, away)
    const text = goalSummaryText(summary)
    await logPanel('community', 'Gol başı ödül maçı sonuçlandı', `Maç #${id}`, `${home}-${away} · ${text}`)
    return text
  })
}

export type GoalPickList = { event: GoalEvent; match: GoalMatch; picks: GoalPickRow[] }

export async function loadGoalPicks(matchId: number): Promise<{ ok: true; data: GoalPickList } | { ok: false; error: string }> {
  if (!(await allowed())) return { ok: false, error: EXPIRED }
  try {
    return { ok: true, data: await goalPicks(Number(matchId)) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Katılımcı listesi okunamadı.' }
  }
}

const APPROVAL_LOG: Record<GoalApproval, string> = { approved: 'Katılım şartı onaylandı', rejected: 'Katılım şartı reddedildi', pending: 'Katılım şartı beklemeye alındı' }

export async function approveGoalPicks(matchId: number, userIds: string[], approval: GoalApproval) {
  return guard(async () => {
    if (!isGoalApproval(approval)) throw new Error('Geçersiz onay durumu.')
    const n = await setGoalApproval(Number(matchId), userIds, approval)
    if (n) await logPanel('community', APPROVAL_LOG[approval], `Maç #${matchId}`, `${n} üye`)
    return n ? `${n} üyede işlendi.` : 'Değişen kayıt yok. Teslim edilmiş bir ödülün şartı değiştirilemez; önce teslimi geri al.'
  })
}

export async function deliverGoalPicks(matchId: number, userIds: string[], delivered: boolean) {
  return guard(async () => {
    const n = await setGoalDelivered(Number(matchId), userIds, Boolean(delivered))
    if (n) await logPanel('community', delivered ? 'Sponsor ödülü teslim edildi' : 'Sponsor ödülü teslimi geri alındı', `Maç #${matchId}`, `${n} üye`)
    if (n) return delivered ? `${n} üyenin ödülü teslim edildi olarak işaretlendi.` : `${n} üyenin teslimi geri alındı.`
    return delivered ? 'İşaretlenecek kayıt yok. Teslim için maç sonuçlanmış, şart onaylanmış ve ödül sıfırdan büyük olmalı.' : 'Geri alınacak teslim yok.'
  })
}

export async function retryGoalPay(matchId: number, userId: string, userName: string) {
  return guard(async () => {
    await retryGoalPayment(Number(matchId), String(userId))
    await logPanel('community', 'Gol başı ödül ödemesi yeniden denendi', String(userName).slice(0, 60), `Maç #${matchId}`)
    return 'Ödeme yeniden denendi. Listeyi kontrol et.'
  })
}
