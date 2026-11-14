import 'server-only'

import { Client } from 'pg'
import { pool } from '@/lib/db'

const CHANNEL = 'table_events'
/** Above this many open database connections no listener is opened; tables keep working on polling alone. */
const BUSY_CONNECTIONS = 70
const KEEPALIVE_MS = 30_000
const IDLE_CLOSE_MS = 20_000

export type TableEvent = 'change' | 'lost'
type Listener = (event: TableEvent) => void

type Hub = {
  client: Client | null
  connecting: Promise<void> | null
  subs: Map<string, Set<Listener>>
  keepalive: ReturnType<typeof setInterval> | null
  idle: ReturnType<typeof setTimeout> | null
}

// One listening connection per server instance, shared by every open table stream on it.
const scope = globalThis as typeof globalThis & { __alkankaTableHub?: Hub }
const hub: Hub = (scope.__alkankaTableHub ??= { client: null, connecting: null, subs: new Map(), keepalive: null, idle: null })

/** Tells every open stream of this table that its row changed. Never throws: polling still catches the change. */
export async function notifyTable(id: string) {
  await pool.query('SELECT pg_notify($1, $2)', [CHANNEL, id]).catch(() => {})
}

function drop() {
  const client = hub.client
  hub.client = null
  if (hub.keepalive) clearInterval(hub.keepalive)
  hub.keepalive = null
  client?.removeAllListeners()
  client?.end().catch(() => {})
  for (const set of hub.subs.values()) for (const fn of [...set]) fn('lost')
}

async function connect() {
  const busy = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM pg_stat_activity')
  if ((busy.rows[0]?.n ?? 0) > BUSY_CONNECTIONS) throw new Error('Veritabanı yoğun')
  // LISTEN needs a session, so it cannot go through the transaction pooler.
  const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL })
  client.on('error', drop)
  client.on('end', drop)
  client.on('notification', (n) => {
    const set = n.payload ? hub.subs.get(n.payload) : null
    if (set) for (const fn of [...set]) fn('change')
  })
  try {
    await client.connect()
    await client.query(`LISTEN ${CHANNEL}`)
  } catch (e) {
    client.removeAllListeners()
    client.end().catch(() => {})
    throw e
  }
  hub.client = client
  hub.keepalive = setInterval(() => void client.query('SELECT 1').catch(drop), KEEPALIVE_MS)
}

/** Calls `fn` whenever the table changes. Rejects when no listener can be opened; the returned function unsubscribes. */
export async function subscribeTable(id: string, fn: Listener): Promise<() => void> {
  if (hub.idle) clearTimeout(hub.idle)
  hub.idle = null
  const set = hub.subs.get(id) ?? new Set<Listener>()
  hub.subs.set(id, set)
  set.add(fn)

  const unsubscribe = () => {
    set.delete(fn)
    if (set.size === 0 && hub.subs.get(id) === set) hub.subs.delete(id)
    if (hub.subs.size > 0 || hub.idle) return
    hub.idle = setTimeout(() => {
      hub.idle = null
      if (hub.subs.size === 0) drop()
    }, IDLE_CLOSE_MS)
  }

  if (!hub.client) {
    hub.connecting ??= connect().finally(() => {
      hub.connecting = null
    })
    try {
      await hub.connecting
    } catch (e) {
      unsubscribe()
      throw e
    }
  }
  return unsubscribe
}
