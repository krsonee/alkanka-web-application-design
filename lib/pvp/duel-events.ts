import 'server-only'

import { Client } from 'pg'

const KEEPALIVE_MS = 30_000
const IDLE_CLOSE_MS = 20_000
/** What duelChannel() produces. The name goes into LISTEN as an identifier, so nothing else is ever accepted. */
const CHANNEL = /^duel_[0-9a-f]{40}$/

/** A frame addressed to the listener; `lost` means the listening connection died and the stream must reopen. */
export type DuelEvent = { kind: 'frame'; payload: string } | { kind: 'lost' }
type Listener = (event: DuelEvent) => void

type Hub = {
  client: Client | null
  connecting: Promise<void> | null
  subs: Map<string, Set<Listener>>
  /** Channels the current connection has been told to LISTEN on. */
  listening: Set<string>
  /** The connection runs one statement at a time; LISTEN and UNLISTEN from many streams wait their turn here. */
  queue: Promise<void>
  keepalive: ReturnType<typeof setInterval> | null
  idle: ReturnType<typeof setTimeout> | null
}

// One listening connection per server instance carries every duel on it. Each player's stream used to open a
// direct database connection of its own and hold it for the whole match; direct connections are a small, fixed
// number, so a few hundred duels at once would have used them all and left the rest of the site unable to query.
const scope = globalThis as typeof globalThis & { __alkankaDuelHub?: Hub }
const hub: Hub = (scope.__alkankaDuelHub ??= {
  client: null,
  connecting: null,
  subs: new Map(),
  listening: new Set(),
  queue: Promise.resolve(),
  keepalive: null,
  idle: null,
})

function run(client: Client, text: string) {
  const result = hub.queue.then(() => client.query(text))
  hub.queue = result.then(
    () => {},
    () => {},
  )
  return result
}

function drop() {
  const client = hub.client
  hub.client = null
  hub.listening.clear()
  if (hub.keepalive) clearInterval(hub.keepalive)
  hub.keepalive = null
  client?.removeAllListeners()
  // A connection that is already broken can still emit: without a listener that would crash the instance.
  client?.on('error', () => {})
  client?.end().catch(() => {})
  for (const set of [...hub.subs.values()]) for (const fn of [...set]) fn({ kind: 'lost' })
}

async function connect() {
  // LISTEN needs a session, so it cannot go through the transaction pooler.
  const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL })
  client.on('error', drop)
  client.on('end', drop)
  client.on('notification', (n) => {
    const set = hub.subs.get(n.channel)
    if (set && n.payload) for (const fn of [...set]) fn({ kind: 'frame', payload: n.payload })
  })
  try {
    await client.connect()
  } catch (e) {
    client.removeAllListeners()
    client.on('error', () => {})
    client.end().catch(() => {})
    throw e
  }
  hub.client = client
  hub.queue = Promise.resolve()
  hub.keepalive = setInterval(() => void run(client, 'SELECT 1').catch(drop), KEEPALIVE_MS)
}

/**
 * Calls `fn` for every frame NOTIFY'd on `channel`. Rejects when no listener can be opened, in which case the
 * duel keeps running on its polling relay. The returned function unsubscribes.
 */
export async function subscribeDuel(channel: string, fn: Listener): Promise<() => void> {
  if (!CHANNEL.test(channel)) throw new Error('Geçersiz kanal')
  if (hub.idle) clearTimeout(hub.idle)
  hub.idle = null
  const set = hub.subs.get(channel) ?? new Set<Listener>()
  hub.subs.set(channel, set)
  set.add(fn)

  const unsubscribe = () => {
    if (!set.delete(fn)) return
    if (set.size === 0 && hub.subs.get(channel) === set) {
      hub.subs.delete(channel)
      if (hub.listening.delete(channel) && hub.client) run(hub.client, `UNLISTEN ${channel}`).catch(() => {})
    }
    if (hub.subs.size > 0 || hub.idle) return
    hub.idle = setTimeout(() => {
      hub.idle = null
      if (hub.subs.size === 0) drop()
    }, IDLE_CLOSE_MS)
  }

  try {
    if (!hub.client) {
      hub.connecting ??= connect().finally(() => {
        hub.connecting = null
      })
      await hub.connecting
    }
    const client = hub.client as Client | null
    if (!client) throw new Error('Bağlantı kurulamadı')
    if (!hub.listening.has(channel)) {
      hub.listening.add(channel)
      try {
        await run(client, `LISTEN ${channel}`)
      } catch (e) {
        if (hub.client === client) hub.listening.delete(channel)
        throw e
      }
    }
  } catch (e) {
    unsubscribe()
    throw e
  }
  return unsubscribe
}
