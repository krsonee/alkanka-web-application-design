import { getMember } from '@/lib/member'
import { subscribeTable } from '@/lib/pvp/table-events'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Closed a little before the function limit; EventSource reconnects on its own within `retry` ms. */
const LIFETIME_MS = 270_000
const HEARTBEAT_MS = 20_000
const TABLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Tells an open table the moment its row changes, so a rival's move shows up without waiting for the next poll.
 * It carries no game data: the client answers each event by fetching the table as it always does.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!TABLE_ID.test(id)) return new Response('Masa bulunamadı.', { status: 404 })
  if (!(await getMember())) return new Response('Giriş yapmalısın.', { status: 401 })

  const enc = new TextEncoder()
  let close = () => {}
  let pending: string[] | null = []
  let push = (chunk: string) => void pending?.push(chunk)

  let unsubscribe: () => void
  try {
    unsubscribe = await subscribeTable(id, (event) => (event.kind === 'change' ? push(`data: ${event.version}\n\n`) : close()))
  } catch {
    return new Response('Bağlantı kurulamadı.', { status: 503 })
  }

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
      const heartbeat = setInterval(() => push(': hb\n\n'), HEARTBEAT_MS)
      const lifetime = setTimeout(() => close(), LIFETIME_MS)
      close = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        clearTimeout(lifetime)
        unsubscribe()
        try {
          ctrl.close()
        } catch {
          // Already closed by the client.
        }
      }
      req.signal.addEventListener('abort', () => close())
      push('retry: 2000\n: open\n\n')
      const queued = pending ?? []
      pending = null
      for (const chunk of queued) push(chunk)
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
