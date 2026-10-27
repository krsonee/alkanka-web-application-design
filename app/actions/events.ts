'use server'

import { getBalance, getMember } from '@/lib/member'
import { joinEvent, joinedEventIds } from '@/lib/event-entries'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

export async function myEventEntries(): Promise<string[]> {
  const member = await getMember()
  if (!member) return []
  return joinedEventIds(member.id).catch(() => [])
}

export async function joinEventAction(eventId: string): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const member = await getMember()
  if (!member) return { ok: false, error: 'Giriş yapmalısın.' }
  if (typeof eventId !== 'string' || !eventId || eventId.length > 80) return { ok: false, error: 'Geçersiz etkinlik.' }
  if (await hitRateLimit(`event-join:${member.id}`, 10, 60)) return { ok: false, error: RATE_LIMIT_MESSAGE }
  try {
    await joinEvent(member.id, member.name, eventId)
    return { ok: true, balance: await getBalance(member.id) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Katılım yapılamadı.' }
  }
}
