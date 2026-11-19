'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { linkReport, rangeForDays, saveShortDomain } from '@/lib/links'
import type { LinkReport } from '@/lib/links-shared'
import { logPanel } from '@/lib/panel-log'

const DENIED = 'Oturum süresi doldu, tekrar giriş yap.'
const reason = (error: unknown) => (error instanceof Error ? error.message : 'İşlem tamamlanamadı.')

export type LinkQuery = { days?: number; from?: string; to?: string; siteId?: number | null }

export async function loadLinksAction(query: LinkQuery): Promise<{ ok: true; report: LinkReport } | { ok: false; message: string }> {
  if (!(await canPanel('growth'))) return { ok: false, message: DENIED }
  try {
    const range = query.days ? rangeForDays(query.days) : { from: query.from, to: query.to }
    const report = await linkReport({ ...range, siteId: query.siteId ?? null, campaigns: await canPanel('marketing') })
    return { ok: true, report }
  } catch (error) {
    return { ok: false, message: reason(error) }
  }
}

export async function saveShortDomainAction(value: string): Promise<{ ok: boolean; message: string; host?: string }> {
  if (!(await canPanel('growth'))) return { ok: false, message: DENIED }
  try {
    const host = await saveShortDomain(String(value ?? ''))
    revalidatePath('/panel')
    await logPanel('growth', host ? 'Kısa link alan adı kaydedildi' : 'Kısa link alan adı kaldırıldı', host || 'alan adı yok')
    return {
      ok: true,
      host,
      message: host
        ? `Kaydedildi. Alan adı bu projeye bağlandığında kısa linkler ${host} üzerinden açılır.`
        : 'Kısa link alan adı kaldırıldı. Linkler ana alan adından açılır.',
    }
  } catch (error) {
    return { ok: false, message: reason(error) }
  }
}
