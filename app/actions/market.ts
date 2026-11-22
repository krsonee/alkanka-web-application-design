'use server'

import { revalidatePath } from 'next/cache'
import { getBalance, getMember } from '@/lib/member'
import { doneDealTasks, linkedSponsorAccounts, myRequests, requestProduct, type Delivered, type LinkedSponsorAccount, type MarketRequest } from '@/lib/market'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

type Result = { ok: true; balance: number; message: string; delivered: boolean } | { ok: false; error: string }

const PLAY_NAMES = { cark: 'çark', zar: 'zar', sandik: 'sandık' }

function deliveredMessage(delivered: Delivered) {
  if (delivered?.kind === 'plays') {
    const name = PLAY_NAMES[delivered.game]
    return `+${delivered.amount} ${name} hakkı hesabına eklendi. Şu an ${delivered.total} ekstra ${name} hakkın var, hemen kullanabilirsin.`
  }
  if (delivered?.kind === 'shield') return `Seri kalkanı hesabına eklendi. Toplam ${delivered.total} kalkanın var.`
  if (delivered?.kind === 'kc') return `+${delivered.amount.toLocaleString('tr-TR')} KC bakiyene eklendi.`
  if (delivered?.kind === 'kp') return `+${delivered.amount.toLocaleString('tr-TR')} Kanka Puan hesabına eklendi.`
  if (delivered?.kind === 'badge') return `${delivered.name} rozeti profiline takıldı.`
  return 'Talebin alındı. Ekibimiz onayladığında hesabına tanımlanacak.'
}

export async function requestMarketItem(itemId: string, siteUsername: string | null, shownPrice?: number): Promise<Result> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Talep için giriş yapmalısın.' }
  if (await hitRateLimit(`market:${member.id}`, 5, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  try {
    const expected = typeof shownPrice === 'number' && Number.isFinite(shownPrice) ? shownPrice : null
    const item = await requestProduct(member, String(itemId), siteUsername, expected)
    revalidatePath('/market')
    revalidatePath('/panel')
    return {
      ok: true,
      balance: await getBalance(member.id),
      delivered: Boolean(item.delivered),
      message: item.kind === 'sponsor'
        ? `Talebin alındı. Onaylandığında bonus ${item.sponsorName} hesabına eklenecek.`
        : deliveredMessage(item.delivered),
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Talep oluşturulamadı.' }
  }
}

/** The tasks tied to a product price that this member has finished. */
export async function getMyMarketDeals(): Promise<number[]> {
  const member = await getMember()
  if (!member) return []
  return doneDealTasks(member.id).catch(() => [])
}

/** The member's linked sponsor accounts by sponsor slug; a sponsor reward is sent to these, not to a typed name. */
export async function getMyMarketAccounts(): Promise<Record<string, LinkedSponsorAccount>> {
  const member = await getMember()
  if (!member) return {}
  return linkedSponsorAccounts(member.id).catch(() => ({}))
}

export async function getMyMarketRequests(): Promise<MarketRequest[]> {
  const member = await getMember()
  if (!member) return []
  return myRequests(member.id)
}
