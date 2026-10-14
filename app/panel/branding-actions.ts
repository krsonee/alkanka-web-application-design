'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { updateBranding } from '@/lib/branding'

type Result = { ok: true; message?: string } | { ok: false; error: string }

const LOGO_URL_RE = /^\/api\/logo\/[a-z0-9._-]+$/i

export async function saveHeaderLogo(logoUrl: string, logoHeight: number): Promise<Result> {
  if (!(await canPanel('branding'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  const url = String(logoUrl ?? '').trim()
  if (url && !LOGO_URL_RE.test(url)) return { ok: false, error: 'Logo önce yüklenmeli.' }
  const height = Math.min(64, Math.max(20, Math.round(Number(logoHeight) || 36)))
  await updateBranding({ logoUrl: url || undefined, logoHeight: height })
  revalidatePath('/', 'layout')
  return { ok: true, message: url ? 'Header logosu kaydedildi.' : 'Varsayılan logoya dönüldü.' }
}

export async function resetAppIcon(): Promise<Result> {
  if (!(await canPanel('branding'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  await updateBranding({ icons: undefined })
  revalidatePath('/', 'layout')
  return { ok: true, message: 'Varsayılan uygulama ikonuna dönüldü.' }
}
