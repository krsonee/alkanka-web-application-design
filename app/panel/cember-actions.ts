'use server'

import { canPanel } from '@/lib/admin-auth'
import { cancelInstantRound, saveCemberEvents, scheduleInstantRound, scheduleTestRound, upcomingSlots, type UpcomingSlot } from '@/lib/cember'
import type { CemberConfig } from '@/lib/cember-shared'

export type CemberActionResult = {
  ok: boolean
  message: string
  events?: CemberConfig[]
  upcoming?: UpcomingSlot[]
  clash?: { title: string; at: string; suggestAt: string }
}

const trTime = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })

export async function startInstantEvent(eventId: string, delaySeconds: number, placeAfterClash: boolean): Promise<CemberActionResult> {
  if (!(await canPanel('cember'))) return { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const r = await scheduleInstantRound(eventId, Math.min(600, Math.max(20, Math.round(delaySeconds))), placeAfterClash)
    if (r.kind === 'clash') {
      return {
        ok: false,
        message: `"${r.clashTitle}" turu ${trTime(r.clashAt)}'de başlıyor, anlık tur onunla çakışır.`,
        clash: { title: r.clashTitle, at: r.clashAt, suggestAt: r.suggestAt },
      }
    }
    return { ok: true, message: `Anlık etkinlik ${trTime(r.at)} için kuruldu. O saatte sitedeki herkese açılır.`, events: r.events, upcoming: upcomingSlots(r.events) }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Anlık etkinlik kurulamadı.' }
  }
}

export async function cancelInstantEvent(eventId: string, slotIso: string): Promise<CemberActionResult> {
  if (!(await canPanel('cember'))) return { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const events = await cancelInstantRound(eventId, slotIso)
    return { ok: true, message: `${trTime(slotIso)} anlık turu iptal edildi, ödül dağıtılmayacak.`, events, upcoming: upcomingSlots(events) }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'İptal edilemedi.' }
  }
}

export async function saveCember(input: CemberConfig[]): Promise<CemberActionResult> {
  if (!(await canPanel('cember'))) return { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const events = await saveCemberEvents(input)
    return { ok: true, message: `${events.length} etkinlik kaydedildi. Sitede 5 saniye içinde güncellenir.`, events, upcoming: upcomingSlots(events) }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Kaydedilemedi, tekrar dene.' }
  }
}

export async function startTestRound(eventId: string, delaySeconds: number): Promise<CemberActionResult> {
  if (!(await canPanel('cember'))) return { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const at = await scheduleTestRound(eventId, Math.min(600, Math.max(20, Math.round(delaySeconds))))
    const time = new Date(at).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })
    return { ok: true, message: `Ek tur ${time} için kuruldu. O saatte sitedeki herkese açılır.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Tur kurulamadı.' }
  }
}
