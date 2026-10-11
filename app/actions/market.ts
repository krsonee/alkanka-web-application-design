'use server'

import { revalidatePath } from 'next/cache'
import { getBalance, getMember } from '@/lib/member'
import { myRequests, requestProduct, type MarketRequest } from '@/lib/market'

type Result = { ok: true; balance: number; message: string } | { ok: false; error: string }

export async function requestMarketItem(itemId: string, siteUsername: string | null): Promise<Result> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Talep için giriş yapmalısın.' }
  try {
    const item = await requestProduct(member, String(itemId), siteUsername)
    revalidatePath('/market')
    revalidatePath('/panel')
    return {
      ok: true,
      balance: await getBalance(member.id),
      message: item.kind === 'sponsor'
        ? `Talebin alındı. Onaylandığında bonus ${item.sponsorName} hesabına eklenecek.`
        : 'Talebin alındı. Ekibimiz onayladığında hesabına tanımlanacak.',
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Talep oluşturulamadı.' }
  }
}

export async function getMyMarketRequests(): Promise<MarketRequest[]> {
  const member = await getMember()
  if (!member) return []
  return myRequests(member.id)
}
