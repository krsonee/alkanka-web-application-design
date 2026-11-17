'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel, isPanelOwner } from '@/lib/admin-auth'
import { parseAmount } from '@/lib/amount'
import { extractBrand } from '@/lib/brand-extract'
import { put } from '@vercel/blob'
import { getContent, setContent } from '@/lib/content'
import { CUSTOM_SLIDES_KEY, MAX_CUSTOM_SLIDES, readCustomSlides } from '@/lib/custom-slides'
import { HIDDEN_KEY, readHidden } from '@/lib/hidden-shared'
import { deleteAsset, deleteBrand, deleteJob, getJob, readFile, saveBrand } from '@/lib/studio'
import { saveStudioCap } from '@/lib/studio-budget'
import { STUDIO_CAP_RANGE, usd } from '@/lib/studio-types'

type Result = { ok?: boolean; message?: string; brand?: { name: string; domain: string; logo: string; colors: string[]; font: string } }

const EXPIRED = { message: 'Oturum süresi doldu, tekrar giriş yap.' }

export async function extractBrandAction(domain: string): Promise<Result> {
  if (!(await canPanel('studio'))) return EXPIRED
  try {
    const b = await extractBrand(domain)
    return { ok: true, brand: b, message: b.warnings.join(' ') || 'Marka bilgileri siteden çekildi.' }
  } catch (error) {
    console.error('Brand extract failed:', error)
    return { message: 'Siteye ulaşılamadı (koruma/engel olabilir). Bilgileri elle girebilirsin.' }
  }
}

export async function saveBrandAction(input: {
  id: number | null
  name: string
  domain: string
  logo: string
  mascot: string
  colors: string[]
  font: string
  notes: string
}): Promise<Result> {
  if (!(await canPanel('studio'))) return EXPIRED
  const name = input.name.trim().slice(0, 60)
  if (!name) return { message: 'Marka adı gerekli.' }
  if (input.logo && !/^studio\/logos\/[a-z0-9._-]+$/i.test(input.logo)) return { message: 'Geçersiz logo.' }
  if (input.mascot && !/^studio\/mascots\/[a-z0-9._-]+$/i.test(input.mascot)) return { message: 'Geçersiz maskot.' }
  await saveBrand({
    id: input.id,
    name,
    domain: input.domain.trim().toLowerCase().slice(0, 120),
    logo: input.logo,
    mascot: input.mascot,
    colors: input.colors.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 6),
    font: input.font.trim().slice(0, 60),
    notes: input.notes.trim().slice(0, 600),
  })
  revalidatePath('/panel')
  await logPanel('studio', 'Marka kiti kaydedildi', input.name)
  return { ok: true, message: 'Marka kiti kaydedildi.' }
}

export async function saveStudioCapAction(raw: string): Promise<Result> {
  if (!(await isPanelOwner())) return { message: 'Aylık tavanı sadece ana yönetici değiştirebilir.' }
  const text = String(raw).trim()
  if (!text) {
    await saveStudioCap(null)
    revalidatePath('/panel')
    await logPanel('studio', 'Stüdyo aylık tavanı kaldırıldı')
    return { ok: true, message: 'Aylık tavan kaldırıldı.' }
  }
  const cap = parseAmount(text)
  const [min, max] = STUDIO_CAP_RANGE
  if (cap == null || cap < min || cap > max) return { message: `Tavan ${min} ile ${max} dolar arasında bir tutar olmalı.` }
  await saveStudioCap(cap)
  revalidatePath('/panel')
  await logPanel('studio', 'Stüdyo aylık tavanı değişti', null, usd(cap))
  return { ok: true, message: `Aylık tavan ${usd(cap)} olarak kaydedildi.` }
}

export async function deleteBrandAction(id: number): Promise<Result> {
  if (!(await canPanel('studio'))) return EXPIRED
  await deleteBrand(id)
  revalidatePath('/panel')
  await logPanel('studio', 'Marka kiti silindi', `Marka #${id}`)
  return { ok: true }
}

export async function deleteAssetAction(id: number): Promise<Result> {
  if (!(await canPanel('studio'))) return EXPIRED
  await deleteAsset(id)
  revalidatePath('/panel')
  await logPanel('studio', 'Stüdyo görseli silindi', `Görsel #${id}`)
  return { ok: true }
}

const SLIDE_IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }

/**
 * Copies a Studio banner into the public image store and adds it to the slider as a hidden slide,
 * so nothing reaches the home page until someone has written its title and link.
 */
export async function studioToSlideAction(id: number): Promise<Result> {
  if (!(await canPanel('studio'))) return EXPIRED
  if (!(await canPanel('slide'))) return { message: 'Slider bölümünü açma yetkin yok; görseli indirip Slider yetkisi olan birine ver.' }
  try {
    const job = Number.isSafeInteger(id) ? await getJob(id) : null
    if (!job) return { message: 'Üretim bulunamadı. Sayfayı yenileyip tekrar dene.' }
    if (job.kind !== 'banner') return { message: 'Slider\'a sadece banner görselleri eklenebilir.' }
    const ext = job.pathname.split('.').pop()?.toLowerCase() ?? ''
    const contentType = SLIDE_IMAGE_TYPES[ext]
    if (!contentType) return { message: 'Bu dosya türü slider\'da kullanılamıyor.' }
    const list = readCustomSlides(await getContent(CUSTOM_SLIDES_KEY))
    if (list.length >= MAX_CUSTOM_SLIDES) return { message: `En fazla ${MAX_CUSTOM_SLIDES} yeni slayt eklenebilir. Önce kullanılmayan bir slaytı sil.` }

    const data = await readFile(job.pathname)
    const blob = await put(`logos/slide-studio.${ext}`, data, { access: 'private', addRandomSuffix: true, contentType })
    const slideId = `c-${Date.now().toString(36)}`
    const title = job.texts?.headline || 'Başlığı buraya yaz'
    await setContent(CUSTOM_SLIDES_KEY, [
      ...list,
      {
        id: slideId,
        eyebrow: job.brandName || 'Yeni slayt',
        title,
        description: job.texts?.subline ?? '',
        cta: job.texts?.cta || 'İncele',
        href: '/',
        image: `/api/logo/${blob.pathname.slice('logos/'.length)}`,
      },
    ])
    const hidden = readHidden(await getContent(HIDDEN_KEY))
    await setContent(HIDDEN_KEY, { ...hidden, slide: [...new Set([...(hidden.slide ?? []), slideId])] })
    revalidatePath('/')
    revalidatePath('/panel')
    await logPanel('slide', 'Stüdyo görseli slider\'a eklendi', title, `Üretim #${id}, gizli olarak eklendi`)
    return { ok: true, message: 'Slayt gizli olarak eklendi. Slider bölümünde başlığını ve linkini düzenle, sonra "Göster" ile yayına al.' }
  } catch (error) {
    console.error('[studio] slider\'a eklenemedi', error)
    return { message: 'Görsel slider\'a eklenemedi. Biraz sonra tekrar dene.' }
  }
}

export async function deleteJobAction(id: number): Promise<Result> {
  if (!(await canPanel('studio'))) return EXPIRED
  await deleteJob(id)
  revalidatePath('/panel')
  await logPanel('studio', 'Stüdyo üretim kaydı silindi', `Üretim #${id}`)
  return { ok: true }
}
