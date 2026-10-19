'use server'

import { randomUUID } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { getMember } from '@/lib/member'
import { hashNetwork } from '@/lib/growth'
import { claimTourReward, getTourState, markTourSeen, type TourClaim, type TourState } from '@/lib/tour'

const DEVICE_COOKIE = 'alk_tdev'

async function requestContext() {
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? h.get('x-real-ip'))?.split(',')[0]?.trim() || null
  const store = await cookies()
  let deviceId = store.get(DEVICE_COOKIE)?.value ?? null
  if (!deviceId || !/^[a-f0-9-]{36}$/.test(deviceId)) {
    deviceId = randomUUID()
    store.set(DEVICE_COOKIE, deviceId, { maxAge: 60 * 60 * 24 * 730, path: '/', sameSite: 'lax', secure: true, httpOnly: true })
  }
  return { ipHash: hashNetwork(ip), deviceId }
}

export async function getMyTourState(): Promise<TourState | null> {
  const member = await getMember()
  if (!member) return null
  return getTourState(member.id).catch(() => ({ done: false, rewarded: false }))
}

export async function markTourSeenAction(): Promise<void> {
  const member = await getMember()
  if (!member) return
  const { ipHash, deviceId } = await requestContext()
  await markTourSeen(member.id, ipHash, deviceId).catch((error) => console.error('[tour] kaydedilemedi', error))
}

export async function completeTourAction(): Promise<TourClaim | { status: 'guest' | 'error'; message?: string }> {
  const member = await getMember()
  if (!member) return { status: 'guest' }
  const { hitRateLimit } = await import('@/lib/rate-limit')
  if (await hitRateLimit(`tour:${member.id}`, 5, 60)) return { status: 'error', message: 'Çok hızlı denedin, biraz bekle.' }
  try {
    const { ipHash, deviceId } = await requestContext()
    return await claimTourReward(member, ipHash, deviceId)
  } catch (error) {
    console.error('[tour] ödül verilemedi', error)
    return { status: 'error', message: 'Ödül şu an verilemedi, tekrar dene.' }
  }
}
