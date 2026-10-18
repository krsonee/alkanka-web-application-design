'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { setContent } from '@/lib/content'
import { LEGAL_DEFAULTS, LEGAL_KEY, LEGAL_MAX, type LegalOverrides } from '@/lib/legal-shared'

export type LegalActionState = { ok?: boolean; message?: string }

export async function saveLegal(_: LegalActionState, form: FormData): Promise<LegalActionState> {
  if (!(await canPanel('texts'))) return { message: 'Oturum süresi doldu, tekrar giriş yap.' }
  const value: LegalOverrides = {}
  for (const d of LEGAL_DEFAULTS) {
    const title = String(form.get(`${d.slug}.title`) ?? '').trim().slice(0, 80)
    const body = String(form.get(`${d.slug}.body`) ?? '').trim().slice(0, LEGAL_MAX)
    const entry: { title?: string; body?: string } = {}
    if (title && title !== d.title) entry.title = title
    if (body && body !== d.body.trim()) entry.body = body
    if (entry.title || entry.body) value[d.slug] = entry
  }
  try {
    await setContent(LEGAL_KEY, value)
    revalidatePath('/yasal', 'layout')
    return { ok: true, message: `Kaydedildi (${Object.keys(value).length} sayfa özelleştirildi).` }
  } catch {
    return { message: 'Kaydedilemedi, tekrar dene.' }
  }
}
