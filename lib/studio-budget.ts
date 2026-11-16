import 'server-only'
import { deleteContent, setContent } from '@/lib/content'
import { rows, sql } from '@/lib/db'
import { studioSpend } from '@/lib/studio'
import { usd } from '@/lib/studio-types'

export const STUDIO_BUDGET_KEY = 'studio:budget'

/** Read straight from the table: a failed read has to stop a paid job, not look like "no cap". */
export async function getStudioCap(): Promise<number | null> {
  const r = await rows<{ value: { monthlyCap?: unknown } | null }>(sql`SELECT value FROM site_content WHERE key = ${STUDIO_BUDGET_KEY}`)
  const cap = Number(r[0]?.value?.monthlyCap)
  return Number.isFinite(cap) && cap > 0 ? cap : null
}

export async function saveStudioCap(cap: number | null) {
  if (cap == null) await deleteContent(STUDIO_BUDGET_KEY)
  else await setContent(STUDIO_BUDGET_KEY, { monthlyCap: cap })
}

/** The reason a paid job may not start, or null when it fits under this month's cap. */
export async function budgetBlock(cost: number): Promise<string | null> {
  if (cost <= 0) return null
  try {
    const [cap, spend] = await Promise.all([getStudioCap(), studioSpend()])
    if (cap == null || spend.month + cost <= cap + 1e-9) return null
    return `Bu üretim (~${usd(cost)}) Stüdyo'nun aylık tavanını aşıyor: bu ay ${usd(spend.month)} harcandı, tavan ${usd(cap)}. Tavanı ana yönetici Stüdyo ekranından değiştirebilir.`
  } catch (error) {
    console.error('[studio:budget]', error)
    return 'Aylık harcama tavanı okunamadı, üretim başlatılmadı. Biraz sonra tekrar dene.'
  }
}
