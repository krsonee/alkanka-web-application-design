import { claimUpdate, dispatchUpdate, verifyHook, type HubUpdate } from '@/lib/tg-hub'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request, { params }: { params: Promise<{ botId: string }> }) {
  const botId = Number((await params).botId)
  if (!Number.isInteger(botId) || botId <= 0) return new Response('not found', { status: 404 })
  const authorized = await verifyHook(botId, request.headers.get('x-telegram-bot-api-secret-token')).catch((error) => {
    console.error('[tg-hook] secret check failed', error)
    return false
  })
  if (!authorized) return new Response('unauthorized', { status: 401 })
  try {
    const update = (await request.json()) as HubUpdate
    // If the repeat check itself fails, handling the update beats dropping it.
    const fresh = await claimUpdate(botId, update.update_id).catch(() => true)
    if (fresh) await dispatchUpdate(botId, update)
  } catch (error) {
    // Returning 200 keeps Telegram from retrying a broken update forever.
    console.error('[tg-hook]', error)
  }
  return Response.json({ ok: true })
}
