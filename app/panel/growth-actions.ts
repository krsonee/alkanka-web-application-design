'use server'

import { logPanel, memberTag } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { checkAffTarget, deleteAffLink, saveAffLink, setAffActive, type AffInput } from '@/lib/aff-links'
import { importWagers, notifyAddressChange, setFlag, setSiteLink, setSponsorAccountStatus } from '@/lib/growth'
import { siteNameLookup } from '@/lib/sites'

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
    if (changed) await logPanel('growth', 'Sponsor giriş adresi değişti', siteId, `${url}${notify ? ' · üyelere bildirildi' : ''}`)
    if (!changed || !notify) return { ok: true, message: changed ? 'Adres güncellendi (bildirim gönderilmedi).' : 'Adres kaydedildi.' }
    const name = (await siteNameLookup())(siteId)
    const r = await notifyAddressChange(siteId, name, `${siteBase()}/git/${siteId}?src=alarm`)
    return { ok: true, message: `Adres güncellendi. ${r.push} cihaza bildirim, ${r.telegram} Telegram mesajı gitti.` }
  } catch (error) {
    return fail(error)
  }
}

export async function saveAffLinkAction(input: AffInput): Promise<Result> {
  if (!(await canPanel('growth'))) return denied
  try {
    const r = await saveAffLink(input)
    revalidatePath('/panel')
    await logPanel('growth', input.id ? 'Affiliate link güncellendi' : 'Affiliate link eklendi', r.code)
    return { ok: true, message: `Kaydedildi. Kısa link: ${siteBase()}/r/${r.code}` }
  } catch (error) {
    return fail(error)
  }
}

export async function toggleAffLinkAction(id: number, active: boolean): Promise<Result> {
  if (!(await canPanel('growth'))) return denied
  await setAffActive(id, active)
  revalidatePath('/panel')
  await logPanel('growth', active ? 'Affiliate link açıldı' : 'Affiliate link durduruldu', `Link #${id}`)
  return { ok: true, message: active ? 'Link açıldı.' : 'Link durduruldu. Kısa link artık sponsorlar sayfasına düşer.' }
}

export async function deleteAffLinkAction(id: number): Promise<Result> {
  if (!(await canPanel('growth'))) return denied
  await deleteAffLink(id)
  revalidatePath('/panel')
  await logPanel('growth', 'Affiliate link silindi', `Link #${id}`)
  return { ok: true, message: 'Link ve tıklama geçmişi silindi.' }
}

export async function checkAffLinkAction(id: number): Promise<Result> {
  if (!(await canPanel('growth'))) return denied
  try {
    const r = await checkAffTarget(id)
    if (r.status === 0) return { ok: false, message: `Hedefe ulaşılamadı (engelli ya da kapalı olabilir): ${r.target}` }
    if (r.status >= 300 && r.status < 400) return { ok: true, message: `Çalışıyor (${r.status}). Sponsor şuraya yönlendiriyor: ${r.location ?? '-'}` }
    if (r.status < 400) return { ok: true, message: `Çalışıyor (${r.status}): ${r.target}` }
    return { ok: false, message: `Hedef hata döndü (${r.status}). Sponsordan yeni link iste: ${r.target}` }
  } catch (error) {
    return fail(error)
  }
}

export async function setFlagAction(userId: string, flagged: boolean): Promise<Result> {
  if (!(await canPanel('growth'))) return denied
  await setFlag(userId, flagged)
  revalidatePath('/panel')
  await logPanel('growth', flagged ? 'Üye şüpheli işaretlendi' : 'Şüpheli işareti kaldırıldı', await memberTag(userId))
  return { ok: true, message: flagged ? 'Üye işaretlendi.' : 'İşaret kaldırıldı, ödüller açıldı.' }
}

export async function reviewSponsorAccountAction(userId: string, siteId: string, approve: boolean, note: string): Promise<Result> {
  if (!(await canPanel('growth'))) return denied
  await setSponsorAccountStatus(userId, siteId, approve ? 'approved' : 'rejected', note)
  revalidatePath('/panel')
  revalidatePath('/siralama')
  await logPanel('growth', approve ? 'Sponsor hesabı onaylandı' : 'Sponsor hesabı reddedildi', await memberTag(userId), `sponsor ${siteId}${note ? ` · ${note}` : ''}`)
  return { ok: true, message: approve ? 'Hesap onaylandı.' : 'Hesap reddedildi.' }
}

export async function importWagersAction(siteId: string, period: string, text: string): Promise<Result> {
  if (!(await canPanel('growth'))) return denied
  try {
    const r = await importWagers(siteId, period, text)
    revalidatePath('/siralama')
    revalidatePath('/panel')
    const skipped = r.skipped ? ` ${r.skipped} satır okunamadığı için atlandı.` : ''
    await logPanel('growth', 'Çevrim verisi yüklendi', `Sponsor ${siteId}`, `${period} · ${r.rows} satır · ${r.matched} eşleşme`)
    return { ok: true, message: `${r.rows} satır yüklendi, ${r.matched} tanesi onaylı üyeyle eşleşti.${skipped}` }
  } catch (error) {
    return fail(error)
  }
}
