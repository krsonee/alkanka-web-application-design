'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { getBranding, updateBranding } from '@/lib/branding'

type Result = { ok: true; message?: string } | { ok: false; error: string }

const LOGO_URL_RE = /^\/api\/logo\/[a-z0-9._-]+$/i

export async function saveHeaderLogo(logoUrl: string, logoHeight: number): Promise<Result> {
  if (!(await canPanel('branding'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  const url = String(logoUrl ?? '').trim()
  if (url && !LOGO_URL_RE.test(url)) return { ok: false, error: 'Logo önce yüklenmeli.' }
  const height = Math.min(64, Math.max(20, Math.round(Number(logoHeight) || 36)))
  const hadLogo = Boolean((await getBranding()).logoUrl)
  await updateBranding({ logoUrl: url || undefined, logoHeight: height })
  revalidatePath('/', 'layout')
  const done = url ? 'Header logosu kaydedildi' : hadLogo ? 'Varsayılan logoya dönüldü' : 'Logo yüksekliği kaydedildi'
  await logPanel('branding', done)
  return { ok: true, message: `${done}.` }
}

export async function resetAppIcon(): Promise<Result> {
  if (!(await canPanel('branding'))) return { ok: false, error: 'Bu bölüm için yetkin yok.' }
  await updateBranding({ icons: undefined })
  revalidatePath('/', 'layout')
  await logPanel('branding', 'Varsayılan uygulama ikonuna dönüldü')
  return { ok: true, message: 'Varsayılan uygulama ikonuna dönüldü.' }
}
