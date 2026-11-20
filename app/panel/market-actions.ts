'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { deleteProduct, featureProduct, reorderProducts, resolveRequest, saveProduct, type ProductInput } from '@/lib/market'

type Result = { ok: true; message?: string } | { ok: false; error: string }

async function guard(fn: () => Promise<string | void>): Promise<Result> {
  if (!(await canPanel('market'))) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
  try {
    const message = await fn()
    revalidatePath('/panel')
    revalidatePath('/market')
    return { ok: true, message: message || undefined }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'İşlem başarısız.' }
  }
}

export async function saveMarketProductAction(input: ProductInput) {
  return guard(async () => {
    await saveProduct(input)
    await logPanel('market', input.id ? 'Ürün güncellendi' : 'Ürün eklendi', input.name)
    return 'Ürün kaydedildi.'
  })
}

export async function deleteMarketProductAction(id: string) {
  return guard(async () => {
    await deleteProduct(id)
    await logPanel('market', 'Ürün silindi', id)
    return 'Ürün silindi.'
  })
}

export async function reorderMarketProductsAction(ids: string[]) {
  return guard(async () => {
    if (!Array.isArray(ids)) throw new Error('Sıra okunamadı.')
    await reorderProducts(ids.map(String))
    await logPanel('market', 'Ürün sırası değişti', `${ids.length} ürün`)
    return 'Sıra kaydedildi.'
  })
}

export async function featureMarketProductAction(id: string, featured: boolean) {
  return guard(async () => {
    await featureProduct(String(id), Boolean(featured))
    await logPanel('market', featured ? 'Ürün öne çıkarıldı' : 'Ürün öne çıkanlardan alındı', String(id))
    return featured ? 'Ürün market sayfasının üstünde gösterilecek.' : 'Ürün öne çıkanlardan alındı.'
  })
}

export async function resolveMarketRequestAction(id: number, approve: boolean, note: string) {
  return guard(async () => {
    await resolveRequest(id, approve, note)
    await logPanel('market', approve ? 'Market talebi onaylandı' : 'Market talebi reddedildi', `Talep #${id}`, note || null)
    return approve ? 'Talep onaylandı.' : 'Talep reddedildi, KC iade edildi.'
  })
}
