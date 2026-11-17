'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { reorderSites, saveSite } from '@/lib/sites'
import type { SiteInput } from '@/lib/sites-shared'
import { getSponsorSummary } from '@/lib/sponsor-summary'
import { SUMMARY_SECTIONS, type SponsorSummary, type SummarySection } from '@/lib/sponsor-summary-shared'

type Result = { ok: true; message?: string } | { ok: false; error: string }

export async function reorderSitesAction(ids: number[]): Promise<Result> {
  if (!(await canPanel('sponsors'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await reorderSites(ids)
    revalidatePath('/panel')
    revalidatePath('/')
    revalidatePath('/sponsorlar')
    await logPanel('sponsors', 'Sponsor sırası değişti', null, `${ids.length} sponsor sürüklenerek sıralandı`)
    return { ok: true, message: 'Sıra kaydedildi.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Sıra kaydedilemedi.' }
  }
}

/** Hakediş figures are money, so they need the Kampanya permission on top of Sponsorlar. */
export async function sponsorSummaryAction(id: number): Promise<{ ok: true; summary: SponsorSummary; sections: SummarySection[] } | { ok: false; error: string }> {
  if (!(await canPanel('sponsors'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const allowed = await Promise.all(SUMMARY_SECTIONS.map((s) => canPanel(s)))
    const sections = SUMMARY_SECTIONS.filter((_, i) => allowed[i])
    const summary = await getSponsorSummary(Number(id), { earnings: sections.includes('marketing') })
    return summary ? { ok: true, summary, sections } : { ok: false, error: 'Sponsor bulunamadı. Sayfayı yenile.' }
  } catch (error) {
    console.error('[sponsor-summary] okunamadı', error)
    return { ok: false, error: 'Özet okunamadı. Biraz sonra tekrar dene.' }
  }
}

export async function saveSiteAction(input: SiteInput): Promise<Result> {
  if (!(await canPanel('sponsors'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    await saveSite(input)
    revalidatePath('/panel')
    revalidatePath('/')
    revalidatePath('/sponsorlar')
    await logPanel('sponsors', input.id ? 'Sponsor güncellendi' : 'Sponsor eklendi', input.name)
    return { ok: true, message: input.id ? 'Sponsor güncellendi.' : 'Sponsor kaydedildi.' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}
