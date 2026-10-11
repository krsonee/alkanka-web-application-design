'use server'

import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'
import { deleteProduct, resolveRequest, saveProduct, type ProductInput } from '@/lib/market'

type Result = { ok: true; message?: string } | { ok: false; error: string }

async function guard(fn: () => Promise<string | void>): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: 'Oturum süresi doldu, tekrar giriş yap.' }
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
    return 'Ürün kaydedildi.'
  })
}

export async function deleteMarketProductAction(id: string) {
  return guard(async () => {
    await deleteProduct(id)
    return 'Ürün silindi.'
  })
}

export async function resolveMarketRequestAction(id: number, approve: boolean, note: string) {
  return guard(async () => {
    await resolveRequest(id, approve, note)
    return approve ? 'Talep onaylandı.' : 'Talep reddedildi, KC iade edildi.'
  })
}
