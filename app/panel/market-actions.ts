'use server'

import { logPanel } from '@/lib/panel-log'
import { revalidatePath } from 'next/cache'
import { canPanel } from '@/lib/admin-auth'
import { deleteProduct, featureProduct, reorderProducts, resolveRequest, saveProduct, type ProductInput } from '@/lib/market'
import { deleteSale, saveSale, setSaleActive } from '@/lib/market-sales'
import type { SaleInput } from '@/lib/market-shared'

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

export async function saveMarketSaleAction(input: SaleInput) {
  return guard(async () => {
    await saveSale(input)
    await logPanel('market', input.id ? 'İndirim kampanyası güncellendi' : 'İndirim kampanyası eklendi', String(input.name).slice(0, 80), `%${Math.floor(Number(input.pct) || 0)}`)
    return 'Kampanya kaydedildi. Başlangıç saatinde kendiliğinden başlar, bitiş saatinde kendiliğinden biter.'
  })
}

export async function toggleMarketSaleAction(id: number, active: boolean) {
  return guard(async () => {
    await setSaleActive(Number(id), Boolean(active))
    await logPanel('market', active ? 'İndirim kampanyası açıldı' : 'İndirim kampanyası durduruldu', `Kampanya #${Number(id)}`)
    return active ? 'Kampanya açıldı.' : 'Kampanya durduruldu; fiyatlar normale döndü.'
  })
}

export async function deleteMarketSaleAction(id: number) {
  return guard(async () => {
    await deleteSale(Number(id))
    await logPanel('market', 'İndirim kampanyası silindi', `Kampanya #${Number(id)}`)
    return 'Kampanya silindi.'
  })
}

export async function resolveMarketRequestAction(id: number, approve: boolean, note: string) {
  return guard(async () => {
    await resolveRequest(id, approve, note)
    await logPanel('market', approve ? 'Market talebi onaylandı' : 'Market talebi reddedildi', `Talep #${id}`, note || null)
    return approve ? 'Talep onaylandı.' : 'Talep reddedildi, KC iade edildi.'
  })
}
