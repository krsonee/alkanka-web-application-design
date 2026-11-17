'use server'

import { getBalance, getMember } from '@/lib/member'
import { eventBoard, eventOverview, joinEvent } from '@/lib/event-entries'
import type { EventBoard } from '@/lib/event-rules'
import { hitRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit'

export type EventOverview = { joined: string[]; counts: Record<string, number>; settled: string[] }

const EMPTY: EventOverview = { joined: [], counts: {}, settled: [] }

export async function getEventOverview(): Promise<EventOverview> {
  const member = await getMember()
  return eventOverview(member?.id ?? null).catch((error) => {
    console.error('[events] özet okunamadı', (error as Error).message)
    return EMPTY
  })
}

export async function getEventBoard(eventId: string): Promise<EventBoard | null> {
  if (typeof eventId !== 'string' || !eventId || eventId.length > 80) return null
  const member = await getMember()
  return eventBoard(eventId, member?.id ?? null).catch((error) => {
    console.error('[events] sıralama okunamadı', (error as Error).message)
    return null
  })
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
