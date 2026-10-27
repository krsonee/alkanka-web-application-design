'use server'

import { revalidatePath } from 'next/cache'
import { getBalance, getMember } from '@/lib/member'
import { buyShield, claimBestBonus, setBirthday } from '@/lib/boosts'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

type Result<T> = ({ ok: true } & T) | { ok: false; error: string }

const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'İşlem yapılamadı.' })

export async function buyShieldAction(): Promise<Result<{ count: number; balance: number }>> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  if (await hitRateLimit(`shield:${member.id}`, 5, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  try {
    const count = await buyShield(member.id)
    revalidatePath('/gorevler')
    return { ok: true, count, balance: await getBalance(member.id) }
  } catch (e) {
    return fail(e)
  }
}

export async function setBirthdayAction(date: string): Promise<Result<{ date: string }>> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  if (await hitRateLimit(`birthday:${member.id}`, 5, 300)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  try {
    await setBirthday(member.id, String(date).slice(0, 10))
    revalidatePath('/gorevler')
    return { ok: true, date }
  } catch (e) {
    return fail(e)
  }
}

export async function claimBestBonusAction(): Promise<Result<{ kp: number }>> {
  const member = await getMember()
  if (!member) return { ok: true, kp: 0 }
  if (await hitRateLimit(`vitrin:${member.id}`, 10, 60)) return { ok: true, kp: 0 }
  try {
    return { ok: true, ...(await claimBestBonus(member.id)) }
  } catch (e) {
    return fail(e)
  }
}
