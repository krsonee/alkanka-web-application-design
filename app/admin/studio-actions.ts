'use server'

import { revalidatePath } from 'next/cache'
import { isAuthenticated } from '@/lib/admin-gate'
import { extractBrand } from '@/lib/brand-extract'
import { deleteAsset, deleteBrand, deleteJob, saveBrand } from '@/lib/studio'

type Result = { ok?: boolean; message?: string; brand?: { name: string; domain: string; logo: string; colors: string[]; font: string } }

const EXPIRED = { message: 'Oturum süresi doldu, tekrar giriş yap.' }

export async function extractBrandAction(domain: string): Promise<Result> {
  if (!(await isAuthenticated())) return EXPIRED
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
  if (!(await isAuthenticated())) return EXPIRED
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
  revalidatePath('/admin')
  return { ok: true, message: 'Marka kiti kaydedildi.' }
}

export async function deleteBrandAction(id: number): Promise<Result> {
  if (!(await isAuthenticated())) return EXPIRED
  await deleteBrand(id)
  revalidatePath('/admin')
  return { ok: true }
}

export async function deleteAssetAction(id: number): Promise<Result> {
  if (!(await isAuthenticated())) return EXPIRED
  await deleteAsset(id)
  revalidatePath('/admin')
  return { ok: true }
}

export async function deleteJobAction(id: number): Promise<Result> {
  if (!(await isAuthenticated())) return EXPIRED
  await deleteJob(id)
  revalidatePath('/admin')
  return { ok: true }
}
