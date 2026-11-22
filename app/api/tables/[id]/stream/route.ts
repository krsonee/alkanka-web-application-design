import { pool } from '@/lib/db'
import { getMember } from '@/lib/member'
import { duelChannel, opponentOf } from '@/lib/pvp/duel-channel'
import { subscribeDuel } from '@/lib/pvp/duel-events'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Closed a little before the function limit; EventSource reconnects on its own within `retry` ms. */
const LIFETIME_MS = 270_000
const HEARTBEAT_MS = 15_000

/**
 * Push half of the duel relay: frames the rival sends via `POST link {action:'push'}` arrive here the moment
 * they are NOTIFY'd, instead of waiting for the next poll. The listening connection is shared by every duel on
 * this server instance (see duel-events); this stream holds no database connection of its own.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: room } = await params
  const m = await getMember()
  if (!m) return new Response('Giriş yapmalısın.', { status: 401 })
  if (!(await opponentOf(`${room}`, m.id))) return new Response('Bu masada rakibin yok.', { status: 404 })

  const key = `game:${room}`
  // The 'live' row tells the rival's relay calls to NOTIFY us instead of storing frames for a poll.
  const markLive = () =>
    pool.query(
      `WITH del AS (DELETE FROM voice_signals WHERE room = $1 AND to_id = $2 AND kind = 'live')
       INSERT INTO voice_signals (room, from_id, to_id, kind, payload) VALUES ($1, $2, $2, 'live', '{}'::jsonb)`,
      [key, m.id],
    )

  const enc = new TextEncoder()
  let close = () => {}
  let lost = false
  // Frames that arrive between LISTEN and the stream opening are kept and sent first.
  let pending: string[] | null = []
  let push = (chunk: string) => void pending?.push(chunk)

  let unsubscribe: (() => void) | null = null
  try {
    unsubscribe = await subscribeDuel(duelChannel(key, m.id), (event) => {
      if (event.kind === 'frame') return push(`data: ${event.payload}\n\n`)
      lost = true
      close()
    })
    await markLive()
  } catch {
    unsubscribe?.()
    return new Response('Bağlantı kurulamadı.', { status: 503 })
  }
  const leave = unsubscribe

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      let closed = false
      push = (chunk) => {
        if (closed) return
        try {
          ctrl.enqueue(enc.encode(chunk))
        } catch {
          close()
        }
      }
      const heartbeat = setInterval(() => {
        push(': hb\n\n')
        markLive().catch(() => close())
      }, HEARTBEAT_MS)
      const lifetime = setTimeout(() => close(), LIFETIME_MS)
      close = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        clearTimeout(lifetime)
        leave()
        pool.query(`DELETE FROM voice_signals WHERE room = $1 AND to_id = $2 AND kind = 'live'`, [key, m.id]).catch(() => {})
        try {
          ctrl.close()
        } catch {
          // Already closed by the client.
        }
      }
      req.signal.addEventListener('abort', () => close())
      push('retry: 400\n: open\n\n')
      const queued = pending ?? []
      pending = null
      for (const chunk of queued) push(chunk)
      if (lost) close()
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
