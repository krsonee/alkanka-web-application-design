'use server'

import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { importWagers, notifyAddressChange, setFlag, setSiteLink, setSponsorAccountStatus } from '@/lib/growth'
import { SPONSORS } from '@/components/alkanka/data'

type Result = { ok: boolean; message: string }
const denied: Result = { ok: false, message: 'Oturum süresi doldu, tekrar giriş yap.' }
const fail = (error: unknown): Result => ({ ok: false, message: error instanceof Error ? error.message : 'İşlem tamamlanamadı.' })

function siteBase() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://alkanka.com').replace(/\/$/, '')
}

export async function saveSiteLinkAction(siteId: string, url: string, notify: boolean): Promise<Result> {
  if (!(await canPanel('growth'))) return denied
  try {
    const { changed } = await setSiteLink(siteId, url)
    revalidatePath('/siteler')
    revalidatePath(`/siteler/${siteId}`)
    revalidatePath('/panel')
    if (!changed || !notify) return { ok: true, message: changed ? 'Adres güncellendi (bildirim gönderilmedi).' : 'Adres kaydedildi.' }
    const name = SPONSORS.find((s) => s.id === siteId)?.name ?? siteId
    const r = await notifyAddressChange(siteId, name, `${siteBase()}/git/${siteId}?src=alarm`)
    return { ok: true, message: `Adres güncellendi. ${r.push} cihaza bildirim, ${r.telegram} Telegram mesajı gitti.` }
  } catch (error) {
    return fail(error)
  }
}

export async function setFlagAction(userId: string, flagged: boolean): Promise<Result> {
  if (!(await canPanel('growth'))) return denied
  await setFlag(userId, flagged)
  revalidatePath('/panel')
  return { ok: true, message: flagged ? 'Üye işaretlendi.' : 'İşaret kaldırıldı, ödüller açıldı.' }
}

export async function reviewSponsorAccountAction(userId: string, siteId: string, approve: boolean, note: string): Promise<Result> {
  if (!(await canPanel('growth'))) return denied
  await setSponsorAccountStatus(userId, siteId, approve ? 'approved' : 'rejected', note)
  revalidatePath('/panel')
  revalidatePath('/siralama')
  return { ok: true, message: approve ? 'Hesap onaylandı.' : 'Hesap reddedildi.' }
}

export async function importWagersAction(siteId: string, period: string, text: string): Promise<Result> {
  if (!(await canPanel('growth'))) return denied
  try {
    const r = await importWagers(siteId, period, text)
    revalidatePath('/siralama')
    revalidatePath('/panel')
    return { ok: true, message: `${r.rows} satır yüklendi, ${r.matched} tanesi onaylı üyeyle eşleşti.` }
  } catch (error) {
    return fail(error)
  }
}
