'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { logPanel } from '@/lib/panel-log'
import {
  addGoalMatch,
  deleteGoalEvent,
  deleteGoalMatch,
  goalBoard,
  goalFlagList,
  goalPicks,
  goalSummaryText,
  importGoalFixtures,
  retryGoalPayment,
  saveGoalEvent,
  setGoalApproval,
  setGoalDelivered,
  setGoalFlag,
  settleGoalMatch,
  voidGoalMatch,
  type GoalFixture,
} from '@/lib/goal-rewards'
import type { LeaguePin } from '@/lib/prediction-book-shared'
import {
  GOAL_NAME,
  goalAmount,
  isGoalApproval,
  isGoalFlagAction,
  type GoalApproval,
  type GoalEvent,
  type GoalEventView,
  type GoalFlagAction,
  type GoalFlagRow,
  type GoalMatch,
  type GoalPickRow,
} from '@/lib/goal-rewards-shared'

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
    const [{ listSites }, { getLeagueBook }] = await Promise.all([import('@/lib/sites'), import('@/lib/prediction-book')])
    const [events, sites, pins] = await Promise.all([
      goalBoard(null, { admin: true }),
      listSites().then(
        (all) => all.filter((s) => s.active),
        () => [],
      ),
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
    const fees = await voidGoalMatch(Number(id))
    const refund = fees.feePicks === 0 ? '' : fees.refunded === fees.feePicks ? ` ${fees.feePicks} üyenin katılım ücreti (toplam ${goalAmount(fees.feeTotal, 'KC')}) geri yatırıldı.` : ` ${fees.feePicks} üyenin katılım ücretinden ${fees.refunded} tanesi geri yatırıldı; kalanı site ziyaret edildikçe kendiliğinden yeniden denenir.`
    await logPanel('community', 'Gol başı ödül maçı iptal edildi', `Maç #${id}`, `Ödül verilmez${refund ? ` ·${refund}` : ''}`)
    return `Maç iptal edildi. Bu maçtan ödül verilmez; katılan üyeler kartta iptal yazısını görür.${refund}`
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

const APPROVAL_LOG: Record<GoalApproval, string> = { approved: 'Kupon geçerli sayıldı', rejected: 'Talep geçersiz sayıldı', pending: 'Talep yeniden kontrole alındı' }

/** `reason` is why a request is invalid; the member sees it and it counts towards their tag. */
export async function approveGoalPicks(matchId: number, userIds: string[], approval: GoalApproval, reason?: string) {
  return guard(async () => {
    if (!isGoalApproval(approval)) throw new Error('Geçersiz onay durumu.')
    if (approval === 'rejected' && !String(reason ?? '').trim()) throw new Error('Talebin neden geçersiz olduğunu seç ya da yaz; üye bu nedeni görür.')
    const n = await setGoalApproval(Number(matchId), userIds, approval, reason)
    if (n) await logPanel('community', APPROVAL_LOG[approval], `Maç #${matchId}`, `${n} üye${approval === 'rejected' ? ` · ${String(reason).trim().slice(0, 160)}` : ''}`)
    if (!n) return 'Değişen kayıt yok. Teslim edilmiş bir ödülün talebi değiştirilemez; önce teslimi geri al.'
    return approval === 'rejected' ? `${n} talep geçersiz sayıldı. Tekrarlayan üyeleri "Geçersiz talepler" listesinden uyarabilir ya da katılımını kapatabilirsin.` : `${n} üyede işlendi.`
  })
}

export async function loadGoalFlags(): Promise<{ ok: true; data: GoalFlagRow[] } | { ok: false; error: string }> {
  if (!(await allowed())) return { ok: false, error: EXPIRED }
  try {
    return { ok: true, data: await goalFlagList() }
  } catch (error) {
    console.error('[goal] etiket listesi okunamadı', (error as Error).message)
    return { ok: false, error: 'Geçersiz talep listesi okunamadı.' }
  }
}

const FLAG_LOG: Record<GoalFlagAction, string> = { warn: 'Gol Yağmuru: üye uyarıldı', block: 'Gol Yağmuru: sponsor etkinliklerine katılım kapatıldı', open: 'Gol Yağmuru: sponsor etkinliklerine katılım açıldı' }

/**
 * Warns a member, closes their participation in sponsor events, or opens it again. The member is told
 * in their message box; if that message cannot be written the tag still stands and staff is told so.
 */
export async function flagGoalMember(userId: string, action: GoalFlagAction, note: string) {
  return guard(async () => {
    if (!isGoalFlagAction(action)) throw new Error('Geçersiz işlem.')
    const text = String(note ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
    if (action !== 'open' && text.length < 5) throw new Error('Üyeye gidecek açıklamayı yaz: neden uyarıldığını ya da katılımının neden kapatıldığını bilmeli.')
    const { getPanelSession } = await import('@/lib/panel-auth')
    const session = await getPanelSession()
    const by = session ? session.displayName : 'panel'
    const saved = await setGoalFlag(String(userId), action, text, by)
    await logPanel('community', FLAG_LOG[action], saved.userName.slice(0, 60), text || null)
    const title = action === 'warn' ? `${GOAL_NAME}: geçersiz talep uyarısı` : action === 'block' ? `${GOAL_NAME}: sponsor etkinliklerine katılımın kapatıldı` : `${GOAL_NAME}: sponsor etkinliklerine katılımın yeniden açıldı`
    const body =
      action === 'warn'
        ? `Sponsor etkinliklerine gönderdiğin taleplerde şartlara uymayanlar var: ${text} Geçersiz talep göndermeye devam edersen sponsor etkinliklerine katılımın kapatılır.`
        : action === 'block'
          ? `Tekrarlayan geçersiz talepler nedeniyle sponsor etkinliklerine artık katılamazsın: ${text} Bir hata olduğunu düşünüyorsan destekle iletişime geç.`
          : `Sponsor etkinliklerine yeniden katılabilirsin.${text ? ` ${text}` : ''} Talep göndermeden önce etkinliğin kurallarını oku.`
    const told = await import('@/lib/inbox').then(
      ({ sendMessage }) => sendMessage({ userId: String(userId), targetLabel: saved.userName, title, body, url: '/tahminler?bolum=gol-yagmuru&etkinlik=sponsor', sentBy: by }).then(() => true),
      () => false,
    ).catch(() => false)
    const done = action === 'warn' ? `${saved.userName} uyarıldı (toplam ${saved.warns} uyarı).` : action === 'block' ? `${saved.userName} artık sponsor etkinliklerine katılamaz.` : `${saved.userName} yeniden katılabilir.`
    return told ? `${done} Üyeye mesaj gönderildi.` : `${done} Üyeye mesaj GÖNDERİLEMEDİ; istersen Mesajlar bölümünden elle yaz.`
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
