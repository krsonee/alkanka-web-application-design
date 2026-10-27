import 'server-only'
import { rows, sql } from '@/lib/db'

let ready: Promise<void> | null = null

function ensure() {
  ready ??= (async () => {
    await rows(sql`CREATE TABLE IF NOT EXISTS event_entries (
      user_id text NOT NULL,
      event_id text NOT NULL,
      paid int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, event_id)
    )`)
  })().catch((e) => {
    ready = null
    throw e
  })
  return ready
}

export async function joinedEventIds(userId: string): Promise<string[]> {
  await ensure()
  const r = await rows<{ event_id: string }>(sql`SELECT event_id FROM event_entries WHERE user_id = ${userId}`)
  return r.map((x) => x.event_id)
}

export async function joinEvent(userId: string, userName: string, eventId: string) {
  const { withUserLock } = await import('@/lib/user-lock')
  return withUserLock(`event:${userId}`, async () => {
    await ensure()
    const { getCatalog } = await import('@/lib/catalog')
    const event = (await getCatalog()).events.find((e) => e.id === eventId)
    if (!event) throw new Error('Etkinlik bulunamadı.')
    const [existing] = await rows<{ event_id: string }>(
      sql`SELECT event_id FROM event_entries WHERE user_id = ${userId} AND event_id = ${eventId}`,
    )
    if (existing) throw new Error('Bu etkinliğe zaten katıldın.')

    const { debit, credit, recordHistory } = await import('@/lib/member')
    const price = Math.max(0, Math.floor(Number(event.entry) || 0))
    if (price > 0 && !(await debit(userId, price))) throw new Error('Kanka Coin bakiyen yetersiz.')

    const inserted = await rows<{ event_id: string }>(sql`INSERT INTO event_entries (user_id, event_id, paid)
      VALUES (${userId}, ${eventId}, ${price}) ON CONFLICT DO NOTHING RETURNING event_id`)
    if (!inserted.length) {
      if (price > 0) await credit(userId, price)
      throw new Error('Bu etkinliğe zaten katıldın.')
    }
    if (price > 0) {
      await recordHistory({ userId, userName, game: 'etkinlik', mode: 'harcama', opponent: event.title, stake: price, result: 'loss', delta: -price }).catch(() => {})
    }
  })
}
