import { Client } from 'pg'
import { getMember } from '@/lib/member'
import { duelChannel, opponentOf } from '@/lib/pvp/duel-channel'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Closed a little before the function limit; EventSource reconnects on its own within `retry` ms. */
const LIFETIME_MS = 270_000
const HEARTBEAT_MS = 15_000

/**
 * Push half of the duel relay: frames the rival sends via `POST link {action:'push'}` arrive here the moment
 * they are NOTIFY'd, instead of waiting for the next poll. LISTEN needs a direct (unpooled) connection.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: room } = await params
  const m = await getMember()
  if (!m) return new Response('Giriş yapmalısın.', { status: 401 })
  if (!(await opponentOf(`${room}`, m.id))) return new Response('Bu masada rakibin yok.', { status: 404 })

  const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL })
  try {
    await client.connect()
    await client.query(`LISTEN ${duelChannel(`game:${room}`, m.id)}`)
  } catch {
    await client.end().catch(() => {})
    return new Response('Bağlantı kurulamadı.', { status: 503 })
  }

  const enc = new TextEncoder()
  let close = () => {}
  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      let closed = false
      const send = (chunk: string) => {
        if (closed) return
        try {
          ctrl.enqueue(enc.encode(chunk))
        } catch {
          close()
        }
      }
      const heartbeat = setInterval(() => send(': hb\n\n'), HEARTBEAT_MS)
      const lifetime = setTimeout(() => close(), LIFETIME_MS)
      close = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        clearTimeout(lifetime)
        client.end().catch(() => {})
        try {
          ctrl.close()
        } catch {
          // Already closed by the client.
        }
      }
      client.on('notification', (n) => {
        if (n.payload) send(`data: ${n.payload}\n\n`)
      })
      client.on('error', () => close())
      req.signal.addEventListener('abort', () => close())
      send('retry: 400\n: open\n\n')
    },
    cancel() {
      close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
