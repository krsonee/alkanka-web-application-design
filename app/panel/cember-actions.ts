'use server'

import { canPanel } from '@/lib/admin-auth'
import { saveCemberConfig, scheduleTestRound } from '@/lib/cember'
import type { CemberConfig } from '@/lib/cember-shared'

export type CemberActionResult = { ok: boolean; message: string }

export async function saveCember(input: CemberConfig): Promise<CemberActionResult> {
  if (!(await canPanel('cember'))) return { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await saveCemberConfig(input)
    return { ok: true, message: 'Jako Çemberi ayarları kaydedildi.' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Kaydedilemedi, tekrar dene.' }
  }
}

export async function startTestRound(delaySeconds: number): Promise<CemberActionResult> {
  if (!(await canPanel('cember'))) return { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const at = await scheduleTestRound(Math.min(600, Math.max(20, Math.round(delaySeconds))))
    const time = new Date(at).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })
    return { ok: true, message: `Ek tur ${time} için kuruldu. O saatte sitedeki herkese açılır.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Tur kurulamadı.' }
  }
}
