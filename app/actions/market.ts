'use server'

import { revalidatePath } from 'next/cache'
import { getBalance, getMember } from '@/lib/member'
import { myRequests, requestProduct, type MarketRequest } from '@/lib/market'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

type Result = { ok: true; balance: number; message: string } | { ok: false; error: string }

export async function requestMarketItem(itemId: string, siteUsername: string | null): Promise<Result> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Talep için giriş yapmalısın.' }
  if (await hitRateLimit(`market:${member.id}`, 5, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
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
