'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel, isPanelOwner } from '@/lib/admin-auth'
import { parseAmount } from '@/lib/amount'
import { extractBrand } from '@/lib/brand-extract'
import { deleteAsset, deleteBrand, deleteJob, saveBrand } from '@/lib/studio'
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

export async function deleteJobAction(id: number): Promise<Result> {
  if (!(await canPanel('studio'))) return EXPIRED
  await deleteJob(id)
  revalidatePath('/panel')
  await logPanel('studio', 'Stüdyo üretim kaydı silindi', `Üretim #${id}`)
  return { ok: true }
}
